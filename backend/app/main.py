import logging
import os
import uuid
import time
import traceback
from typing import Optional

logger = logging.getLogger(__name__)

import cv2
import numpy as np

from fastapi import FastAPI, UploadFile, File, Depends, BackgroundTasks, HTTPException, Query, Header, Request
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
from uploads.services.audio_service import analyze_audio, extract_audio_from_video, _is_video
from uploads.services.video_service import analyze_video
from utils.explain import generate_heatmap, explain_audio, tts_explanation, generate_video_heatmap
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
# Also allow Chrome / Firefox extension origins for real-time call monitoring
_LOCAL_DEV_ORIGIN_REGEX = (
    r"^(https?://(localhost|127\.0\.0\.1|\[::1\])(:\d+)?"
    r"|chrome-extension://[a-z]{32}"
    r"|moz-extension://[\w-]+)$"
)

_FRONTEND_URL = os.environ.get("FRONTEND_URL", "")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        *([_FRONTEND_URL] if _FRONTEND_URL else []),
    ],
    allow_origin_regex=(
        r"^(https?://(localhost|127\.0\.0\.1|\[::1\])(:\d+)?"
        r"|chrome-extension://[a-z]{32}"
        r"|moz-extension://[\w-]+"
        r"|https://[\w-]+\.vercel\.app"
        r"|https://[\w-]+\.netlify\.app)$"
    ),
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

    if not is_video and result.get("label") != "NO_FACE":
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
    label = result["label"]

    # Generate explanation text
    pct = round(score * 100, 1)
    if label == "FAKE":
        explanation = (
            f"Deepfake detected with {pct}% confidence. "
            "The highlighted regions show where the AI found manipulation artifacts — "
            "typically around facial boundaries, skin texture, or eye regions. "
            "These inconsistencies are characteristic of GAN-generated or face-swapped imagery."
        )
    elif label == "REAL":
        explanation = (
            f"Image appears authentic ({round((1 - score) * 100, 1)}% confidence). "
            "No significant manipulation artifacts were detected in facial regions."
        )
    else:
        explanation = "Analysis inconclusive — no faces detected or image quality too low."

    tts_url = tts_explanation(explanation, job_id)

    out = {
        "job_id": job_id,
        "status": "completed",
        "label": label,
        "score": score,
        "heatmap_url": heatmap_url,
        "faces_detected": result.get("faces_detected", 0),
        "confidence": result.get("confidence"),
        "metadata": result.get("metadata", {}),
        "explanation": explanation,
        "tts_url": tts_url,
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
# --------------------------------------------------
# POST /analyze-audio
# --------------------------------------------------
@app.post("/analyze-audio")
async def analyze_audio_endpoint(file: UploadFile = File(...)):
    """
    Unified audio / video deepfake detection endpoint.

    Audio files (WAV, MP3, FLAC, OGG, WebM, M4A):
      → audio-only pipeline (CNN → wav2vec2 → heuristic)
      Returns: { label, confidence, method, processing_time, input_type }

    Video files (MP4, AVI, MOV, MKV):
      → audio + visual fusion pipeline (MobileNetV3 frames + audio CNN)
      Returns: { label, confidence, method, processing_time, input_type,
                 audio_result, visual_result }
    """
    if file is None:
        raise HTTPException(status_code=400, detail="File is required")

    # .webm treated as audio — browser MediaRecorder produces audio-only webm
    audio_exts = {".wav", ".flac", ".mp3", ".ogg", ".webm", ".m4a"}
    video_exts = {".mp4", ".avi", ".mov", ".mkv"}
    allowed = audio_exts | video_exts

    ext = os.path.splitext(file.filename or "")[-1].lower()
    if ext not in allowed:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported format '{ext}'. Accepted: {', '.join(sorted(allowed))}",
        )

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty file")

    job_id    = uuid.uuid4().hex
    safe_name = os.path.basename(file.filename or "upload")
    file_path = os.path.join(UPLOAD_DIR, f"{job_id}_{safe_name}")

    try:
        with open(file_path, "wb") as f:
            f.write(contents)

        if _is_video(file_path):
            # Full audio + visual fusion
            result = analyze_video(file_path)

            # Video heatmap — run on a saved copy before temp file is deleted
            vid_heatmap = generate_video_heatmap(
                file_path, n_frames=6, out_dir="heatmaps", job_id=job_id
            )
            result["heatmap_url"]      = vid_heatmap.get("heatmap_url")
            result["key_frame_index"]  = vid_heatmap.get("key_frame_index")
            result["frame_scores"]     = vid_heatmap.get("frame_scores", [])

            # Visual explanation text
            label = result.get("label", "UNKNOWN")
            conf  = result.get("confidence", 0.5)
            pct   = round(conf * 100, 1)
            if label == "FAKE":
                n_suspicious = sum(1 for s in result["frame_scores"] if s > 0.5)
                result["explanation"] = (
                    f"Deepfake detected with {pct}% confidence. "
                    f"{n_suspicious} of {len(result['frame_scores'])} sampled frames "
                    "show visual manipulation artifacts. "
                    "The highlighted regions indicate where the AI detected inconsistencies "
                    "in skin texture, facial boundaries, or lighting."
                )
            else:
                result["explanation"] = (
                    f"Video appears authentic ({pct}% confidence). "
                    "No significant visual manipulation artifacts were detected across sampled frames."
                )

            result["tts_url"] = tts_explanation(result["explanation"], job_id)

        else:
            # Audio-only pipeline — keep a copy for spectral explanation
            import shutil, tempfile
            tmp_copy = tempfile.NamedTemporaryFile(
                suffix=os.path.splitext(file_path)[-1], delete=False
            )
            tmp_copy.close()
            shutil.copy2(file_path, tmp_copy.name)

            result = analyze_audio(file_path)
            result["input_type"] = "audio"

            # Explanation from spectral features
            result["explanation"] = explain_audio(result, audio_path=tmp_copy.name)
            result["tts_url"]     = tts_explanation(result["explanation"], job_id)

            try:
                os.unlink(tmp_copy.name)
            except OSError:
                pass

        return result

    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        logger.error("Analysis error: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Analysis failed")
    finally:
        try:
            if os.path.isfile(file_path):
                os.remove(file_path)
        except OSError:
            pass


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


