import os
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import UPLOAD_DIR, CORS_ORIGINS, BASE_DIR
from app.database import init_db
from fastapi.responses import JSONResponse, FileResponse
from app.routers import (
    auth,
    couriers,
    settings,
    quote,
    shipments,
    claims,
    alerts,
    scorecard,
    uploads,
    audit
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB schema, default settings, and couriers
    init_db()
    yield

app = FastAPI(
    title="ShipGuard API",
    description="Parcel protection and claims platform between e-commerce sellers and courier companies",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static file serving for uploads
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# Custom consistent error response format
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    # If detail is already formatted with error key, return as-is
    if isinstance(exc.detail, dict) and "error" in exc.detail:
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    
    code = "HTTP_ERROR"
    if exc.status_code == 400:
        code = "BAD_REQUEST"
    elif exc.status_code == 401:
        code = "UNAUTHORIZED"
    elif exc.status_code == 403:
        code = "FORBIDDEN"
    elif exc.status_code == 404:
        code = "NOT_FOUND"
    elif exc.status_code == 409:
        code = "CONFLICT"
    elif exc.status_code == 422:
        code = "UNPROCESSABLE_ENTITY"
    elif exc.status_code == 429:
        code = "RATE_LIMIT_EXCEEDED"

    message = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": code, "message": message}}
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    first_err = errors[0] if errors else {}
    field = ".".join(str(loc) for loc in first_err.get("loc", []) if loc != "body")
    message = first_err.get("msg", "Validation error")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": f"{field}: {message}" if field else message,
                "field": field or None
            }
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected server error occurred."
            }
        }
    )

# Include routers
app.include_router(auth.router)
app.include_router(couriers.router)
app.include_router(settings.router)
app.include_router(quote.router)
app.include_router(shipments.router)
app.include_router(claims.router)
app.include_router(alerts.router)
app.include_router(scorecard.router)
app.include_router(uploads.router)
app.include_router(audit.router)

@app.get("/api/health")
def health():
    return {"status": "ok", "app": "ShipGuard", "version": "1.0.0"}

# Serve frontend build if present
DIST_DIR = BASE_DIR.parent / "frontend" / "dist"
if DIST_DIR.exists():
    assets_dir = DIST_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api") or full_path.startswith("uploads"):
            raise HTTPException(status_code=404, detail={"error": {"code": "NOT_FOUND", "message": "Endpoint not found"}})
        target = DIST_DIR / full_path
        if target.is_file():
            return FileResponse(target)
        return FileResponse(DIST_DIR / "index.html")

