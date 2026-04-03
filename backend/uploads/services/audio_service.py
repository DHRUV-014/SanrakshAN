"""
Audio deepfake detection service.

Inference priority (highest → lowest):

  Tier 0 — Custom trained CNN (backend/models/audio_model.pth)
            TorchScript; ~450K params; ~50–100 ms / clip on CPU.

  Tier 1 — HuggingFace wav2vec2 pretrained
            (MelodyMachine/Deepfake-audio-detection, ~90 MB quantised).

  Tier 2 — Librosa spectral heuristic (always available)
"""

import logging
import os
import subprocess
import tempfile
import time
from pathlib import Path

import numpy as np

logger = logging.getLogger(__name__)

# Path to the trained TorchScript model (produced by ml/train_audio.py)
_MODEL_PATH = Path(__file__).parent.parent.parent / "models" / "audio_model.pth"

# ── Global singletons (loaded at most once per process) ───────────────────────
_cnn            = None   # Tier 0: trained TorchScript CNN
_cnn_checked    = False  # True after first attempt (avoids repeated disk I/O)

_hf_model       = None   # Tier 1: HuggingFace wav2vec2
_hf_extractor   = None
_hf_unavailable = False


# ─────────────────────────────────────────────────────────────────────────────
# Audio loading
# ─────────────────────────────────────────────────────────────────────────────

# Formats that soundfile cannot decode natively — must be converted to WAV first
_NEEDS_FFMPEG = {".webm", ".ogg", ".mp3", ".m4a", ".opus"}


def _find_ffmpeg() -> str:
    """Return the ffmpeg binary path, checking common locations."""
    import shutil
    # Check PATH first, then common Homebrew locations
    found = shutil.which("ffmpeg")
    if found:
        return found
    for candidate in ("/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg", "/usr/bin/ffmpeg"):
        if os.path.isfile(candidate):
            return candidate
    return "ffmpeg"  # let subprocess raise FileNotFoundError with a clear message


def _ffmpeg_to_wav(src: str) -> str:
    """
    Convert any audio file to 16 kHz mono WAV using ffmpeg.
    Returns path to a temp WAV file — caller must delete it.
    Raises ValueError if ffmpeg is unavailable or conversion fails.
    """
    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    tmp.close()

    ffmpeg = _find_ffmpeg()
    cmd = [
        ffmpeg, "-y", "-i", src,
        "-vn",
        "-acodec", "pcm_s16le",
        "-ar", "16000",
        "-ac", "1",
        tmp.name,
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, timeout=30)
    except FileNotFoundError:
        os.unlink(tmp.name)
        raise ValueError(
            "ffmpeg is required to decode this audio format but is not installed. "
            "Run: brew install ffmpeg"
        )
    except subprocess.TimeoutExpired:
        os.unlink(tmp.name)
        raise ValueError("ffmpeg timed out converting audio.")

    if proc.returncode != 0 or not os.path.getsize(tmp.name):
        os.unlink(tmp.name)
        raise ValueError(
            "ffmpeg could not decode the audio file. "
            "Make sure the file is a valid audio/video file."
        )
    return tmp.name


def _load_audio(path: str, target_sr: int = 16_000, max_duration: float = 10.0) -> np.ndarray:
    """
    Load audio → mono float32 array at target_sr.
    Formats that soundfile cannot handle (WebM, OGG, MP3, M4A) are first
    converted to WAV via ffmpeg, then loaded by librosa.
    """
    import librosa

    ext = os.path.splitext(path)[-1].lower()
    converted = None

    if ext in _NEEDS_FFMPEG:
        converted = _ffmpeg_to_wav(path)
        load_path = converted
    else:
        load_path = path

    try:
        audio, _ = librosa.load(load_path, sr=target_sr, mono=True, duration=max_duration)
    finally:
        if converted and os.path.exists(converted):
            os.unlink(converted)

    peak = np.abs(audio).max()
    if peak > 0:
        audio = audio / peak
    return audio