# ==================================================
# WHATSAPP WEBHOOK
# ==================================================
import httpx

WA_VERIFY_TOKEN = os.environ.get("WA_VERIFY_TOKEN", "sanrakshan_verify_2024")
WA_TOKEN        = os.environ.get("WA_TOKEN", "")
WA_PHONE_ID     = os.environ.get("WA_PHONE_ID", "")

@app.get("/whatsapp/webhook")
async def wa_verify(
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
    hub_challenge: str = Query(None, alias="hub.challenge"),
):
    if hub_mode == "subscribe" and hub_verify_token == WA_VERIFY_TOKEN:
        return int(hub_challenge)
    raise HTTPException(status_code=403, detail="Verification failed")

@app.post("/whatsapp/webhook")
async def wa_webhook(request: Request, background_tasks: BackgroundTasks):
    body = await request.json()
    background_tasks.add_task(_process_wa_message, body)
    return {"status": "ok"}

async def _process_wa_message(body: dict):
    """Process incoming WhatsApp message asynchronously."""
    if not WA_TOKEN or not WA_PHONE_ID:
        logger.warning("WhatsApp credentials not configured.")
        return
    try:
        for entry in body.get("entry", []):
            for change in entry.get("changes", []):
                value = change.get("value", {})
                messages = value.get("messages", [])
                for msg in messages:
                    from_no   = msg.get("from")
                    msg_type  = msg.get("type")
                    if msg_type not in ("image", "audio", "video") or not from_no:
                        continue
                    media_id = msg[msg_type].get("id")
                    if not media_id:
                        continue
                    await _wa_analyze_and_reply(from_no, media_id, msg_type)
    except Exception as exc:
        logger.error("WhatsApp webhook processing failed: %s", exc, exc_info=True)

async def _wa_analyze_and_reply(from_no: str, media_id: str, media_type: str):
    headers = {"Authorization": f"Bearer {WA_TOKEN}"}
    async with httpx.AsyncClient(timeout=30) as client:
        # Get media URL
        info_res = await client.get(f"https://graph.facebook.com/v18.0/{media_id}", headers=headers)
        media_url = info_res.json().get("url")
        if not media_url:
            return
        # Download media
        media_res = await client.get(media_url, headers=headers)
        media_bytes = media_res.content

    ext_map = {"image": "jpg", "audio": "ogg", "video": "mp4"}
    ext      = ext_map.get(media_type, "bin")
    job_id   = uuid.uuid4().hex
    file_path = os.path.join(UPLOAD_DIR, f"{job_id}_wa.{ext}")

    try:
        with open(file_path, "wb") as f:
            f.write(media_bytes)

        if media_type == "audio":
            result = analyze_audio(file_path)
        else:
            is_video = media_type == "video"
            result = analyze_media(file_path=file_path, is_video=is_video)

        label = result.get("label", "UNKNOWN")
        conf  = round((result.get("confidence") or result.get("score") or 0) * 100, 1)
        emoji = "✅" if label == "REAL" else "🚨"
        reply = f"{emoji} *SanrakshAN Analysis*\nVerdict: *{label}*\nConfidence: {conf}%"
        if result.get("explanation"):
            expl = result["explanation"][:200]
            reply += f"\n\n_{expl}_"

    except Exception as exc:
        logger.error("WA analysis failed: %s", exc)
        reply = "⚠️ Analysis failed. Please send a clearer image or audio file."
    finally:
        try:
            if os.path.isfile(file_path):
                os.remove(file_path)
        except OSError:
            pass

    # Send reply
    async with httpx.AsyncClient(timeout=15) as client:
        await client.post(
            f"https://graph.facebook.com/v18.0/{WA_PHONE_ID}/messages",
            headers={"Authorization": f"Bearer {WA_TOKEN}", "Content-Type": "application/json"},
            json={
                "messaging_product": "whatsapp",
                "to": from_no,
                "type": "text",
                "text": {"body": reply},
            },
        )


