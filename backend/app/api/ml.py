from io import BytesIO
from fastapi import APIRouter, File, HTTPException, UploadFile
from PIL import Image
from app.ml.model import get_predictor

router = APIRouter(prefix="/ml", tags=["Machine Learning"])


@router.get("/status")
def model_status():
    predictor = get_predictor()
    return {
        "loaded": predictor.model is not None,
        "device": str(predictor.device),
        "classes": predictor.class_names,
        "message": predictor.load_error or "Model loaded",
    }


@router.post("/predict-category")
async def predict_category(image: UploadFile = File(...)):
    predictor = get_predictor()
    if predictor.model is None:
        raise HTTPException(status_code=503, detail=predictor.load_error)
    try:
        parsed = Image.open(BytesIO(await image.read())).convert("RGB")
        result = predictor.predict(parsed)
        return {
            "predicted_category": result["predicted_category"],
            "confidence": round(result["category_confidence"], 4),
        }
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not process image: {exc}")
