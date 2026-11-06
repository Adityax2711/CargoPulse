import pytest
import sqlite3
from app.services.pricing_service import calculate_quote, generate_packaging_advice, get_seller_claims_ratio
from app.database import SCHEMA_SQL, DEFAULT_SETTINGS

@pytest.fixture
def memory_db():
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA_SQL)
    cursor = conn.cursor()
    for k, v in DEFAULT_SETTINGS.items():
        cursor.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (k, v))
    cursor.execute("INSERT INTO couriers (id, name) VALUES ('CR-FASTEX', 'FastEx')")
    cursor.execute("INSERT INTO users (id, name, email, password_hash, role) VALUES ('USR-S1', 'Seller 1', 's1@test.com', 'h', 'seller')")
    conn.commit()
    yield conn
    conn.close()

def test_packaging_advice():
    # Fragile electronics with value > 500
    adv = generate_packaging_advice(category="Electronics", fragile=True, declared_value=800.0)
    titles = [a["title"] for a in adv]
    assert any("Anti-Static" in t for t in titles)
    assert any("Cushioning" in t for t in titles)
    assert any("Dual-Side Fragile" in t for t in titles)
    assert any("High-Value Security" in t for t in titles)

def test_standard_quote_calculation(memory_db):
    # Non-fragile, $1000 value, no seller discount
    # standard_rate = 0.4% = 0.004 -> $4.00
    # Seller with 0 shipments gets clean discount (20%) -> 4.00 - 0.80 = 3.20
    q = calculate_quote(memory_db, declared_value=1000.0, fragile=False, seller_id="USR-S1")
    assert q["base_premium"] == 4.00
    assert q["qualifies_clean_discount"] is True
    assert q["discount_amount"] == 0.80
    assert q["final_premium"] == 3.20

def test_fragile_800_quote_calculation(memory_db):
    # Demo scenario: Fragile electronics $800
    # fragile_rate = 0.8% = 0.008 -> 800 * 0.008 = 6.40 USD base premium
    q = calculate_quote(memory_db, declared_value=800.0, fragile=True, seller_id="USR-S1")
    assert q["base_premium"] == 6.40
    # Clean discount 20% of 6.40 = 1.28 -> 5.12 USD
    assert q["discount_amount"] == 1.28
    assert q["final_premium"] == 5.12

def test_min_premium_floor(memory_db):
    # Very low value: $10 standard goods -> 10 * 0.004 = 0.04
    # Minimum premium is $0.50
    q = calculate_quote(memory_db, declared_value=10.0, fragile=False, seller_id="USR-S1")
    assert q["final_premium"] == 0.50

def test_disqualify_clean_discount(memory_db):
    # Create 10 shipments and 1 claim -> ratio = 10% (>= 2%)
    cursor = memory_db.cursor()
    for i in range(10):
        cursor.execute("""
            INSERT INTO shipments (id, seller_id, courier_id, origin, destination, recipient, category, fragile, declared_value, insured, premium, status)
            VALUES (?, 'USR-S1', 'CR-FASTEX', 'O', 'D', 'R', 'General', 0, 100, 1, 0.5, 'delivered')
        """, (f"SHP-DISQ-{i}",))
    cursor.execute("""
        INSERT INTO claims (id, shipment_id, seller_id, courier_id, type, description, claimed_amount, status, reason)
        VALUES ('CLM-DISQ-1', 'SHP-DISQ-0', 'USR-S1', 'CR-FASTEX', 'damage', 'Damaged', 50, 'approved', 'Test')
    """)
    memory_db.commit()

    stats = get_seller_claims_ratio(memory_db, "USR-S1")
    assert stats["total_shipments"] == 10
    assert stats["total_claims"] == 1
    assert stats["ratio"] == 0.1
    assert stats["qualifies_clean_discount"] is False

    # Calculate quote for disqualified seller
    q = calculate_quote(memory_db, declared_value=800.0, fragile=True, seller_id="USR-S1")
    assert q["base_premium"] == 6.40
    assert q["qualifies_clean_discount"] is False
    assert q["discount_amount"] == 0.0
    assert q["final_premium"] == 6.40

