import sqlite3
from fastapi import APIRouter, Depends, HTTPException, status
from app.database import get_db
from app.models import CourierUpdateRequest
from app.services.auth_service import get_current_user, require_role
from app.services.audit_service import log_audit_event

router = APIRouter(prefix="/api/couriers", tags=["couriers"])

@router.get("")
def list_couriers(conn: sqlite3.Connection = Depends(get_db)):
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, created_at FROM couriers ORDER BY name ASC")
    rows = cursor.fetchall()
    return {"couriers": [dict(r) for r in rows]}


@router.patch("/{courier_id}")
def update_courier(
    courier_id: str,
    req: CourierUpdateRequest,
    current_user: dict = Depends(require_role(["admin"])),
    conn: sqlite3.Connection = Depends(get_db)
):
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM couriers WHERE id = ?", (courier_id,))
    courier = cursor.fetchone()
    if not courier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "COURIER_NOT_FOUND", "message": "Courier not found"}}
        )

    old_name = courier["name"]
    new_name = req.name.strip()

    cursor.execute("UPDATE couriers SET name = ? WHERE id = ?", (new_name, courier_id))
    # Also update courier_name in users if matching
    cursor.execute("UPDATE users SET courier_name = ? WHERE courier_name = ?", (new_name, old_name))
    conn.commit()

    log_audit_event(
        conn,
        actor_id=current_user["id"],
        action="update_courier",
        entity_type="courier",
        entity_id=courier_id,
        details={"old_name": old_name, "new_name": new_name}
    )

    return {"message": "Courier updated successfully", "courier": {"id": courier_id, "name": new_name}}

