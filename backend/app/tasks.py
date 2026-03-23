import os
import cv2
import traceback

from app.firebase_auth import firestore_db
from uploads.services.services import analyze_media
from utils.face_engine import FaceEngine
from utils.explain import generate_heatmap


def run_analysis_task(job_id: str, file_path: str, user_id: str):
    job_ref = firestore_db.collection("jobs").document(job_id)

    try:
        # ---------------- STATUS ----------------
        job_ref.update({
            "status": "PROCESSING",
            "user_id": user_id,  # ✅ ensure user_id exists
        })

        is_video = file_path.lower().endswith((".mp4", ".avi", ".mov", ".mkv"))
        result = analyze_media(file_path=file_path, is_video=is_video)

        face_url = None
        heatmap_url = None

        # ---------------- HEATMAP (IMAGES ONLY) ----------------
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

                face_path = f"heatmaps/{job_id}_face.jpg"
                cv2.imwrite(face_path, primary["full"])
                face_url = face_path

                heatmap = generate_heatmap(primary["model"])
                heatmap_path = f"heatmaps/{job_id}_heatmap.jpg"
                cv2.imwrite(heatmap_path, heatmap)
                heatmap_url = heatmap_path

        # ---------------- FINAL RESPONSE ----------------
        from google.cloud.firestore import SERVER_TIMESTAMP

        job_ref.update({
            "status": "COMPLETED",

            # ✅ required for history + index
            "user_id": user_id,
            "created_at": SERVER_TIMESTAMP,

            # ✅ unified score handling
            "score": result.get("fake_probability") or result.get("score", 0.0),
            "confidence": result.get("confidence"),

            "label": result["label"],
            "faces_detected": result["faces_detected"],
            "face_url": face_url,
            "heatmap_url": heatmap_url,
            "metadata": result.get("metadata", {}),
        })

    except Exception as e:
        print("❌ ANALYSIS FAILED")
        print(traceback.format_exc())
        job_ref.update({
            "status": "FAILED",
            "error": str(e)
        })