import sqlite3
import json
from datetime import datetime, timezone
from typing import Any, Dict

def log_audit_event(
    conn: sqlite3.Connection,
    actor_id: str,
    action: str,
    entity_type: str,
    entity_id: str,
    details: Dict[str, Any]
):
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    details_str = json.dumps(details, default=str)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO audit_log (actor_id, action, entity_type, entity_id, details, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (actor_id, action, entity_type, entity_id, details_str, now_str))
    conn.commit()

