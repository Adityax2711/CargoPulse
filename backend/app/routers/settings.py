import sqlite3
from fastapi import APIRouter, Depends, HTTPException, status
from app.database import get_db
from app.models import SettingsUpdateRequest
from app.services.auth_service import require_role
from app.services.audit_service import log_audit_event

router = APIRouter(prefix="/api/settings", tags=["settings"])

@router.get("")
def get_settings(
    current_user: dict = Depends(require_role(["admin"])),
    conn: sqlite3.Connection = Depends(get_db)
):
    cursor = conn.cursor()
    cursor.execute("SELECT key, value, updated_at FROM settings ORDER BY key ASC")
    rows = cursor.fetchall()
    return {"settings": {r["key"]: r["value"] for r in rows}}


@router.put("")
def update_settings(
    req: SettingsUpdateRequest,
    current_user: dict = Depends(require_role(["admin"])),
    conn: sqlite3.Connection = Depends(get_db)
):
    cursor = conn.cursor()
    updated = {}
    for key, val in req.settings.items():
        # Validate that numeric values are parseable
        try:
            float(val)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error": {"code": "INVALID_SETTING_VALUE", "message": f"Value for '{key}' must be numeric", "field": key}}
            )

        cursor.execute("""
            INSERT INTO settings (key, value, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
        """, (key, str(val)))
        updated[key] = str(val)

    conn.commit()

    log_audit_event(
        conn,
        actor_id=current_user["id"],
        action="update_settings",
        entity_type="settings",
        entity_id="global",
        details={"updated_keys": updated}
    )

    return {"message": "Settings updated successfully", "settings": updated}

