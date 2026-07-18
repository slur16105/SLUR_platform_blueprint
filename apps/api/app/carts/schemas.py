import uuid

from pydantic import BaseModel, Field


class CartItemAdd(BaseModel):
    variant_id: uuid.UUID
    quantity: int = Field(ge=1, le=999)


class CartItemQuantity(BaseModel):
    quantity: int = Field(ge=1, le=999)


class CartItemBrief(BaseModel):
    """담기·수량 변경 응답 — 목록 표시는 GET /carts가 소유."""

    id: uuid.UUID
    variant_id: uuid.UUID | None
    quantity: int


class CartItemResponse(BaseModel):
    id: uuid.UUID
    variant_id: uuid.UUID | None  # None = 조합 삭제됨 (SET NULL) → 판매 종료
    quantity: int
    product_id: uuid.UUID | None
    product_name: str
    brand_name: str
    option_text: str  # 서버가 완성형으로 조립 (AD-12)
    final_price: int | None  # base + extra, 백엔드 계산 (AD-12)
    image_url: str | None
    purchasable: bool  # 단일 술어 결과 (AD-10)


class CartResponse(BaseModel):
    items: list[CartItemResponse]
    purchasable_total: int  # 구매 가능 항목만의 상품 합계 — 배송비는 4.2 (AD-11)
