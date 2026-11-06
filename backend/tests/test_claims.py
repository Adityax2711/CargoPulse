import pytest
import sqlite3
import json
from datetime import datetime, timezone, timedelta
from app.services.claims_service import evaluate_claim
from app.database import SCHEMA_SQL, DEFAULT_SETTINGS

@pytest.fixture
def claim_db():
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA_SQL)
    cursor = conn.cursor()
    for k, v in DEFAULT_SETTINGS.items():
        cursor.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (k, v))
    cursor.execute("INSERT INTO couriers (id, name) VALUES ('CR-FASTEX', 'FastEx')")
    cursor.execute("INSERT INTO users (id, name, email, password_hash, role) VALUES ('USR-S1', 'Seller 1', 's1@test.com', 'h', 'seller')")
    cursor.execute("INSERT INTO users (id, name, email, password_hash, role) VALUES ('USR-COURIER', 'Courier Staff', 'c@test.com', 'h', 'courier')")
    conn.commit()
    yield conn
    conn.close()

def create_test_shipment(conn, shipment_id, declared_value=500.0, insured=1, status="in_transit", days_ago=1):
    dt = (datetime.now(timezone.utc) - timedelta(days=days_ago)).strftime("%Y-%m-%d %H:%M:%S")
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO shipments (
            id, seller_id, courier_id, origin, destination, recipient,
            category, fragile, declared_value, insured, premium, status,
            created_at, updated_at
        ) VALUES (?, 'USR-S1', 'CR-FASTEX', 'Origin', 'Destination', 'Recipient',
                  'Electronics', 0, ?, ?, 2.0, ?, ?, ?)
    """, (shipment_id, declared_value, insured, status, dt, dt))
    conn.commit()

def test_rule_a_fraud_review(claim_db):
    # Rule a: Seller has 3 or more claims in last 90 days -> fraud_review
    now = datetime.now(timezone.utc)
    cursor = claim_db.cursor()
    for i in range(3):
        create_test_shipment(claim_db, f"SHP-HIST-{i}")
        cursor.execute("""
            INSERT INTO claims (id, shipment_id, seller_id, courier_id, type, description, claimed_amount, status, reason, created_at)
            VALUES (?, ?, 'USR-S1', 'CR-FASTEX', 'damage', 'Past claim', 100, 'approved', 'Test', ?)
        """, (f"CLM-HIST-{i}", f"SHP-HIST-{i}", (now - timedelta(days=10 + i)).strftime("%Y-%m-%d %H:%M:%S")))
    claim_db.commit()

    create_test_shipment(claim_db, "SHP-NEW")
    result = evaluate_claim(
        claim_db,
        shipment_id="SHP-NEW",
        seller_id="USR-S1",
        claim_type="damage",
        claimed_amount=100.0,
        description="Crushed box",
        damage_photo_urls=[]
    )
    assert result["status"] == "fraud_review"
    assert result["payout_now"] == 0.0

def test_rule_b_loss_delivered_denied(claim_db):
    # Rule b: type is loss and shipment is marked delivered -> denied
    create_test_shipment(claim_db, "SHP-DELIV", status="delivered")
    result = evaluate_claim(
        claim_db,
        shipment_id="SHP-DELIV",
        seller_id="USR-S1",
        claim_type="loss",
        claimed_amount=200.0,
        description="Buyer says not received",
        damage_photo_urls=[]
    )
    assert result["status"] == "denied"
    assert result["reason"] == "Delivery scan on record; proof of non-delivery required"
    assert result["payout_now"] == 0.0

def test_rule_c_parametric_loss_auto_approved(claim_db):
    # Rule c: type is loss and last scan is 14 or more days old -> auto_approved
    create_test_shipment(claim_db, "SHP-LOST", declared_value=400.0, insured=1, days_ago=16)
    result = evaluate_claim(
        claim_db,
        shipment_id="SHP-LOST",
        seller_id="USR-S1",
        claim_type="loss",
        claimed_amount=400.0,
        description="Package vanished 16 days ago",
        damage_photo_urls=[]
    )
    assert result["status"] == "auto_approved"
    assert "Parametric loss rule" in result["reason"]
    assert result["approved_amount"] == 400.0
    assert result["payout_now"] == 400.0

def test_rule_d_damage_with_shock_flag(claim_db):
    # Rule d: type is damage, pickup record exists, and shipment has 'shock' or 'weight_mismatch' flag -> auto_approved
    create_test_shipment(claim_db, "SHP-SHOCK", declared_value=800.0, insured=1)
    cursor = claim_db.cursor()
    # Add pickup baseline
    cursor.execute("""
        INSERT INTO pickups (id, shipment_id, weight_kg, dims_cm, condition, photo_urls, recorded_by)
        VALUES ('PCK-1', 'SHP-SHOCK', 2.0, '20x20x10', 'good', '["/p1.jpg"]', 'USR-S1')
    """)
    # Add scan with shock flag
    cursor.execute("""
        INSERT INTO scan_events (id, shipment_id, status, location, shock_g, flags, recorded_by)
        VALUES ('SCN-1', 'SHP-SHOCK', 'hub', 'Sorting Hub', 12.0, '["shock"]', 'USR-COURIER')
    """)
    claim_db.commit()

    result = evaluate_claim(
        claim_db,
        shipment_id="SHP-SHOCK",
        seller_id="USR-S1",
        claim_type="damage",
        claimed_amount=600.0,
        description="Chassis broken after impact",
        damage_photo_urls=[]
    )
    assert result["status"] == "auto_approved"
    assert result["approved_amount"] == 600.0
    assert result["payout_now"] == 600.0

def test_rule_e_low_value_auto_approved(claim_db):
    # Rule e: claimed amount <= 50 USD, insured, and pickup record exists -> auto_approved
    create_test_shipment(claim_db, "SHP-SMALL", declared_value=100.0, insured=1)
    cursor = claim_db.cursor()
    cursor.execute("""
        INSERT INTO pickups (id, shipment_id, weight_kg, dims_cm, condition, photo_urls, recorded_by)
        VALUES ('PCK-SM', 'SHP-SMALL', 1.0, '10x10x5', 'good', '["/p.jpg"]', 'USR-S1')
    """)
    claim_db.commit()

    result = evaluate_claim(
        claim_db,
        shipment_id="SHP-SMALL",
        seller_id="USR-S1",
        claim_type="damage",
        claimed_amount=45.0,
        description="Minor cosmetic damage on cover",
        damage_photo_urls=[]
    )
    assert result["status"] == "auto_approved"
    assert result["approved_amount"] == 45.0
    assert result["payout_now"] == 45.0

def test_rule_f_under_review_with_advance_if_insured(claim_db):
    # Rule f: Insured parcel without shock flag, amount > 50 -> under_review with 50% advance
    create_test_shipment(claim_db, "SHP-REVIEW-INS", declared_value=300.0, insured=1)
    result = evaluate_claim(
        claim_db,
        shipment_id="SHP-REVIEW-INS",
        seller_id="USR-S1",
        claim_type="damage",
        claimed_amount=200.0,
        description="Items reported cracked",
        damage_photo_urls=[]
    )
    assert result["status"] == "under_review"
    assert result["approved_amount"] is None
    # 50% of 200 = 100
    assert result["payout_now"] == 100.0

def test_rule_f_uninsured_capped_and_no_advance(claim_db):
    # Uninsured parcel -> capped at default liability cap ($100), no advance
    create_test_shipment(claim_db, "SHP-UNINS", declared_value=500.0, insured=0)
    result = evaluate_claim(
        claim_db,
        shipment_id="SHP-UNINS",
        seller_id="USR-S1",
        claim_type="damage",
        claimed_amount=200.0,
        description="Damage on uninsured package",
        damage_photo_urls=[]
    )
    assert result["status"] == "under_review"
    assert result["coverage_amount"] == 100.0
    assert result["eligible_amount"] == 100.0
    assert result["payout_now"] == 0.0
