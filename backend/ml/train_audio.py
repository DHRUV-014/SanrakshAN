"""
Audio deepfake detection — training script.

─────────────────────────────────────────────────────────────────────────────
STEP 1 — FIND THE DATASET ON KAGGLE
─────────────────────────────────────────────────────────────────────────────

Recommended: "Fake or Real" (FoR) dataset
  • Go to kaggle.com and search: "fake or real audio deepfake"
  • Look for the dataset by Mohammed Abdeldayem (or similar FoR uploads)
  • The dataset should have ~4 GB and contain real + fake speech samples
  • Paper reference: Reimao & Tzerpos, 2019 — "FoR: A Dataset for Fake-or-Real Speech"

Alternative: ASVspoof 2019
  • Search kaggle.com for: "asvspoof 2019 LA"
  • Pass --dataset asvspoof (different loader, see below)

Alternative: WaveFake
  • https://zenodo.org/record/5642694  (DOI: 10.5281/zenodo.5642694)
  • Pass --dataset wavefake

─────────────────────────────────────────────────────────────────────────────
STEP 2 — DOWNLOAD VIA KAGGLE CLI
─────────────────────────────────────────────────────────────────────────────

  pip install kaggle
  # Put your kaggle.json API token at ~/.kaggle/kaggle.json
  # (Download from: kaggle.com → Account → API → Create New Token)

  # After finding the dataset on Kaggle, copy its "Copy API command":
  kaggle datasets download -d <owner>/<dataset-slug> -p ./data --unzip

─────────────────────────────────────────────────────────────────────────────
STEP 3 — EXPECTED DIRECTORY STRUCTURE
─────────────────────────────────────────────────────────────────────────────

  FoR / generic Kaggle datasets (--dataset simple):
    <data_dir>/
      real/                ← .wav or .flac files of genuine speech
        LJ001-0001.wav
        ...
      fake/                ← .wav or .flac files of synthetic speech
        generated_001.wav
        ...

  Note: some FoR versions use "training/real" and "training/fake".
        Pass the inner directory as --data_dir in that case.

  ASVspoof 2019 LA (--dataset asvspoof):
    <data_dir>/
      ASVspoof2019_LA_train/flac/
      ASVspoof2019_LA_cm_protocols/ASVspoof2019.LA.cm.train.trn.txt

  WaveFake (--dataset wavefake):
    <data_dir>/
      LJSpeech-1.1/wavs/          ← real
      generated_audio/<vocoder>/  ← fake

─────────────────────────────────────────────────────────────────────────────
STEP 4 — RUN TRAINING  (run this locally, NOT on Render)
─────────────────────────────────────────────────────────────────────────────

  pip install torch torchaudio librosa soundfile tqdm scikit-learn

  python backend/ml/train_audio.py \\
    --data_dir  ./data/for-norm \\
    --dataset   simple \\
    --max_samples 5000 \\
    --epochs    30 \\
    --output    backend/models/audio_model.pth

─────────────────────────────────────────────────────────────────────────────
STEP 5 — DEPLOY
─────────────────────────────────────────────────────────────────────────────

  Commit backend/models/audio_model.pth to git (or upload via Render dashboard).
  The inference service (audio_service.py) auto-detects and uses it as Tier 0.
"""

import argparse
import os
import random
import sys
from pathlib import Path
from typing import List, Tuple

import librosa
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Dataset
from sklearn.metrics import accuracy_score, roc_auc_score
from tqdm import tqdm

sys.path.insert(0, str(Path(__file__).parent))
from audio_cnn import AudioDeepfakeCNN, extract_log_mel, SR, DURATION

SEED = 42
random.seed(SEED)
np.random.seed(SEED)
torch.manual_seed(SEED)


# ─────────────────────────────────────────────────────────────────────────────
# Dataset loaders — each returns List[(path, label)]  label: 1=real, 0=fake
# ─────────────────────────────────────────────────────────────────────────────

def _load_simple(data_dir: Path, max_per_class: int) -> List[Tuple[Path, int]]:
    """
    Generic loader for datasets that have a real/ and fake/ subdirectory.
    Covers: FoR (Fake-or-Real), most Kaggle audio deepfake datasets.

    Also handles nested layouts like:
      data_dir/for-norm/real/  and  data_dir/for-norm/fake/
    by auto-searching up to 2 levels deep.
    """
    audio_exts = {".wav", ".flac", ".mp3", ".ogg"}

    def _find_class_dir(root: Path, names: List[str]) -> Path:
        """Search root and one level of subdirs for a directory matching names."""
        for name in names:
            candidate = root / name
            if candidate.is_dir():
                return candidate
        # Try one level deeper
        for subdir in sorted(root.iterdir()):
            if not subdir.is_dir():
                continue
            for name in names:
                candidate = subdir / name
                if candidate.is_dir():
                    return candidate
        raise FileNotFoundError(
            f"Could not find a '{names[0]}' directory under {root}. "
            f"Check --data_dir. See the script header for expected structure."
        )

    real_dir = _find_class_dir(data_dir, ["real", "Real", "REAL", "genuine"])
    fake_dir = _find_class_dir(data_dir, ["fake", "Fake", "FAKE", "spoof", "synthetic"])

    def _collect(directory: Path, label: int) -> List[Tuple[Path, int]]:
        files = [
            (p, label)
            for p in sorted(directory.rglob("*"))
            if p.suffix.lower() in audio_exts
        ]
        random.shuffle(files)
        return files[:max_per_class]

    reals = _collect(real_dir, 1)
    fakes = _collect(fake_dir, 0)

    print(f"Simple loader — {len(reals)} real + {len(fakes)} fake")
    samples = reals + fakes
    random.shuffle(samples)
    return samples