# ==================================================
# TWILIO WHATSAPP BOT  (easier demo setup)
# ==================================================
from urllib.parse import urlencode

TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN  = os.environ.get("TWILIO_AUTH_TOKEN", "")

def _twilio_twiml(message: str) -> str:
    """Return a TwiML response string."""
    escaped = message.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return f'<?xml version="1.0" encoding="UTF-8"?><Response><Message>{escaped}</Message></Response>'

@app.post("/twilio/whatsapp")
async def twilio_whatsapp(request: Request):
    """
    Twilio WhatsApp sandbox webhook.

    Setup (free, 2 min):
    1. Sign up at twilio.com
    2. Go to Messaging → Try it out → Send a WhatsApp message
    3. Set webhook URL to: https://YOUR_BACKEND/twilio/whatsapp
    4. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN env vars (for signature verification)

    The bot accepts images, audio, or video sent to the sandbox number
    and replies with the SanrakshAN deepfake verdict.
    """
    from fastapi.responses import Response as FastAPIResponse

    form   = await request.form()
    body   = form.get("Body", "").strip()
    from_  = form.get("From", "")
    num_media = int(form.get("NumMedia", 0))

    # Optionally verify Twilio signature (skip in dev)
    if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
        from twilio.request_validator import RequestValidator
        validator  = RequestValidator(TWILIO_AUTH_TOKEN)
        url        = str(request.url)
        sig        = request.headers.get("X-Twilio-Signature", "")
        form_dict  = dict(form)
        if not validator.validate(url, form_dict, sig):
            return FastAPIResponse(content=_twilio_twiml("Unauthorized"), media_type="application/xml", status_code=403)

    if num_media == 0:
        # Text-only message
        reply = (
            "👋 *SanrakshAN Deepfake Detector*\n\n"
            "Send me an *image*, *audio clip*, or *video* and I'll tell you if it's real or AI-generated.\n\n"
            "Supported formats: JPG · PNG · MP3 · WAV · OGG · MP4 · MOV"
        )
        return FastAPIResponse(content=_twilio_twiml(reply), media_type="application/xml")

    # Download and analyze first media item
    media_url         = form.get("MediaUrl0", "")
    media_content_type = form.get("MediaContentType0", "")

    ext_map = {
        "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
        "audio/ogg": "ogg",  "audio/mpeg": "mp3", "audio/wav": "wav",
        "audio/webm": "webm",
        "video/mp4": "mp4",  "video/quicktime": "mov",
    }
    ext = ext_map.get(media_content_type, "bin")
    is_audio_type = media_content_type.startswith("audio/")
    is_video_type = media_content_type.startswith("video/")

    job_id    = uuid.uuid4().hex
    file_path = os.path.join(UPLOAD_DIR, f"{job_id}_twilio.{ext}")

    try:
        # Download media (Twilio requires auth)
        auth = (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN) if TWILIO_ACCOUNT_SID else None
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(media_url, auth=auth)
        with open(file_path, "wb") as f:
            f.write(resp.content)

        # Run analysis
        if is_audio_type:
            result = analyze_audio(file_path)
        elif is_video_type:
            from uploads.services.video_service import analyze_video
            result = analyze_video(file_path)
        else:
            result = analyze_media(file_path=file_path, is_video=False)

        label = result.get("label", "UNKNOWN")
        conf  = round((result.get("confidence") or result.get("score") or 0) * 100, 1)
        emoji = "✅" if label == "REAL" else "🚨"
        media_kind = "audio" if is_audio_type else ("video" if is_video_type else "image")

        reply = (
            f"{emoji} *SanrakshAN Analysis*\n"
            f"Type: {media_kind}\n"
            f"Verdict: *{label}*\n"
            f"Confidence: {conf}%"
        )
        if result.get("explanation"):
            expl = result["explanation"][:220]
            reply += f"\n\n{expl}"

    except Exception as exc:
        logger.error("Twilio WA analysis failed: %s", exc, exc_info=True)
        reply = "⚠️ Analysis failed. Please send a clearer file and try again."
    finally:
        try:
            if os.path.isfile(file_path):
                os.remove(file_path)
        except OSError:
            pass

    return FastAPIResponse(content=_twilio_twiml(reply), media_type="application/xml")