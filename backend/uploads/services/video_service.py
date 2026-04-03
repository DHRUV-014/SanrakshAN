"""
Video deepfake detection service.

For video uploads, runs BOTH:
  1. Audio analysis (existing audio_service.analyze_audio)
  2. Visual frame analysis (ml.video_model.analyze_video_frames)

Then fuses the predictions with a weighted average:
  - Visual: 60%  (spatial GAN artifacts are the primary signal)
  - Audio:  40%  (voice cloning is secondary but important)

If only one modality is available (model missing, silent video, etc.)
the available prediction is used at 100%.
"""

import logging
import os
import sys
import time
from pathlib import Path
from typing import Optional

# Make sure ml/ is importable when called from backend root
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "ml"))

logger = logging.getLogger(__name__)

# Fusion weights
_W_VISUAL = 0.60
_W_AUDIO  = 0.40


def _fake_prob_from_result(result: dict) -> float:
    """
    Extract a [0,1] fake probability from any result dict.
    Works with both audio_service and video_model outputs.
    """
    label      = result.get("label", "REAL")
    confidence = float(result.get("confidence", 0.5))
    if label == "FAKE":
        return confidence
    else:
        return 1.0 - confidence


def analyze_video(video_path: str) -> dict:
    """
    Full audio + video analysis for a video file.

    Returns:
        {
            "label":            "REAL" | "FAKE",
            "confidence":       float,
            "input_type":       "video",
            "method":           "audio+video" | "video_only" | "audio_only",
            "processing_time":  "2.10s",
            "audio_result":     dict | None,
            "visual_result":    dict | None,
        }
    """
    t0 = time.perf_counter()

    audio_result  = None
    visual_result = None

    # ── 1. Audio analysis ─────────────────────────────────────────────────────
    try:
        from uploads.services.audio_service import (
            analyze_audio,
            extract_audio_from_video,
        )
        extracted_wav = None
        try:
            extracted_wav = extract_audio_from_video(video_path)
            audio_result  = analyze_audio(extracted_wav)
        except ValueError as exc:
            logger.info("Audio extraction skipped: %s", exc)
        except Exception as exc:
            logger.warning("Audio analysis failed: %s", exc)
        finally:
            if extracted_wav and os.path.isfile(extracted_wav):
                os.remove(extracted_wav)
    except ImportError as exc:
        logger.warning("audio_service import failed: %s", exc)

    # ── 2. Visual frame analysis ───────────────────────────────────────────────
    try:
        from ml.video_model import analyze_video_frames
        visual_result = analyze_video_frames(video_path, n_frames=8, face_crop=True)
    except Exception as exc:
        logger.info("Visual analysis unavailable: %s", exc)

    # ── 3. Fusion ──────────────────────────────────────────────────────────────
    have_audio  = audio_result is not None
    have_visual = visual_result is not None

    if have_audio and have_visual:
        audio_fake_p  = _fake_prob_from_result(audio_result)
        visual_fake_p = _fake_prob_from_result(visual_result)
        fused_fake_p  = _W_VISUAL * visual_fake_p + _W_AUDIO * audio_fake_p
        method = "audio+video"

    elif have_visual:
        fused_fake_p = _fake_prob_from_result(visual_result)
        method = "video_only"

    elif have_audio:
        fused_fake_p = _fake_prob_from_result(audio_result)
        method = "audio_only"

    else:
        # Nothing worked — return a neutral result rather than crashing
        logger.error("Both audio and visual analysis failed for %s", video_path)
        return {
            "label":           "UNKNOWN",
            "confidence":      0.5,
            "input_type":      "video",
            "method":          "none",
            "processing_time": f"{time.perf_counter() - t0:.2f}s",
            "audio_result":    None,
            "visual_result":   None,
        }

    label      = "FAKE" if fused_fake_p >= 0.5 else "REAL"
    confidence = round(fused_fake_p if label == "FAKE" else 1.0 - fused_fake_p, 4)

    return {
        "label":           label,
        "confidence":      confidence,
        "input_type":      "video",
        "method":          method,
        "processing_time": f"{time.perf_counter() - t0:.2f}s",
        "audio_result":    audio_result,
        "visual_result":   visual_result,
    }
