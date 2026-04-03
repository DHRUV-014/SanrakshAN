"""
Video deepfake detection — training script.

Dataset: Pre-extracted face frames from FaceForensics++ & Celeb-DF
  Layout expected:
    data_dir/
        train/real/*.png  (or .jpg)
        train/fake/*.png
        validation/real/*.png
        validation/fake/*.png
        test/real/*.png         (optional)
        test/fake/*.png

Architecture: MobileNetV3-Small pretrained on ImageNet, fine-tuned binary.
  - 2.5 MB model
  - CPU inference: ~5ms per frame, ~40ms for 8 frames
  - Frame-level predictions aggregated at inference time

Usage:
    python train_video.py --data_dir /path/to/dataset
    python train_video.py --data_dir /path/to/dataset --epochs 20 --batch_size 32
"""

import argparse
import random
import sys
import time
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Dataset
from torchvision import transforms
from torchvision.models import mobilenet_v3_small, MobileNet_V3_Small_Weights
from PIL import Image

SEED = 42
random.seed(SEED)
np.random.seed(SEED)
torch.manual_seed(SEED)

IMG_EXTS = {".png", ".jpg", ".jpeg"}


# ── Dataset ────────────────────────────────────────────────────────────────────

class FaceFrameDataset(Dataset):
    def __init__(self, real_dir: Path, fake_dir: Path, transform):
        real_files = [f for f in real_dir.glob("*") if f.suffix.lower() in IMG_EXTS]
        fake_files = [f for f in fake_dir.glob("*") if f.suffix.lower() in IMG_EXTS]
        self.files  = real_files + fake_files
        self.labels = [0] * len(real_files) + [1] * len(fake_files)  # 0=real, 1=fake
        self.transform = transform

        combined = list(zip(self.files, self.labels))
        random.shuffle(combined)
        self.files, self.labels = zip(*combined)

    def __len__(self):
        return len(self.files)

    def __getitem__(self, idx):
        img = Image.open(self.files[idx]).convert("RGB")
        return self.transform(img), torch.tensor(self.labels[idx], dtype=torch.long)


def get_transforms(train: bool):
    if train:
        return transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.RandomHorizontalFlip(),
            transforms.ColorJitter(brightness=0.1, contrast=0.1, saturation=0.05),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
        ])
    return transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])


# ── Model ──────────────────────────────────────────────────────────────────────

def build_model() -> nn.Module:
    model = mobilenet_v3_small(weights=MobileNet_V3_Small_Weights.DEFAULT)
    in_features = model.classifier[3].in_features
    model.classifier[3] = nn.Linear(in_features, 2)
    return model


# ── Training helpers ───────────────────────────────────────────────────────────

def train_epoch(model, loader, optimizer, criterion, device):
    model.train()
    total_loss = correct = total = 0
    for imgs, labels in loader:
        imgs, labels = imgs.to(device), labels.to(device)
        optimizer.zero_grad()
        loss = criterion(model(imgs), labels)
        loss.backward()
        optimizer.step()
        total_loss += loss.item() * len(labels)
        correct    += (model(imgs).argmax(1) == labels).sum().item()
        total      += len(labels)
    return total_loss / total, correct / total


@torch.no_grad()
def eval_epoch(model, loader, criterion, device):
    model.eval()
    total_loss = correct = total = 0
    all_preds, all_labels = [], []
    for imgs, labels in loader:
        imgs, labels = imgs.to(device), labels.to(device)
        logits = model(imgs)
        loss   = criterion(logits, labels)
        preds  = logits.argmax(1)
        total_loss += loss.item() * len(labels)
        correct    += (preds == labels).sum().item()
        total      += len(labels)
        all_preds.extend(preds.cpu().tolist())
        all_labels.extend(labels.cpu().tolist())
    return total_loss / total, correct / total, all_preds, all_labels


