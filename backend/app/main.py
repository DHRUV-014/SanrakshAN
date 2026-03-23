import os
import uuid
import time
import traceback
from typing import Optional

import cv2
import numpy as np

from fastapi import FastAPI, UploadFile, File, Depends, BackgroundTasks, HTTPException, Query, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.firebase_auth import (
    FIREBASE_KEY_PATH,
    analyze_endpoint_user,
    firebase_auth,
    firestore_db,
)
from app.tasks import run_analysis_task
from uploads.services.services import analyze_media
from utils.explain import generate_heatmap
from utils.face_engine import FaceEngine

# ✅ HISTORY ROUTE
from app.routes import history

# ✅ NEW: Challenge pipeline
from uploads.services.challenge_pipeline import ChallengeSession
from uploads.services.monitor_service import VideoCallMonitor

app = FastAPI()

# --------------------------------------------------
# CORS
# --------------------------------------------------
# CORS: Starlette returns 400 "Disallowed CORS ..." on failed preflight (OPTIONS).
# Regex covers localhost / 127.0.0.1 / ::1 with any port (Vite, preview, etc.).
_LOCAL_DEV_ORIGIN_REGEX = r"^https?://(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$"

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
    allow_origin_regex=_LOCAL_DEV_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------------------------------------
# STATIC FILES
# --------------------------------------------------
os.makedirs("faces", exist_ok=True)
os.makedirs("heatmaps", exist_ok=True)

app.mount("/faces", StaticFiles(directory="faces"), name="faces")
app.mount("/heatmaps", StaticFiles(directory="heatmaps"), name="heatmaps")

# --------------------------------------------------
# REGISTER ROUTES
# --------------------------------------------------
app.include_router(history.router)

# --------------------------------------------------
# UPLOADS
# --------------------------------------------------
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# --------------------------------------------------
# ACTIVE CHALLENGE SESSIONS STORAGE
# --------------------------------------------------
challenge_sessions = {}

# --------------------------------------------------
# CREATOR VERIFICATION SESSIONS STORAGE
# --------------------------------------------------
verification_sessions = {}

# --------------------------------------------------
# VIDEO CALL MONITOR INSTANCES (per client)
# --------------------------------------------------
video_monitors = {}


def _want_public_sync_analyze(
    x_public_demo: Optional[str],
    user: Optional[dict],
) -> bool:
    """Landing sends X-Public-Demo; prod anonymous sends no Bearer (user is None)."""
    if (x_public_demo or "").strip().lower() in ("1", "true", "yes"):
        return True
    if os.path.exists(FIREBASE_KEY_PATH) and user is None:
        return True
    return False


def _run_public_sync_analysis(file_path: str, job_id: str) -> dict:
    """
    Same ML path as run_analysis_task (analyze_media + optional heatmap), without Firestore.
    Does not modify ML logic inside analyze_media.
    """
    is_video = file_path.lower().endswith((".mp4", ".avi", ".mov", ".mkv"))
    result = analyze_media(file_path=file_path, is_video=is_video)

    heatmap_url = None

    if (
        not is_video
        and result.get("label") != "NO_FACE"
        and result.get("metadata", {}).get("explainable", False)
    ):
        engine = FaceEngine()
        with open(file_path, "rb") as f:
            faces = engine.process_image(f.read())

        if faces:
            primary = faces[0]
            os.makedirs("heatmaps", exist_ok=True)
            heatmap_path = f"heatmaps/{job_id}_heatmap.jpg"
            heatmap = generate_heatmap(primary["model"])
            cv2.imwrite(heatmap_path, heatmap)
            heatmap_url = f"/{heatmap_path.replace(os.sep, '/')}"

    score = float(result.get("fake_probability") or result.get("score", 0.0))

    out = {
        "job_id": job_id,
        "status": "completed",
        "label": result["label"],
        "score": score,
        "heatmap_url": heatmap_url,
        "faces_detected": result.get("faces_detected", 0),
        "confidence": result.get("confidence"),
        "metadata": result.get("metadata", {}),
    }
    print(f"/analyze sync result: label={out['label']} score={out['score']}")
    return out


# --------------------------------------------------
# POST /challenge/start
# --------------------------------------------------
@app.post("/challenge/start")
def start_challenge():
    session_id = uuid.uuid4().hex
    challenge_sessions[session_id] = ChallengeSession()
    return {"session_id": session_id}

# --------------------------------------------------
# POST /challenge/frame/{session_id}
# --------------------------------------------------
@app.post("/challenge/frame/{session_id}")
async def upload_challenge_frame(
    session_id: str,
    file: UploadFile = File(...),
):
    if session_id not in challenge_sessions:
        raise HTTPException(status_code=404, detail="Invalid session")

    contents = await file.read()
    np_img = np.frombuffer(contents, np.uint8)
    frame = cv2.imdecode(np_img, cv2.IMREAD_COLOR)

    challenge_sessions[session_id].add_frame(frame)

    return {"status": "frame added"}

# --------------------------------------------------
# GET /challenge/analyze/{session_id}
# --------------------------------------------------
@app.get("/challenge/analyze/{session_id}")
def analyze_challenge(session_id: str):
    if session_id not in challenge_sessions:
        raise HTTPException(status_code=404, detail="Invalid session")

    result = challenge_sessions[session_id].analyze_reflectance()

    # Optional: cleanup session
    del challenge_sessions[session_id]

    return result

