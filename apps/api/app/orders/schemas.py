import uuid
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
