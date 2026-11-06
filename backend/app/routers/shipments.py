import uuid
import json
import sqlite3
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from app.database import get_db
from app.models import (
    ShipmentCreateRequest,
    PickupCreateRequest,
    PickupSupersedeRequest,
    ScanCreateRequest
)
from app.services.auth_service import get_current_user, require_role
from app.services.pricing_service import calculate_quote
from app.services.audit_service import log_audit_event

router = APIRouter(prefix="/api/shipments", tags=["shipments"])

def get_user_courier_id(conn: sqlite3.Connection, courier_name: Optional[str]) -> Optional[str]:
    if not courier_name:
        return None
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM couriers WHERE LOWER(name) = LOWER(?) OR id = ?", (courier_name, courier_name))
    row = cursor.fetchone()
    return row["id"] if row else None


@router.post("", status_code=status.HTTP_201_CREATED)
def create_shipment(
    req: ShipmentCreateRequest,
    current_user: dict = Depends(require_role(["seller", "admin"])),
    conn: sqlite3.Connection = Depends(get_db)
):
    cursor = conn.cursor()

    # Verify courier exists
    cursor.execute("SELECT id, name FROM couriers WHERE id = ?", (req.courier_id,))
    courier = cursor.fetchone()
    if not courier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "COURIER_NOT_FOUND", "message": "Selected courier does not exist", "field": "courier_id"}}
        )

    seller_id = current_user["id"]

    # Calculate premium if insured
    premium = 0.0
    if req.insured:
        quote = calculate_quote(
            conn=conn,
            declared_value=req.declared_value,
            fragile=req.fragile,
            seller_id=seller_id
        )
        premium = quote["final_premium"]

    shipment_id = f"SHP-{uuid.uuid4().hex[:8].upper()}"
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

    cursor.execute("""
        INSERT INTO shipments (
            id, seller_id, courier_id, origin, destination, recipient,
            category, fragile, declared_value, insured, premium, status,
            created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'booked', ?, ?)
    """, (
        shipment_id,
        seller_id,
        req.courier_id,
        req.origin.strip(),
        req.destination.strip(),
        req.recipient.strip(),
        req.category.strip(),
        1 if req.fragile else 0,
        req.declared_value,
        1 if req.insured else 0,
        premium,
        now_str,
        now_str
    ))

    # Add initial timeline event
    cursor.execute("""
        INSERT INTO scan_events (id, shipment_id, status, location, shock_g, weight_kg, flags, recorded_by, created_at)
        VALUES (?, ?, 'in_transit', 'Booking Confirmed (Awaiting Pickup)', 0.0, NULL, '[]', ?, ?)
    """, (f"SCN-{uuid.uuid4().hex[:8].upper()}", shipment_id, current_user["id"], now_str))

    conn.commit()

    return {
        "message": "Shipment booked successfully",
        "shipment": {
            "id": shipment_id,
            "seller_id": seller_id,
            "courier_id": req.courier_id,
            "courier_name": courier["name"],
            "origin": req.origin,
            "destination": req.destination,
            "recipient": req.recipient,
            "category": req.category,
            "fragile": req.fragile,
            "declared_value": req.declared_value,
            "insured": req.insured,
            "premium": premium,
            "status": "booked",
            "created_at": now_str
        }
    }


