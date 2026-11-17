"""AI-Powered Visual & Multimodal Matching Engine for Lost & Found Items."""
from io import BytesIO
from pathlib import Path
from datetime import datetime, timezone
import numpy as np
from PIL import Image
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from app.core.db import get_db
from app.core.auth import get_current_user
from app.ml.model import get_predictor
from app.services.storage import read_item_image

router = APIRouter(prefix="/matching", tags=["AI Matching"])

VISUAL_WEIGHT = 0.70
CATEGORY_WEIGHT = 0.15
CONTEXT_WEIGHT = 0.15


def _text_overlap_score(query_text: str, candidate_text: str) -> float:
    """Calculate token Jaccard similarity for textual descriptions/locations."""
    if not query_text or not candidate_text:
        return 0.0
    q_tokens = set(query_text.lower().replace(",", " ").split())
    c_tokens = set(candidate_text.lower().replace(",", " ").split())
    # Exclude common stop words
    stops = {"the", "a", "an", "in", "on", "at", "and", "or", "of", "with", "my", "is"}
    q_tokens -= stops
    c_tokens -= stops
    if not q_tokens or not c_tokens:
        return 0.0
    intersection = len(q_tokens & c_tokens)
    union = len(q_tokens | c_tokens)
    return float(intersection / union) if union > 0 else 0.0


def _get_embedding_from_blob(blob: bytes | None) -> np.ndarray | None:
    if not blob:
        return None
    try:
        return np.frombuffer(blob, dtype=np.float32)
    except Exception:
        return None


@router.post("/search")
async def find_matches(
    image: UploadFile = File(..., description="Query image of the lost or found item"),
    item_type: str = Form("lost", description="'lost' (search found items) or 'found' (search lost items)"),
    category: str | None = Form(None),
    title: str = Form(""),
    description: str = Form(""),
    location: str = Form(""),
    top_k: int = Form(6, ge=1, le=20),
):
    """
    Given an uploaded photograph and optional details of a lost item,
    analyze with the fine-tuned ResNet18 model and retrieve ranked candidate items
    of the opposite type.
    """
    clean_type = item_type.strip().lower()
    if clean_type not in {"lost", "found"}:
        raise HTTPException(status_code=400, detail="item_type must be 'lost' or 'found'.")

    predictor = get_predictor()
    if predictor.model is None:
        raise HTTPException(status_code=503, detail=predictor.load_error or "AI model not ready.")

    try:
        raw_bytes = await image.read()
        pil_img = Image.open(BytesIO(raw_bytes)).convert("RGB")
        query_pred = predictor.predict(pil_img)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to process image: {exc}")

    query_embedding = query_pred["embedding"].astype(np.float32)
    predicted_category = query_pred["predicted_category"]
    confidence = round(query_pred["category_confidence"], 4)
    effective_category = (category or predicted_category).strip().lower()

    # Search opposite type items that are still open
    opposite_type = "found" if clean_type == "lost" else "lost"
    conn = get_db()
    cursor = conn.execute("""
        SELECT 
            i.id, i.type, i.title, i.description, i.location, i.category,
            i.contact_info, i.image_url, i.image_path, i.embedding, i.created_at,
            u.display_name
        FROM items i
        LEFT JOIN users u ON i.user_id = u.id
        WHERE i.type = ? AND i.status = 'open'
    """, (opposite_type,))
    candidates = cursor.fetchall()
    conn.close()

    matches = []
    for row in candidates:
        candidate_embedding = _get_embedding_from_blob(row["embedding"])
        
        # If candidate embedding wasn't cached, extract from image on disk
        if candidate_embedding is None and row["image_path"]:
            try:
                img_data = read_item_image(row["image_path"])
                c_img = Image.open(BytesIO(img_data)).convert("RGB")
                c_res = predictor.predict(c_img)
                candidate_embedding = c_res["embedding"].astype(np.float32)
            except Exception:
                continue

        if candidate_embedding is None:
            continue

        # 1. Visual Cosine Similarity (vectors are L2-normalized)
        visual_sim = float(np.dot(query_embedding, candidate_embedding))
        visual_sim = max(0.0, min(1.0, visual_sim))

        # 2. Category Match
        cand_cat = (row["category"] or "").strip().lower()
        cat_match = 1.0 if cand_cat == effective_category else 0.0

        # 3. Contextual overlap (location & description)
        loc_score = _text_overlap_score(location, row["location"])
        desc_score = _text_overlap_score(f"{title} {description}", f"{row['title']} {row['description']}")
        context_score = max(loc_score, desc_score)

        # Composite Multimodal Ranking Score
        final_score = (
            VISUAL_WEIGHT * visual_sim +
            CATEGORY_WEIGHT * cat_match +
            CONTEXT_WEIGHT * context_score
        )

        matches.append({
            "item": {
                "id": row["id"],
                "type": row["type"],
                "title": row["title"],
                "description": row["description"],
                "location": row["location"],
                "category": row["category"],
                "contact_info": row["contact_info"],
                "image_url": row["image_url"],
                "created_at": row["created_at"],
                "profiles": {"display_name": row["display_name"] or "Anonymous"},
            },
            "similarity_score": round(final_score, 4),
            "match_percentage": round(final_score * 100, 1),
            "visual_similarity": round(visual_sim * 100, 1),
            "category_matched": bool(cat_match),
            "context_score": round(context_score * 100, 1),
        })

    # Sort descending by final similarity score
    matches.sort(key=lambda m: m["similarity_score"], reverse=True)

    return {
        "query_predicted_category": predicted_category,
        "query_confidence": confidence,
        "searched_in": opposite_type,
        "total_candidates": len(candidates),
        "matches": matches[:top_k],
        "note": "Ranking combines deep visual embeddings, category alignment, and contextual metadata."
    }


