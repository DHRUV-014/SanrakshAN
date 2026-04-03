"""
Video frame extraction utilities for deepfake detection.

Design choices:
- Uniform sampling (not random) for reproducible inference
- Resize to 224x224 for MobileNetV3 compatibility
- Face crop when face is detected (improves accuracy on face deepfakes)
  with full-frame fallback when no face is found
- Returns normalized tensors ready for torchvision models
"""

import os
import subprocess
import shutil
import tempfile
from pathlib import Path
from typing import Optional

import cv2
import numpy as np


# ImageNet normalization (matches MobileNetV3 pretrain)
_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
_STD  = np.array([0.229, 0.224, 0.225], dtype=np.float32)

IMG_SIZE = 224


def _find_ffmpeg() -> str:
    found = shutil.which("ffmpeg")
    if found:
        return found
    for p in ("/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg", "/usr/bin/ffmpeg"):
        if os.path.isfile(p):
            return p
    return "ffmpeg"


def preprocess_frame(frame_bgr: np.ndarray) -> np.ndarray:
    """
    BGR frame → normalized float32 (3, 224, 224) tensor (C, H, W).
    """
    rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    resized = cv2.resize(rgb, (IMG_SIZE, IMG_SIZE), interpolation=cv2.INTER_LINEAR)
    arr = resized.astype(np.float32) / 255.0
    arr = (arr - _MEAN) / _STD
    return arr.transpose(2, 0, 1)  # (3, H, W)


def extract_frames(
    video_path: str,
    n_frames: int = 8,
    face_crop: bool = True,
    face_scale: float = 1.3,
) -> Optional[np.ndarray]:
    """
    Sample n_frames uniformly from the video.

    Returns:
        np.ndarray of shape (n_frames, 3, 224, 224), float32
        or None if the video cannot be read / has no valid frames.

    face_crop:
        If True, detect the largest face in each frame and crop around it
        (padded by face_scale). Falls back to full frame if no face found.
    face_scale:
        How much wider/taller than the detected face bounding box to crop.
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return None

    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if total <= 0:
        cap.release()
        return None

    # Pick frame indices uniformly
    n = min(n_frames, total)
    if total == 1:
        indices = [0]
    else:
        indices = [int(round(i * (total - 1) / (n - 1))) for i in range(n)]

    face_detector = None
    if face_crop:
        # Use OpenCV's built-in Haar cascade — zero extra deps
        cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        face_detector = cv2.CascadeClassifier(cascade_path)

    frames = []
    for idx in indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
        ok, frame = cap.read()
        if not ok or frame is None:
            continue

        if face_crop and face_detector is not None:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            faces = face_detector.detectMultiScale(
                gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60)
            )
            if len(faces) > 0:
                # Largest face
                x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
                cx, cy = x + w // 2, y + h // 2
                half = int(max(w, h) * face_scale / 2)
                x1 = max(0, cx - half)
                y1 = max(0, cy - half)
                x2 = min(frame.shape[1], cx + half)
                y2 = min(frame.shape[0], cy + half)
                frame = frame[y1:y2, x1:x2]

        if frame.size == 0:
            continue

        frames.append(preprocess_frame(frame))

    cap.release()

    if not frames:
        return None

    # Pad with last frame if fewer frames than requested
    while len(frames) < n_frames:
        frames.append(frames[-1])

    return np.stack(frames, axis=0)  # (n_frames, 3, 224, 224)


def extract_frames_from_video_file(
    video_path: str,
    n_frames: int = 8,
    face_crop: bool = True,
) -> Optional[np.ndarray]:
    """
    Wrapper that handles formats OpenCV can't open by demuxing via ffmpeg first.
    Falls back to OpenCV directly when ffmpeg is unavailable.
    """
    result = extract_frames(video_path, n_frames=n_frames, face_crop=face_crop)
    if result is not None:
        return result

    # OpenCV failed → try extracting individual frames via ffmpeg
    ffmpeg = _find_ffmpeg()
    if not os.path.isfile(ffmpeg) and not shutil.which(ffmpeg):
        return None

    tmp_dir = tempfile.mkdtemp()
    try:
        out_pattern = os.path.join(tmp_dir, "frame_%04d.jpg")
        cmd = [
            ffmpeg, "-y", "-i", video_path,
            "-vf", f"select=not(mod(n\\,10))",  # every 10th frame
            "-vsync", "vfr",
            "-q:v", "2",
            "-frames:v", str(n_frames * 5),  # get more than needed, then subsample
            out_pattern,
        ]
        subprocess.run(cmd, capture_output=True, timeout=60)

        jpgs = sorted(Path(tmp_dir).glob("frame_*.jpg"))
        if not jpgs:
            return None

        # Uniformly subsample
        n = min(n_frames, len(jpgs))
        if n == 1:
            chosen = [jpgs[0]]
        else:
            chosen = [jpgs[int(round(i * (len(jpgs) - 1) / (n - 1)))] for i in range(n)]

        frames = []
        for p in chosen:
            frame = cv2.imread(str(p))
            if frame is not None:
                frames.append(preprocess_frame(frame))

        if not frames:
            return None
        while len(frames) < n_frames:
            frames.append(frames[-1])

        return np.stack(frames, axis=0)

    except Exception:
        return None
    finally:
        import shutil as _sh
        _sh.rmtree(tmp_dir, ignore_errors=True)


def load_video_dataset(
    data_dir: str,
    n_frames: int = 8,
    face_crop: bool = True,
    max_per_class: Optional[int] = None,
    extensions: tuple = (".mp4", ".avi", ".mov", ".mkv"),
) -> tuple[list, list]:
    """
    Load a dataset from a directory containing real/ and fake/ subdirectories.

    Returns:
        (frames_list, labels_list)
        frames_list: list of np.ndarray, each (n_frames, 3, 224, 224)
        labels_list: list of int (0=real, 1=fake)
    """
    data_dir = Path(data_dir)
    real_dirs = [d for d in ("real", "Real", "REAL", "original", "Original") if (data_dir / d).is_dir()]
    fake_dirs = [d for d in ("fake", "Fake", "FAKE", "manipulated", "Fake") if (data_dir / d).is_dir()]

    if not real_dirs or not fake_dirs:
        raise ValueError(
            f"Expected real/ and fake/ subdirectories in {data_dir}. "
            f"Found: {[d.name for d in data_dir.iterdir() if d.is_dir()]}"
        )

    frames_list, labels_list = [], []

    for label_idx, dir_name in [(0, real_dirs[0]), (1, fake_dirs[0])]:
        folder = data_dir / dir_name
        videos = [f for f in folder.rglob("*") if f.suffix.lower() in extensions]

        if max_per_class and len(videos) > max_per_class:
            import random
            random.seed(42)
            videos = random.sample(videos, max_per_class)

        class_name = "REAL" if label_idx == 0 else "FAKE"
        print(f"  Loading {len(videos)} {class_name} videos from {dir_name}/")

        for vid_path in videos:
            frames = extract_frames_from_video_file(
                str(vid_path), n_frames=n_frames, face_crop=face_crop
            )
            if frames is not None:
                frames_list.append(frames)
                labels_list.append(label_idx)
            else:
                print(f"    ⚠ skipped (unreadable): {vid_path.name}")

    return frames_list, labels_list
