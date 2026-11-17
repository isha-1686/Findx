"""Local authentication utilities and FastAPI dependency."""
import hashlib
import secrets
from datetime import datetime, timezone
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.core.db import get_db

bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    """Hash password using PBKDF2 HMAC SHA-256 with salt."""
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000)
    return f"{salt}:{key.hex()}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against stored salt:hash."""
    try:
        salt, expected_hash = hashed_password.split(":")
        test_key = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt.encode("utf-8"), 100_000)
        return secrets.compare_digest(test_key.hex(), expected_hash)
    except Exception:
        # Fallback for plain sha256 or demo hash
        if ":" not in hashed_password:
            return hashlib.sha256(plain_password.encode("utf-8")).hexdigest() == hashed_password
        return False


def create_token_for_user(user_id: str) -> str:
    """Generate and store an API token for a user."""
    token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc).isoformat()
    conn = get_db()
    with conn:
        conn.execute("INSERT INTO auth_tokens (token, user_id, created_at) VALUES (?, ?, ?)", (token, user_id, now))
    conn.close()
    return token


def get_current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict:
    """Extract and validate user from Bearer token."""
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authentication token"
        )
    
    token = credentials.credentials.strip()
    conn = get_db()
    cursor = conn.execute("""
        SELECT u.id, u.email, u.display_name, u.created_at
        FROM auth_tokens t
        JOIN users u ON t.user_id = u.id
        WHERE t.token = ?
    """, (token,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session. Please sign in again."
        )

    return {
        "id": row["id"],
        "email": row["email"],
        "display_name": row["display_name"] or row["email"].split("@")[0],
        "created_at": row["created_at"],
    }


def get_optional_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict | None:
    """Optional user dependency — returns None if unauthenticated."""
    if not credentials or not credentials.credentials:
        return None
    try:
        return get_current_user(credentials)
    except HTTPException:
        return None
