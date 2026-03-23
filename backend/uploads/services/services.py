from __future__ import annotations
import os, math
from functools import lru_cache
from typing import Dict, Any, List

import cv2
import numpy as np
import torch
from transformers import AutoImageProcessor, AutoModelForImageClassification

from utils.face_engine import FaceEngine

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
MODEL_ID = "dima806/deepfake_vs_real_image_detection"
FAKE_CLASS_INDEX = 1


# ================= CALIBRATED DECISION LOGIC =================
def decide_label(fake_probs: List[float]):
    """
    Forensic decision logic synced with CALIBRATION RESULTS:
    REAL 95th: 0.8926 | FAKE 5th: 0.3839
    """
    if not fake_probs:
        return "NO_FACE", 0.0

    median_p = float(np.median(fake_probs))
    std_p = float(np.std(fake_probs))

    # ---- NEW CALIBRATED THRESHOLDS ----
    # Because your REAL 95th is so high (0.89), we must be generous to REAL
    # but also check if the model is 'sure' (low variance)

    # 1. PROTECT REAL IMAGES
    # If the score is below your 95th percentile, we lean toward REAL
    if median_p <= 0.8926:
        # If the score is high but below threshold, it's likely a 'noisy' real image
        return "REAL", 1 - median_p

    # 2. STRICT FAKE CLASSIFICATION
    # Only flag as FAKE if it exceeds the 89% threshold AND is consistent (low std)
    if median_p > 0.8926 and std_p <= 0.15:
        return "FAKE", median_p

    # 3. UNCERTAIN FALLBACK
    return "UNCERTAIN", 0.5


@lru_cache(maxsize=1)
def load_models():
    processor = AutoImageProcessor.from_pretrained(MODEL_ID)
    base_model = AutoModelForImageClassification.from_pretrained(MODEL_ID)
    base_model.to(DEVICE).eval()

    finetuned_model = AutoModelForImageClassification.from_pretrained(MODEL_ID)
    finetuned_path = "backend/ml/best_model.pt"  # Ensure this path is correct

    if os.path.exists(finetuned_path):
        state = torch.load(finetuned_path, map_location=DEVICE)
        finetuned_model.load_state_dict(state, strict=False)
        finetuned_model.to(DEVICE).eval()
    else:
        finetuned_model = None

    return base_model, finetuned_model, processor


def _predict_fake_prob(img_bgr, model, processor) -> float:
    rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    inputs = processor(images=rgb, return_tensors="pt").to(DEVICE)
    with torch.no_grad():
        out = model(**inputs)
        probs = torch.softmax(out.logits, dim=1)
    return float(probs[0][FAKE_CLASS_INDEX])


def _get_ensemble_prob(face_img, base_model, finetuned_model, processor):
    base_p = _predict_fake_prob(face_img, base_model, processor)
    if finetuned_model:
        fine_p = _predict_fake_prob(face_img, finetuned_model, processor)
        # Using a 50/50 split to give your fine-tuning equal weight
        return 0.50 * base_p + 0.50 * fine_p
    return base_p


def analyze_media(file_path: str, is_video: bool) -> Dict[str, Any]:
    engine = FaceEngine()
    return _analyze_video(file_path, engine) if is_video else _analyze_image(file_path, engine)


def _analyze_image(file_path: str, engine: FaceEngine) -> Dict[str, Any]:
    with open(file_path, "rb") as f:
        faces = engine.process_image(f.read())

    if not faces:
        return {"score": 0.0, "label": "NO_FACE", "faces_detected": 0, "metadata": {}}

    base_model, finetuned_model, processor = load_models()
    fake_probs = [_get_ensemble_prob(f["model"], base_model, finetuned_model, processor) for f in faces]

    label, confidence = decide_label(fake_probs)
    median_prob = float(np.median(fake_probs))

    return {
        "score": round(median_prob, 4),
        "label": label,
        "faces_detected": len(faces),
        "confidence": round(confidence, 4),
        "metadata": {
            "model": "Ensemble-Calibrated-V2",
            "reason": f"Calibrated threshold check: {label} (Score: {median_prob:.4f})",
            "uncertainty": f"{float(np.std(fake_probs)) * 100:.1f}% variance"
        },
    }


def _analyze_video(file_path: str, engine: FaceEngine) -> Dict[str, Any]:
    cap = cv2.VideoCapture(file_path)
    base_model, finetuned_model, processor = load_models()

    fake_probs = []
    fps = cap.get(cv2.CAP_PROP_FPS) or 25
    step = int(math.ceil(fps / 2))
    idx = 0

    while True:
        ok, frame = cap.read()
        if not ok: break
        if idx % step == 0:
            _, buf = cv2.imencode(".jpg", frame)
            faces = engine.process_image(buf.tobytes())
            for face in faces:
                p = _get_ensemble_prob(face["model"], base_model, finetuned_model, processor)
                fake_probs.append(p)
        idx += 1
    cap.release()

    if not fake_probs:
        return {"score": 0.0, "label": "NO_FACE", "faces_detected": 0, "metadata": {}}

    label, confidence = decide_label(fake_probs)
    return {
        "score": round(float(np.median(fake_probs)), 4),
        "label": label,
        "faces_detected": len(fake_probs),
        "confidence": round(confidence, 4),
        "metadata": {"model": "Video-Calibrated-V2"},
    }