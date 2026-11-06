import uuid
import json
import sqlite3
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from app.database import get_db
from app.models import ClaimCreateRequest, ClaimDecisionRequest
from app.services.auth_service import get_current_user, require_role
from app.services.claims_service import evaluate_claim
from app.services.audit_service import log_audit_event

router = APIRouter(prefix="/api/claims", tags=["claims"])

def get_user_courier_id(conn: sqlite3.Connection, courier_name: Optional[str]) -> Optional[str]:
    if not courier_name:
        return None
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM couriers WHERE LOWER(name) = LOWER(?) OR id = ?", (courier_name, courier_name))
    row = cursor.fetchone()
    return row["id"] if row else None


@router.post("", status_code=status.HTTP_201_CREATED)
def file_claim(
    req: ClaimCreateRequest,
    current_user: dict = Depends(require_role(["seller"])),
    conn: sqlite3.Connection = Depends(get_db)
):
    cursor = conn.cursor()

    # 1. Verify shipment exists & belongs to current seller
    cursor.execute("SELECT * FROM shipments WHERE id = ?", (req.shipment_id,))
    shipment = cursor.fetchone()
    if not shipment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "SHIPMENT_NOT_FOUND", "message": "Shipment not found", "field": "shipment_id"}}
        )

    if shipment["seller_id"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "FORBIDDEN", "message": "You can only file claims on your own shipments"}}
        )

    # 2. Check that only one claim is allowed per shipment
    cursor.execute("SELECT id FROM claims WHERE shipment_id = ?", (req.shipment_id,))
    existing_claim = cursor.fetchone()
    if existing_claim:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": {"code": "CLAIM_ALREADY_EXISTS", "message": f"A claim ({existing_claim['id']}) has already been filed for this shipment. Only one claim is permitted per shipment."}}
        )

    # 3. Evaluate claim through business rules engine (rules a -> f)
    evaluation = evaluate_claim(
        conn=conn,
        shipment_id=req.shipment_id,
        seller_id=current_user["id"],
        claim_type=req.type,
        claimed_amount=req.claimed_amount,
        description=req.description,
        damage_photo_urls=req.damage_photo_urls or []
    )

    claim_id = f"CLM-{uuid.uuid4().hex[:8].upper()}"
    now = datetime.now(timezone.utc)
    now_str = now.strftime("%Y-%m-%d %H:%M:%S")

    # If auto_approved or denied, decided_at is set immediately
    decided_at = now_str if evaluation["status"] in ("auto_approved", "denied") else None
    decided_by = "USR-SYSTEM" if evaluation["status"] in ("auto_approved", "denied") else None

    cursor.execute("""
        INSERT INTO claims (
            id, shipment_id, seller_id, courier_id, type, description,
            claimed_amount, approved_amount, payout_now, damage_photo_urls,
            status, reason, created_at, decided_at, decided_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        claim_id,
        req.shipment_id,
        current_user["id"],
        evaluation["courier_id"],
        req.type,
        req.description.strip(),
        round(req.claimed_amount, 2),
        evaluation["approved_amount"],
        round(evaluation["payout_now"], 2),
        json.dumps(req.damage_photo_urls or []),
        evaluation["status"],
        evaluation["reason"],
        now_str,
        decided_at,
        decided_by
    ))

    # Log audit event
    log_audit_event(
        conn,
        actor_id=current_user["id"],
        action="file_claim",
        entity_type="claim",
        entity_id=claim_id,
        details={
            "status": evaluation["status"],
            "claimed_amount": req.claimed_amount,
            "approved_amount": evaluation["approved_amount"],
            "payout_now": evaluation["payout_now"],
            "reason": evaluation["reason"]
        }
    )

    conn.commit()

    return {
        "message": "Claim processed successfully",
        "claim": {
            "id": claim_id,
            "shipment_id": req.shipment_id,
            "seller_id": current_user["id"],
            "type": req.type,
            "status": evaluation["status"],
            "claimed_amount": req.claimed_amount,
            "approved_amount": evaluation["approved_amount"],
            "payout_now": evaluation["payout_now"],
            "coverage_amount": evaluation["coverage_amount"],
            "reason": evaluation["reason"],
            "created_at": now_str,
            "decided_at": decided_at
        }
    }


@router.get("")
def list_claims(
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: dict = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db)
):
    cursor = conn.cursor()
    role = current_user["role"]

    query = """
        SELECT cl.*, s.declared_value, s.insured, s.category, s.origin, s.destination,
               c.name as courier_name, u.name as seller_name, u.email as seller_email,
               dec.name as decided_by_name
        FROM claims cl
        JOIN shipments s ON cl.shipment_id = s.id
        JOIN couriers c ON cl.courier_id = c.id
        JOIN users u ON cl.seller_id = u.id
        LEFT JOIN users dec ON cl.decided_by = dec.id
        WHERE 1=1
    """
    params = []

    if role == "seller":
        query += " AND cl.seller_id = ?"
        params.append(current_user["id"])
    elif role == "courier":
        c_id = get_user_courier_id(conn, current_user.get("courier_name"))
        if not c_id:
            return {"claims": []}
        query += " AND cl.courier_id = ?"
        params.append(c_id)

    if status_filter:
        query += " AND cl.status = ?"
        params.append(status_filter)

    query += " ORDER BY cl.created_at DESC"

    cursor.execute(query, params)
    rows = cursor.fetchall()

    claims = []
    for r in rows:
        d = dict(r)
        d["insured"] = bool(d["insured"])
        try:
            d["damage_photo_urls"] = json.loads(d["damage_photo_urls"])
        except Exception:
            d["damage_photo_urls"] = []
        claims.append(d)

    return {"claims": claims}


@router.get("/{claim_id}")
def get_claim(
    claim_id: str,
    current_user: dict = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db)
):
    cursor = conn.cursor()
    cursor.execute("""
        SELECT cl.*, s.declared_value, s.insured, s.category, s.origin, s.destination, s.status as shipment_status,
               c.name as courier_name, u.name as seller_name, u.email as seller_email,
               dec.name as decided_by_name
        FROM claims cl
        JOIN shipments s ON cl.shipment_id = s.id
        JOIN couriers c ON cl.courier_id = c.id
        JOIN users u ON cl.seller_id = u.id
        LEFT JOIN users dec ON cl.decided_by = dec.id
        WHERE cl.id = ?
    """, (claim_id,))
    row = cursor.fetchone()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "CLAIM_NOT_FOUND", "message": "Claim not found"}}
        )

    claim = dict(row)
    claim["insured"] = bool(claim["insured"])
    try:
        claim["damage_photo_urls"] = json.loads(claim["damage_photo_urls"])
    except Exception:
        claim["damage_photo_urls"] = []

    # Enforce role scoping
    role = current_user["role"]
    if role == "seller" and claim["seller_id"] != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "FORBIDDEN", "message": "You can only view your own claims"}}
        )
    elif role == "courier":
        c_id = get_user_courier_id(conn, current_user.get("courier_name"))
        if claim["courier_id"] != c_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error": {"code": "FORBIDDEN", "message": "You can only view claims assigned to your courier"}}
            )

    # Fetch pickup check for evidence
    cursor.execute("SELECT * FROM pickups WHERE shipment_id = ?", (claim["shipment_id"],))
    pickup_row = cursor.fetchone()
    pickup = None
    if pickup_row:
        pickup = dict(pickup_row)
        try:
            pickup["photo_urls"] = json.loads(pickup["photo_urls"])
        except Exception:
            pickup["photo_urls"] = []

    # Fetch audit log for this claim
    cursor.execute("""
        SELECT a.*, u.name as actor_name, u.role as actor_role
        FROM audit_log a
        LEFT JOIN users u ON a.actor_id = u.id
        WHERE a.entity_id = ?
        ORDER BY a.created_at ASC
    """, (claim_id,))
    logs = [dict(lr) for lr in cursor.fetchall()]

    return {
        "claim": claim,
        "pickup": pickup,
        "audit_logs": logs
    }


@router.post("/{claim_id}/decision")
def ops_decision(
    claim_id: str,
    req: ClaimDecisionRequest,
    current_user: dict = Depends(require_role(["admin"])),
    conn: sqlite3.Connection = Depends(get_db)
):
    """
    Ops admins can approve (with an optional adjusted amount), deny, or send a claim to 'arbitration'.
    Each decision needs a reason and is recorded with admin's identity and timestamp in audit log.
    Arbitration status stays open until an admin resolves it.
    """
    cursor = conn.cursor()
    cursor.execute("""
        SELECT cl.*, s.declared_value, s.insured 
        FROM claims cl
        JOIN shipments s ON cl.shipment_id = s.id
        WHERE cl.id = ?
    """, (claim_id,))
    row = cursor.fetchone()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "CLAIM_NOT_FOUND", "message": "Claim not found"}}
        )

    claim = dict(row)
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

    # Load liability cap
    cursor.execute("SELECT value FROM settings WHERE key = 'liability_cap'")
    cap_row = cursor.fetchone()
    liability_cap = float(cap_row["value"]) if cap_row else 100.0

    coverage_amount = claim["declared_value"] if claim["insured"] else liability_cap

    if req.decision == "approved":
        approved_amt = req.amount if req.amount is not None else min(claim["claimed_amount"], coverage_amount)
        approved_amt = round(min(approved_amt, coverage_amount), 2)
        payout_now = approved_amt
        new_status = "approved"
        decided_at = now_str
    elif req.decision == "denied":
        approved_amt = 0.0
        payout_now = 0.0
        new_status = "denied"
        decided_at = now_str
    elif req.decision == "arbitration":
        approved_amt = None
        payout_now = claim["payout_now"]  # keep advance if already given
        new_status = "arbitration"
        decided_at = None

    cursor.execute("""
        UPDATE claims
        SET status = ?, approved_amount = ?, payout_now = ?, reason = ?, decided_at = ?, decided_by = ?
        WHERE id = ?
    """, (
        new_status,
        approved_amt,
        payout_now,
        req.reason.strip(),
        decided_at,
        current_user["id"],
        claim_id
    ))

    # Log to audit log
    log_audit_event(
        conn,
        actor_id=current_user["id"],
        action=f"claim_{req.decision}",
        entity_type="claim",
        entity_id=claim_id,
        details={
            "previous_status": claim["status"],
            "new_status": new_status,
            "approved_amount": approved_amt,
            "payout_now": payout_now,
            "reason": req.reason.strip(),
            "admin_name": current_user["name"],
            "admin_id": current_user["id"]
        }
    )

    conn.commit()

    return {
        "message": f"Claim updated to {new_status}",
        "claim": {
            "id": claim_id,
            "status": new_status,
            "approved_amount": approved_amt,
            "payout_now": payout_now,
            "reason": req.reason,
            "decided_at": decided_at,
            "decided_by": current_user["id"]
        }
    }

