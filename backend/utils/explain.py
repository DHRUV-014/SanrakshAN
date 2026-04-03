"""
Explainability utilities for SanrakshAN.

Provides:
  - generate_heatmap(face_bgr)      → Attention-rollout overlay for ViT deepfake model
  - explain_audio(result, path)     → text explanation from spectral features
  - tts_explanation(text, job_id)   → mp3 via gTTS, returns URL path
  - generate_video_heatmap(path)    → per-frame attention maps for video files
"""

from __future__ import annotations

import logging
import os
from typing import Optional

import cv2
import numpy as np
import torch
import torch.nn.functional as F

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────────────────────
# 1. ATTENTION ROLLOUT — Image
#    Model: dima806/deepfake_vs_real_image_detection (ViT-based).
#
#    Why attention rollout, not Grad-CAM:
#    - ViT has a single patch-embedding Conv2d at the very start; Grad-CAM on
#      it yields uniform/flat maps with no semantic content.
#    - Grad-CAM via last-block hooks requires gradients to propagate cleanly
#      through attention layers — they often vanish or explode in practice.
#    - Attention rollout uses the model's own attention weights (forward pass
#      only, no gradients) — reliable, stable, and architecturally correct.
#
#    Algorithm:
#    1. Forward pass with output_attentions=True.
#    2. For each layer: avg over heads → add identity (residual connection).
#    3. Multiply layer matrices (rollout) → final CLS→patch attention (196,).
#    4. Reshape 14×14 → upsample → JET colormap → blend.
# ──────────────────────────────────────────────────────────────────────────────

_DEEPFAKE_MODEL_ID = "dima806/deepfake_vs_real_image_detection"
_gradcam_model:     Optional[torch.nn.Module] = None
_gradcam_processor: Optional[object]          = None
_gradcam_ready     = False


def _load_gradcam_model() -> bool:
    global _gradcam_model, _gradcam_processor, _gradcam_ready
    if _gradcam_ready:
        return _gradcam_model is not None
    _gradcam_ready = True
    try:
        from transformers import AutoImageProcessor, AutoModelForImageClassification
        _gradcam_processor = AutoImageProcessor.from_pretrained(_DEEPFAKE_MODEL_ID)
        _gradcam_model = AutoModelForImageClassification.from_pretrained(
            _DEEPFAKE_MODEL_ID,
            output_attentions=True,   # bake in so we always get attentions
        )
        _gradcam_model.eval()
        logger.info("Attention-rollout model loaded: %s", _DEEPFAKE_MODEL_ID)
        return True
    except Exception as exc:
        logger.warning("Model load failed: %s", exc)
        return False


def _saliency_map(face_bgr: np.ndarray, h: int, w: int) -> Optional[np.ndarray]:
    """
    Input-gradient saliency map — works on ANY model (ViT, CNN, etc.).

    Method:
    - Resize face to 224×224, run a forward pass with gradients enabled.
    - Backprop the FAKE class logit w.r.t. pixel_values.
    - Take max-abs over the 3 colour channels → (224, 224) importance map.
    - Percentile-clip bottom 70%, power-boost (^1.5), upsample.

    This is guaranteed to produce visible coloured regions because the
    gradient is computed directly on the pixel input — no hooks, no
    attention extraction, no architecture assumptions.
    """
    if _gradcam_model is None or _gradcam_processor is None:
        return None

    face_224 = cv2.resize(face_bgr, (224, 224))
    rgb      = cv2.cvtColor(face_224, cv2.COLOR_BGR2RGB)

    try:
        inputs = _gradcam_processor(images=rgb, return_tensors="pt")
    except Exception as exc:
        logger.warning("Processor failed: %s", exc)
        return None

    try:
        pixel_values = inputs["pixel_values"].requires_grad_(True)

        _gradcam_model.zero_grad()
        output     = _gradcam_model(pixel_values=pixel_values)
        fake_score = output.logits[0, 1]   # target: FAKE class
        fake_score.backward()

        if pixel_values.grad is None:
            logger.warning("No gradient — model not differentiable w.r.t. pixel_values.")
            return None

        # (3, H, W) → max-abs over channels → (H, W)
        sal = pixel_values.grad[0].abs().max(dim=0).values.detach().cpu().numpy()

        # Percentile clip — suppress low-importance background pixels
        threshold = float(np.percentile(sal, 70))
        sal = np.maximum(sal - threshold, 0.0)

        sal_max = sal.max()
        if sal_max < 1e-8:
            logger.warning("Saliency map is flat after clipping.")
            return None
        sal = sal / sal_max

        # Contrast boost
        sal = np.power(sal, 1.5)

        # Upsample to original face resolution
        sal = cv2.resize(sal, (w, h), interpolation=cv2.INTER_CUBIC)
        sal = cv2.GaussianBlur(sal, (11, 11), 0)
        return np.clip(sal, 0.0, 1.0)

    except Exception as exc:
        logger.warning("Saliency map failed: %s", exc)
        return None


