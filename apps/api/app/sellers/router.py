import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.errors import AppError
from app.core.security import get_current_user_id, require_role
from app.products import service as products_service
from app.products import storage as products_storage
from app.products.schemas import PresignRequest, ProductCreate, ProductUpdate, ProductImageResponse, ProductResponse, VariantResponse, VariantsReplace
from app.sellers import service
from app.sellers.schemas import ApplicationRequest, ApplicationResponse, SellerMeResponse, ShippingFees

router = APIRouter(prefix="/sellers")


@router.post("/applications", response_model=ApplicationResponse, status_code=201)
async def submit_application(
    body: ApplicationRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
) -> ApplicationResponse:
    app_row = await service.submit_application(session, user_id, body)
    return ApplicationResponse.model_validate(app_row, from_attributes=True)


@router.get("/applications/me", response_model=ApplicationResponse)
async def my_application(
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
) -> ApplicationResponse:
    app_row = await service.my_latest_application(session, user_id)
    if app_row is None:
        raise AppError("not_found", "신청 내역이 없습니다.", status_code=404)
    return ApplicationResponse.model_validate(app_row, from_attributes=True)


@router.get("/me", response_model=SellerMeResponse)
async def my_profile(
    user_id: uuid.UUID = Depends(require_role("seller")),
    session: AsyncSession = Depends(get_session),
) -> SellerMeResponse:
    seller = await service.get_my_seller(session, user_id)
    return SellerMeResponse.model_validate(seller, from_attributes=True)


@router.put("/me/shipping-fees", response_model=SellerMeResponse)
async def update_shipping_fees(
    body: ShippingFees,
    user_id: uuid.UUID = Depends(require_role("seller")),
    session: AsyncSession = Depends(get_session),
) -> SellerMeResponse:
    seller = await service.update_shipping_fees(
        session, user_id, body.base_shipping_fee, body.jeju_extra_fee, body.island_extra_fee
    )
    return SellerMeResponse.model_validate(seller, from_attributes=True)


def _product_response(product, images, variants=()) -> ProductResponse:
    return ProductResponse(
        id=product.id, name=product.name, base_price=product.base_price, description=product.description,
        status=product.status, category_id=product.category_id,
        images=[
            ProductImageResponse(path=i.path, sort_order=i.sort_order, url=products_service._image_url(i.path))
            for i in images
        ],
        variants=[VariantResponse.model_validate(v, from_attributes=True) for v in variants],
    )


@router.post("/products/images/presign")
async def presign_image(
    body: PresignRequest,
    user_id: uuid.UUID = Depends(require_role("seller")),
    session: AsyncSession = Depends(get_session),
) -> dict:
    seller = await service.get_my_seller(session, user_id)
    return await products_storage.create_signed_upload(seller.id, body.content_type)


@router.post("/products", response_model=ProductResponse, status_code=201)
async def create_product(
    body: ProductCreate,
    user_id: uuid.UUID = Depends(require_role("seller")),
    session: AsyncSession = Depends(get_session),
) -> ProductResponse:
    seller = await service.get_my_seller(session, user_id)
    product = await products_service.create_product(session, seller.id, body)
    images = (await products_service.get_product_images(session, [product.id])).get(product.id, [])
    variants = (await products_service.get_variants(session, [product.id])).get(product.id, [])
    return _product_response(product, images, variants)


@router.get("/products", response_model=list[ProductResponse])
async def list_products(
    user_id: uuid.UUID = Depends(require_role("seller")),
    session: AsyncSession = Depends(get_session),
) -> list[ProductResponse]:
    seller = await service.get_my_seller(session, user_id)
    rows = await products_service.list_my_products(session, seller.id)
    ids = [p.id for p in rows]
    images = await products_service.get_product_images(session, ids)
    variants = await products_service.get_variants(session, ids)
    return [_product_response(p, images.get(p.id, []), variants.get(p.id, [])) for p in rows]


@router.put("/products/{product_id}/variants", response_model=ProductResponse)
async def replace_variants(
    product_id: uuid.UUID,
    body: VariantsReplace,
    user_id: uuid.UUID = Depends(require_role("seller")),
    session: AsyncSession = Depends(get_session),
) -> ProductResponse:
    seller = await service.get_my_seller(session, user_id)
    product = await products_service.replace_variants(session, seller.id, product_id, body.variants)
    images = (await products_service.get_product_images(session, [product.id])).get(product.id, [])
    variants = (await products_service.get_variants(session, [product.id])).get(product.id, [])
    return _product_response(product, images, variants)


@router.patch("/products/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: uuid.UUID,
    body: ProductUpdate,
    user_id: uuid.UUID = Depends(require_role("seller")),
    session: AsyncSession = Depends(get_session),
) -> ProductResponse:
    seller = await service.get_my_seller(session, user_id)
    product = await products_service.update_product(session, seller.id, product_id, body)
    images = (await products_service.get_product_images(session, [product.id])).get(product.id, [])
    variants = (await products_service.get_variants(session, [product.id])).get(product.id, [])
    return _product_response(product, images, variants)


