import sqlite3
import json
from fastapi import APIRouter, Depends, Query
from app.database import get_db
from app.services.auth_service import require_role

router = APIRouter(prefix="/api/audit", tags=["audit"])

@router.get("")
def get_audit_logs(
    limit: int = Query(50, le=200),
    current_user: dict = Depends(require_role(["admin"])),
    conn: sqlite3.Connection = Depends(get_db)
):
    cursor = conn.cursor()
    cursor.execute("""
        SELECT a.*, u.name as actor_name, u.role as actor_role
        FROM audit_log a
        LEFT JOIN users u ON a.actor_id = u.id
        ORDER BY a.created_at DESC
        LIMIT ?
    """, (limit,))
    rows = cursor.fetchall()
    logs = []
    for r in rows:
        d = dict(r)
        try:
            d["details"] = json.loads(d["details"])
        except Exception:
            pass
        logs.append(d)
    return {"audit_logs": logs}

