import time
import cv2
import numpy as np
from utils.face_engine import FaceEngine
from utils.liveness_detector import LivenessDetector


class ChallengeSession:
    def __init__(self):
        self.frames = []
        self.timestamps = []
        self.start_time = time.time()

        # Advanced liveness detection (blink + head movement)
        self.liveness_detector = LivenessDetector()
        self.blink_count = 0
        self.head_movements = 0

    # --------------------------------------------------
    # Add incoming frame
    # --------------------------------------------------
    def add_frame(self, frame):
        self.frames.append(frame)
        self.timestamps.append(time.time())

        # Liveness cues per frame (blink + head movement)
        try:
            if self.liveness_detector.detect_blink(frame):
                self.blink_count += 1

            if self.liveness_detector.detect_head_movement(frame):
                self.head_movements += 1
        except Exception:
            # Do not let liveness detection failures break the pipeline
            pass

    # --------------------------------------------------
    # Access stored frames
    # --------------------------------------------------
    def get_frames(self):
        return self.frames

    # --------------------------------------------------
    # Retinex Reflectance Analysis with ROI + temporal stability
    # --------------------------------------------------
    def analyze_reflectance(self):
        print("Total frames received:", len(self.frames))

        if len(self.frames) < 6:
            return {"error": "Not enough frames (need baseline + flash frames)"}

        face_engine = FaceEngine()

        baseline_frames = self.frames[:3]
        flash_frames = self.frames[3:]

        baseline_red_means = []
        flash_red_means = []

        # ----------------------------
        # Baseline phase (ROI-based)
        # ----------------------------
        for idx, frame in enumerate(baseline_frames):
            face = face_engine.extract_face(frame)
            print(f"Baseline frame {idx} face detected:", face is not None)

            if face is not None:
                h, w = face.shape[:2]
                x1 = int(w * 0.3)
                x2 = int(w * 0.7)
                y1 = int(h * 0.15)
                y2 = int(h * 0.45)

                roi = face[y1:y2, x1:x2]
                if roi.size == 0:
                    continue

                red_channel = roi[:, :, 2]
                baseline_red_means.append(np.mean(red_channel))

        # ----------------------------
        # Flash phase (ROI-based)
        # ----------------------------
        for idx, frame in enumerate(flash_frames):
            face = face_engine.extract_face(frame)
            print(f"Flash frame {idx} face detected:", face is not None)

            if face is not None:
                h, w = face.shape[:2]
                x1 = int(w * 0.3)
                x2 = int(w * 0.7)
                y1 = int(h * 0.15)
                y2 = int(h * 0.45)

                roi = face[y1:y2, x1:x2]
                if roi.size == 0:
                    continue

                red_channel = roi[:, :, 2]
                flash_red_means.append(np.mean(red_channel))

        if not baseline_red_means or not flash_red_means:
            return {"error": "Face not detected in one or more phases"}

        # --------------------------------------------------
        # STEP 1 / 2: Reflectance using ROI red means
        # --------------------------------------------------
        baseline_mean = np.mean(baseline_red_means)
        flash_mean = np.mean(flash_red_means)

        # Normalized reflectance
        delta_intensity = (flash_mean - baseline_mean) / baseline_mean
        # Clip to a reasonable range to reduce outlier impact
        delta_intensity = np.clip(delta_intensity, -0.2, 0.2)

        # --------------------------------------------------
        # STEP 3: Temporal stability on flash reflectance
        # --------------------------------------------------
        flash_std = float(np.std(flash_red_means))
        reflectance_stable = flash_std < 5

        # --------------------------------------------------
        # STEP 4: Basic head motion from baseline frames
        # --------------------------------------------------
        motion_values = []
        for i in range(1, len(baseline_frames)):
            diff = cv2.absdiff(baseline_frames[i], baseline_frames[i - 1])
            motion = float(np.mean(diff))
            motion_values.append(motion)

        head_motion = float(np.mean(motion_values)) if motion_values else 0.0
        motion_live = head_motion > 1.5

        # --------------------------------------------------
        # STEP 5 / 6: Reflectance threshold + weighted fusion
        # Use magnitude so both brightening and darkening are accepted.
        # --------------------------------------------------
        reflectance_live = abs(delta_intensity) > 0.003

        score = 0.0
        if reflectance_live:
            score += 0.5
        if reflectance_stable:
            score += 0.25
        if motion_live:
            score += 0.25

        # --------------------------------------------------
        # STEP 7: Final decision
        # --------------------------------------------------
        if score >= 0.5:
            verdict = "Live Person"
        else:
            verdict = "Possible Deepfake"

        print("Baseline red mean:", baseline_mean)
        print("Flash red mean:", flash_mean)
        print("Delta intensity:", delta_intensity)
        print("Flash reflectance std:", flash_std)
        print("Head motion metric:", head_motion)
        print("Liveness score:", score)

        # --------------------------------------------------
        # STEP 8: Extended analysis result
        # --------------------------------------------------
        return {
            "baseline_red_mean": float(baseline_mean),
            "flash_red_mean": float(flash_mean),
            "delta_intensity": float(delta_intensity),
            "reflectance_std": float(flash_std),
            "head_motion": float(head_motion),
            "liveness_score": float(score),
            "verdict": verdict,
        }