@router.get("")
def list_shipments(
    q: Optional[str] = Query(None, description="Search term for ID, recipient, route"),
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: dict = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db)
):
    cursor = conn.cursor()
    role = current_user["role"]

    query = """
        SELECT s.*, c.name as courier_name, u.name as seller_name, u.email as seller_email,
               p.id as pickup_id, p.weight_kg as pickup_weight_kg, p.condition as pickup_condition,
               cl.id as claim_id, cl.status as claim_status
        FROM shipments s
        JOIN couriers c ON s.courier_id = c.id
        JOIN users u ON s.seller_id = u.id
        LEFT JOIN pickups p ON s.id = p.shipment_id
        LEFT JOIN claims cl ON s.id = cl.shipment_id
        WHERE 1=1
    """
    params = []

    # Enforce role scoping
    if role == "seller":
        query += " AND s.seller_id = ?"
        params.append(current_user["id"])
    elif role == "courier":
        c_id = get_user_courier_id(conn, current_user.get("courier_name"))
        if not c_id:
            return {"shipments": []}
        query += " AND s.courier_id = ?"
        params.append(c_id)

    # Search filter
    if q:
        q_term = f"%{q.strip().lower()}%"
        query += " AND (LOWER(s.id) LIKE ? OR LOWER(s.recipient) LIKE ? OR LOWER(s.origin) LIKE ? OR LOWER(s.destination) LIKE ? OR LOWER(s.category) LIKE ?)"
        params.extend([q_term, q_term, q_term, q_term, q_term])

    # Status filter
    if status_filter:
        query += " AND s.status = ?"
        params.append(status_filter)

    query += " ORDER BY s.created_at DESC"

    cursor.execute(query, params)
    rows = cursor.fetchall()

    shipments = []
    now = datetime.now(timezone.utc)
    for r in rows:
        d = dict(r)
        d["fragile"] = bool(d["fragile"])
        d["insured"] = bool(d["insured"])

        # Check for inactivity warning (> 2 days)
        last_dt_str = d["updated_at"] or d["created_at"]
        days_inact = 0.0
        try:
            if "T" in last_dt_str:
                dt = datetime.fromisoformat(last_dt_str.replace("Z", "+00:00"))
            else:
                dt = datetime.strptime(last_dt_str, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
            days_inact = round((now - dt).total_seconds() / 86400.0, 1)
        except Exception:
            pass

        d["days_since_last_activity"] = days_inact
        d["has_scan_gap_warning"] = (days_inact >= 2.0 and d["status"] not in ("delivered", "lost"))
        shipments.append(d)

    return {"shipments": shipments}


@router.get("/{shipment_id}")
def get_shipment(
    shipment_id: str,
    current_user: dict = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db)
):
    cursor = conn.cursor()
    cursor.execute("""
        SELECT s.*, c.name as courier_name, u.name as seller_name, u.email as seller_email
        FROM shipments s
        JOIN couriers c ON s.courier_id = c.id
        JOIN users u ON s.seller_id = u.id
        WHERE s.id = ?
    """, (shipment_id,))
    row = cursor.fetchone()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "SHIPMENT_NOT_FOUND", "message": "Shipment not found"}}
        )

    shipment = dict(row)
    shipment["fragile"] = bool(shipment["fragile"])
    shipment["insured"] = bool(shipment["insured"])

    # Enforce role-based access
    role = current_user["role"]
    if role == "seller" and shipment["seller_id"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "FORBIDDEN", "message": "You can only view your own shipments"}}
        )
    elif role == "courier":
        c_id = get_user_courier_id(conn, current_user.get("courier_name"))
        if shipment["courier_id"] != c_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error": {"code": "FORBIDDEN", "message": "You can only view shipments assigned to your courier company"}}
            )

    # Fetch pickup check
    cursor.execute("SELECT * FROM pickups WHERE shipment_id = ?", (shipment_id,))
    pickup_row = cursor.fetchone()
    pickup = None
    if pickup_row:
        pickup = dict(pickup_row)
        try:
            pickup["photo_urls"] = json.loads(pickup["photo_urls"])
        except Exception:
            pickup["photo_urls"] = []

    # Fetch scans timeline
    cursor.execute("""
        SELECT s.*, u.name as recorded_by_name, u.role as recorded_by_role
        FROM scan_events s
        LEFT JOIN users u ON s.recorded_by = u.id
        WHERE s.shipment_id = ?
        ORDER BY s.created_at ASC
    """, (shipment_id,))
    timeline_rows = cursor.fetchall()
    timeline = []
    has_shock_flag = False
    has_weight_mismatch_flag = False

    for tr in timeline_rows:
        td = dict(tr)
        try:
            td["flags"] = json.loads(td["flags"])
        except Exception:
            td["flags"] = []
        if "shock" in td["flags"]:
            has_shock_flag = True
        if "weight_mismatch" in td["flags"]:
            has_weight_mismatch_flag = True
        timeline.append(td)

    # Fetch claim if any
    cursor.execute("""
        SELECT cl.*, u.name as decided_by_name 
        FROM claims cl
        LEFT JOIN users u ON cl.decided_by = u.id
        WHERE cl.shipment_id = ?
    """, (shipment_id,))
    claim_row = cursor.fetchone()
    claim = None
    if claim_row:
        claim = dict(claim_row)
        try:
            claim["damage_photo_urls"] = json.loads(claim["damage_photo_urls"])
        except Exception:
            claim["damage_photo_urls"] = []

    # Inactivity check
    now = datetime.now(timezone.utc)
    last_active_str = timeline[-1]["created_at"] if timeline else shipment["created_at"]
    days_inact = 0.0
    try:
        if "T" in last_active_str:
            dt = datetime.fromisoformat(last_active_str.replace("Z", "+00:00"))
        else:
            dt = datetime.strptime(last_active_str, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
        days_inact = round((now - dt).total_seconds() / 86400.0, 1)
    except Exception:
        pass

    shipment["days_since_last_activity"] = days_inact
    shipment["has_scan_gap_warning"] = (days_inact >= 2.0 and shipment["status"] not in ("delivered", "lost"))
    shipment["has_shock_flag"] = has_shock_flag
    shipment["has_weight_mismatch_flag"] = has_weight_mismatch_flag

    return {
        "shipment": shipment,
        "pickup": pickup,
        "timeline": timeline,
        "claim": claim
    }


@router.post("/{shipment_id}/pickup", status_code=status.HTTP_201_CREATED)
def record_pickup(
    shipment_id: str,
    req: PickupCreateRequest,
    current_user: dict = Depends(require_role(["seller", "courier", "admin"])),
    conn: sqlite3.Connection = Depends(get_db)
):
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM shipments WHERE id = ?", (shipment_id,))
    shipment = cursor.fetchone()
    if not shipment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "SHIPMENT_NOT_FOUND", "message": "Shipment not found"}}
        )

    # Check permission
    role = current_user["role"]
    if role == "seller" and shipment["seller_id"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "FORBIDDEN", "message": "You can only record pickups for your own shipments"}}
        )
    elif role == "courier":
        c_id = get_user_courier_id(conn, current_user.get("courier_name"))
        if shipment["courier_id"] != c_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error": {"code": "FORBIDDEN", "message": "You can only record pickups for your assigned courier"}}
            )

    # Check if pickup already exists (baseline cannot be edited, only superseded by admin)
    cursor.execute("SELECT id FROM pickups WHERE shipment_id = ?", (shipment_id,))
    if cursor.fetchone():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": {"code": "PICKUP_EXISTS", "message": "A pickup check has already been recorded for this shipment. It cannot be edited, only superseded by an ops admin."}}
        )

    pickup_id = f"PCK-{uuid.uuid4().hex[:8].upper()}"
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

    cursor.execute("""
        INSERT INTO pickups (
            id, shipment_id, weight_kg, dims_cm, condition,
            photo_urls, recorded_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        pickup_id,
        shipment_id,
        round(req.weight_kg, 2),
        req.dims_cm.strip(),
        req.condition,
        json.dumps(req.photo_urls),
        current_user["id"],
        now_str
    ))

    # Update shipment status to 'picked_up' if currently 'booked'
    if shipment["status"] == "booked":
        cursor.execute("UPDATE shipments SET status = 'picked_up', updated_at = ? WHERE id = ?", (now_str, shipment_id))

    # Add timeline scan event
    scan_id = f"SCN-{uuid.uuid4().hex[:8].upper()}"
    cursor.execute("""
        INSERT INTO scan_events (id, shipment_id, status, location, shock_g, weight_kg, flags, recorded_by, created_at)
        VALUES (?, ?, 'picked_up', 'Pickup Evidence Check Recorded', 0.0, ?, '[]', ?, ?)
    """, (scan_id, shipment_id, round(req.weight_kg, 2), current_user["id"], now_str))

    conn.commit()

    return {
        "message": "Pickup record created successfully",
        "pickup": {
            "id": pickup_id,
            "shipment_id": shipment_id,
            "weight_kg": req.weight_kg,
            "dims_cm": req.dims_cm,
            "condition": req.condition,
            "photo_urls": req.photo_urls,
            "recorded_by": current_user["id"],
            "created_at": now_str
        }
    }


@router.get("/{shipment_id}/pickup")
def get_pickup(
    shipment_id: str,
    current_user: dict = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db)
):
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM pickups WHERE shipment_id = ?", (shipment_id,))
    row = cursor.fetchone()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "PICKUP_NOT_FOUND", "message": "No pickup check on record for this shipment"}}
        )

    pickup = dict(row)
    try:
        pickup["photo_urls"] = json.loads(pickup["photo_urls"])
    except Exception:
        pickup["photo_urls"] = []

    return {"pickup": pickup}


@router.post("/{shipment_id}/pickup/supersede")
def supersede_pickup(
    shipment_id: str,
    req: PickupSupersedeRequest,
    current_user: dict = Depends(require_role(["admin"])),
    conn: sqlite3.Connection = Depends(get_db)
):
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM pickups WHERE shipment_id = ?", (shipment_id,))
    existing = cursor.fetchone()
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "PICKUP_NOT_FOUND", "message": "No pickup check exists to supersede"}}
        )

    old_record = dict(existing)
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

    cursor.execute("""
        UPDATE pickups
        SET weight_kg = ?, dims_cm = ?, condition = ?, photo_urls = ?,
            superseded_by = ?, audit_note = ?, created_at = ?
        WHERE shipment_id = ?
    """, (
        round(req.weight_kg, 2),
        req.dims_cm.strip(),
        req.condition,
        json.dumps(req.photo_urls),
        current_user["id"],
        req.audit_note.strip(),
        now_str,
        shipment_id
    ))

    log_audit_event(
        conn,
        actor_id=current_user["id"],
        action="supersede_pickup",
        entity_type="pickup",
        entity_id=existing["id"],
        details={
            "old": old_record,
            "new": {
                "weight_kg": req.weight_kg,
                "dims_cm": req.dims_cm,
                "condition": req.condition,
                "audit_note": req.audit_note
            }
        }
    )

    return {"message": "Pickup baseline superseded by admin", "audit_note": req.audit_note}


@router.post("/{shipment_id}/scan", status_code=status.HTTP_201_CREATED)
def record_scan(
    shipment_id: str,
    req: ScanCreateRequest,
    current_user: dict = Depends(require_role(["courier", "admin"])),
    conn: sqlite3.Connection = Depends(get_db)
):
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM shipments WHERE id = ?", (shipment_id,))
    shipment = cursor.fetchone()
    if not shipment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "SHIPMENT_NOT_FOUND", "message": "Shipment not found"}}
        )

    # Courier ownership enforcement
    role = current_user["role"]
    if role == "courier":
        c_id = get_user_courier_id(conn, current_user.get("courier_name"))
        if shipment["courier_id"] != c_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error": {"code": "FORBIDDEN", "message": "You can only log scans for shipments assigned to your courier"}}
            )

    # Load settings for thresholds
    cursor.execute("SELECT key, value FROM settings")
    settings = {row["key"]: float(row["value"]) for row in cursor.fetchall()}
    shock_threshold = settings.get("shock_threshold_g", 10.0)
    weight_tolerance_pct = settings.get("weight_tolerance_pct", 5.0)

    flags = []

    # Shock flag check
    if req.shock_g is not None and req.shock_g >= shock_threshold:
        flags.append("shock")

    # Delivered weight mismatch check
    if req.status == "delivered" and req.weight_kg is not None:
        cursor.execute("SELECT weight_kg FROM pickups WHERE shipment_id = ?", (shipment_id,))
        p_row = cursor.fetchone()
        if p_row and p_row["weight_kg"]:
            pickup_weight = float(p_row["weight_kg"])
            if pickup_weight > 0:
                pct_diff = abs(req.weight_kg - pickup_weight) / pickup_weight * 100.0
                if pct_diff > weight_tolerance_pct:
                    flags.append("weight_mismatch")

    scan_id = f"SCN-{uuid.uuid4().hex[:8].upper()}"
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

    cursor.execute("""
        INSERT INTO scan_events (
            id, shipment_id, status, location, weight_kg, shock_g,
            flags, recorded_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        scan_id,
        shipment_id,
        req.status,
        req.location.strip(),
        req.weight_kg,
        req.shock_g,
        json.dumps(flags),
        current_user["id"],
        now_str
    ))

    # Update shipment status
    cursor.execute("UPDATE shipments SET status = ?, updated_at = ? WHERE id = ?", (req.status, now_str, shipment_id))
    conn.commit()

    return {
        "message": "Scan recorded successfully",
        "scan": {
            "id": scan_id,
            "shipment_id": shipment_id,
            "status": req.status,
            "location": req.location,
            "weight_kg": req.weight_kg,
            "shock_g": req.shock_g,
            "flags": flags,
            "created_at": now_str
        }
    }


@router.get("/{shipment_id}/timeline")
def get_timeline(
    shipment_id: str,
    current_user: dict = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db)
):
    # Reuse get_shipment logic or return timeline array
    detail = get_shipment(shipment_id, current_user, conn)
    return {"timeline": detail["timeline"]}

