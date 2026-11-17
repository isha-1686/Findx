"""Reports API: Full management for Lost and Found item submissions."""
from io import BytesIO
from datetime import datetime, timezone
import uuid
import numpy as np
from PIL import Image
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from app.core.db import get_db
from app.core.auth import get_current_user, get_optional_user
from app.services.storage import upload_item_image, delete_item_image
from app.ml.model import get_predictor

router = APIRouter(prefix="/reports", tags=["Reports"])

VALID_CATEGORIES = [
    "bag", "book", "card", "earphone", "key",
    "lipstick", "phone", "umbrella", "USBflashdisk", "vacuumcup", "other"
]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_report(
    type: str = Form(..., description="'lost' or 'found'"),
    title: str = Form(..., min_length=1, max_length=120),
    description: str = Form(..., min_length=1, max_length=2000),
    location: str = Form(..., min_length=1, max_length=200),
    category: str | None = Form(None),
    contact_info: str | None = Form(None),
    image: UploadFile = File(..., description="Photograph of the item"),
    user: dict = Depends(get_current_user),
):
    """
    Submit a lost or found report with photo.
    Automatically extracts 512-dim visual embeddings and classifies category.
    """
    clean_type = type.strip().lower()
    if clean_type not in {"lost", "found"}:
        raise HTTPException(status_code=400, detail="Type must be 'lost' or 'found'.")

    # Save uploaded image locally
    img_path, img_url = await upload_item_image(image)

    # Compute AI embedding and predicted category
    embedding_bytes = None
    predicted_category = None
    category_confidence = 0.0

    predictor = get_predictor()
    if predictor.model is not None:
        try:
            with open(img_path, "rb") as f:
                pil_img = Image.open(BytesIO(f.read())).convert("RGB")
                res = predictor.predict(pil_img)
                predicted_category = res["predicted_category"]
                category_confidence = round(res["category_confidence"], 4)
                embedding = res["embedding"].astype(np.float32)
                embedding_bytes = embedding.tobytes()
        except Exception as exc:
            print(f"[Warning] Failed to generate embedding: {exc}")

    effective_category = category.strip() if category else (predicted_category or "other")

    item_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    conn = get_db()
    with conn:
        conn.execute("""
            INSERT INTO items (
                id, user_id, type, title, description, location,
                category, contact_info, image_path, image_url,
                embedding, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)
        """, (
            item_id, user["id"], clean_type, title.strip(), description.strip(),
            location.strip(), effective_category, (contact_info or "").strip() or None,
            img_path, img_url, embedding_bytes, now, now
        ))
    conn.close()

    return {
        "message": "Report created successfully",
        "item": {
            "id": item_id,
            "type": clean_type,
            "title": title.strip(),
            "description": description.strip(),
            "location": location.strip(),
            "category": effective_category,
            "contact_info": contact_info,
            "image_url": img_url,
            "status": "open",
            "created_at": now,
            "user_id": user["id"],
            "profiles": {"display_name": user["display_name"]},
        },
        "ai_prediction": {
            "predicted_category": predicted_category,
            "confidence": category_confidence,
            "has_embedding": embedding_bytes is not None,
        }
    }


@router.get("/stats")
def get_stats():
    """Return count summary for lost, found, and resolved reports."""
    conn = get_db()
    cursor = conn.execute("""
        SELECT 
            SUM(CASE WHEN type = 'lost' AND status = 'open' THEN 1 ELSE 0 END) as lost_count,
            SUM(CASE WHEN type = 'found' AND status = 'open' THEN 1 ELSE 0 END) as found_count,
            SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved_count,
            COUNT(*) as total_count
        FROM items
    """)
    row = cursor.fetchone()
    conn.close()

    return {
        "lost": row["lost_count"] or 0,
        "found": row["found_count"] or 0,
        "resolved": row["resolved_count"] or 0,
        "total": row["total_count"] or 0,
    }