@router.get("/item/{item_id}")
def match_stored_item(item_id: str, top_k: int = 5):
    """
    Retrieve top candidate matches for an existing report already in the database.
    Used by the frontend to display recommended matches on the item detail page.
    """
    conn = get_db()
    cursor = conn.execute("""
        SELECT id, type, title, description, location, category, image_path, embedding
        FROM items
        WHERE id = ?
    """, (item_id,))
    item = cursor.fetchone()
    if not item:
        conn.close()
        raise HTTPException(status_code=404, detail="Item not found.")

    predictor = get_predictor()
    if predictor.model is None:
        conn.close()
        raise HTTPException(status_code=503, detail="AI model not available.")

    query_embedding = _get_embedding_from_blob(item["embedding"])
    if query_embedding is None and item["image_path"]:
        try:
            img_data = read_item_image(item["image_path"])
            c_img = Image.open(BytesIO(img_data)).convert("RGB")
            c_res = predictor.predict(c_img)
            query_embedding = c_res["embedding"].astype(np.float32)
        except Exception as exc:
            conn.close()
            raise HTTPException(status_code=500, detail=f"Could not extract query embedding: {exc}")

    if query_embedding is None:
        conn.close()
        return {"item_id": item_id, "matches": []}

    opposite_type = "found" if item["type"] == "lost" else "lost"
    cand_cursor = conn.execute("""
        SELECT 
            i.id, i.type, i.title, i.description, i.location, i.category,
            i.contact_info, i.image_url, i.image_path, i.embedding, i.created_at,
            u.display_name
        FROM items i
        LEFT JOIN users u ON i.user_id = u.id
        WHERE i.type = ? AND i.status = 'open' AND i.id != ?
    """, (opposite_type, item_id))
    candidates = cand_cursor.fetchall()
    conn.close()

    effective_category = (item["category"] or "").strip().lower()

    matches = []
    for cand in candidates:
        cand_embedding = _get_embedding_from_blob(cand["embedding"])
        if cand_embedding is None and cand["image_path"]:
            try:
                img_data = read_item_image(cand["image_path"])
                c_img = Image.open(BytesIO(img_data)).convert("RGB")
                c_res = predictor.predict(c_img)
                cand_embedding = c_res["embedding"].astype(np.float32)
            except Exception:
                continue

        if cand_embedding is None:
            continue

        visual_sim = float(np.dot(query_embedding, cand_embedding))
        visual_sim = max(0.0, min(1.0, visual_sim))

        cand_cat = (cand["category"] or "").strip().lower()
        cat_match = 1.0 if cand_cat == effective_category else 0.0

        context_score = max(
            _text_overlap_score(item["location"], cand["location"]),
            _text_overlap_score(f"{item['title']} {item['description']}", f"{cand['title']} {cand['description']}")
        )

        final_score = (
            VISUAL_WEIGHT * visual_sim +
            CATEGORY_WEIGHT * cat_match +
            CONTEXT_WEIGHT * context_score
        )

        matches.append({
            "item": {
                "id": cand["id"],
                "type": cand["type"],
                "title": cand["title"],
                "description": cand["description"],
                "location": cand["location"],
                "category": cand["category"],
                "contact_info": cand["contact_info"],
                "image_url": cand["image_url"],
                "created_at": cand["created_at"],
                "profiles": {"display_name": cand["display_name"] or "Anonymous"},
            },
            "similarity_score": round(final_score, 4),
            "match_percentage": round(final_score * 100, 1),
            "visual_similarity": round(visual_sim * 100, 1),
            "category_matched": bool(cat_match),
        })

    matches.sort(key=lambda m: m["similarity_score"], reverse=True)
    return {
        "source_item_id": item_id,
        "searched_in": opposite_type,
        "matches": matches[:top_k],
    }


@router.post("/item/{item_id}/confirm/{matched_item_id}")
def confirm_item_match(
    item_id: str,
    matched_item_id: str,
    user: dict = Depends(get_current_user),
):
    """Resolve an open report and its opposite-type match after the reporter confirms."""
    conn = get_db()
    try:
        with conn:
            conn.execute("BEGIN IMMEDIATE")

            source = conn.execute(
                "SELECT id, user_id, type, status FROM items WHERE id = ?",
                (item_id,),
            ).fetchone()
            if not source:
                raise HTTPException(status_code=404, detail="Source report not found.")
            if source["user_id"] != user["id"]:
                raise HTTPException(
                    status_code=403,
                    detail="You can only confirm a match for your own report.",
                )

            candidate = conn.execute(
                "SELECT id, type, status FROM items WHERE id = ?",
                (matched_item_id,),
            ).fetchone()
            if not candidate:
                raise HTTPException(status_code=404, detail="Matched report not found.")
            if source["type"] == candidate["type"]:
                raise HTTPException(
                    status_code=400,
                    detail="A match must pair one lost report with one found report.",
                )
            if source["status"] != "open" or candidate["status"] != "open":
                raise HTTPException(
                    status_code=409,
                    detail="Both reports must still be open to confirm this match.",
                )

            now = datetime.now(timezone.utc).isoformat()
            cursor = conn.execute(
                """
                UPDATE items
                SET status = 'resolved', updated_at = ?
                WHERE id IN (?, ?) AND status = 'open'
                """,
                (now, item_id, matched_item_id),
            )
            if cursor.rowcount != 2:
                raise HTTPException(
                    status_code=409,
                    detail="One or both reports are no longer open.",
                )
    finally:
        conn.close()

    return {
        "message": "Both reports have been marked as reunited.",
        "resolved_item_ids": [item_id, matched_item_id],
    }
