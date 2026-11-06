from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Any

EMAIL_REGEX = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"

class SignupRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: str = Field(..., pattern=EMAIL_REGEX)
    password: str = Field(..., min_length=6)
    role: str = Field(..., pattern="^(seller|courier|admin)$")
    courier_name: Optional[str] = None

class LoginRequest(BaseModel):
    email: str = Field(..., pattern=EMAIL_REGEX)
    password: str

class ResetPasswordRequest(BaseModel):
    email: str = Field(..., pattern=EMAIL_REGEX)
    password: str = Field(..., min_length=6)

class CourierUpdateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)

class QuoteRequest(BaseModel):
    declared_value: float = Field(..., gt=0)
    fragile: bool = False
    category: Optional[str] = "general"
    seller_id: Optional[str] = None

class ShipmentCreateRequest(BaseModel):
    courier_id: str
    origin: str = Field(..., min_length=3)
    destination: str = Field(..., min_length=3)
    recipient: str = Field(..., min_length=2)
    category: str = Field(..., min_length=2)
    fragile: bool = False
    declared_value: float = Field(..., gt=0)
    insured: bool = False

class PickupCreateRequest(BaseModel):
    weight_kg: float = Field(..., gt=0)
    dims_cm: str = Field(..., min_length=3)
    condition: str = Field(..., pattern="^(good|minor_marks|damaged)$")
    photo_urls: List[str] = Field(default_factory=list)

    @field_validator("photo_urls")
    @classmethod
    def validate_photo_urls(cls, v):
        if len(v) < 1 or len(v) > 3:
            raise ValueError("Must provide between 1 and 3 photos for pickup check")
        return v

class PickupSupersedeRequest(BaseModel):
    weight_kg: float = Field(..., gt=0)
    dims_cm: str = Field(..., min_length=3)
    condition: str = Field(..., pattern="^(good|minor_marks|damaged)$")
    photo_urls: List[str] = Field(default_factory=list)
    audit_note: str = Field(..., min_length=5)

class ScanCreateRequest(BaseModel):
    status: str = Field(..., pattern="^(in_transit|hub|out_for_delivery|delivered)$")
    location: str = Field(..., min_length=2)
    weight_kg: Optional[float] = Field(None, gt=0)
    shock_g: Optional[float] = Field(None, ge=0)

class ClaimCreateRequest(BaseModel):
    shipment_id: str
    type: str = Field(..., pattern="^(loss|damage)$")
    description: str = Field(..., min_length=5)
    claimed_amount: float = Field(..., gt=0)
    damage_photo_urls: Optional[List[str]] = Field(default_factory=list)

class ClaimDecisionRequest(BaseModel):
    decision: str = Field(..., pattern="^(approved|denied|arbitration)$")
    amount: Optional[float] = Field(None, ge=0)
    reason: str = Field(..., min_length=3)

class SettingsUpdateRequest(BaseModel):
    settings: Dict[str, str]
