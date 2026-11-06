import uuid
import sqlite3
from fastapi import APIRouter, Depends, HTTPException, status, Request
from app.database import get_db
from app.models import SignupRequest, LoginRequest, ResetPasswordRequest
from app.services.auth_service import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    check_rate_limit
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/signup", status_code=status.HTTP_201_CREATED)
def signup(req: SignupRequest, request: Request, conn: sqlite3.Connection = Depends(get_db)):
    client_ip = request.client.host if request.client else "127.0.0.1"
    check_rate_limit(f"signup:{client_ip}")

    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE email = ?", (req.email.lower(),))
    if cursor.fetchone():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": {"code": "EMAIL_EXISTS", "message": "A user with this email already exists", "field": "email"}}
        )

    # Validate courier_name if role is courier
    if req.role == "courier" and not req.courier_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": "MISSING_COURIER_NAME", "message": "Courier name is required for courier staff accounts", "field": "courier_name"}}
        )

    user_id = f"USR-{uuid.uuid4().hex[:8].upper()}"
    pwd_hash = hash_password(req.password)

    cursor.execute("""
        INSERT INTO users (id, name, email, password_hash, role, courier_name)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (user_id, req.name.strip(), req.email.lower().strip(), pwd_hash, req.role, req.courier_name))
    conn.commit()

    token = create_access_token({"sub": user_id, "role": req.role, "name": req.name})
    return {
        "token": token,
        "user": {
            "id": user_id,
            "name": req.name,
            "email": req.email.lower(),
            "role": req.role,
            "courier_name": req.courier_name
        }
    }


@router.post("/login")
def login(req: LoginRequest, request: Request, conn: sqlite3.Connection = Depends(get_db)):
    client_ip = request.client.host if request.client else "127.0.0.1"
    check_rate_limit(f"login:{client_ip}:{req.email.lower()}")

    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE email = ?", (req.email.lower().strip(),))
    user = cursor.fetchone()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "USER_NOT_FOUND",
                    "message": f"No account found for '{req.email.strip()}'. Please click 'Create Account' to register your email, or use a demo account above.",
                    "field": "email"
                }
            }
        )

    if not verify_password(req.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": {
                    "code": "INVALID_PASSWORD",
                    "message": "Incorrect password for this account. If using a demo account, the password is 'password123'.",
                    "field": "password"
                }
            }
        )

    token = create_access_token({"sub": user["id"], "role": user["role"], "name": user["name"]})
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "role": user["role"],
            "courier_name": user["courier_name"]
        }
    }


@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest, conn: sqlite3.Connection = Depends(get_db)):
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE email = ?", (req.email.lower().strip(),))
    user = cursor.fetchone()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "USER_NOT_FOUND",
                    "message": f"No account found for '{req.email.strip()}'.",
                    "field": "email"
                }
            }
        )

    new_hash = hash_password(req.password)
    cursor.execute("UPDATE users SET password_hash = ? WHERE id = ?", (new_hash, user["id"]))
    conn.commit()

    token = create_access_token({"sub": user["id"], "role": user["role"], "name": user["name"]})
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "role": user["role"],
            "courier_name": user["courier_name"]
        },
        "message": "Password updated successfully"
    }


@router.post("/logout")
def logout():
    return {"message": "Logged out successfully"}


@router.get("/me")
def me(current_user: dict = Depends(get_current_user)):
    return {"user": current_user}

