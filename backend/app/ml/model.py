"""Load the fine-tuned ResNet18 classifier and expose category + feature embeddings."""
from pathlib import Path
import json
import torch
import torch.nn as nn
from torchvision import models, transforms
from PIL import Image
from app.core.config import settings


class ItemNet(nn.Module):
    def __init__(self, num_classes: int):
        super().__init__()
        base = models.resnet18(weights=None)
        self.feature_dim = base.fc.in_features
        base.fc = nn.Identity()
        self.backbone = base
        self.classifier = nn.Linear(self.feature_dim, num_classes)

    def forward(self, x):
        features = self.backbone(x)
        logits = self.classifier(features)
        return logits, features


class ItemPredictor:
    def __init__(self):
        self.device = self._choose_device()
        self.model = None
        self.class_names: list[str] = []
        self.transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])
        self.load_error: str | None = None
        self._load()

    @staticmethod
    def _choose_device():
        if settings.device != "auto":
            return torch.device(settings.device)
        return torch.device("cuda" if torch.cuda.is_available() else "cpu")

    def _load(self):
        model_path = Path(settings.model_path)
        names_path = Path(settings.class_names_path)
        if not model_path.exists() or not names_path.exists():
            self.load_error = "Model not trained yet. Run: python -m app.ml.train"
            return
        try:
            self.class_names = json.loads(names_path.read_text(encoding="utf-8"))
            self.model = ItemNet(len(self.class_names))
            state = torch.load(model_path, map_location=self.device, weights_only=True)
            self.model.load_state_dict(state)
            self.model.to(self.device).eval()
        except Exception as exc:
            self.model = None
            self.load_error = f"Could not load model: {exc}"

    def predict(self, image: Image.Image) -> dict:
        if self.model is None:
            raise RuntimeError(self.load_error or "Model unavailable")
        tensor = self.transform(image.convert("RGB")).unsqueeze(0).to(self.device)
        with torch.inference_mode():
            logits, features = self.model(tensor)
            probs = torch.softmax(logits, dim=1)[0]
            confidence, index = torch.max(probs, dim=0)
            embedding = torch.nn.functional.normalize(features, p=2, dim=1)[0]
        return {
            "predicted_category": self.class_names[int(index)],
            "category_confidence": float(confidence),
            "embedding": embedding.cpu().numpy(),
        }


_predictor: ItemPredictor | None = None


def get_predictor() -> ItemPredictor:
    global _predictor
    if _predictor is None:
        _predictor = ItemPredictor()
    return _predictor
