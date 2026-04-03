"""
Video deepfake detection — inference module.

Loads the TorchScript model once at import time.
Falls back gracefully if the model file doesn't exist.

Usage:
    from ml.video_model import analyze_video_frames

    result = analyze_video_frames("/path/to/video.mp4")
    # → {"label": "FAKE", "confidence": 0.93, "method": "mobilenetv3", "frame_scores": [...]}
"""

import logging
import time
from pathlib import Path
from typing import Optional

import numpy as np
import torch

logger = logging.getLogger(__name__)

_MODEL_PATH = Path(__file__).parent.parent / "models" / "video_model.pth"

_model         = None
_model_checked = False


def _load_model() -> bool:
    global _model, _model_checked
    if _model_checked:
        return _model is not None
    _model_checked = True

    if not _MODEL_PATH.exists():
        logger.info("No video model at %s — visual analysis unavailable.", _MODEL_PATH)
        return False

    try:
        _model = torch.jit.load(str(_MODEL_PATH), map_location="cpu")
        _model.eval()
        logger.info("Video model loaded from %s", _MODEL_PATH)
        return True
    except Exception as exc:
        logger.warning("Failed to load video model: %s", exc)
        _model = None
        return False


@torch.no_grad()
def predict_frames(frames: np.ndarray) -> dict:
    """
    Run the model on pre-extracted frames.

    Args:
        frames: np.ndarray (N, 3, 224, 224) float32, ImageNet-normalized

    Returns:
        {"label": "REAL"|"FAKE", "confidence": float, "frame_scores": list[float]}
    """
    if not _load_model():
        raise RuntimeError("Video model not loaded.")

    tensor = torch.tensor(frames, dtype=torch.float32)  # (N, 3, 224, 224)
    logits = _model(tensor)                              # (N, 2)
    probs  = torch.softmax(logits, dim=1)               # (N, 2) — [real, fake]

    # Per-frame fake probability (index 1)
    frame_fake_probs = probs[:, 1].cpu().numpy().tolist()

    # Mean aggregation across frames
    mean_probs = probs.mean(dim=0)  # (2,)
    fake_prob  = float(mean_probs[1])
    real_prob  = float(mean_probs[0])

    if fake_prob >= real_prob:
        label      = "FAKE"
        confidence = round(fake_prob, 4)
    else:
        label      = "REAL"
        confidence = round(real_prob, 4)

    return {
        "label":        label,
        "confidence":   confidence,
        "frame_scores": [round(s, 4) for s in frame_fake_probs],
    }


def analyze_video_frames(
    video_path: str,
    n_frames: int = 8,
    face_crop: bool = True,
) -> Optional[dict]:
    """
    Full inference pipeline for a video file.

    Returns:
        {
            "label":        "REAL" | "FAKE",
            "confidence":   float,
            "method":       "mobilenetv3",
            "frame_scores": list[float],
            "processing_time": "1.23s",
        }
        or None if model is unavailable / frames can't be extracted.
    """
    if not _load_model():
        return None

    t0 = time.perf_counter()

    # Import here to avoid circular imports at module level
    from ml.utils.video_processing import extract_frames_from_video_file

    frames = extract_frames_from_video_file(
        video_path, n_frames=n_frames, face_crop=face_crop
    )
    if frames is None:
        logger.warning("Could not extract frames from %s", video_path)
        return None

    result = predict_frames(frames)
    result["method"]          = "mobilenetv3"
    result["processing_time"] = f"{time.perf_counter() - t0:.2f}s"
    return result
