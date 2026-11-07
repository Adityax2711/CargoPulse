import json
import sqlite3
import random
from datetime import datetime, timezone, timedelta
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

from app.config import UPLOAD_DIR
from app.database import init_db, get_db_ctx
from app.services.auth_service import hash_password

def create_sample_images():
    """Generates clean placeholder parcel photos for demo."""
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    colors = [
        ("#1E293B", "#38BDF8", "CargoPulse Pickup Check #1"),
        ("#0F172A", "#34D399", "CargoPulse Pickup Check #2"),
        ("#18181B", "#F59E0B", "CargoPulse Transit Check"),
        ("#450A0A", "#EF4444", "CargoPulse Damage Evidence")
    ]
    img_names = ["parcel_box_front.jpg", "parcel_box_label.jpg", "parcel_box_side.jpg", "damage_crushed_corner.jpg"]

    for (bg, fg, text), name in zip(colors, img_names):
        filepath = UPLOAD_DIR / name
        if not filepath.exists():
            img = Image.new("RGB", (640, 480), color=bg)
            draw = ImageDraw.Draw(img)
            # Draw decorative box outline
            draw.rectangle([40, 40, 600, 440], outline=fg, width=4)
            draw.rectangle([60, 60, 580, 200], fill="#334155")
            draw.text((80, 100), text, fill="#FFFFFF")
            draw.text((80, 140), "VERIFIED TIMESTAMPED EVIDENCE", fill=fg)
            img.save(filepath, "JPEG")