def _load_asvspoof(data_dir: Path, max_per_class: int) -> List[Tuple[Path, int]]:
    """ASVspoof 2019 LA training split."""
    protocol = (
        data_dir
        / "ASVspoof2019_LA_cm_protocols"
        / "ASVspoof2019.LA.cm.train.trn.txt"
    )
    audio_dir = data_dir / "ASVspoof2019_LA_train" / "flac"

    if not protocol.exists():
        raise FileNotFoundError(f"Protocol not found: {protocol}")
    if not audio_dir.exists():
        raise FileNotFoundError(f"Audio dir not found: {audio_dir}")

    reals, fakes = [], []
    with open(protocol) as f:
        for line in f:
            parts = line.strip().split()
            if len(parts) < 5:
                continue
            file_id, lbl = parts[1], parts[4]
            p = audio_dir / f"{file_id}.flac"
            if not p.exists():
                continue
            (reals if lbl == "bonafide" else fakes).append(p)

    random.shuffle(reals)
    random.shuffle(fakes)
    samples = (
        [(p, 1) for p in reals[:max_per_class]]
        + [(p, 0) for p in fakes[:max_per_class]]
    )
    random.shuffle(samples)
    print(f"ASVspoof 2019 LA — {min(len(reals), max_per_class)} real + {min(len(fakes), max_per_class)} fake")
    return samples


def _load_wavefake(data_dir: Path, max_per_class: int) -> List[Tuple[Path, int]]:
    """WaveFake dataset (Zenodo)."""
    real_dir  = data_dir / "LJSpeech-1.1" / "wavs"
    fake_root = data_dir / "generated_audio"

    if not real_dir.exists():
        raise FileNotFoundError(f"Real dir not found: {real_dir}")
    if not fake_root.exists():
        raise FileNotFoundError(f"Fake root not found: {fake_root}")

    reals = list(sorted(real_dir.glob("*.wav")))
    fakes = [
        p
        for sub in sorted(fake_root.iterdir()) if sub.is_dir()
        for p in sorted(sub.glob("*.wav"))
    ]
    random.shuffle(reals)
    random.shuffle(fakes)
    samples = (
        [(p, 1) for p in reals[:max_per_class]]
        + [(p, 0) for p in fakes[:max_per_class]]
    )
    random.shuffle(samples)
    print(f"WaveFake — {min(len(reals), max_per_class)} real + {min(len(fakes), max_per_class)} fake")
    return samples


LOADERS = {
    "simple":   _load_simple,
    "asvspoof": _load_asvspoof,
    "wavefake": _load_wavefake,
}


# ─────────────────────────────────────────────────────────────────────────────
# PyTorch Dataset
# ─────────────────────────────────────────────────────────────────────────────

class AudioDataset(Dataset):
    def __init__(self, samples: List[Tuple[Path, int]], augment: bool = False):
        self.samples = samples
        self.augment = augment

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx: int):
        path, label = self.samples[idx]
        try:
            audio, _ = librosa.load(str(path), sr=SR, mono=True, duration=DURATION)
        except Exception as e:
            print(f"  Warning: could not load {path}: {e}")
            audio = np.zeros(int(SR * DURATION), dtype=np.float32)

        peak = np.abs(audio).max()
        if peak > 0:
            audio = audio / peak

        if self.augment:
            audio = _augment(audio)

        x = extract_log_mel(audio)
        return torch.tensor(x, dtype=torch.float32), torch.tensor(label, dtype=torch.long)


def _augment(audio: np.ndarray) -> np.ndarray:
    """Random gain ± 3 dB + optional low-SNR noise."""
    gain = 10 ** (random.uniform(-0.3, 0.3) / 20)
    audio = audio * gain
    if random.random() < 0.5:
        audio = audio + np.random.randn(len(audio)).astype(np.float32) * 0.001
    peak = np.abs(audio).max()
    if peak > 0:
        audio = audio / peak
    return audio


# ─────────────────────────────────────────────────────────────────────────────
# Training
# ─────────────────────────────────────────────────────────────────────────────

