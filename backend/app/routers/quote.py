import sqlite3
from fastapi import APIRouter, Depends
from app.database import get_db
from app.models import QuoteRequest
from app.services.pricing_service import calculate_quote, generate_packaging_advice

router = APIRouter(prefix="/api/quote", tags=["quote"])

@router.post("")
def get_quote(req: QuoteRequest, conn: sqlite3.Connection = Depends(get_db)):
    quote = calculate_quote(
        conn=conn,
        declared_value=req.declared_value,
        fragile=req.fragile,
        seller_id=req.seller_id
    )
    advice = generate_packaging_advice(
        category=req.category or "general",
        fragile=req.fragile,
        declared_value=req.declared_value
    )
    return {
        "quote": quote,
        "packaging_advice": advice
    }