# --------------------------------------------------
# POST /analyze
# - Bearer token (dashboard): async job + Firestore (unchanged contract).
# - No Bearer (landing demo): synchronous ML analysis + temp file removed after.
# --------------------------------------------------
@app.post("/analyze")
async def analyze(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user: Optional[dict] = Depends(analyze_endpoint_user),
    x_public_demo: Optional[str] = Header(default=None, alias="X-Public-Demo"),
):
    if file is None:
        raise HTTPException(status_code=400, detail="File is required")

    print("File received:", file.filename)

    job_id = uuid.uuid4().hex
    safe_name = os.path.basename(file.filename or "upload")
    file_path = os.path.join(UPLOAD_DIR, f"{job_id}_{safe_name}")

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty file")

    with open(file_path, "wb") as buffer:
        buffer.write(contents)
    print("Saved upload to:", os.path.abspath(file_path), "bytes:", len(contents))

    public_sync = _want_public_sync_analyze(x_public_demo, user)

    # Authenticated: existing async pipeline (dashboard / signed-in clients)
    if not public_sync and user is not None:
        firestore_db.collection("jobs").document(job_id).set({
            "status": "PENDING",
            "user_id": user["uid"],
        })

        background_tasks.add_task(
            run_analysis_task,
            job_id=job_id,
            file_path=file_path,
            user_id=user["uid"],
        )

        out = {
            "job_id": job_id,
            "status": "PENDING",
        }
        print("Final /analyze response (async):", out)
        return out

    # Public landing demo: run ML immediately, then delete temp upload
    try:
        payload = _run_public_sync_analysis(file_path, job_id)
        print("Final /analyze response (sync):", payload)
        return payload
    except Exception as e:
        print("❌ PUBLIC /analyze FAILED")
        print(traceback.format_exc())
        err_body = {"status": "error", "message": str(e)}
        print("Returning error JSON:", err_body)
        return JSONResponse(status_code=200, content=err_body)
    finally:
        try:
            if os.path.isfile(file_path):
                os.remove(file_path)
        except OSError:
            pass

# --------------------------------------------------
# GET /status/{job_id}  (UNCHANGED)
# --------------------------------------------------
@app.get("/status/{job_id}")
def get_status(job_id: str, user=Depends(firebase_auth)):
    doc = firestore_db.collection("jobs").document(job_id).get()

    if not doc.exists:
        raise HTTPException(status_code=404, detail="Job not found")

    return doc.to_dict()

# ==================================================
# FEATURE 1: CREATOR VERIFICATION
# ==================================================

# --------------------------------------------------
# POST /verify/creator/start
# --------------------------------------------------
@app.post("/verify/creator/start")
def start_creator_verification():
    """Initialize a new creator verification session."""
    session_id = uuid.uuid4().hex
    verification_sessions[session_id] = ChallengeSession()
    return {"session_id": session_id}

# --------------------------------------------------
# POST /verify/creator/frame/{session_id}
# --------------------------------------------------
@app.post("/verify/creator/frame/{session_id}")
async def upload_verification_frame(
    session_id: str,
    file: UploadFile = File(...),
):
    """Add a frame to the creator verification session."""
    if session_id not in verification_sessions:
        raise HTTPException(status_code=404, detail="Invalid session")

    contents = await file.read()
    np_img = np.frombuffer(contents, np.uint8)
    frame = cv2.imdecode(np_img, cv2.IMREAD_COLOR)

    verification_sessions[session_id].add_frame(frame)

    return {"status": "frame added"}

# --------------------------------------------------
# GET /verify/creator/result/{session_id}
# --------------------------------------------------
@app.get("/verify/creator/result/{session_id}")
def get_verification_result(session_id: str):
    """Get creator verification result with creator_verified flag."""
    if session_id not in verification_sessions:
        raise HTTPException(status_code=404, detail="Invalid session")

    result = verification_sessions[session_id].analyze_reflectance()

    # Add creator_verified field
    if "error" in result:
        result["creator_verified"] = False
    else:
        result["creator_verified"] = result.get("verdict") == "Live Person"

    # Cleanup session
    del verification_sessions[session_id]

    return result

# ==================================================
# FEATURE 2: VIDEO CALL DEEPFAKE MONITORING
# ==================================================

# --------------------------------------------------
# POST /monitor/frame
# --------------------------------------------------
@app.post("/monitor/frame")
async def monitor_video_frame(
    file: UploadFile = File(...),
    client_id: str = Query(default="default", description="Client identifier for session tracking"),
):
    """
    Analyze a single video call frame for deepfake detection.
    Uses rolling window smoothing for stability.
    """
    # Use client_id if provided, otherwise generate a session-based ID
    # For simplicity, we'll use a default client_id if not provided
    if client_id is None:
        client_id = "default"

    # Initialize monitor if not exists
    if client_id not in video_monitors:
        video_monitors[client_id] = VideoCallMonitor(window_size=5)

    # Decode frame
    contents = await file.read()
    np_img = np.frombuffer(contents, np.uint8)
    frame = cv2.imdecode(np_img, cv2.IMREAD_COLOR)

    if frame is None:
        raise HTTPException(status_code=400, detail="Invalid image data")

    # Analyze frame
    result = video_monitors[client_id].analyze_frame(frame)

    return result