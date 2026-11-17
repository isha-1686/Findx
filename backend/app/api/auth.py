"""Authentication API router: signup, signin, me, demo login."""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from app.core.db import get_db
from app.core.auth import (
    hash_password,
    verify_password,
    create_token_for_user,
    get_current_user,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


class SignUpRequest(BaseModel):
    email: str = Field(min_length=3)
    password: str = Field(min_length=6)
    display_name: str | None = None


class SignInRequest(BaseModel):
    email: str = Field(min_length=3)
    password: str


@router.post("/signup", status_code=status.HTTP_201_CREATED)
def sign_up(payload: SignUpRequest):
    conn = get_db()
    email_clean = payload.email.strip().lower()
    
    # Check if already registered
    cursor = conn.execute("SELECT id FROM users WHERE LOWER(email) = ?", (email_clean,))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="An account with this email already exists.")

    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    pwd_hash = hash_password(payload.password)
    display_name = payload.display_name.strip() if payload.display_name else email_clean.split("@")[0]

    with conn:
        conn.execute("""
            INSERT INTO users (id, email, password_hash, display_name, created_at)
            VALUES (?, ?, ?, ?, ?)
        """, (user_id, email_clean, pwd_hash, display_name, now))

    token = create_token_for_user(user_id)
    conn.close()

    return {
        "user": {
            "id": user_id,
            "email": email_clean,
            "display_name": display_name,
            "created_at": now,
        },
        "token": token,
    }


@router.post("/signin")
def sign_in(payload: SignInRequest):
    conn = get_db()
    email_clean = payload.email.strip().lower()
    
    cursor = conn.execute("""
        SELECT id, email, password_hash, display_name, created_at
        FROM users
        WHERE LOWER(email) = ?
    """, (email_clean,))
    row = cursor.fetchone()
    conn.close()

    if not row or not verify_password(payload.password, row["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password."
        )

    token = create_token_for_user(row["id"])
    return {
        "user": {
            "id": row["id"],
            "email": row["email"],
            "display_name": row["display_name"],
            "created_at": row["created_at"],
        },
        "token": token,
    }


@router.get("/me")
def get_me(user: dict = Depends(get_current_user)):
    return {"user": user}


@router.post("/signout")
def sign_out(user: dict = Depends(get_current_user)):
    conn = get_db()
    with conn:
        conn.execute("DELETE FROM auth_tokens WHERE user_id = ?", (user["id"],))
    conn.close()
    return {"message": "Signed out successfully"}


@router.post("/demo")
def demo_login():
    """Instant login as demo user for fast testing and demonstrations."""
    conn = get_db()
    cursor = conn.execute("SELECT id, email, display_name, created_at FROM users WHERE id = 'demo-user-001'")
    row = cursor.fetchone()
    
    if not row:
        now = datetime.now(timezone.utc).isoformat()
        with conn:
            conn.execute("""
                INSERT INTO users (id, email, password_hash, display_name, created_at)
                VALUES ('demo-user-001', 'demo@campus.edu', 'demo', 'Campus Security Desk', ?)
            """, (now,))
        user_id = "demo-user-001"
        email = "demo@campus.edu"
        name = "Campus Security Desk"
    else:
        user_id = row["id"]
        email = row["email"]
        name = row["display_name"]
        now = row["created_at"]

    token = create_token_for_user(user_id)
    conn.close()

    return {
        "user": {
            "id": user_id,
            "email": email,
            "display_name": name,
            "created_at": now,
        },
        "token": token,
    }
