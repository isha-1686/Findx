"""Fine-tune ResNet18 on the 10-class lost-and-found dataset.

Expected layout:
    backend/data/raw/<class_name>/<image files>

Classes: bag, book, card, earphone, key, lipstick, phone, umbrella, USBflashdisk, vacuumcup

Run from the backend/ directory:
    python -m app.ml.train
"""
from pathlib import Path
import json
import random
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Subset, random_split
from torchvision import datasets, models, transforms
from app.ml.model import ItemNet

ROOT = Path("data/raw")
OUT = Path("data/models")
EPOCHS = 10
BATCH_SIZE = 32
LEARNING_RATE = 1e-4
SEED = 42


def main():
    random.seed(SEED)
    np.random.seed(SEED)
    torch.manual_seed(SEED)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    if not ROOT.exists():
        raise FileNotFoundError(
            f"Dataset not found at {ROOT.resolve()}. "
            "Make sure data/raw/<class>/<images> exists."
        )

    # --- Transforms ---
    train_transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.RandomHorizontalFlip(),
        transforms.RandomRotation(15),
        transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.15, hue=0.05),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])
    val_transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])

    # --- Dataset ---
    full_dataset = datasets.ImageFolder(ROOT, transform=train_transform)
    if len(full_dataset.classes) < 2 or len(full_dataset) == 0:
        raise RuntimeError(f"Expected class subfolders with images under {ROOT.resolve()}")

    val_size = max(1, int(0.2 * len(full_dataset)))
    train_size = len(full_dataset) - val_size
    indices = list(range(len(full_dataset)))
    random.shuffle(indices)
    train_indices = indices[:train_size]
    val_indices = indices[train_size:]

    # Val set uses val_transform
    val_dataset = datasets.ImageFolder(ROOT, transform=val_transform)
    train_set = Subset(full_dataset, train_indices)
    val_set = Subset(val_dataset, val_indices)

    train_loader = DataLoader(train_set, batch_size=BATCH_SIZE, shuffle=True, num_workers=0, pin_memory=False)
    val_loader = DataLoader(val_set, batch_size=BATCH_SIZE, shuffle=False, num_workers=0, pin_memory=False)

    print(f"Classes ({len(full_dataset.classes)}): {full_dataset.classes}")
    print(f"Train samples: {len(train_set)} | Val samples: {len(val_set)}")

    # --- Model: load ImageNet pretrained backbone ---
    weights = models.ResNet18_Weights.DEFAULT
    pretrained = models.resnet18(weights=weights)
    model = ItemNet(len(full_dataset.classes))
    # Copy pretrained backbone weights (skip fc layer)
    backbone_state = {k: v for k, v in pretrained.state_dict().items() if not k.startswith("fc.")}
    model.backbone.load_state_dict(backbone_state, strict=False)
    model.to(device)

    # --- Optimizer & Loss ---
    criterion = nn.CrossEntropyLoss()
    # Use a lower LR for the backbone (it's already pretrained), higher for the new classifier head
    optimizer = torch.optim.AdamW([
        {"params": model.backbone.parameters(), "lr": LEARNING_RATE * 0.1},
        {"params": model.classifier.parameters(), "lr": LEARNING_RATE},
    ])
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=EPOCHS)

    OUT.mkdir(parents=True, exist_ok=True)
    best_acc = 0.0

    for epoch in range(EPOCHS):
        # --- Train ---
        model.train()
        train_loss = 0.0
        for images, labels in train_loader:
            images, labels = images.to(device), labels.to(device)
            optimizer.zero_grad()
            logits, _ = model(images)
            loss = criterion(logits, labels)
            loss.backward()
            optimizer.step()
            train_loss += loss.item() * images.size(0)
        scheduler.step()

        # --- Validate ---
        model.eval()
        correct = total = 0
        with torch.inference_mode():
            for images, labels in val_loader:
                images, labels = images.to(device), labels.to(device)
                logits, _ = model(images)
                predictions = logits.argmax(dim=1)
                correct += (predictions == labels).sum().item()
                total += labels.size(0)

        val_acc = correct / max(total, 1)
        avg_loss = train_loss / max(train_size, 1)
        print(f"Epoch {epoch + 1:02d}/{EPOCHS} | loss={avg_loss:.4f} | val_acc={val_acc:.4f}")

        if val_acc >= best_acc:
            best_acc = val_acc
            torch.save(model.state_dict(), OUT / "best_model.pth")
            (OUT / "class_names.json").write_text(
                json.dumps(full_dataset.classes, indent=2), encoding="utf-8"
            )
            print(f"  → Saved best model (val_acc={best_acc:.4f})")

    print(f"\nTraining complete. Best val accuracy: {best_acc:.4f}")
    print(f"Saved: {OUT / 'best_model.pth'}")
    print(f"Saved: {OUT / 'class_names.json'}")


if __name__ == "__main__":
    main()
