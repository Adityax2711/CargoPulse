import sqlite3
from fastapi import APIRouter, Depends, Query
from app.database import get_db
from app.services.auth_service import require_role
from app.services.alerts_service import calculate_scorecard

router = APIRouter(prefix="/api/scorecard", tags=["scorecard"])

@router.get("")
def get_scorecard(
    range_param: str = Query("all", alias="range", pattern="^(30d|90d|all)$"),
    current_user: dict = Depends(require_role(["admin"])),
    conn: sqlite3.Connection = Depends(get_db)
):
    scorecard = calculate_scorecard(conn, date_range=range_param)
    return {
        "range": range_param,
        "couriers": scorecard
    }

