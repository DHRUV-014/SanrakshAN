"""
Face Engine
===========
MediaPipe Tasks Face Detector (TFLite) with OpenCV Haar cascade fallback.
Falls back automatically when libGLESv2 (OpenGL ES) is unavailable (e.g. Render cloud).
"""

from __future__ import annotations
from typing import List, Dict, Optional
import os
import cv2
import numpy as np


def _try_load_mediapipe():
    """Returns (Image, ImageFormat, vision, base_options) or None if unavailable."""
    try:
        from mediapipe import Image, ImageFormat
        from mediapipe.tasks.python import vision
        from mediapipe.tasks.python.core import base_options
        return Image, ImageFormat, vision, base_options
    except Exception:
        return None


_MP = _try_load_mediapipe()


class FaceEngine:
    def __init__(self) -> None:
        self._use_mediapipe = False
        self._detector = None

        if _MP is not None:
            Image, ImageFormat, vision, base_options = _MP
            BASE_DIR = os.path.dirname(os.path.dirname(__file__))
            model_path = os.path.join(BASE_DIR, "models", "face_detector.tflite")
            try:
                options = vision.FaceDetectorOptions(
                    base_options=base_options.BaseOptions(model_asset_path=model_path),
                    running_mode=vision.RunningMode.IMAGE,
                    min_detection_confidence=0.6,
                )
                self._detector = vision.FaceDetector.create_from_options(options)
                self._use_mediapipe = True
            except Exception as e:
                print(f"MediaPipe FaceDetector unavailable ({e}), falling back to OpenCV.")

        if not self._use_mediapipe:
            # OpenCV Haar cascade — works everywhere, no GPU required
            cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
            self._cascade = cv2.CascadeClassifier(cascade_path)
            print("FaceEngine: using OpenCV Haar cascade fallback.")

    # --------------------------------------------------
    # PUBLIC
    # --------------------------------------------------
    def process_image(self, image_bytes: bytes) -> List[Dict[str, np.ndarray]]:
        image = self._bytes_to_bgr(image_bytes)
        if image is None:
            return []
        return self._extract_faces(image)

    def extract_face(self, frame: np.ndarray) -> Optional[np.ndarray]:
        faces = self._extract_faces(frame)
        if not faces:
            return None
        return faces[0]["face"]

    # --------------------------------------------------
    # CORE DETECTION
    # --------------------------------------------------
    def _extract_faces(self, image: np.ndarray) -> List[Dict[str, np.ndarray]]:
        if self._use_mediapipe:
            return self._detect_mediapipe(image)
        return self._detect_opencv(image)

    def _detect_mediapipe(self, image: np.ndarray) -> List[Dict[str, np.ndarray]]:
        Image, ImageFormat, vision, base_options = _MP
        h, w = image.shape[:2]
        mp_image = Image(
            image_format=ImageFormat.SRGB,
            data=cv2.cvtColor(image, cv2.COLOR_BGR2RGB),
        )
        result = self._detector.detect(mp_image)
        if not result.detections:
            return []

        faces = []
        for det in result.detections:
            box = det.bounding_box
            x1 = max(0, int(box.origin_x))
            y1 = max(0, int(box.origin_y))
            x2 = min(w, int(x1 + box.width))
            y2 = min(h, int(y1 + box.height))
            face = image[y1:y2, x1:x2]
            if face.size == 0:
                continue
            faces.append({
                "full": face.copy(),
                "face": face.copy(),
                "model": cv2.resize(face, (224, 224)),
            })
        return faces

    def _detect_opencv(self, image: np.ndarray) -> List[Dict[str, np.ndarray]]:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        detections = self._cascade.detectMultiScale(
            gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60)
        )
        faces = []
        if len(detections) == 0:
            # No face found — treat entire image as face crop for the model
            faces.append({
                "full": image.copy(),
                "face": image.copy(),
                "model": cv2.resize(image, (224, 224)),
            })
            return faces

        for (x, y, fw, fh) in detections:
            face = image[y:y+fh, x:x+fw]
            if face.size == 0:
                continue
            faces.append({
                "full": face.copy(),
                "face": face.copy(),
                "model": cv2.resize(face, (224, 224)),
            })
        return faces

    # --------------------------------------------------
    @staticmethod
    def _bytes_to_bgr(image_bytes: bytes):
        data = np.frombuffer(image_bytes, dtype=np.uint8)
        return cv2.imdecode(data, cv2.IMREAD_COLOR)
