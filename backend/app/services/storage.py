"""Local file storage service for item photographs."""
from pathlib import Path
import uuid
from fastapi import UploadFile, HTTPException
from app.core.config import settings

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_BYTES = 10 * 1024 * 1024  # 10 MB
EXT_MAP = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}

UPLOAD_DIR = Path(settings.upload_dir)


async def upload_item_image(file: UploadFile) -> tuple[str, str]:
    """
    Save an uploaded image to local storage.
    Returns (local_filepath, public_url).
    """
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=415, detail="Please upload a JPG, PNG, or WEBP image.")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(content) > MAX_BYTES:
        raise HTTPException(status_code=413, detail=f"Image must be under {MAX_BYTES // (1024*1024)} MB.")

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    ext = EXT_MAP.get(file.content_type, "jpg")
    filename = f"{uuid.uuid4().hex}.{ext}"
    dest_path = UPLOAD_DIR / filename

    try:
        dest_path.write_bytes(content)
        public_url = f"{settings.base_url}/uploads/{filename}"
        return str(dest_path), public_url
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to save image: {exc}")


def read_item_image(path_or_url: str) -> bytes:
    """Read image bytes from disk or path."""
    p = Path(path_or_url)
    if not p.is_absolute() and not p.exists():
        # Check in uploads
        p = UPLOAD_DIR / path_or_url
    if not p.exists():
        raise FileNotFoundError(f"Image not found on disk: {path_or_url}")
    return p.read_bytes()


def delete_item_image(file_path: str) -> None:
    """Delete image from local storage. Non-fatal on failure."""
    try:
        p = Path(file_path)
        if p.exists():
            p.unlink()
    except Exception:
        pass