# ─────────────────────────────────────────────────────────────────────────────
# Tier 0 — Custom trained CNN (TorchScript)
# ─────────────────────────────────────────────────────────────────────────────

def _try_load_cnn() -> bool:
    global _cnn, _cnn_checked

    if _cnn_checked:
        return _cnn is not None

    _cnn_checked = True

    if not _MODEL_PATH.exists():
        logger.info(
            "No trained CNN found at %s. Using fallback tiers.", _MODEL_PATH
        )
        return False

    try:
        import torch
        _cnn = torch.jit.load(str(_MODEL_PATH), map_location="cpu")
        _cnn.eval()
        logger.info("Loaded trained audio CNN from %s", _MODEL_PATH)
        return True
    except Exception as exc:
        logger.warning("Failed to load CNN (%s). Using fallback.", exc)
        _cnn = None
        return False


def _extract_log_mel(audio: np.ndarray, sr: int = 16_000) -> "torch.Tensor":
    """
    Convert waveform → log-Mel spectrogram tensor (1, 1, 128, 300).
    Matches the feature config used during training (audio_cnn.py).
    """
    import librosa
    import torch

    N_MELS     = 128
    N_FFT      = 512
    HOP_LENGTH = 160
    N_FRAMES   = 300
    DURATION   = 3.0

    # Pad / trim to 3 seconds
    target_len = int(sr * DURATION)
    if len(audio) < target_len:
        audio = np.pad(audio, (0, target_len - len(audio)))
    else:
        audio = audio[:target_len]

    mel = librosa.feature.melspectrogram(
        y=audio, sr=sr,
        n_fft=N_FFT, hop_length=HOP_LENGTH, n_mels=N_MELS,
        fmin=20, fmax=8_000,
    )
    log_mel = librosa.power_to_db(mel, ref=np.max)

    # Pad / trim time axis
    T = log_mel.shape[1]
    if T < N_FRAMES:
        log_mel = np.pad(log_mel, ((0, 0), (0, N_FRAMES - T)))
    else:
        log_mel = log_mel[:, :N_FRAMES]

    # Instance normalise
    log_mel = (log_mel - log_mel.mean()) / (log_mel.std() + 1e-6)

    return torch.tensor(log_mel[np.newaxis, np.newaxis, :, :], dtype=torch.float32)


def _infer_with_cnn(audio: np.ndarray) -> tuple[str, float]:
    """Run trained TorchScript CNN. Returns (label, confidence)."""
    import torch

    x = _extract_log_mel(audio)

    with torch.no_grad():
        logits = _cnn(x)                        # (1, 2) — [fake, real]
        probs  = torch.softmax(logits, dim=1)[0]

    fake_prob = float(probs[0])
    real_prob = float(probs[1])

    if real_prob >= fake_prob:
        return "REAL", round(real_prob, 4)
    else:
        return "FAKE", round(fake_prob, 4)


# ─────────────────────────────────────────────────────────────────────────────
# Tier 1 — HuggingFace wav2vec2
# ─────────────────────────────────────────────────────────────────────────────

def _try_load_hf_model() -> bool:
    global _hf_model, _hf_extractor, _hf_unavailable

    if _hf_unavailable:
        return False
    if _hf_model is not None:
        return True

    try:
        import torch
        from transformers import AutoFeatureExtractor, AutoModelForAudioClassification

        model_id = "MelodyMachine/Deepfake-audio-detection"
        logger.info("Loading HuggingFace audio model: %s", model_id)

        _hf_extractor = AutoFeatureExtractor.from_pretrained(model_id)
        _hf_model = AutoModelForAudioClassification.from_pretrained(
            model_id,
            torch_dtype=torch.float32,
            low_cpu_mem_usage=True,
        )
        _hf_model.eval()

        # int8 quantisation — ~4× smaller, minimal accuracy loss on CPU
        _hf_model = torch.quantization.quantize_dynamic(
            _hf_model, {torch.nn.Linear}, dtype=torch.qint8
        )
        logger.info("HuggingFace audio model loaded (int8 quantised)")
        return True

    except Exception as exc:
        logger.warning("HuggingFace model unavailable (%s). Using heuristic.", exc)
        _hf_unavailable = True
        _hf_model = None
        _hf_extractor = None
        return False


