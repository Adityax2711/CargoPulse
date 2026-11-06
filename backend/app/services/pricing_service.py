import sqlite3
from typing import Dict, Any, List

def generate_packaging_advice(category: str, fragile: bool, declared_value: float) -> List[Dict[str, str]]:
    """
    Returns list of actionable packaging guidelines based on shipment parameters:
    - Fragile goods: bubble wrap, void fill, FRAGILE labels on two sides
    - Electronics: anti-static packing, separately secured batteries
    - High value (> 500 USD): tamper-evident tape, pickup photos, shock sensing
    - Liquids / Cosmetics: sealed leak-proof bags, double boxing
    - Heavy / dense items: double-walled corrugated box, reinforced tape
    """
    advice: List[Dict[str, str]] = []

    # Category-specific guidance
    cat_lower = (category or "").lower()
    if "electronic" in cat_lower or "gadget" in cat_lower or "phone" in cat_lower or "computer" in cat_lower:
        advice.append({
            "title": "Anti-Static & Battery Protection",
            "detail": "Use ESD (anti-static) bags for circuit boards. Ensure lithium batteries are installed or terminals insulated with cap tape.",
            "level": "critical"
        })
    elif "liquid" in cat_lower or "cosmetic" in cat_lower or "chemical" in cat_lower:
        advice.append({
            "title": "Leak Containment & Double Bagging",
            "detail": "Seal caps with tape, place in waterproof ziplock bags, and use absorbent packing material inside a rigid outer box.",
            "level": "critical"
        })
    elif "apparel" in cat_lower or "clothing" in cat_lower or "textile" in cat_lower:
        advice.append({
            "title": "Moisture Barrier",
            "detail": "Use waterproof poly mailers or interior plastic liner to prevent rain and humidity damage.",
            "level": "standard"
        })

    # Fragility guidance
    if fragile:
        advice.append({
            "title": "Cushioning & Void Fill",
            "detail": "Wrap item in at least 5cm of heavy bubble wrap. Fill all box voids with corrugated inserts or kraft paper (no movement).",
            "level": "critical"
        })
        advice.append({
            "title": "Dual-Side Fragile Labeling",
            "detail": "Affix high-contrast 'FRAGILE / HANDLE WITH CARE' stickers on at least two opposing sides and top face.",
            "level": "critical"
        })
    else:
        advice.append({
            "title": "Standard Box & Tape",
            "detail": "Use single-wall or double-wall corrugated box with H-taping pattern (sealing all seams).",
            "level": "standard"
        })

    # Value-based advice
    if declared_value > 500:
        advice.append({
            "title": "High-Value Security & Shock Sensing",
            "detail": "Value exceeds $500. Tamper-evident tape, mandatory photo evidence at pickup, and shock impact sensing required for priority claims.",
            "level": "high_value"
        })
    elif declared_value > 100:
        advice.append({
            "title": "Evidence Recommended",
            "detail": "Take photos of packaged parcel before handover to ensure quick auto-approval if damaged.",
            "level": "recommended"
        })

    return advice


def get_seller_claims_ratio(conn: sqlite3.Connection, seller_id: str) -> Dict[str, Any]:
    """
    Computes claims-to-shipments ratio for a seller:
    Total shipments booked by seller vs total claims filed by seller.
    """
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) as count FROM shipments WHERE seller_id = ?", (seller_id,))
    total_shipments = cursor.fetchone()["count"]

    cursor.execute("SELECT COUNT(*) as count FROM claims WHERE seller_id = ?", (seller_id,))
    total_claims = cursor.fetchone()["count"]

    if total_shipments == 0:
        ratio = 0.0
    else:
        ratio = total_claims / total_shipments

    qualifies_clean_discount = ratio < 0.02
    return {
        "total_shipments": total_shipments,
        "total_claims": total_claims,
        "ratio": round(ratio, 4),
        "qualifies_clean_discount": qualifies_clean_discount
    }


def calculate_quote(
    conn: sqlite3.Connection,
    declared_value: float,
    fragile: bool,
    seller_id: str = None
) -> Dict[str, Any]:
    """
    Calculates the protection quote:
    - standard rate (default 0.4%) or fragile rate (default 0.8%)
    - minimum premium (default $0.50)
    - 20% discount if seller's claims-to-shipments ratio < 2%
    - courier default liability cap ($100.00)
    """
    cursor = conn.cursor()
    cursor.execute("SELECT key, value FROM settings")
    settings = {row["key"]: float(row["value"]) for row in cursor.fetchall()}

    standard_rate = settings.get("standard_rate", 0.004)
    fragile_rate = settings.get("fragile_rate", 0.008)
    clean_discount_rate = settings.get("clean_discount", 0.20)
    min_premium = settings.get("min_premium", 0.50)
    liability_cap = settings.get("liability_cap", 100.00)

    rate = fragile_rate if fragile else standard_rate
    base_premium = round(declared_value * rate, 2)

    qualifies_clean = False
    clean_ratio = 0.0
    if seller_id:
        stats = get_seller_claims_ratio(conn, seller_id)
        qualifies_clean = stats["qualifies_clean_discount"]
        clean_ratio = stats["ratio"]
    else:
        # Default for new or unauthenticated preview: qualifies for discount
        qualifies_clean = True

    discount_amount = 0.0
    if qualifies_clean:
        discount_amount = round(base_premium * clean_discount_rate, 2)

    premium_after_discount = base_premium - discount_amount
    final_premium = max(min_premium, round(premium_after_discount, 2))

    return {
        "declared_value": declared_value,
        "fragile": fragile,
        "rate_applied": rate,
        "base_premium": base_premium,
        "qualifies_clean_discount": qualifies_clean,
        "seller_claims_ratio": clean_ratio,
        "discount_percent": int(clean_discount_rate * 100) if qualifies_clean else 0,
        "discount_amount": discount_amount,
        "min_premium": min_premium,
        "final_premium": final_premium,
        "coverage_if_insured": declared_value,
        "courier_liability_cap": liability_cap
    }

