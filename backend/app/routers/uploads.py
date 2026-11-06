import uuid
import os
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, status, Depends
from app.config import UPLOAD_DIR
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/api/uploads", tags=["uploads"])

ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif", "image/jpg"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB

@router.post("")
async def upload_file(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    # Validate MIME type
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail={"error": {"code": "INVALID_MIME_TYPE", "message": f"File type '{file.content_type}' is not supported. Only JPEG, PNG, WEBP, and GIF images are allowed."}}
        )

    # Read content and validate size
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={"error": {"code": "FILE_TOO_LARGE", "message": f"File size ({len(content)} bytes) exceeds the maximum allowed 5 MB limit."}}
        )

    # Determine file extension
    ext = Path(file.filename or "image.jpg").suffix.lower()
    if ext not in [".jpg", ".jpeg", ".png", ".webp", ".gif"]:
        ext = ".jpg"

    filename = f"{uuid.uuid4().hex}{ext}"
    dest_path = UPLOAD_DIR / filename

    with open(dest_path, "wb") as f:
        f.write(content)

    return {
        "url": f"/uploads/{filename}",
        "filename": filename,
        "size": len(content),
        "content_type": file.content_type
    }