def _infer_with_hf(audio: np.ndarray) -> tuple[str, float]:
    """Run HuggingFace wav2vec2 classifier. Returns (label, confidence)."""
    import torch

    inputs = _hf_extractor(
        audio,
        sampling_rate=16_000,
        return_tensors="pt",
        padding=True,
        truncation=True,
        max_length=160_000,
    )

    with torch.no_grad():
        probs = torch.softmax(_hf_model(**inputs).logits, dim=-1)[0]

    pred_id    = int(probs.argmax())
    raw_label  = _hf_model.config.id2label[pred_id].lower()
    confidence = float(probs[pred_id])

    if any(kw in raw_label for kw in ("real", "genuine", "bonafide", "human")):
        label = "REAL"
    else:
        label = "FAKE"

    return label, round(confidence, 4)


# ─────────────────────────────────────────────────────────────────────────────
# Tier 2 — Librosa spectral heuristic
# ─────────────────────────────────────────────────────────────────────────────

def _infer_with_heuristic(audio: np.ndarray, sr: int = 16_000) -> tuple[str, float]:
    """
    Spectral + prosodic heuristics for TTS/voice-clone detection.

    Four components (weighted sum → fake_score ∈ [0, 1]):
      1. MFCC delta variance — real speech varies more temporally
      2. Spectral flatness   — TTS is more spectrally uniform
      3. F0 coefficient of variation — TTS pitch is smoother
      4. Silence distribution — natural speech has ~35% near-silence
    """
    import librosa

    components = []   # (name, fake_score_0_to_1, weight)

    # 1. MFCC delta variance
    mfccs      = librosa.feature.mfcc(y=audio, sr=sr, n_mfcc=20)
    delta_var  = float(np.var(librosa.feature.delta(mfccs)))
    mfcc_fake  = float(np.clip(1.0 - delta_var / 60.0, 0.0, 1.0))
    components.append(("mfcc_delta", mfcc_fake, 0.35))

    # 2. Spectral flatness
    flatness   = float(librosa.feature.spectral_flatness(y=audio).mean())
    flat_fake  = float(np.clip(flatness / 0.02, 0.0, 1.0))
    components.append(("flatness", flat_fake, 0.25))

    # 3. Pitch regularity (F0 CoV)
    try:
        f0, voiced, _ = librosa.pyin(
            audio,
            fmin=librosa.note_to_hz("C2"),
            fmax=librosa.note_to_hz("C7"),
        )
        voiced_f0 = f0[voiced & ~np.isnan(f0)]
        if len(voiced_f0) >= 20:
            cov        = float(np.std(voiced_f0) / (np.mean(voiced_f0) + 1e-6))
            pitch_fake = float(np.clip(1.0 - cov / 0.25, 0.0, 1.0))
        else:
            pitch_fake = 0.45
    except Exception:
        pitch_fake = 0.45
    components.append(("pitch_cov", pitch_fake, 0.25))

    # 4. Silence distribution
    rms          = librosa.feature.rms(y=audio)[0]
    silence_ratio = float(np.mean(rms < 0.01))
    silence_fake  = float(np.clip(abs(silence_ratio - 0.35) / 0.35, 0.0, 1.0))
    components.append(("silence", silence_fake, 0.15))

    fake_score = float(np.clip(sum(s * w for _, s, w in components), 0.05, 0.95))

    if fake_score >= 0.5:
        return "FAKE", round(fake_score, 4)
    else:
        return "REAL", round(1.0 - fake_score, 4)


# ─────────────────────────────────────────────────────────────────────────────
# Video → audio extraction
# ─────────────────────────────────────────────────────────────────────────────

