import sqlite3
import json
import uuid
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List

def run_scan_gap_check(conn: sqlite3.Connection) -> Dict[str, Any]:
    """
    Evaluates all active shipments for scan gaps:
    - >= 2 days without scan: warning alert
    - >= 14 days without scan: move status to 'lost' and append timeline event
    """
    cursor = conn.cursor()

    # Load settings
    cursor.execute("SELECT key, value FROM settings")
    settings = {row["key"]: float(row["value"]) for row in cursor.fetchall()}
    warn_days = settings.get("warn_days", 2.0)
    lost_days = settings.get("lost_days", 14.0)

    now = datetime.now(timezone.utc)
    now_str = now.strftime("%Y-%m-%d %H:%M:%S")

    # Fetch active shipments (not yet delivered or lost)
    cursor.execute("""
        SELECT s.*, c.name as courier_name, u.name as seller_name, u.email as seller_email
        FROM shipments s
        JOIN couriers c ON s.courier_id = c.id
        JOIN users u ON s.seller_id = u.id
        WHERE s.status NOT IN ('delivered', 'lost')
    """)
    active_shipments = cursor.fetchall()

    warnings = []
    newly_lost = []

    for shp in active_shipments:
        shipment_id = shp["id"]

        # Find latest scan event
        cursor.execute("""
            SELECT * FROM scan_events 
            WHERE shipment_id = ? 
            ORDER BY created_at DESC LIMIT 1
        """, (shipment_id,))
        latest_scan = cursor.fetchone()

        last_time_str = latest_scan["created_at"] if latest_scan else shp["created_at"]
        try:
            if "T" in last_time_str:
                last_dt = datetime.fromisoformat(last_time_str.replace("Z", "+00:00"))
            else:
                last_dt = datetime.strptime(last_time_str, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
        except Exception:
            last_dt = now

        days_elapsed = (now - last_dt).total_seconds() / 86400.0

        if days_elapsed >= lost_days:
            # Mark as lost
            cursor.execute("""
                UPDATE shipments 
                SET status = 'lost', updated_at = ? 
                WHERE id = ?
            """, (now_str, shipment_id))

            # Append scan event to timeline
            scan_id = f"SCN-{uuid.uuid4().hex[:8].upper()}"
            cursor.execute("""
                INSERT INTO scan_events (id, shipment_id, status, location, shock_g, weight_kg, flags, recorded_by, created_at)
                VALUES (?, ?, 'lost', 'Automated Scan Monitor (System)', 0.0, NULL, ?, 'USR-SYSTEM', ?)
            """, (scan_id, shipment_id, json.dumps(["scan_gap_lost"]), now_str))

            # Audit log
            cursor.execute("""
                INSERT INTO audit_log (actor_id, action, entity_type, entity_id, details, created_at)
                VALUES ('USR-SYSTEM', 'auto_mark_lost', 'shipment', ?, ?, ?)
            """, (
                shipment_id,
                json.dumps({
                    "reason": f"No scan recorded for {round(days_elapsed, 1)} days (threshold: {lost_days} days)",
                    "days_elapsed": round(days_elapsed, 1)
                }),
                now_str
            ))

            newly_lost.append({
                "shipment_id": shipment_id,
                "seller_name": shp["seller_name"],
                "courier_name": shp["courier_name"],
                "days_elapsed": round(days_elapsed, 1)
            })

        elif days_elapsed >= warn_days:
            warnings.append({
                "shipment_id": shipment_id,
                "seller_id": shp["seller_id"],
                "seller_name": shp["seller_name"],
                "courier_name": shp["courier_name"],
                "origin": shp["origin"],
                "destination": shp["destination"],
                "status": shp["status"],
                "days_elapsed": round(days_elapsed, 1),
                "last_active": last_time_str,
                "severity": "high" if days_elapsed >= 7 else "medium"
            })

    conn.commit()

    return {
        "checked_at": now.isoformat(),
        "total_active_evaluated": len(active_shipments),
        "newly_marked_lost": newly_lost,
        "active_warnings": warnings
    }


def get_all_alerts(conn: sqlite3.Connection) -> List[Dict[str, Any]]:
    """
    Returns unified alerts list for ops admin:
    - 2+ days warning scan gaps
    - 14+ days lost shipments
    """
    cursor = conn.cursor()

    # Load settings
    cursor.execute("SELECT key, value FROM settings")
    settings = {row["key"]: float(row["value"]) for row in cursor.fetchall()}
    warn_days = settings.get("warn_days", 2.0)
    lost_days = settings.get("lost_days", 14.0)

    now = datetime.now(timezone.utc)

    # 1. Fetch all shipments that are either 'lost' or active
    cursor.execute("""
        SELECT s.*, c.name as courier_name, u.name as seller_name, u.email as seller_email
        FROM shipments s
        JOIN couriers c ON s.courier_id = c.id
        JOIN users u ON s.seller_id = u.id
        ORDER BY s.created_at DESC
    """)
    all_shipments = cursor.fetchall()

    alerts = []

    for shp in all_shipments:
        shipment_id = shp["id"]
        status = shp["status"]

        # Latest scan
        cursor.execute("""
            SELECT * FROM scan_events 
            WHERE shipment_id = ? 
            ORDER BY created_at DESC LIMIT 1
        """, (shipment_id,))
        latest_scan = cursor.fetchone()

        last_time_str = latest_scan["created_at"] if latest_scan else shp["created_at"]
        try:
            if "T" in last_time_str:
                last_dt = datetime.fromisoformat(last_time_str.replace("Z", "+00:00"))
            else:
                last_dt = datetime.strptime(last_time_str, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
        except Exception:
            last_dt = now

        days_elapsed = (now - last_dt).total_seconds() / 86400.0

        if status == "lost":
            alerts.append({
                "id": f"ALT-LOST-{shipment_id}",
                "shipment_id": shipment_id,
                "type": "lost",
                "severity": "critical",
                "title": f"Shipment Lost: {shipment_id}",
                "message": f"Parcel marked LOST. No scan activity recorded for {round(days_elapsed, 1)} days.",
                "seller_name": shp["seller_name"],
                "seller_id": shp["seller_id"],
                "courier_name": shp["courier_name"],
                "courier_id": shp["courier_id"],
                "declared_value": shp["declared_value"],
                "insured": bool(shp["insured"]),
                "days_elapsed": round(days_elapsed, 1),
                "created_at": shp["updated_at"]
            })
        elif status != "delivered" and days_elapsed >= warn_days:
            alerts.append({
                "id": f"ALT-WARN-{shipment_id}",
                "shipment_id": shipment_id,
                "type": "scan_gap_warning",
                "severity": "high" if days_elapsed >= 7 else "medium",
                "title": f"Scan Gap Warning: {shipment_id}",
                "message": f"Inactivity alert: Last scan occurred {round(days_elapsed, 1)} days ago ({latest_scan['location'] if latest_scan else 'Origin'}).",
                "seller_name": shp["seller_name"],
                "seller_id": shp["seller_id"],
                "courier_name": shp["courier_name"],
                "courier_id": shp["courier_id"],
                "declared_value": shp["declared_value"],
                "insured": bool(shp["insured"]),
                "days_elapsed": round(days_elapsed, 1),
                "created_at": last_time_str
            })

    return alerts


def calculate_scorecard(conn: sqlite3.Connection, date_range: str = "all") -> List[Dict[str, Any]]:
    """
    Computes courier accountability scorecard metrics:
    - Shipment count
    - Lost count
    - Damage claim count
    - Incidents per 1,000 shipments: ((lost + damage_claims) / shipments) * 1000
    - Avg hours from claim creation to decision
    """
    cursor = conn.cursor()

    # Determine date filter
    now = datetime.now(timezone.utc)
    date_filter = None
    if date_range == "30d":
        date_filter = (now - timedelta(days=30)).strftime("%Y-%m-%d %H:%M:%S")
    elif date_range == "90d":
        date_filter = (now - timedelta(days=90)).strftime("%Y-%m-%d %H:%M:%S")

    # Fetch all couriers
    cursor.execute("SELECT id, name FROM couriers ORDER BY name ASC")
    couriers = cursor.fetchall()

    scorecard = []

    for c in couriers:
        c_id = c["id"]
        c_name = c["name"]

        # Shipments count
        if date_filter:
            cursor.execute("""
                SELECT COUNT(*) as cnt FROM shipments 
                WHERE courier_id = ? AND created_at >= ?
            """, (c_id, date_filter))
        else:
            cursor.execute("SELECT COUNT(*) as cnt FROM shipments WHERE courier_id = ?", (c_id,))
        total_shipments = cursor.fetchone()["cnt"]

        # Lost shipments count
        if date_filter:
            cursor.execute("""
                SELECT COUNT(*) as cnt FROM shipments 
                WHERE courier_id = ? AND status = 'lost' AND updated_at >= ?
            """, (c_id, date_filter))
        else:
            cursor.execute("SELECT COUNT(*) as cnt FROM shipments WHERE courier_id = ? AND status = 'lost'", (c_id,))
        lost_count = cursor.fetchone()["cnt"]

        # Damage claims count
        if date_filter:
            cursor.execute("""
                SELECT COUNT(*) as cnt FROM claims 
                WHERE courier_id = ? AND type = 'damage' AND created_at >= ?
            """, (c_id, date_filter))
        else:
            cursor.execute("SELECT COUNT(*) as cnt FROM claims WHERE courier_id = ? AND type = 'damage'", (c_id,))
        damage_claims_count = cursor.fetchone()["cnt"]

        # Loss claims count
        if date_filter:
            cursor.execute("""
                SELECT COUNT(*) as cnt FROM claims 
                WHERE courier_id = ? AND type = 'loss' AND created_at >= ?
            """, (c_id, date_filter))
        else:
            cursor.execute("SELECT COUNT(*) as cnt FROM claims WHERE courier_id = ? AND type = 'loss'", (c_id,))
        loss_claims_count = cursor.fetchone()["cnt"]

        # Incident rate per 1,000 shipments
        total_incidents = lost_count + damage_claims_count
        incidents_per_1000 = round((total_incidents / total_shipments * 1000.0), 1) if total_shipments > 0 else 0.0

        # Avg hours to claim decision
        if date_filter:
            cursor.execute("""
                SELECT created_at, decided_at FROM claims 
                WHERE courier_id = ? AND decided_at IS NOT NULL AND created_at >= ?
            """, (c_id, date_filter))
        else:
            cursor.execute("""
                SELECT created_at, decided_at FROM claims 
                WHERE courier_id = ? AND decided_at IS NOT NULL
            """, (c_id,))
        decided_claims = cursor.fetchall()

        total_hours = 0.0
        decided_count = 0
        for dc in decided_claims:
            try:
                c_dt_str = dc["created_at"]
                d_dt_str = dc["decided_at"]
                c_dt = datetime.fromisoformat(c_dt_str.replace("Z", "+00:00")) if "T" in c_dt_str else datetime.strptime(c_dt_str, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
                d_dt = datetime.fromisoformat(d_dt_str.replace("Z", "+00:00")) if "T" in d_dt_str else datetime.strptime(d_dt_str, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
                diff_hours = (d_dt - c_dt).total_seconds() / 3600.0
                if diff_hours >= 0:
                    total_hours += diff_hours
                    decided_count += 1
            except Exception:
                pass

        avg_hours_to_decision = round(total_hours / decided_count, 1) if decided_count > 0 else 0.0

        # On-time delivery estimation or health score
        health_grade = "A"
        if incidents_per_1000 > 60:
            health_grade = "D"
        elif incidents_per_1000 > 40:
            health_grade = "C"
        elif incidents_per_1000 > 20:
            health_grade = "B"

        scorecard.append({
            "courier_id": c_id,
            "courier_name": c_name,
            "shipments_count": total_shipments,
            "lost_count": lost_count,
            "damage_claims_count": damage_claims_count,
            "loss_claims_count": loss_claims_count,
            "total_incidents": total_incidents,
            "incidents_per_1000": incidents_per_1000,
            "avg_hours_to_decision": avg_hours_to_decision,
            "decided_claims_count": decided_count,
            "health_grade": health_grade
        })

    return scorecard

