import cv2
import numpy as np

try:
    import mediapipe as mp
    _MP_AVAILABLE = True
except Exception:
    mp = None
    _MP_AVAILABLE = False


class LivenessDetector:
    """
    Combines blink and head-movement cues using MediaPipe FaceMesh.
    Falls back gracefully if FaceMesh is unavailable in the environment.
    """

    def __init__(self, ear_threshold: float = 0.21, movement_threshold: float = 0.02):
        self.ear_threshold = ear_threshold
        self.movement_threshold = movement_threshold

        self._face_mesh = None
        self._left_eye_indices = []
        self._right_eye_indices = []
        self._prev_nose = None  # (x, y) in normalized coordinates

        try:
            mp_solutions = getattr(mp, "solutions", None) if _MP_AVAILABLE else None
            if mp_solutions is not None and hasattr(mp_solutions, "face_mesh"):
                mp_face_mesh = mp_solutions.face_mesh
                self._face_mesh = mp_face_mesh.FaceMesh(
                    static_image_mode=False,
                    max_num_faces=1,
                    refine_landmarks=True,
                    min_detection_confidence=0.5,
                    min_tracking_confidence=0.5,
                )

                # Eye landmarks (MediaPipe FaceMesh indices)
                # Left eye
                self._left_eye_indices = [33, 160, 158, 133, 153, 144]
                # Right eye
                self._right_eye_indices = [362, 385, 387, 263, 373, 380]
        except Exception:
            # If anything fails, we keep FaceMesh disabled and just return no liveness cues.
            self._face_mesh = None
            self._left_eye_indices = []
            self._right_eye_indices = []
            self._prev_nose = None

    @staticmethod
    def _euclidean_dist(p1, p2):
        return np.linalg.norm(np.array(p1) - np.array(p2))

    def _compute_ear(self, landmarks, indices, image_width, image_height):
        pts = []
        for idx in indices:
            lm = landmarks[idx]
            pts.append((lm.x * image_width, lm.y * image_height))

        # p1-p4: horizontal, p2-p6 & p3-p5: vertical pairs
        p1, p2, p3, p4, p5, p6 = pts

        vert_1 = self._euclidean_dist(p2, p6)
        vert_2 = self._euclidean_dist(p3, p5)
        horiz = self._euclidean_dist(p1, p4)

        if horiz == 0:
            return 0.0

        ear = (vert_1 + vert_2) / (2.0 * horiz)
        return ear

    def _process_frame(self, frame: np.ndarray):
        """
        Runs FaceMesh on the frame and returns face_landmarks list (or None).
        """
        if self._face_mesh is None:
            return None

        if frame is None or frame.size == 0:
            return None

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        result = self._face_mesh.process(rgb)
        if not result.multi_face_landmarks:
            return None

        return result.multi_face_landmarks[0].landmark

    # --------------------------------------------------
    # Blink detection
    # --------------------------------------------------
    def detect_blink(self, frame: np.ndarray) -> bool:
        """
        Returns True if a blink is detected in the given BGR frame.
        """
        if (
            self._face_mesh is None
            or not self._left_eye_indices
            or not self._right_eye_indices
        ):
            return False

        h, w = frame.shape[:2]
        landmarks = self._process_frame(frame)
        if landmarks is None:
            return False

        left_ear = self._compute_ear(landmarks, self._left_eye_indices, w, h)
        right_ear = self._compute_ear(landmarks, self._right_eye_indices, w, h)

        ear = (left_ear + right_ear) / 2.0
        return ear < self.ear_threshold

    # --------------------------------------------------
    # Head movement detection
    # --------------------------------------------------
    def detect_head_movement(self, frame: np.ndarray) -> bool:
        """
        Returns True if head movement above threshold is detected
        based on the displacement of the nose landmark (index 1)
        between consecutive frames.
        """
        if self._face_mesh is None:
            return False

        landmarks = self._process_frame(frame)
        if landmarks is None:
            return False

        nose = landmarks[1]
        current = (nose.x, nose.y)  # normalized coordinates

        if self._prev_nose is None:
            self._prev_nose = current
            return False

        dx = current[0] - self._prev_nose[0]
        dy = current[1] - self._prev_nose[1]
        movement = float(np.sqrt(dx * dx + dy * dy))

        self._prev_nose = current

        return movement > self.movement_threshold