def confusion_str(preds, labels):
    tp = sum(p == 1 and l == 1 for p, l in zip(preds, labels))
    tn = sum(p == 0 and l == 0 for p, l in zip(preds, labels))
    fp = sum(p == 1 and l == 0 for p, l in zip(preds, labels))
    fn = sum(p == 0 and l == 1 for p, l in zip(preds, labels))
    prec = tp / (tp + fp + 1e-8)
    rec  = tp / (tp + fn + 1e-8)
    f1   = 2 * prec * rec / (prec + rec + 1e-8)
    return (
        f"  Confusion (REAL=0, FAKE=1):\n"
        f"    TN={tn}  FP={fp}  FN={fn}  TP={tp}\n"
        f"  Precision={prec:.3f}  Recall={rec:.3f}  F1={f1:.3f}"
    )


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data_dir",   required=True)
    parser.add_argument("--epochs",     type=int,   default=20)
    parser.add_argument("--batch_size", type=int,   default=32)
    parser.add_argument("--lr",         type=float, default=3e-4)
    parser.add_argument("--freeze_epochs", type=int, default=3,
                        help="Freeze backbone for first N epochs")
    parser.add_argument("--output",     default="../models/video_model.pth")
    args = parser.parse_args()

    device = torch.device("mps" if torch.backends.mps.is_available() else
                          "cuda" if torch.cuda.is_available() else "cpu")

    data = Path(args.data_dir)

    print(f"\n{'='*60}")
    print("  SanrakshAN — Video Deepfake Detector Training")
    print(f"{'='*60}")
    print(f"  Device:     {device}")
    print(f"  Data dir:   {data}")
    print(f"  Epochs:     {args.epochs}  |  Batch: {args.batch_size}  |  LR: {args.lr}")
    print(f"  Output:     {args.output}")
    print(f"{'='*60}\n")

    # ── Datasets ──────────────────────────────────────────────────────────────
    splits = {}
    for split in ("train", "validation", "test"):
        r = data / split / "real"
        f = data / split / "fake"
        if r.is_dir() and f.is_dir():
            splits[split] = (r, f)

    if "train" not in splits:
        # Flat layout: data_dir/real/, data_dir/fake/
        r, f = data / "real", data / "fake"
        if not (r.is_dir() and f.is_dir()):
            print("❌ Expected train/real, train/fake directories (or real/, fake/ at root).")
            sys.exit(1)
        splits["train"] = (r, f)

    trn_ds = FaceFrameDataset(*splits["train"], get_transforms(train=True))
    val_r, val_f = splits.get("validation", splits.get("test", splits["train"]))
    val_ds = FaceFrameDataset(val_r, val_f, get_transforms(train=False))

    n_real = sum(1 for l in trn_ds.labels if l == 0)
    n_fake = sum(1 for l in trn_ds.labels if l == 1)
    print(f"  Train: {len(trn_ds)} ({n_real} real, {n_fake} fake)")
    print(f"  Val:   {len(val_ds)}\n")

    # Class weights to handle imbalance
    w_real = len(trn_ds) / (2 * max(n_real, 1))
    w_fake = len(trn_ds) / (2 * max(n_fake, 1))
    weights = torch.tensor([w_real, w_fake], dtype=torch.float32).to(device)

    trn_loader = DataLoader(trn_ds, batch_size=args.batch_size, shuffle=True,  num_workers=0)
    val_loader = DataLoader(val_ds, batch_size=64,             shuffle=False, num_workers=0)

    # ── Model ─────────────────────────────────────────────────────────────────
    model = build_model().to(device)

    # Freeze backbone initially
    if args.freeze_epochs > 0:
        for p in model.features.parameters():
            p.requires_grad = False

    n_trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"  Model: MobileNetV3-Small  |  Trainable params: {n_trainable:,}")
    print(f"  (backbone {'frozen' if args.freeze_epochs > 0 else 'unfrozen'} for first {args.freeze_epochs} epochs)\n")

    criterion = nn.CrossEntropyLoss(weight=weights)
    optimizer = torch.optim.AdamW(
        filter(lambda p: p.requires_grad, model.parameters()),
        lr=args.lr, weight_decay=1e-4
    )
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.epochs, eta_min=1e-6)

    best_val_acc = 0.0
    best_state   = None

    print(f"  {'Ep':>3}  {'TrnLoss':>8}  {'TrnAcc':>7}  {'ValLoss':>8}  {'ValAcc':>7}  {'LR':>8}")
    print(f"  {'─'*54}")

    for epoch in range(1, args.epochs + 1):

        # Unfreeze backbone after freeze_epochs
        if epoch == args.freeze_epochs + 1:
            for p in model.parameters():
                p.requires_grad = True
            optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr * 0.2, weight_decay=1e-4)
            scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(
                optimizer, T_max=args.epochs - epoch, eta_min=1e-6
            )
            print(f"\n  [epoch {epoch}] Backbone unfrozen — lr → {args.lr * 0.2:.1e}\n")

        t0 = time.perf_counter()
        trn_loss, trn_acc = train_epoch(model, trn_loader, optimizer, criterion, device)
        val_loss, val_acc, preds, gt = eval_epoch(model, val_loader, criterion, device)
        scheduler.step()
        elapsed = time.perf_counter() - t0

        lr_now = optimizer.param_groups[0]["lr"]
        mark   = " ✓" if val_acc > best_val_acc else ""
        print(f"  {epoch:>3}  {trn_loss:>8.4f}  {trn_acc:>7.3f}  {val_loss:>8.4f}  {val_acc:>7.3f}  {lr_now:>8.2e}  {elapsed:.1f}s{mark}")

        if val_acc > best_val_acc:
            best_val_acc = val_acc
            best_state   = {k: v.clone() for k, v in model.state_dict().items()}

    # ── Save ──────────────────────────────────────────────────────────────────
    print(f"\n{'─'*60}")
    print(f"  Best val accuracy: {best_val_acc*100:.2f}%")
    print(confusion_str(preds, gt))

    model.load_state_dict(best_state)
    model.eval()
    model.to("cpu")

    scripted = torch.jit.trace(model, torch.zeros(1, 3, 224, 224))
    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    torch.jit.save(scripted, str(out))

    print(f"\n  ✅ Saved → {out}  ({out.stat().st_size/1e6:.1f} MB)")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