# .webm is intentionally excluded — browser MediaRecorder produces audio-only .webm
# blobs that librosa can decode directly. Only container formats that always carry
# a video stream should trigger ffmpeg extraction.
_VIDEO_EXTS = {".mp4", ".avi", ".mov", ".mkv"}


def _is_video(path: str) -> bool:
    return os.path.splitext(path)[-1].lower() in _VIDEO_EXTS


def extract_audio_from_video(video_path: str) -> str:
    """
    Use ffmpeg (available on Render/Ubuntu) to extract the first audio track
    from a video file and save it as a 16 kHz mono WAV.

    Returns the path of the temporary WAV file — caller must delete it.
    Raises ValueError if ffmpeg fails or the video has no audio.
    """
    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    tmp.close()

    ffmpeg = _find_ffmpeg()
    cmd = [
        ffmpeg, "-y",
        "-i", video_path,
        "-vn",                  # drop video stream
        "-acodec", "pcm_s16le", # raw PCM
        "-ar", "16000",         # 16 kHz
        "-ac", "1",             # mono
        tmp.name,
    ]

    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            timeout=60,
        )
    except FileNotFoundError:
        os.unlink(tmp.name)
        raise ValueError(
            "ffmpeg is not installed on this server. "
            "Video audio extraction requires ffmpeg."
        )
    except subprocess.TimeoutExpired:
        os.unlink(tmp.name)
        raise ValueError("ffmpeg timed out extracting audio from video.")

    if proc.returncode != 0:
        os.unlink(tmp.name)
        stderr = proc.stderr.decode(errors="replace")
        if "no streams" in stderr.lower() or "output file is empty" in stderr.lower():
            raise ValueError("The video file contains no audio track.")
        raise ValueError(f"ffmpeg failed (rc={proc.returncode}): {stderr[:300]}")

    if not os.path.exists(tmp.name) or os.path.getsize(tmp.name) == 0:
        os.unlink(tmp.name)
        raise ValueError("The video file contains no audio track.")

    logger.info("Extracted audio from video → %s (%d bytes)",
                tmp.name, os.path.getsize(tmp.name))
    return tmp.name


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────

def analyze_audio(audio_path: str) -> dict:
    """
    Detect whether audio contains synthetic/deepfake speech.

    Returns:
        {
            "label":           "REAL" | "FAKE",
            "confidence":      float,       # 0–1
            "method":          "cnn" | "wav2vec2" | "heuristic",
            "processing_time": "0.31s",
        }

    Raises:
        ValueError — if the file cannot be decoded.
    """
    t0 = time.perf_counter()

    try:
        audio = _load_audio(audio_path)
    except Exception as exc:
        raise ValueError(f"Cannot decode audio file: {exc}") from exc

    # ── Tier 0: trained CNN ───────────────────────────────────────────────────
    if _try_load_cnn():
        try:
            label, confidence = _infer_with_cnn(audio)
            method = "cnn"
            logger.debug("CNN inference: %s %.3f", label, confidence)
        except Exception as exc:
            logger.warning("CNN inference failed (%s); trying next tier.", exc)
            label, confidence, method = None, None, None
    else:
        label, confidence, method = None, None, None

    # ── Tier 1: HuggingFace wav2vec2 ─────────────────────────────────────────
    if label is None and _try_load_hf_model():
        try:
            label, confidence = _infer_with_hf(audio)
            method = "wav2vec2"
        except Exception as exc:
            logger.warning("HuggingFace inference failed (%s); using heuristic.", exc)
            label = None

    # ── Tier 2: heuristic (always available) ──────────────────────────────────
    if label is None:
        label, confidence = _infer_with_heuristic(audio)
        method = "heuristic"

    elapsed = round(time.perf_counter() - t0, 3)

    return {
        "label":           label,
        "confidence":      confidence,
        "method":          method,
        "processing_time": f"{elapsed}s",
    }