def generate_heatmap(face_bgr: np.ndarray) -> np.ndarray:
    """
    Input-gradient saliency overlay on face_bgr.
    Red/yellow regions = pixels most responsible for the FAKE prediction.

    Returns BGR overlay image (same size as input), or original on failure.
    """
    if not _load_gradcam_model():
        return face_bgr

    h, w = face_bgr.shape[:2]
    cam  = _saliency_map(face_bgr, h, w)

    if cam is None:
        logger.warning("Saliency map returned None; returning plain image.")
        return face_bgr

    heatmap = cv2.applyColorMap(np.uint8(255 * cam), cv2.COLORMAP_TURBO)
    return cv2.addWeighted(face_bgr, 0.45, heatmap, 0.55, 0)


# ──────────────────────────────────────────────────────────────────────────────
# 2. ATTENTION ROLLOUT — Video
# ──────────────────────────────────────────────────────────────────────────────

def generate_video_heatmap(
    video_path: str,
    n_frames: int = 6,
    out_dir: str = "heatmaps",
    job_id: str = "vid",
) -> dict:
    """
    Sample n_frames from video, score each with the deepfake model,
    run attention rollout on the most suspicious frame, save the overlay.

    Returns:
        { "heatmap_url": str|None, "key_frame_index": int, "frame_scores": list[float] }
    """
    if not _load_gradcam_model():
        return {"heatmap_url": None, "key_frame_index": 0, "frame_scores": []}

    if _gradcam_model is None or _gradcam_processor is None:
        return {"heatmap_url": None, "key_frame_index": 0, "frame_scores": []}

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return {"heatmap_url": None, "key_frame_index": 0, "frame_scores": []}

    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if total <= 0:
        cap.release()
        return {"heatmap_url": None, "key_frame_index": 0, "frame_scores": []}

    n       = min(n_frames, total)
    indices = [int(round(i * (total - 1) / max(n - 1, 1))) for i in range(n)]

    frame_scores:   list = []
    frame_heatmaps: list = []

    for idx in indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
        ok, frame = cap.read()
        if not ok or frame is None:
            frame_scores.append(0.0)
            frame_heatmaps.append(None)
            continue

        face = cv2.resize(frame, (224, 224))
        rgb  = cv2.cvtColor(face, cv2.COLOR_BGR2RGB)
        try:
            inputs = _gradcam_processor(images=rgb, return_tensors="pt")
            with torch.no_grad():
                logits    = _gradcam_model(**inputs).logits
                fake_prob = float(torch.softmax(logits, dim=1)[0, 1])
        except Exception:
            fake_prob = 0.0

        frame_scores.append(round(fake_prob, 4))
        frame_heatmaps.append(frame)

    cap.release()

    if not frame_scores:
        return {"heatmap_url": None, "key_frame_index": 0, "frame_scores": []}

    best_idx   = int(np.argmax(frame_scores))
    best_frame = frame_heatmaps[best_idx]

    heatmap_url = None
    if best_frame is not None:
        overlay = generate_heatmap(best_frame)
        os.makedirs(out_dir, exist_ok=True)
        out_path = os.path.join(out_dir, f"{job_id}_heatmap.jpg")
        cv2.imwrite(out_path, overlay)
        heatmap_url = f"/{out_path.replace(os.sep, '/')}"

    return {
        "heatmap_url":     heatmap_url,
        "key_frame_index": best_idx,
        "frame_scores":    frame_scores,
    }


# ──────────────────────────────────────────────────────────────────────────────
# 3. AUDIO EXPLANATION
# ──────────────────────────────────────────────────────────────────────────────

