import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.seed import seed_database

@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    seed_database()

@pytest.fixture
def client():
    return TestClient(app)

def login_user(client, email, password="password123"):
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, f"Login failed for {email}: {res.text}"
    data = res.json()
    return data["token"], data["user"]

def test_full_demo_scenario(client):
    # Step 1: Log in as a seller (apex@seller.com)
    seller_token, seller_user = login_user(client, "apex@seller.com")
    seller_headers = {"Authorization": f"Bearer {seller_token}"}

    # Book a fragile electronics parcel worth 800 USD with protection
    # Courier FastEx (CR-FASTEX)
    booking_res = client.post("/api/shipments", headers=seller_headers, json={
        "courier_id": "CR-FASTEX",
        "origin": "742 Evergreen Terrace, Springfield",
        "destination": "123 Ocean Drive, Miami",
        "recipient": "Montgomery Burns",
        "category": "Electronics",
        "fragile": True,
        "declared_value": 800.0,
        "insured": True
    })
    assert booking_res.status_code == 201, booking_res.text
    shp = booking_res.json()["shipment"]
    shipment_id = shp["id"]
    # Fragile rate = 0.8% -> 800 * 0.008 = 6.40 USD base. With 20% clean discount = 5.12 USD
    assert shp["insured"] is True
    assert shp["declared_value"] == 800.0
    assert shp["premium"] in (6.40, 5.12)

    # Step 2: Record a pickup with weight 2.00 kg and two photos
    pickup_res = client.post(f"/api/shipments/{shipment_id}/pickup", headers=seller_headers, json={
        "weight_kg": 2.00,
        "dims_cm": "30x20x15",
        "condition": "good",
        "photo_urls": ["/uploads/parcel_box_front.jpg", "/uploads/parcel_box_label.jpg"]
    })
    assert pickup_res.status_code == 201, pickup_res.text
    pck = pickup_res.json()["pickup"]
    assert pck["weight_kg"] == 2.00
    assert len(pck["photo_urls"]) == 2

    # Step 3: Log in as courier staff (FastEx) and record a hub scan with shock of 12g
    courier_token, courier_user = login_user(client, "staff@fastex.com")
    courier_headers = {"Authorization": f"Bearer {courier_token}"}

    scan_res = client.post(f"/api/shipments/{shipment_id}/scan", headers=courier_headers, json={
        "status": "hub",
        "location": "FastEx Central Sorting Hub #4",
        "weight_kg": 2.02,
        "shock_g": 12.0
    })
    assert scan_res.status_code == 201, scan_res.text
    scan_data = scan_res.json()["scan"]
    assert "shock" in scan_data["flags"]

    # Verify timeline reflects the shock flag
    detail_res = client.get(f"/api/shipments/{shipment_id}", headers=seller_headers)
    assert detail_res.status_code == 200
    detail_data = detail_res.json()
    assert detail_data["shipment"]["has_shock_flag"] is True

    # Step 4: As the seller, file a damage claim for 600 USD. Confirm auto-approved under rule d
    claim_res = client.post("/api/claims", headers=seller_headers, json={
        "shipment_id": shipment_id,
        "type": "damage",
        "claimed_amount": 600.0,
        "description": "Internal glass sensor shattered following severe sorting impact",
        "damage_photo_urls": ["/uploads/damage_crushed_corner.jpg"]
    })
    assert claim_res.status_code == 201, claim_res.text
    claim_data = claim_res.json()["claim"]
    assert claim_data["status"] == "auto_approved"
    assert claim_data["approved_amount"] == 600.0
    assert claim_data["payout_now"] == 600.0
    assert "impact shock" in claim_data["reason"]

    # Step 5: Verify seeded 15-day inactive shipment appears in ops alerts as 'lost'
    admin_token, admin_user = login_user(client, "admin@shipguard.com")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    alerts_res = client.get("/api/alerts", headers=admin_headers)
    assert alerts_res.status_code == 200
    alerts = alerts_res.json()["alerts"]
    lost_alert = next((a for a in alerts if a["shipment_id"] == "SHP-LOST15D"), None)
    assert lost_alert is not None
    assert lost_alert["type"] == "lost"

    # Verify scorecard also reflects lost count and scorecard metrics
    scorecard_res = client.get("/api/scorecard?range=all", headers=admin_headers)
    assert scorecard_res.status_code == 200
    scorecard = scorecard_res.json()["couriers"]
    fastex_card = next((c for c in scorecard if c["courier_id"] == "CR-FASTEX"), None)
    assert fastex_card is not None
    assert fastex_card["lost_count"] >= 1

    # Step 6: As admin, deny one under-review claim with a reason and confirm audit log
    decision_res = client.post("/api/claims/CLM-REV001/decision", headers=admin_headers, json={
        "decision": "denied",
        "reason": "Inspection confirmed pre-existing manufacturer defect, not transit handling."
    })
    assert decision_res.status_code == 200, decision_res.text
    assert decision_res.json()["claim"]["status"] == "denied"

    # Confirm audit log entry
    audit_res = client.get("/api/audit", headers=admin_headers)
    assert audit_res.status_code == 200
    logs = audit_res.json()["audit_logs"]
    deny_log = next((l for l in logs if l["entity_id"] == "CLM-REV001" and l["action"] == "claim_denied"), None)
    assert deny_log is not None
    assert "pre-existing manufacturer defect" in deny_log["details"]["reason"]

def test_rbac_isolation(client):
    # Seller 2 should NOT see Seller 1's shipments (e.g. SHP-LOST15D belongs to Seller 1)
    s2_token, _ = login_user(client, "nova@seller.com")
    s2_headers = {"Authorization": f"Bearer {s2_token}"}

    # Try accessing Seller 1's seeded shipment
    res = client.get("/api/shipments/SHP-LOST15D", headers=s2_headers)
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "FORBIDDEN"

    # Courier staff SwiftPost should NOT scan FastEx shipment
    swift_token, _ = login_user(client, "staff@swiftpost.com")
    swift_headers = {"Authorization": f"Bearer {swift_token}"}

    res_scan = client.post("/api/shipments/SHP-LOST15D/scan", headers=swift_headers, json={
        "status": "hub",
        "location": "Unauthorized Terminal",
        "shock_g": 0.5
    })
    assert res_scan.status_code == 403
    assert res_scan.json()["error"]["code"] == "FORBIDDEN"