@router.get("")
def list_reports(
    type: str | None = None,
    category: str | None = None,
    q: str | None = None,
    user_id: str | None = None,
    status: str | None = "open",
    limit: int = 50,
    offset: int = 0,
):
    """
    List reports with optional filters for type, category, keyword search, or user.
    """
    conditions = []
    params = []

    if status and status != "all":
        conditions.append("i.status = ?")
        params.append(status)

    if type in {"lost", "found"}:
        conditions.append("i.type = ?")
        params.append(type)

    if category:
        conditions.append("LOWER(i.category) = ?")
        params.append(category.strip().lower())

    if user_id:
        conditions.append("i.user_id = ?")
        params.append(user_id)

    if q:
        kw = f"%{q.strip().lower()}%"
        conditions.append("(LOWER(i.title) LIKE ? OR LOWER(i.description) LIKE ? OR LOWER(i.location) LIKE ?)")
        params.extend([kw, kw, kw])

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    query = f"""
        SELECT 
            i.id, i.type, i.title, i.description, i.location, i.category,
            i.contact_info, i.image_url, i.status, i.user_id, i.created_at, i.updated_at,
            u.display_name
        FROM items i
        LEFT JOIN users u ON i.user_id = u.id
        {where_clause}
        ORDER BY i.created_at DESC
        LIMIT ? OFFSET ?
    """
    params.extend([max(1, min(100, limit)), max(0, offset)])

    conn = get_db()
    cursor = conn.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    items = []
    for r in rows:
        items.append({
            "id": r["id"],
            "type": r["type"],
            "title": r["title"],
            "description": r["description"],
            "location": r["location"],
            "category": r["category"],
            "contact_info": r["contact_info"],
            "image_url": r["image_url"],
            "status": r["status"],
            "user_id": r["user_id"],
            "created_at": r["created_at"],
            "profiles": {"display_name": r["display_name"] or "Anonymous"},
        })

    return {"items": items, "count": len(items)}


@router.get("/{item_id}")
def get_report(item_id: str):
    """Get single report by ID."""
    conn = get_db()
    cursor = conn.execute("""
        SELECT 
            i.id, i.type, i.title, i.description, i.location, i.category,
            i.contact_info, i.image_url, i.status, i.user_id, i.created_at, i.updated_at,
            u.display_name
        FROM items i
        LEFT JOIN users u ON i.user_id = u.id
        WHERE i.id = ?
    """, (item_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Report not found.")

    return {
        "id": row["id"],
        "type": row["type"],
        "title": row["title"],
        "description": row["description"],
        "location": row["location"],
        "category": row["category"],
        "contact_info": row["contact_info"],
        "image_url": row["image_url"],
        "status": row["status"],
        "user_id": row["user_id"],
        "created_at": row["created_at"],
        "profiles": {"display_name": row["display_name"] or "Anonymous"},
    }


@router.patch("/{item_id}/status")
def update_status(
    item_id: str,
    status: str = Form(..., description="'open' or 'resolved'"),
    user: dict = Depends(get_current_user),
):
    """Mark a report as resolved or open."""
    new_status = status.strip().lower()
    if new_status not in {"open", "resolved", "closed"}:
        raise HTTPException(status_code=400, detail="Status must be 'open' or 'resolved'.")

    conn = get_db()
    cursor = conn.execute("SELECT user_id FROM items WHERE id = ?", (item_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Report not found.")

    if row["user_id"] != user["id"]:
        conn.close()
        raise HTTPException(status_code=403, detail="You can only update your own reports.")

    now = datetime.now(timezone.utc).isoformat()
    with conn:
        conn.execute("UPDATE items SET status = ?, updated_at = ? WHERE id = ?", (new_status, now, item_id))
    conn.close()

    return {"message": f"Status updated to '{new_status}'", "status": new_status}


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_report(item_id: str, user: dict = Depends(get_current_user)):
    """Delete a report and its stored image."""
    conn = get_db()
    cursor = conn.execute("SELECT user_id, image_path FROM items WHERE id = ?", (item_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Report not found.")

    if row["user_id"] != user["id"]:
        conn.close()
        raise HTTPException(status_code=403, detail="You can only delete your own reports.")

    img_path = row["image_path"]
    with conn:
        conn.execute("DELETE FROM items WHERE id = ?", (item_id,))
    conn.close()

    if img_path:
        delete_item_image(img_path)
