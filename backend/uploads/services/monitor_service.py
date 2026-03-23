"""
Lightweight monitoring service for video call deepfake detection.
Analyzes single frames with rolling window for smoothing.
"""
import cv2
import numpy as np
from collections import deque
from utils.face_engine import FaceEngine
from utils.liveness_detector import LivenessDetector


class VideoCallMonitor:
    """
    Monitors video call frames for deepfake detection.
    Uses rolling window of frames for reflectance analysis and score smoothing.
    """

    def __init__(self, window_size: int = 5):
        self.window_size = window_size
        self.face_engine = FaceEngine()
        self.liveness_detector = LivenessDetector()
        self.frame_buffer = deque(maxlen=6)  # Store up to 6 frames for reflectance
        self.score_history = deque(maxlen=window_size)  # Last N scores for smoothing

    def analyze_frame(self, frame: np.ndarray) -> dict:
        """
        Analyze a single frame for liveness/deepfake detection.
        Returns: {
            "authentic": bool,
            "deepfake_risk": float,
            "liveness_score": float
        }
        """
        # Face detection
        face = self.face_engine.extract_face(frame)
        if face is None:
            # No face detected - assume authentic but low confidence
            score = 0.3
            self.score_history.append(score)
            smoothed_risk = 1.0 - np.mean(self.score_history) if self.score_history else 0.7
            return {
                "authentic": True,
                "deepfake_risk": float(smoothed_risk),
                "liveness_score": float(score),
            }

        # Add frame to buffer
        self.frame_buffer.append(frame.copy())

        # Liveness signals (blink + head movement)
        blink_detected = False
        head_moved = False
        try:
            blink_detected = self.liveness_detector.detect_blink(frame)
            head_moved = self.liveness_detector.detect_head_movement(frame)
        except Exception:
            pass

        # Simplified reflectance analysis if we have enough frames
        reflectance_score = 0.0
        if len(self.frame_buffer) >= 3:
            try:
                # Use last 3 frames as a mini baseline/flash comparison
                recent_frames = list(self.frame_buffer)[-3:]
                red_means = []

                for f in recent_frames:
                    f_face = self.face_engine.extract_face(f)
                    if f_face is not None:
                        h, w = f_face.shape[:2]
                        x1 = int(w * 0.3)
                        x2 = int(w * 0.7)
                        y1 = int(h * 0.15)
                        y2 = int(h * 0.45)
                        roi = f_face[y1:y2, x1:x2]
                        if roi.size > 0:
                            red_channel = roi[:, :, 2]
                            red_means.append(np.mean(red_channel))

                if len(red_means) >= 2:
                    # Check for variation (indicates real reflectance response)
                    red_std = float(np.std(red_means))
                    if red_std > 1.0:  # Some variation indicates real response
                        reflectance_score = 0.3
            except Exception:
                pass

        # Compute liveness score
        score = 0.0
        if blink_detected:
            score += 0.3
        if head_moved:
            score += 0.3
        score += reflectance_score

        # Cap score at 1.0
        score = min(score, 1.0)

        # Add to history for smoothing
        self.score_history.append(score)

        # Compute smoothed deepfake risk
        smoothed_score = float(np.mean(self.score_history)) if self.score_history else score
        deepfake_risk = 1.0 - smoothed_score

        return {
            "authentic": smoothed_score >= 0.5,
            "deepfake_risk": float(deepfake_risk),
            "liveness_score": float(smoothed_score),
        }
