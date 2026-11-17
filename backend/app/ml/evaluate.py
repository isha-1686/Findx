"""Evaluate the trained ResNet18 classifier on a held-out test split.

Run from the backend/ directory:
    python -m app.ml.evaluate
"""
from pathlib import Path
import json
import torch
from torch.utils.data import DataLoader, Subset
from torchvision import datasets, transforms
from sklearn.metrics import classification_report, confusion_matrix
from app.ml.model import ItemNet

ROOT = Path("data/raw")
MODEL_PATH = Path("data/models/best_model.pth")
CLASS_NAMES_PATH = Path("data/models/class_names.json")
TEST_RATIO = 0.2
SEED = 42


def main():
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Train the model first: python -m app.ml.train\n(Expected: {MODEL_PATH.resolve()})")

    class_names = json.loads(CLASS_NAMES_PATH.read_text(encoding="utf-8"))
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])

    dataset = datasets.ImageFolder(ROOT, transform=transform)
    n = len(dataset)
    test_size = max(1, int(TEST_RATIO * n))

    # Reproduce the same split used in train.py
    import random
    random.seed(SEED)
    indices = list(range(n))
    random.shuffle(indices)
    test_indices = indices[n - test_size:]
    test_set = Subset(dataset, test_indices)

    loader = DataLoader(test_set, batch_size=32, shuffle=False, num_workers=0)

    model = ItemNet(len(class_names))
    state = torch.load(MODEL_PATH, map_location=device, weights_only=True)
    model.load_state_dict(state)
    model.to(device).eval()

    all_preds, all_labels = [], []
    with torch.inference_mode():
        for images, labels in loader:
            images = images.to(device)
            logits, _ = model(images)
            preds = logits.argmax(dim=1).cpu().tolist()
            all_preds.extend(preds)
            all_labels.extend(labels.tolist())

    print("=" * 60)
    print("Classification Report")
    print("=" * 60)
    print(classification_report(all_labels, all_preds, target_names=class_names))

    cm = confusion_matrix(all_labels, all_preds)
    print("Confusion Matrix (rows=actual, cols=predicted):")
    header = " " * 14 + "  ".join(f"{c[:6]:>6}" for c in class_names)
    print(header)
    for i, row in enumerate(cm):
        print(f"{class_names[i]:<14}" + "  ".join(f"{v:>6}" for v in row))


if __name__ == "__main__":
    main()
