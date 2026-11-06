import sqlite3
from fastapi import APIRouter, Depends
from app.database import get_db
from app.services.auth_service import require_role
from app.services.alerts_service import get_all_alerts, run_scan_gap_check

router = APIRouter(prefix="/api/alerts", tags=["alerts"])

@router.get("")
def list_alerts(
    current_user: dict = Depends(require_role(["admin"])),
    conn: sqlite3.Connection = Depends(get_db)
):
    alerts = get_all_alerts(conn)
    return {"alerts": alerts, "count": len(alerts)}


@router.post("/run-check")
def trigger_scan_gap_check(
    current_user: dict = Depends(require_role(["admin"])),
    conn: sqlite3.Connection = Depends(get_db)
):
    result = run_scan_gap_check(conn)
    return {"message": "Scan-gap check executed", "result": result}

