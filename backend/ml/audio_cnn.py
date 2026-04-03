"""
Audio deepfake detection — model architecture + feature extraction.

Shared between training (train_audio.py) and any direct inference use.
In production, the model is saved as TorchScript so this file is only
needed during training.

Architecture: Lightweight CNN on log-Mel spectrograms.
  ~450K parameters.  CPU inference: ~50–100 ms per 3-second clip.
"""

import numpy as np
import torch
import torch.nn as nn

# ── Feature config — must match between training and inference ─────────────────
SR         = 16_000   # sample rate (Hz)
DURATION   = 3.0      # seconds per clip
N_MELS     = 128
N_FFT      = 512
HOP_LENGTH = 160      # 10 ms hop at 16 kHz
N_FRAMES   = int(np.ceil(SR * DURATION / HOP_LENGTH))  # ≈ 300 frames


# ── Feature extraction ─────────────────────────────────────────────────────────

def extract_log_mel(audio: np.ndarray, sr: int = SR) -> np.ndarray:
    """
    Convert a 1-D float32 waveform → log-Mel spectrogram.

    Returns ndarray of shape (1, N_MELS, N_FRAMES) ready for the CNN.
    Audio is padded or truncated to exactly DURATION seconds.
    """
    import librosa

    # Pad / trim to fixed length
    target_len = int(SR * DURATION)
    if len(audio) < target_len:
        audio = np.pad(audio, (0, target_len - len(audio)))
    else:
        audio = audio[:target_len]

    mel = librosa.feature.melspectrogram(
        y=audio, sr=sr,
        n_fft=N_FFT, hop_length=HOP_LENGTH, n_mels=N_MELS,
        fmin=20, fmax=8_000,
    )
    log_mel = librosa.power_to_db(mel, ref=np.max)  # shape: (N_MELS, T)

    # Pad / trim time axis to exactly N_FRAMES
    T = log_mel.shape[1]
    if T < N_FRAMES:
        log_mel = np.pad(log_mel, ((0, 0), (0, N_FRAMES - T)))
    else:
        log_mel = log_mel[:, :N_FRAMES]

    # Instance normalise
    log_mel = (log_mel - log_mel.mean()) / (log_mel.std() + 1e-6)

    return log_mel[np.newaxis, :, :]   # (1, N_MELS, N_FRAMES)


# ── Model ──────────────────────────────────────────────────────────────────────

class AudioDeepfakeCNN(nn.Module):
    """
    Lightweight CNN for binary audio deepfake detection.

    Input:  (B, 1, N_MELS, N_FRAMES) — normalised log-Mel spectrogram
    Output: (B, 2)                    — [fake_logit, real_logit]

    ~450 K trainable parameters.
    """

    def __init__(self, n_mels: int = N_MELS, dropout: float = 0.35):
        super().__init__()

        def _block(in_ch: int, out_ch: int) -> nn.Sequential:
            return nn.Sequential(
                nn.Conv2d(in_ch, out_ch, kernel_size=3, padding=1, bias=False),
                nn.BatchNorm2d(out_ch),
                nn.ReLU(inplace=True),
                nn.MaxPool2d(2, 2),
            )

        self.encoder = nn.Sequential(
            _block(1,   32),    # (B, 32, 64, 150)
            _block(32,  64),    # (B, 64, 32,  75)
            _block(64,  128),   # (B, 128, 16, 37)
            _block(128, 128),   # (B, 128,  8, 18)
        )

        self.pool = nn.AdaptiveAvgPool2d(1)   # (B, 128, 1, 1)

        self.head = nn.Sequential(
            nn.Flatten(),
            nn.Dropout(dropout),
            nn.Linear(128, 64),
            nn.ReLU(inplace=True),
            nn.Dropout(dropout * 0.5),
            nn.Linear(64, 2),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.encoder(x)
        x = self.pool(x)
        return self.head(x)