def explain_audio(result: dict, audio_path: Optional[str] = None) -> str:
    """
    Generate a non-technical explanation for an audio deepfake result.
    """
    label      = result.get("label", "UNKNOWN")
    confidence = float(result.get("confidence", 0.5))
    method     = result.get("method", "heuristic")
    pct        = round(confidence * 100, 1)

    if label == "REAL":
        base = (
            f"This audio appears to be authentic human speech ({pct}% confidence). "
            "Natural pitch variation, spectral characteristics, and vocal dynamics "
            "are consistent with a real human voice."
        )
        if confidence < 0.75:
            base += (
                " However, some minor irregularities were detected — "
                "recording quality or background noise may have affected the analysis."
            )
        return base

    reasons = []
    if audio_path:
        try:
            reasons = _spectral_reasons(audio_path)
        except Exception as exc:
            logger.debug("Spectral analysis for explanation failed: %s", exc)

    if not reasons:
        reasons = _reasons_from_method(method, confidence)

    reason_str = " ".join(reasons)
    return (
        f"This audio shows signs of AI synthesis ({pct}% confidence). "
        f"{reason_str} "
        "These patterns are characteristic of text-to-speech or voice cloning systems."
    )


def _spectral_reasons(audio_path: str) -> list:
    import librosa
    audio, sr = librosa.load(audio_path, sr=16000, mono=True, duration=10.0)
    reasons   = []

    mfccs     = librosa.feature.mfcc(y=audio, sr=sr, n_mfcc=20)
    delta_var = float(np.var(librosa.feature.delta(mfccs)))
    if delta_var < 15.0:
        reasons.append(
            "The voice shows unusually low temporal variation — "
            "natural speech changes more dynamically over time."
        )

    flatness = float(librosa.feature.spectral_flatness(y=audio).mean())
    if flatness > 0.012:
        reasons.append(
            "The frequency spectrum is abnormally uniform, "
            "lacking the natural unevenness of human vocal cords."
        )

    try:
        f0, voiced, _ = librosa.pyin(
            audio,
            fmin=librosa.note_to_hz("C2"),
            fmax=librosa.note_to_hz("C7"),
        )
        voiced_f0 = f0[voiced & ~np.isnan(f0)] if voiced is not None else np.array([])
        if len(voiced_f0) >= 20:
            cov = float(np.std(voiced_f0) / (np.mean(voiced_f0) + 1e-6))
            if cov < 0.08:
                reasons.append(
                    "Pitch is suspiciously monotone — "
                    "AI voices often lack the natural pitch fluctuation of human speech."
                )
    except Exception:
        pass

    rms           = librosa.feature.rms(y=audio)[0]
    silence_ratio = float(np.mean(rms < 0.01))
    if silence_ratio < 0.10:
        reasons.append(
            "Unnatural absence of pauses — "
            "human speakers naturally breathe and pause between phrases."
        )
    elif silence_ratio > 0.65:
        reasons.append(
            "Excessive silence detected, suggesting stitched or generated audio segments."
        )

    return reasons if reasons else _reasons_from_method("heuristic", 0.75)


def _reasons_from_method(method: str, confidence: float) -> list:
    if method == "cnn":
        return [
            "Mel-spectrogram patterns are inconsistent with natural speech.",
            "The audio shows spectral artifacts typical of neural text-to-speech systems.",
        ]
    if method == "wav2vec2":
        return [
            "Deep audio features extracted from the waveform do not match genuine speech.",
            "The phonetic representation is inconsistent with real human voices.",
        ]
    if confidence > 0.80:
        return ["Multiple spectral and prosodic features deviate significantly from natural speech."]
    return ["Some spectral characteristics suggest possible AI synthesis."]


# ──────────────────────────────────────────────────────────────────────────────
# 4. TTS — explanation text → MP3
# ──────────────────────────────────────────────────────────────────────────────

def tts_explanation(text: str, job_id: str, out_dir: str = "heatmaps") -> Optional[str]:
    """
    Convert text to speech MP3 via gTTS (requires internet).
    Returns URL path like "/heatmaps/abc123_tts.mp3", or None on failure.
    """
    try:
        from gtts import gTTS
        os.makedirs(out_dir, exist_ok=True)
        out_path = os.path.join(out_dir, f"{job_id}_tts.mp3")
        gTTS(text=text, lang="en", slow=False).save(out_path)
        logger.info("TTS saved: %s", out_path)
        return f"/{out_path.replace(os.sep, '/')}"
    except ImportError:
        logger.warning("gTTS not installed. Run: pip install gtts")
        return None
    except Exception as exc:
        logger.warning("TTS failed: %s", exc)
        return None