def train(args):
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")

    data_dir = Path(args.data_dir)
    loader_fn = LOADERS[args.dataset]
    samples   = loader_fn(data_dir, args.max_samples)

    if len(samples) < 20:
        raise RuntimeError(
            "Too few samples found. Double-check --data_dir and --dataset. "
            "See the script header for the expected directory layout."
        )

    # 80 / 20 split
    random.shuffle(samples)
    cut = int(len(samples) * 0.8)
    train_ds = AudioDataset(samples[:cut],  augment=True)
    val_ds   = AudioDataset(samples[cut:],  augment=False)

    train_loader = DataLoader(
        train_ds, batch_size=args.batch_size,
        shuffle=True, num_workers=args.num_workers,
    )
    val_loader = DataLoader(
        val_ds, batch_size=args.batch_size,
        shuffle=False, num_workers=args.num_workers,
    )
    print(f"Train: {len(train_ds)}  Val: {len(val_ds)}")

    model     = AudioDeepfakeCNN().to(device)
    n_params  = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"Model parameters: {n_params:,}")

    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.epochs)
    criterion = nn.CrossEntropyLoss()

    best_val_acc = 0.0
    best_state   = None

    for epoch in range(1, args.epochs + 1):
        # ── Train ─────────────────────────────────────────────────────────────
        model.train()
        running_loss = 0.0
        train_preds, train_labels = [], []

        for x, y in tqdm(train_loader, desc=f"Epoch {epoch:3d}/{args.epochs}", leave=False):
            x, y = x.to(device), y.to(device)
            optimizer.zero_grad()
            logits = model(x)
            loss   = criterion(logits, y)
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()

            running_loss += loss.item() * len(y)
            train_preds.extend(logits.argmax(1).cpu().tolist())
            train_labels.extend(y.cpu().tolist())

        scheduler.step()
        train_acc  = accuracy_score(train_labels, train_preds)
        train_loss = running_loss / len(train_ds)

        # ── Validate ──────────────────────────────────────────────────────────
        model.eval()
        val_preds, val_labels, val_probs = [], [], []

        with torch.no_grad():
            for x, y in val_loader:
                logits = model(x.to(device))
                probs  = torch.softmax(logits, dim=1)[:, 1]   # P(real)
                val_preds.extend(logits.argmax(1).cpu().tolist())
                val_labels.extend(y.tolist())
                val_probs.extend(probs.cpu().tolist())

        val_acc = accuracy_score(val_labels, val_preds)
        try:
            val_auc = roc_auc_score(val_labels, val_probs)
        except Exception:
            val_auc = float("nan")

        marker = "✓" if val_acc > best_val_acc else " "
        print(
            f"  {marker} epoch {epoch:3d} | "
            f"loss {train_loss:.4f} | "
            f"train {train_acc:.3f} | "
            f"val acc {val_acc:.3f} | "
            f"val AUC {val_auc:.3f}"
        )

        if val_acc > best_val_acc:
            best_val_acc = val_acc
            best_state   = {k: v.clone() for k, v in model.state_dict().items()}

    # ── Save best checkpoint as TorchScript ───────────────────────────────────
    print(f"\nBest val accuracy: {best_val_acc:.4f}")
    model.load_state_dict(best_state)
    model.eval().cpu()

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    example = torch.zeros(1, 1, 128, 300)
    scripted = torch.jit.trace(model, example)
    torch.jit.save(scripted, str(output_path))

    size_mb = output_path.stat().st_size / 1_048_576
    print(f"Saved TorchScript model → {output_path.resolve()}  ({size_mb:.1f} MB)")
    print()
    print("Next steps:")
    print("  1. Commit backend/models/audio_model.pth to your repo")
    print("     (or upload it via the Render dashboard)")
    print("  2. Redeploy — the inference service auto-detects it as Tier 0")


# ─────────────────────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    p = argparse.ArgumentParser(
        description="Train audio deepfake CNN — see script header for dataset setup"
    )
    p.add_argument(
        "--data_dir", required=True,
        help="Path to dataset root directory",
    )
    p.add_argument(
        "--dataset", default="simple",
        choices=list(LOADERS.keys()),
        help=(
            "Dataset format: "
            "'simple' = real/ + fake/ folders (FoR / most Kaggle datasets), "
            "'asvspoof' = ASVspoof 2019 LA, "
            "'wavefake' = WaveFake (Zenodo). "
            "Default: simple"
        ),
    )
    p.add_argument(
        "--max_samples", type=int, default=5000,
        help="Max samples per class (default: 5000)",
    )
    p.add_argument(
        "--epochs", type=int, default=30,
        help="Training epochs (default: 30)",
    )
    p.add_argument(
        "--batch_size", type=int, default=32,
        help="Batch size (default: 32)",
    )
    p.add_argument(
        "--lr", type=float, default=1e-3,
        help="Initial learning rate (default: 1e-3)",
    )
    p.add_argument(
        "--num_workers", type=int, default=4,
        help="DataLoader workers (default: 4; set 0 on Windows)",
    )
    p.add_argument(
        "--output", default="../models/audio_model.pth",
        help="Output path for saved TorchScript model (default: ../models/audio_model.pth)",
    )
    train(p.parse_args())
