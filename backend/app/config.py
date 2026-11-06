import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

DB_PATH = os.getenv("SHIPGUARD_DB_PATH", str(DATA_DIR / "shipguard.db"))
UPLOAD_DIR = Path(os.getenv("SHIPGUARD_UPLOAD_DIR", str(DATA_DIR / "uploads")))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

JWT_SECRET = os.getenv("JWT_SECRET", "INSECURE-DEV-DEFAULT-CHANGE-ME")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 72

# Production deployments must add their real frontend domain(s) to this list,
# and must never combine allow_credentials=True with a wildcard origin ("*").
CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000"
]

