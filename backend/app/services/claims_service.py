import sqlite3
import json
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional

def evaluate_claim(
    conn: sqlite3.Connection,
    shipment_id: str,
    seller_id: str,
    claim_type: str,            # 'loss' or 'damage'
    claimed_amount: float,
    description: str,
    damage_photo_urls: list
) -> Dict[str, Any]:
    """
    Evaluates claims based on automated parametric business rules (a through f).
    Returns dict with status, reason, approved_amount, payout_now, etc.
    """
    cursor = conn.cursor()

    # Load settings
    cursor.execute("SELECT key, value FROM settings")
    settings = {row["key"]: float(row["value"]) for row in cursor.fetchall()}
    liability_cap = settings.get("liability_cap", 100.00)
    lost_days = settings.get("lost_days", 14.0)
    auto_approve_limit = settings.get("auto_approve_limit", 50.00)
    advance_pct = settings.get("advance_pct", 0.50)

    # 1. Fetch shipment
    cursor.execute("SELECT * FROM shipments WHERE id = ?", (shipment_id,))
    shipment = cursor.fetchone()
    if not shipment:
        raise ValueError("Shipment not found")

    if shipment["seller_id"] != seller_id:
        raise PermissionError("Seller does not own this shipment")

    courier_id = shipment["courier_id"]
    insured = bool(shipment["insured"])
    declared_value = float(shipment["declared_value"])

    # Max coverage calculation
    coverage_amount = declared_value if insured else liability_cap
    eligible_amount = round(min(claimed_amount, coverage_amount), 2)

    # Fetch pickup baseline
    cursor.execute("SELECT * FROM pickups WHERE shipment_id = ?", (shipment_id,))
    pickup = cursor.fetchone()
    has_pickup = pickup is not None

    # Fetch all scans and flags
    cursor.execute("SELECT * FROM scan_events WHERE shipment_id = ? ORDER BY created_at ASC", (shipment_id,))
    scans = cursor.fetchall()

    has_shock_flag = False
    has_weight_mismatch_flag = False
    last_scan_date = None

    for scan in scans:
        flags = []
        try:
            flags = json.loads(scan["flags"]) if scan["flags"] else []
        except Exception:
            flags = []
        if "shock" in flags:
            has_shock_flag = True
        if "weight_mismatch" in flags:
            has_weight_mismatch_flag = True

    if scans:
        last_scan = scans[-1]
        try:
            # Parse created_at e.g. "2026-11-06 01:00:00" or ISO format
            scan_time_str = last_scan["created_at"]
            if "T" in scan_time_str:
                last_scan_date = datetime.fromisoformat(scan_time_str.replace("Z", "+00:00"))
            else:
                last_scan_date = datetime.strptime(scan_time_str, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
        except Exception:
            last_scan_date = datetime.now(timezone.utc)
    else:
        # If no scans, use shipment created_at
        try:
            shp_time_str = shipment["created_at"]
            if "T" in shp_time_str:
                last_scan_date = datetime.fromisoformat(shp_time_str.replace("Z", "+00:00"))
            else:
                last_scan_date = datetime.strptime(shp_time_str, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
        except Exception:
            last_scan_date = datetime.now(timezone.utc)

    now = datetime.now(timezone.utc)
    days_since_last_scan = (now - last_scan_date).total_seconds() / 86400.0 if last_scan_date else 0

    # 90-day claim count for seller
    ninety_days_ago = (now - timedelta(days=90)).strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute(
        "SELECT COUNT(*) as count FROM claims WHERE seller_id = ? AND created_at >= ?",
        (seller_id, ninety_days_ago)
    )
    recent_claims_count = cursor.fetchone()["count"]

    # RULE EVALUATION IN STRICT ORDER (a -> f)
    # Rule a: 3 or more claims in last 90 days -> fraud_review
    if recent_claims_count >= 3:
        status = "fraud_review"
        reason = f"Seller velocity alert: {recent_claims_count} claims submitted in the last 90 days. Forwarded for fraud review."
        approved_amount = None
        payout_now = 0.0

    # Rule b: type is loss and shipment is marked delivered -> denied
    elif claim_type == "loss" and shipment["status"] == "delivered":
        status = "denied"
        reason = "Delivery scan on record; proof of non-delivery required"
        approved_amount = 0.0
        payout_now = 0.0

    # Rule c: type is loss and last scan is 14 or more days old -> auto_approved
    elif claim_type == "loss" and (days_since_last_scan >= lost_days or shipment["status"] == "lost"):
        status = "auto_approved"
        reason = f"Parametric loss rule triggered: no scan activity for {round(days_since_last_scan, 1)} days (threshold: {int(lost_days)} days)."
        approved_amount = eligible_amount
        payout_now = eligible_amount

    # Rule d: type is damage, pickup record exists, and shipment has 'shock' or 'weight_mismatch' flag -> auto_approved
    elif claim_type == "damage" and has_pickup and (has_shock_flag or has_weight_mismatch_flag):
        trigger_flags = []
        if has_shock_flag:
            trigger_flags.append("impact shock (>=10g)")
        if has_weight_mismatch_flag:
            trigger_flags.append("weight mismatch (>5%)")
        status = "auto_approved"
        reason = f"Auto-approved via transit telemetry: pickup baseline verified and {' + '.join(trigger_flags)} detected in transit."
        approved_amount = eligible_amount
        payout_now = eligible_amount

    # Rule e: claimed amount <= 50 USD, insured, and pickup record exists -> auto_approved
    elif claimed_amount <= auto_approve_limit and insured and has_pickup:
        status = "auto_approved"
        reason = f"Auto-approved: Claim amount (${claimed_amount:.2f}) is within expedited limit (${auto_approve_limit:.2f}) with verified pickup evidence."
        approved_amount = eligible_amount
        payout_now = eligible_amount

    # Rule f: Otherwise under_review. If insured, 50% advance payout, else 0
    else:
        status = "under_review"
        if insured:
            payout_now = round(eligible_amount * advance_pct, 2)
            reason = f"Claim submitted for ops review. As an insured parcel, an immediate {int(advance_pct * 100)}% advance payout (${payout_now:.2f}) has been disbursed."
        else:
            payout_now = 0.0
            reason = f"Claim submitted for ops review. Uninsured parcels capped at default courier liability (${liability_cap:.2f}). No advance payout."
        approved_amount = None

    return {
        "status": status,
        "reason": reason,
        "claimed_amount": claimed_amount,
        "coverage_amount": coverage_amount,
        "eligible_amount": eligible_amount,
        "approved_amount": approved_amount,
        "payout_now": payout_now,
        "courier_id": courier_id,
        "has_pickup": has_pickup,
        "has_shock_flag": has_shock_flag,
        "has_weight_mismatch_flag": has_weight_mismatch_flag,
        "days_since_last_scan": round(days_since_last_scan, 1),
        "recent_claims_count": recent_claims_count
    }