def seed_database():
    print("Initializing database...")
    init_db()
    create_sample_images()

    with get_db_ctx() as conn:
        cursor = conn.cursor()

        # Clear existing data
        cursor.execute("DELETE FROM audit_log")
        cursor.execute("DELETE FROM claims")
        cursor.execute("DELETE FROM scan_events")
        cursor.execute("DELETE FROM pickups")
        cursor.execute("DELETE FROM shipments")
        cursor.execute("DELETE FROM users")
        cursor.execute("DELETE FROM couriers")

        # Couriers
        couriers = [
            ("CR-FASTEX", "FastEx"),
            ("CR-SWIFTPOST", "SwiftPost"),
            ("CR-CITYLINK", "CityLink")
        ]
        cursor.executemany("INSERT INTO couriers (id, name) VALUES (?, ?)", couriers)

        # Standard password: 'password123'
        hashed_pwd = hash_password("password123")
        now = datetime.now(timezone.utc)
        now_str = now.strftime("%Y-%m-%d %H:%M:%S")

        users = [
            ("USR-SYSTEM", "CargoPulse System Engine", "system@shipguard.com", hashed_pwd, "admin", None),
            ("USR-ADMIN", "Sarah Connor", "admin@shipguard.com", hashed_pwd, "admin", None),
            ("USR-SELLER1", "Apex Electronics", "apex@seller.com", hashed_pwd, "seller", None),
            ("USR-SELLER2", "Nova Retail", "nova@seller.com", hashed_pwd, "seller", None),
            ("USR-COURIER-F", "Dave Miller", "staff@fastex.com", hashed_pwd, "courier", "FastEx"),
            ("USR-COURIER-S", "Emma Watson", "staff@swiftpost.com", hashed_pwd, "courier", "SwiftPost"),
            ("USR-COURIER-C", "Carlos Vega", "staff@citylink.com", hashed_pwd, "courier", "CityLink")
        ]
        cursor.executemany("""
            INSERT INTO users (id, name, email, password_hash, role, courier_name, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, [(u[0], u[1], u[2], u[3], u[4], u[5], now_str) for u in users])

        # Generate ~30 shipments in mixed states
        categories = ["Electronics", "Precision Instruments", "Apparel & Shoes", "Cosmetics & Perfume", "Home & Kitchen", "Books & Media"]
        origins = ["San Francisco Fulfillment Hub, CA", "Austin Depot #4, TX", "Seattle Port Hub, WA", "Chicago Gateway Center, IL", "New York Terminal 2, NY"]
        destinations = ["Miami Beach, FL 33139", "Denver Residential, CO 80202", "Boston Downtown, MA 02108", "Atlanta Metro, GA 30301", "Dallas Midtown, TX 75201"]
        recipients = ["TechCorp Logistics", "Dr. Alexander Wright", "Quantum Labs Inc.", "Sophia Martinez", "Liam Johnson", "Olivia Davis"]

        photo_urls = [
            ["/uploads/parcel_box_front.jpg", "/uploads/parcel_box_label.jpg"],
            ["/uploads/parcel_box_side.jpg"],
            ["/uploads/parcel_box_front.jpg", "/uploads/parcel_box_side.jpg"]
        ]

        print("Generating 32 realistic shipments across all lifecycles...")

        # 1. SPECIAL DEMO SHIPMENT 1: 15-day inactive lost shipment (Demo step 5)
        shp_lost_id = "SHP-LOST15D"
        past_15d = (now - timedelta(days=15, hours=4)).strftime("%Y-%m-%d %H:%M:%S")
        cursor.execute("""
            INSERT INTO shipments (
                id, seller_id, courier_id, origin, destination, recipient,
                category, fragile, declared_value, insured, premium, status,
                created_at, updated_at
            ) VALUES (?, 'USR-SELLER1', 'CR-FASTEX', 'San Francisco Fulfillment Hub, CA', 'Miami Beach, FL 33139', 'Quantum Labs Inc.',
                      'Precision Instruments', 1, 1200.00, 1, 9.60, 'lost', ?, ?)
        """, (shp_lost_id, past_15d, past_15d))
        # Initial scan 15 days ago
        cursor.execute("""
            INSERT INTO scan_events (id, shipment_id, status, location, shock_g, weight_kg, flags, recorded_by, created_at)
            VALUES (?, ?, 'hub', 'San Francisco Transit Terminal', 1.2, 3.4, '[]', 'USR-COURIER-F', ?)
        """, ("SCN-LOST15D-1", shp_lost_id, past_15d))
        # Auto-marked lost scan event
        cursor.execute("""
            INSERT INTO scan_events (id, shipment_id, status, location, shock_g, weight_kg, flags, recorded_by, created_at)
            VALUES (?, ?, 'lost', 'Automated Scan Monitor (System)', 0.0, NULL, '["scan_gap_lost"]', 'USR-SYSTEM', ?)
        """, ("SCN-LOST15D-2", shp_lost_id, now_str))

        # 2. SPECIAL DEMO SHIPMENT 2: Under-review claim ready for Admin Denial in Demo Step 6
        shp_claim_review = "SHP-REVCLAIM"
        past_3d = (now - timedelta(days=3)).strftime("%Y-%m-%d %H:%M:%S")
        cursor.execute("""
            INSERT INTO shipments (
                id, seller_id, courier_id, origin, destination, recipient,
                category, fragile, declared_value, insured, premium, status,
                created_at, updated_at
            ) VALUES (?, 'USR-SELLER2', 'CR-SWIFTPOST', 'Austin Depot #4, TX', 'Denver Residential, CO 80202', 'Sophia Martinez',
                      'Home & Kitchen', 0, 150.00, 0, 0.0, 'in_transit', ?, ?)
        """, (shp_claim_review, past_3d, past_3d))
        cursor.execute("""
            INSERT INTO scan_events (id, shipment_id, status, location, shock_g, weight_kg, flags, recorded_by, created_at)
            VALUES (?, ?, 'in_transit', 'Austin Sorting Center', 2.1, 4.5, '[]', 'USR-COURIER-S', ?)
        """, ("SCN-REV1", shp_claim_review, past_3d))
        # Claim filed under_review
        cursor.execute("""
            INSERT INTO claims (
                id, shipment_id, seller_id, courier_id, type, description,
                claimed_amount, approved_amount, payout_now, damage_photo_urls,
                status, reason, created_at
            ) VALUES ('CLM-REV001', ?, 'USR-SELLER2', 'CR-SWIFTPOST', 'damage',
                      'Customer reported ceramic set cracked during transit without external box damage.',
                      120.00, NULL, 0.0, ?, 'under_review',
                      'Claim submitted for ops review. Uninsured parcels capped at default courier liability ($100.00). No advance payout.', ?)
        """, (shp_claim_review, json.dumps(["/uploads/damage_crushed_corner.jpg"]), past_3d))

        # 3. SPECIAL DEMO SHIPMENT 3: Scan-gap warning shipment (3 days no scan)
        shp_warn_id = "SHP-WARN03D"
        past_3d_scan = (now - timedelta(days=3, hours=12)).strftime("%Y-%m-%d %H:%M:%S")
        cursor.execute("""
            INSERT INTO shipments (
                id, seller_id, courier_id, origin, destination, recipient,
                category, fragile, declared_value, insured, premium, status,
                created_at, updated_at
            ) VALUES (?, 'USR-SELLER1', 'CR-CITYLINK', 'Chicago Gateway Center, IL', 'Atlanta Metro, GA 30301', 'Liam Johnson',
                      'Electronics', 0, 450.00, 1, 1.44, 'hub', ?, ?)
        """, (shp_warn_id, past_3d_scan, past_3d_scan))
        cursor.execute("""
            INSERT INTO scan_events (id, shipment_id, status, location, shock_g, weight_kg, flags, recorded_by, created_at)
            VALUES (?, ?, 'hub', 'Midwest Regional Sorting Hub', 1.8, 1.85, '[]', 'USR-COURIER-C', ?)
        """, ("SCN-WARN1", shp_warn_id, past_3d_scan))

        # 4. Generate remaining 28 shipments
        statuses = ["booked", "picked_up", "in_transit", "hub", "out_for_delivery", "delivered"]
        for i in range(1, 29):
            shp_id = f"SHP-{1000 + i}"
            seller_id = "USR-SELLER1" if i % 3 != 0 else "USR-SELLER2"
            courier = couriers[i % 3]
            courier_id = courier[0]
            cat = categories[i % len(categories)]
            fragile = (i % 2 == 0)
            declared_val = round(float(random.choice([65, 120, 280, 490, 850, 1400, 2200])), 2)
            insured = (i % 3 != 0)  # 2 out of 3 insured
            rate = 0.008 if fragile else 0.004
            base_prem = round(declared_val * rate, 2)
            discount = round(base_prem * 0.20, 2) if seller_id == "USR-SELLER1" else 0.0
            prem = max(0.50, round(base_prem - discount, 2)) if insured else 0.0

            status_val = statuses[i % len(statuses)]
            days_ago = random.randint(1, 25)
            created_dt = now - timedelta(days=days_ago, hours=random.randint(1, 20))
            created_str = created_dt.strftime("%Y-%m-%d %H:%M:%S")

            cursor.execute("""
                INSERT INTO shipments (
                    id, seller_id, courier_id, origin, destination, recipient,
                    category, fragile, declared_value, insured, premium, status,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                shp_id,
                seller_id,
                courier_id,
                origins[i % len(origins)],
                destinations[i % len(destinations)],
                recipients[i % len(recipients)],
                cat,
                1 if fragile else 0,
                declared_val,
                1 if insured else 0,
                prem,
                status_val,
                created_str,
                created_str
            ))

            # Pickups for shipments past booked
            if status_val != "booked":
                weight = round(random.uniform(0.8, 12.5), 2)
                pck_time = (created_dt + timedelta(hours=3)).strftime("%Y-%m-%d %H:%M:%S")
                cursor.execute("""
                    INSERT INTO pickups (
                        id, shipment_id, weight_kg, dims_cm, condition,
                        photo_urls, recorded_by, created_at
                    ) VALUES (?, ?, ?, ?, 'good', ?, ?, ?)
                """, (
                    f"PCK-{1000 + i}",
                    shp_id,
                    weight,
                    f"{random.randint(15, 50)}x{random.randint(10, 40)}x{random.randint(5, 30)}",
                    json.dumps(random.choice(photo_urls)),
                    seller_id,
                    pck_time
                ))

                # Add transit scans
                c_user = "USR-COURIER-F" if courier_id == "CR-FASTEX" else ("USR-COURIER-S" if courier_id == "CR-SWIFTPOST" else "USR-COURIER-C")
                flags = []
                shock = round(random.uniform(0.5, 4.0), 1)
                if i % 7 == 0:
                    shock = 13.5
                    flags.append("shock")

                cursor.execute("""
                    INSERT INTO scan_events (id, shipment_id, status, location, shock_g, weight_kg, flags, recorded_by, created_at)
                    VALUES (?, ?, ?, 'Regional Distribution Center', ?, ?, ?, ?, ?)
                """, (
                    f"SCN-{1000 + i}-1",
                    shp_id,
                    status_val if status_val != "delivered" else "in_transit",
                    shock,
                    weight,
                    json.dumps(flags),
                    c_user,
                    (created_dt + timedelta(hours=8)).strftime("%Y-%m-%d %H:%M:%S")
                ))

                if status_val == "delivered":
                    deliv_time = (created_dt + timedelta(days=2)).strftime("%Y-%m-%d %H:%M:%S")
                    deliv_flags = []
                    deliv_weight = weight
                    if i % 5 == 0:  # Weight mismatch
                        deliv_weight = round(weight * 1.09, 2)
                        deliv_flags.append("weight_mismatch")

                    cursor.execute("""
                        INSERT INTO scan_events (id, shipment_id, status, location, shock_g, weight_kg, flags, recorded_by, created_at)
                        VALUES (?, ?, 'delivered', 'Front Door / Recipient Signature', 0.2, ?, ?, ?, ?)
                    """, (
                        f"SCN-{1000 + i}-2",
                        shp_id,
                        deliv_weight,
                        json.dumps(deliv_flags),
                        c_user,
                        deliv_time
                    ))

        # Add 3 additional resolved / historical claims
        # Auto-approved shock claim
        cursor.execute("""
            INSERT INTO claims (
                id, shipment_id, seller_id, courier_id, type, description,
                claimed_amount, approved_amount, payout_now, damage_photo_urls,
                status, reason, created_at, decided_at, decided_by
            ) VALUES ('CLM-SHOCK01', 'SHP-1007', 'USR-SELLER1', 'CR-SWIFTPOST', 'damage',
                      'High shock impact registered during hub sorting. Chassis bent.',
                      450.00, 450.00, 450.00, ?, 'auto_approved',
                      'Auto-approved via transit telemetry: pickup baseline verified and impact shock (>=10g) detected in transit.',
                      ?, ?, 'USR-SYSTEM')
        """, (
            json.dumps(["/uploads/damage_crushed_corner.jpg"]),
            (now - timedelta(days=5)).strftime("%Y-%m-%d %H:%M:%S"),
            (now - timedelta(days=5)).strftime("%Y-%m-%d %H:%M:%S")
        ))

        # Denied claim (delivered scan on record)
        cursor.execute("""
            INSERT INTO claims (
                id, shipment_id, seller_id, courier_id, type, description,
                claimed_amount, approved_amount, payout_now, damage_photo_urls,
                status, reason, created_at, decided_at, decided_by
            ) VALUES ('CLM-DENY01', 'SHP-1005', 'USR-SELLER2', 'CR-CITYLINK', 'loss',
                      'Recipient called saying box was never delivered.',
                      280.00, 0.0, 0.0, '[]', 'denied',
                      'Delivery scan on record; proof of non-delivery required',
                      ?, ?, 'USR-SYSTEM')
        """, (
            (now - timedelta(days=8)).strftime("%Y-%m-%d %H:%M:%S"),
            (now - timedelta(days=8)).strftime("%Y-%m-%d %H:%M:%S")
        ))

        # Arbitration claim
        cursor.execute("""
            INSERT INTO claims (
                id, shipment_id, seller_id, courier_id, type, description,
                claimed_amount, approved_amount, payout_now, damage_photo_urls,
                status, reason, created_at
            ) VALUES ('CLM-ARB01', 'SHP-1011', 'USR-SELLER2', 'CR-FASTEX', 'damage',
                      'Dispute between seller packaging and courier drops during conveyor jam.',
                      800.00, NULL, 400.00, ?, 'arbitration',
                      'Transferred to arbitration pending courier station log review.',
                      ?)
        """, (
            json.dumps(["/uploads/damage_crushed_corner.jpg"]),
            (now - timedelta(days=4)).strftime("%Y-%m-%d %H:%M:%S")
        ))

        conn.commit()
        print("Database successfully seeded with demo accounts, couriers, 32 shipments, and claims!")

if __name__ == "__main__":
    seed_database()
