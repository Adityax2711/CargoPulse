import sqlite3
import json
from contextlib import contextmanager
from app.config import DB_PATH

DEFAULT_SETTINGS = {
    "standard_rate": "0.004",         # 0.4%
    "fragile_rate": "0.008",          # 0.8%
    "clean_discount": "0.20",         # 20% discount if claims ratio < 2%
    "min_premium": "0.50",            # $0.50 minimum
    "liability_cap": "100.00",        # $100 default courier liability
    "warn_days": "2",                 # 2 days no scan -> warning
    "lost_days": "14",                # 14 days no scan -> lost
    "shock_threshold_g": "10.0",      # >= 10g shock flag
    "weight_tolerance_pct": "5.0",    # > 5% weight mismatch
    "auto_approve_limit": "50.00",    # <= $50 auto-approved if insured & pickup check
    "advance_pct": "0.50"             # 50% advance payout when under_review & insured
}

SCHEMA_SQL = """
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('seller', 'courier', 'admin')),
    courier_name TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS couriers (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shipments (
    id TEXT PRIMARY KEY,
    seller_id TEXT NOT NULL,
    courier_id TEXT NOT NULL,
    origin TEXT NOT NULL,
    destination TEXT NOT NULL,
    recipient TEXT NOT NULL,
    category TEXT NOT NULL,
    fragile INTEGER NOT NULL DEFAULT 0,
    declared_value REAL NOT NULL,
    insured INTEGER NOT NULL DEFAULT 0,
    premium REAL NOT NULL DEFAULT 0.0,
    status TEXT NOT NULL DEFAULT 'booked' CHECK(status IN ('booked', 'picked_up', 'in_transit', 'hub', 'out_for_delivery', 'delivered', 'lost')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(seller_id) REFERENCES users(id),
    FOREIGN KEY(courier_id) REFERENCES couriers(id)
);

CREATE TABLE IF NOT EXISTS pickups (
    id TEXT PRIMARY KEY,
    shipment_id TEXT UNIQUE NOT NULL,
    weight_kg REAL NOT NULL,
    dims_cm TEXT NOT NULL,
    condition TEXT NOT NULL CHECK(condition IN ('good', 'minor_marks', 'damaged')),
    photo_urls TEXT NOT NULL DEFAULT '[]',
    recorded_by TEXT NOT NULL,
    superseded_by TEXT,
    audit_note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(shipment_id) REFERENCES shipments(id),
    FOREIGN KEY(recorded_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS scan_events (
    id TEXT PRIMARY KEY,
    shipment_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('picked_up', 'in_transit', 'hub', 'out_for_delivery', 'delivered', 'lost')),
    location TEXT NOT NULL,
    weight_kg REAL,
    shock_g REAL,
    flags TEXT NOT NULL DEFAULT '[]',
    recorded_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(shipment_id) REFERENCES shipments(id),
    FOREIGN KEY(recorded_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS claims (
    id TEXT PRIMARY KEY,
    shipment_id TEXT UNIQUE NOT NULL,
    seller_id TEXT NOT NULL,
    courier_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('loss', 'damage')),
    description TEXT NOT NULL,
    claimed_amount REAL NOT NULL,
    approved_amount REAL,
    payout_now REAL NOT NULL DEFAULT 0.0,
    damage_photo_urls TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL CHECK(status IN ('under_review', 'fraud_review', 'auto_approved', 'approved', 'denied', 'arbitration')),
    reason TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    decided_at TIMESTAMP,
    decided_by TEXT,
    FOREIGN KEY(shipment_id) REFERENCES shipments(id),
    FOREIGN KEY(seller_id) REFERENCES users(id),
    FOREIGN KEY(courier_id) REFERENCES couriers(id),
    FOREIGN KEY(decided_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_id TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    details TEXT NOT NULL DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(actor_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_shipments_seller ON shipments(seller_id);
CREATE INDEX IF NOT EXISTS idx_shipments_courier ON shipments(courier_id);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);
CREATE INDEX IF NOT EXISTS idx_scans_shipment ON scan_events(shipment_id);
CREATE INDEX IF NOT EXISTS idx_scans_created ON scan_events(created_at);
CREATE INDEX IF NOT EXISTS idx_claims_seller ON claims(seller_id);
CREATE INDEX IF NOT EXISTS idx_claims_courier ON claims(courier_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);
"""

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    try:
        yield conn
    finally:
        conn.close()

@contextmanager
def get_db_ctx():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    try:
        yield conn
    finally:
        conn.close()

def init_db():
    with get_db_ctx() as conn:
        conn.executescript(SCHEMA_SQL)
        # Initialize default settings if not present
        cursor = conn.cursor()
        for key, val in DEFAULT_SETTINGS.items():
            cursor.execute(
                "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
                (key, val)
            )
        # Initialize default couriers if none exist
        cursor.execute("SELECT COUNT(*) as cnt FROM couriers")
        if cursor.fetchone()["cnt"] == 0:
            default_couriers = [
                ("CR-FASTEX", "FastEx"),
                ("CR-SWIFTPOST", "SwiftPost"),
                ("CR-CITYLINK", "CityLink")
            ]
            cursor.executemany(
                "INSERT INTO couriers (id, name) VALUES (?, ?)",
                default_couriers
            )
        conn.commit()

def get_setting_float(conn: sqlite3.Connection, key: str, default: float) -> float:
    cursor = conn.cursor()
    cursor.execute("SELECT value FROM settings WHERE key = ?", (key,))
    row = cursor.fetchone()
    if row and row["value"]:
        try:
            return float(row["value"])
        except ValueError:
            pass
    return default
