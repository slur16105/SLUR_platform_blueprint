import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class OrderPreviewRequest(BaseModel):
    postal_code: str = Field(pattern=r"^\d{5}$")  # 숫자 5자리 — 형식 위반은 422 validation_error


class PreviewItem(BaseModel):
    cart_item_id: uuid.UUID
    variant_id: uuid.UUID
    product_name: str
    option_text: str
    quantity: int
    final_price: int  # base + extra (AD-12)
    line_total: int


class PreviewSellerGroup(BaseModel):
    seller_id: uuid.UUID
    brand_name: str
    items: list[PreviewItem]
    item_total: int
    shipping_fee: int  # 판매자 기본 배송비
    remote_extra_fee: int  # 도서산간 추가비 (일반 지역 0)
    shipping_total: int  # 그룹 배송비 합 — 카드 표시용 합산도 서버 소유 (AD-12)


class OrderPreviewResponse(BaseModel):
    seller_groups: list[PreviewSellerGroup]
    item_total: int
    shipping_total: int  # 기본 배송비 합 (도서산간 추가비 제외)
    remote_extra_total: int  # 도서산간 추가비 합 — 요약 행 분리 표시용 (AD-12)
    grand_total: int  # item + shipping + remote
    remote_area_kind: Literal["jeju", "island"] | None  # None = 일반


class OrderCreateRequest(BaseModel):
    cart_item_ids: list[uuid.UUID] = Field(min_length=1, max_length=100)  # 주문서에 표시된 항목만 — 부분 주문 방지
    expected_grand_total: int = Field(ge=0)  # 미리보기에서 본 총액 — 불일치 시 409 price_changed (조용한 금액 변경 방지)
    postal_code: str = Field(pattern=r"^\d{5}$")
    recipient_name: str = Field(min_length=1, max_length=50)
    recipient_phone: str = Field(pattern=r"^\d{9,11}$")
    address1: str = Field(min_length=1, max_length=255)
    address2: str = Field(default="", max_length=255)
    order_note: str = Field(default="", max_length=500)


class OrderCreateResponse(BaseModel):
    order_id: uuid.UUID
    grand_total: int
    deposit_account: str  # settings 값 (AD-13)
    deposit_due_at: datetime
