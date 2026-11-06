import bcrypt
import time
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
from jose import jwt, JWTError
from fastapi import HTTPException, Header, Depends, status
from app.config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRATION_HOURS
from app.database import get_db
import sqlite3

# Simple in-memory sliding-window rate limiter for auth endpoints
# ip_or_email -> list of timestamps
_auth_rate_limit_cache: Dict[str, List[float]] = {}
MAX_AUTH_ATTEMPTS = 15
AUTH_WINDOW_SECONDS = 60

def check_rate_limit(key: str):
    now = time.time()
    attempts = _auth_rate_limit_cache.get(key, [])
    # Keep timestamps within the window
    attempts = [t for t in attempts if now - t < AUTH_WINDOW_SECONDS]
    if len(attempts) >= MAX_AUTH_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "error": {
                    "code": "RATE_LIMIT_EXCEEDED",
                    "message": "Too many login/signup requests. Please wait a minute before retrying."
                }
            }
        )
    attempts.append(now)
    _auth_rate_limit_cache[key] = attempts


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError:
        return None


def get_current_user(
    authorization: Optional[str] = Header(None),
    conn: sqlite3.Connection = Depends(get_db)
) -> dict:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": "UNAUTHORIZED", "message": "Missing authorization token"}}
        )

    parts = authorization.split(" ")
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": "INVALID_TOKEN_FORMAT", "message": "Token must be Bearer token"}}
        )

    token = parts[1]
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": "INVALID_TOKEN", "message": "Invalid or expired token"}}
        )

    user_id = payload["sub"]
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, email, role, courier_name, created_at FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": "USER_NOT_FOUND", "message": "User associated with token does not exist"}}
        )

    return dict(user)


def require_role(allowed_roles: List[str]):
    def role_checker(current_user: dict = Depends(get_current_user)) -> dict:
        if current_user["role"] not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error": {"code": "FORBIDDEN", "message": f"Action requires role in: {', '.join(allowed_roles)}"}}
            )
        return current_user
    return role_checker

