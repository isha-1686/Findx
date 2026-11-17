"""Self-contained local SQLite database with automatic table creation and vector caching."""
from pathlib import Path
import sqlite3
import shutil
import uuid
import json
from datetime import datetime, timezone
import numpy as np
from app.core.config import settings

DB_PATH = Path(settings.db_path)
UPLOAD_DIR = Path(settings.upload_dir)


def get_db():
    """Get SQLite connection configured for dict-like row access."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db():
    """Create all required tables and indexes if they do not exist."""
    conn = get_db()
    with conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            display_name TEXT,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS auth_tokens (
            token TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS items (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            type TEXT NOT NULL CHECK (type IN ('lost', 'found')),
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            location TEXT NOT NULL,
            category TEXT,
            contact_info TEXT,
            image_path TEXT,
            image_url TEXT,
            embedding BLOB,
            status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'closed')),
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_items_type_status ON items (type, status);
        CREATE INDEX IF NOT EXISTS idx_items_user_id ON items (user_id);
        CREATE INDEX IF NOT EXISTS idx_items_created_at ON items (created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_items_category ON items (category);
        """)

    # Seed initial demo items if database is empty
    _seed_initial_data_if_empty(conn)
    conn.close()


def _seed_initial_data_if_empty(conn: sqlite3.Connection):
    cursor = conn.execute("SELECT COUNT(*) FROM items")
    count = cursor.fetchone()[0]
    if count > 0:
        return

    # Create demo user
    demo_user_id = "demo-user-001"
    now = datetime.now(timezone.utc).isoformat()
    # Simple hash for demo
    import hashlib
    demo_pwd_hash = hashlib.sha256(b"demo1234").hexdigest()
    
    with conn:
        conn.execute("""
            INSERT OR IGNORE INTO users (id, email, password_hash, display_name, created_at)
            VALUES (?, ?, ?, ?, ?)
        """, (demo_user_id, "demo@campus.edu", demo_pwd_hash, "Campus Security Desk", now))

    # Pre-populate sample items from data/raw if available
    raw_dir = Path("data/raw")
    if not raw_dir.exists():
        return

    seed_items = [
        {"type": "found", "title": "Black Backpack with Laptop Compartment", "category": "bag", "location": "Main Library 2nd Floor", "description": "Found near quiet study desk. Has black zippers and side water bottle pouch.", "contact_info": "security@campus.edu"},
        {"type": "found", "title": "Wireless Earbuds in Charging Case", "category": "earphone", "location": "Student Center Food Court", "description": "White charging case with slight scuff on the lid. Found on booth table.", "contact_info": "info-desk@campus.edu"},
        {"type": "found", "title": "Campus Student Identity Card", "category": "card", "location": "Gymnasium Entrance", "description": "Card found near turnstiles. Safe at reception desk.", "contact_info": "gym@campus.edu"},
        {"type": "found", "title": "Ring with Multiple Keys", "category": "key", "location": "Lecture Hall 104", "description": "Set of 3 keys with a blue spiral lanyard.", "contact_info": "security@campus.edu"},
        {"type": "lost", "title": "Lost my University ID Card", "category": "card", "location": "Cafeteria or Sports Complex", "description": "Lost my plastic smart card sometime during lunch.", "contact_info": "+1 (555) 234-5678"},
        {"type": "lost", "title": "Lost Canvas Shoulder Bag", "category": "bag", "location": "Science Block Corridor", "description": "Navy/black bag containing course notes and notebook.", "contact_info": "student2126@campus.edu"},
    ]

    from app.ml.model import get_predictor
    from PIL import Image

    predictor = None
    try:
        predictor = get_predictor()
    except Exception:
        pass

    with conn:
        for item in seed_items:
            cat_dir = raw_dir / item["category"]
            img_files = list(cat_dir.glob("*.jpg")) if cat_dir.exists() else []
            if not img_files:
                continue
            
            sample_img_file = img_files[0]
            item_id = str(uuid.uuid4())
            ext = sample_img_file.suffix.lstrip(".").lower()
            upload_filename = f"{item_id}.{ext}"
            dest_file = UPLOAD_DIR / upload_filename
            shutil.copyfile(sample_img_file, dest_file)
            
            img_url = f"{settings.base_url}/uploads/{upload_filename}"
            embedding_bytes = None
            if predictor and predictor.model is not None:
                try:
                    with Image.open(dest_file) as img:
                        pred_res = predictor.predict(img)
                        embedding = pred_res["embedding"].astype(np.float32)
                        embedding_bytes = embedding.tobytes()
                except Exception:
                    pass

            conn.execute("""
                INSERT INTO items (id, user_id, type, title, description, location, category, contact_info, image_path, image_url, embedding, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)
            """, (
                item_id, demo_user_id, item["type"], item["title"], item["description"],
                item["location"], item["category"], item["contact_info"], str(dest_file), img_url,
                embedding_bytes, now, now
            ))
