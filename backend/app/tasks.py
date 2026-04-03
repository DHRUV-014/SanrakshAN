import os
import cv2
import traceback

from app.firebase_auth import firestore_db
from uploads.services.services import analyze_media
from utils.face_engine import FaceEngine
from utils.explain import generate_heatmap, tts_explanation


def run_analysis_task(job_id: str, file_path: str, user_id: str):
    job_ref = firestore_db.collection("jobs").document(job_id)

    try:
        # ---------------- STATUS ----------------
        job_ref.update({
            "status": "PROCESSING",
            "user_id": user_id,
        })

        is_video = file_path.lower().endswith((".mp4", ".avi", ".mov", ".mkv"))
        result = analyze_media(file_path=file_path, is_video=is_video)

        face_url = None
        heatmap_url = None

        # ---------------- HEATMAP (IMAGES ONLY) ----------------
        if not is_video and result.get("label") != "NO_FACE":
            engine = FaceEngine()
            with open(file_path, "rb") as f:
                faces = engine.process_image(f.read())

            if faces:
                primary = faces[0]
                os.makedirs("heatmaps", exist_ok=True)

                face_path = f"heatmaps/{job_id}_face.jpg"
                cv2.imwrite(face_path, primary["full"])
                face_url = f"/{face_path.replace(os.sep, '/')}"

                heatmap = generate_heatmap(primary["model"])
                heatmap_path = f"heatmaps/{job_id}_heatmap.jpg"
                cv2.imwrite(heatmap_path, heatmap)
                heatmap_url = f"/{heatmap_path.replace(os.sep, '/')}"

        # ---------------- EXPLANATION + TTS ----------------
        score = float(result.get("fake_probability") or result.get("score", 0.0))
        label = result.get("label", "UNKNOWN")
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

        # ---------------- FINAL RESPONSE ----------------
        from google.cloud.firestore import SERVER_TIMESTAMP

        job_ref.update({
            "status": "COMPLETED",

            "user_id": user_id,
            "created_at": SERVER_TIMESTAMP,

            "score": score,
            "confidence": result.get("confidence"),

            "label": label,
            "faces_detected": result["faces_detected"],
            "face_url": face_url,
            "heatmap_url": heatmap_url,
            "explanation": explanation,
            "tts_url": tts_url,
            "metadata": result.get("metadata", {}),
        })

    except Exception as e:
        print("❌ ANALYSIS FAILED")
        print(traceback.format_exc())
        job_ref.update({
            "status": "FAILED",
            "error": str(e)
        })