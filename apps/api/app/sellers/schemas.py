import uuid
from datetime import datetime

from app.core.config import get_settings

from pydantic import BaseModel, Field, field_validator


def _validate_brn(value: str) -> str:
    """사업자등록번호 — 하이픈 제거 후 10자리 + 국세청 체크섬."""
    digits = value.replace("-", "").strip()
    if len(digits) != 10 or not digits.isdigit() or not digits.isascii():  # 전각 숫자 차단
        raise ValueError("사업자등록번호는 숫자 10자리여야 합니다.")
    weights = [1, 3, 7, 1, 3, 7, 1, 3, 5]
    total = sum(int(d) * w for d, w in zip(digits[:9], weights))
    total += (int(digits[8]) * 5) // 10
    if (10 - total % 10) % 10 != int(digits[9]):
        raise ValueError("올바르지 않은 사업자등록번호입니다.")
    return digits


class ApplicationRequest(BaseModel):
    company_name: str = Field(min_length=1, max_length=100)
    representative_name: str = Field(min_length=1, max_length=50)
    business_registration_number: str = Field(max_length=20)
    mail_order_number: str = Field(min_length=1, max_length=50)
    business_address: str = Field(min_length=1, max_length=255)
    contact_phone: str = Field(min_length=1, max_length=20)
    brand_name: str = Field(min_length=1, max_length=50)
    brand_intro: str = Field(min_length=1, max_length=500)

    @field_validator("business_registration_number")
    @classmethod
    def brn_valid(cls, v: str) -> str:
        return _validate_brn(v)

    @field_validator("contact_phone")
    @classmethod
    def phone_format(cls, v: str) -> str:
        v = v.strip()
        if not v or not all(c.isdigit() or c == "-" for c in v) or not v.isascii() or sum(c.isdigit() for c in v) < 9:
            raise ValueError("연락처 형식이 올바르지 않습니다.")
        return v

    @field_validator("company_name", "representative_name", "brand_name", "brand_intro", "mail_order_number", "business_address")
    @classmethod
    def not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("필수 입력입니다.")
        return v


class ApplicationResponse(BaseModel):
    id: uuid.UUID
    status: str
    brand_name: str
    rejection_reason: str | None
    created_at: datetime


class ShippingFees(BaseModel):
    base_shipping_fee: int = Field(ge=0)
    jeju_extra_fee: int = Field(ge=0)
    island_extra_fee: int = Field(ge=0)

    @field_validator("base_shipping_fee", "jeju_extra_fee", "island_extra_fee")
    @classmethod
    def within_cap(cls, v: int) -> int:
        cap = get_settings().max_shipping_fee
        if v > cap:
            raise ValueError(f"배송비는 {cap:,}원을 넘을 수 없습니다.")
        return v


class SellerMeResponse(ShippingFees):
    brand_name: str
    brand_intro: str
    company_name: str