# ---------------------------------------------------------------------------
# 판매자 주문관리 (Story 5.3) — 라우터는 HTTP 조합 층: orders service 호출 관례 (5.2 선례)
# ---------------------------------------------------------------------------

from datetime import datetime  # noqa: E402

from pydantic import BaseModel, Field  # noqa: E402

from app.orders import service as orders_service  # noqa: E402


class SellerOrderLine(BaseModel):
    product_name: str
    option_text: str
    quantity: int
    status: str  # ordered | canceled — 취소 라인 구분 표시


class SellerSubOrderItem(BaseModel):
    sub_order_id: uuid.UUID
    order_id: uuid.UUID  # 전체 UUID 병기 (5.2 관례)
    order_no: str
    created_at: datetime
    recipient_name: str
    recipient_phone: str
    postal_code: str
    address1: str
    address2: str
    order_note: str
    items: list[SellerOrderLine]
    shipping_fee: int
    remote_extra_fee: int
    shipping_status: str
    carrier: str | None
    tracking_number: str | None
    all_canceled: bool  # 전 라인 취소 — UI 버튼 억제 (유령 발송 방지)


class SellerOrderList(BaseModel):
    items: list[SellerSubOrderItem]
    total: int
    page: int
    size: int


class ShipRequest(BaseModel):
    carrier: str = Field(min_length=1, max_length=50)
    tracking_number: str = Field(min_length=1, max_length=50)


_ORDER_STATUSES = ("preparing", "shipping", "delivered")


@router.get("/orders", response_model=SellerOrderList)
async def list_seller_orders(
    status: str = "preparing",
    page: int = 1,
    user_id: uuid.UUID = Depends(require_role("seller")),
    session: AsyncSession = Depends(get_session),
):
    """판매자 주문 목록 — 자기 sub_orders만, 상태 필터 (paid 전 NULL은 자연 배제)."""
    if status not in _ORDER_STATUSES:
        raise AppError("validation_error", "올바르지 않은 상태입니다.", status_code=422)
    if page < 1 or page > 10000:
        raise AppError("validation_error", "올바르지 않은 페이지입니다.", status_code=422)
    seller = await service.get_my_seller(session, user_id)
    return await orders_service.list_seller_sub_orders(session, seller.id, status, page)


@router.post("/sub-orders/{sub_order_id}/ship", status_code=204)
async def ship_sub_order(
    sub_order_id: uuid.UUID,
    body: ShipRequest,
    user_id: uuid.UUID = Depends(require_role("seller")),
    session: AsyncSession = Depends(get_session),
):
    """배송 시작 — 송장 필수 (가드·기록은 전이 엔진 소유, FR-21)."""
    seller = await service.get_my_seller(session, user_id)
    await orders_service.ship_sub_order(session, seller.id, user_id, sub_order_id, body.carrier, body.tracking_number)


@router.post("/sub-orders/{sub_order_id}/deliver", status_code=204)
async def deliver_sub_order(
    sub_order_id: uuid.UUID,
    user_id: uuid.UUID = Depends(require_role("seller")),
    session: AsyncSession = Depends(get_session),
):
    """배송 완료."""
    seller = await service.get_my_seller(session, user_id)
    await orders_service.deliver_sub_order(session, seller.id, user_id, sub_order_id)


# ---------------------------------------------------------------------------
# 판매자 대시보드 (Story 5.4) — 집계 전부 서버 계산 (AD-12)
# ---------------------------------------------------------------------------


class LowStockItem(BaseModel):
    product_id: uuid.UUID
    product_name: str
    option_text: str
    stock: int


class SellerDashboard(BaseModel):
    preparing_count: int  # 신규 주문(입금 완료·배송준비 대기) — epics "paid 건수"와 동일 값 (승인된 구체화)
    shipping_count: int
    low_stock: list[LowStockItem]
    low_stock_threshold: int  # settings 값 — 화면 표기용


@router.get("/dashboard", response_model=SellerDashboard)
async def seller_dashboard(
    user_id: uuid.UUID = Depends(require_role("seller")),
    session: AsyncSession = Depends(get_session),
):
    """판매자 랜딩 대시보드 — 처리할 일 요약 (라우터 층 조합, 5.3 관례)."""
    seller = await service.get_my_seller(session, user_id)
    counts = await orders_service.seller_shipping_counts(session, seller.id)
    threshold = await orders_service.get_int_setting(session, orders_service.SETTING_LOW_STOCK_THRESHOLD, minimum=0)
    low = await products_service.low_stock_variants(session, seller.id, threshold)
    return {**counts, "low_stock": low, "low_stock_threshold": threshold}
