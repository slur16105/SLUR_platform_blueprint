import uuid

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import require_role
from app.products import service as products_service
from app.products.schemas import CategoryCreate, CategoryOrder, CategoryRename, CategoryResponse
from app.sellers import service as sellers_service
from app.sellers.schemas import ApplicationResponse

router = APIRouter(prefix="/admin")


class ApplicationAdminItem(ApplicationResponse):
    company_name: str
    representative_name: str
    business_registration_number: str
    mail_order_number: str
    business_address: str
    contact_phone: str
    brand_intro: str


class ApplicationListResponse(BaseModel):
    items: list[ApplicationAdminItem]
    total: int
    page: int


class RejectRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=500)

    @field_validator("reason")
    @classmethod
    def not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("반려 사유를 입력해 주세요.")
        return v


@router.get("/seller-applications", response_model=ApplicationListResponse)
async def list_applications(
    status: str = Query("pending", pattern="^(pending|approved|rejected)$"),
    page: int = Query(1, ge=1),
    _admin: uuid.UUID = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> ApplicationListResponse:
    rows, total = await sellers_service.list_applications(session, status, page)
    items = [ApplicationAdminItem.model_validate(r, from_attributes=True) for r in rows]
    return ApplicationListResponse(items=items, total=total, page=page)


@router.post("/seller-applications/{application_id}/approve", response_model=ApplicationAdminItem)
async def approve(
    application_id: uuid.UUID,
    admin_id: uuid.UUID = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> ApplicationAdminItem:
    await sellers_service.approve_application(session, application_id, admin_id)
    row = await session.get(sellers_service.SellerApplication, application_id)
    return ApplicationAdminItem.model_validate(row, from_attributes=True)


@router.post("/seller-applications/{application_id}/reject", response_model=ApplicationAdminItem)
async def reject(
    application_id: uuid.UUID,
    body: RejectRequest,
    admin_id: uuid.UUID = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> ApplicationAdminItem:
    row = await sellers_service.reject_application(session, application_id, admin_id, body.reason)
    return ApplicationAdminItem.model_validate(row, from_attributes=True)


@router.post("/categories", response_model=CategoryResponse, status_code=201)
async def create_category(
    body: CategoryCreate,
    _admin: uuid.UUID = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> CategoryResponse:
    row = await products_service.create_category(session, body.name)
    return CategoryResponse.model_validate(row, from_attributes=True)


@router.patch("/categories/{category_id}", response_model=CategoryResponse)
async def rename_category(
    category_id: uuid.UUID,
    body: CategoryRename,
    _admin: uuid.UUID = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> CategoryResponse:
    row = await products_service.rename_category(session, category_id, body.name)
    return CategoryResponse.model_validate(row, from_attributes=True)


@router.put("/categories/order", response_model=list[CategoryResponse])
async def reorder_categories(
    body: CategoryOrder,
    _admin: uuid.UUID = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> list[CategoryResponse]:
    rows = await products_service.reorder_categories(session, body.ids)
    return [CategoryResponse.model_validate(c, from_attributes=True) for c in rows]


@router.delete("/categories/{category_id}", status_code=204)
async def delete_category(
    category_id: uuid.UUID,
    _admin: uuid.UUID = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> None:
    await products_service.delete_category(session, category_id)


# ---------------------------------------------------------------------------
# 입금 확인 (Story 5.2) — admin→orders service 경유 (AD-2)
# ---------------------------------------------------------------------------

from datetime import datetime  # noqa: E402

from app.auth import service as auth_service  # noqa: E402 — buyer 표시 정보 (AD-2: admin→auth 허용)
from app.core.errors import AppError  # noqa: E402
from app.orders import service as orders_service  # noqa: E402


class PendingOrderItem(BaseModel):
    order_id: uuid.UUID  # 전체 UUID — 8자 충돌 대비 병기 (5.1 이월 결정)
    order_no: str
    created_at: datetime
    deposit_due_at: datetime
    expired: bool  # 서버 파생 (AD-12)
    buyer_name: str
    buyer_email: str
    grand_total: int  # 잔여 활성분 — 입금 대조 금액
    title: str


class PendingOrderList(BaseModel):
    items: list[PendingOrderItem]
    total: int
    page: int
    size: int  # 클라 페이지 수 계산용 — PAGE_SIZE 이중 소스 방지


class ConfirmPaymentRequest(BaseModel):
    note: str = Field(default="", max_length=500)  # order_events 메모 (FR-29)
    expected_grand_total: int = Field(ge=0)  # 화면에 표시된 금액 — 불일치 409 price_changed (stale 확인 방지)


@router.get("/orders/pending", response_model=PendingOrderList)
async def list_pending_orders(
    page: int = 1,
    _admin: uuid.UUID = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
):
    """입금대기 목록 — 페이지 단 판정 포함 admin 전용 (R7)."""
    if page < 1 or page > 10000:
        raise AppError("validation_error", "올바르지 않은 페이지입니다.", status_code=422)
    data = await orders_service.list_pending_orders(session, page)
    buyers = await auth_service.get_users_by_ids(session, list({r["user_id"] for r in data["items"]}))
    for row in data["items"]:  # buyer enrich — 결측·email NULL 방어 (탈퇴·소셜 전용 계정)
        buyer = buyers.get(row.pop("user_id"))
        row["buyer_name"] = (buyer.name if buyer else "") or "(알 수 없는 사용자)"
        row["buyer_email"] = (buyer.email if buyer else "") or ""
    return data


@router.post("/orders/{order_id}/confirm-payment", status_code=204)
async def confirm_payment(
    order_id: uuid.UUID,
    body: ConfirmPaymentRequest,
    admin_id: uuid.UUID = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
):
    """입금 확인 — paid 전이 (엔진 경유, 연쇄 preparing 포함)."""
    await orders_service.confirm_payment(session, admin_id, order_id, body.note, body.expected_grand_total)


# ---------------------------------------------------------------------------
# 주문 개입 (Story 5.5)
# ---------------------------------------------------------------------------


class AdminOrderCardSub(BaseModel):
    brand_name: str
    display_status: str


class AdminOrderCard(BaseModel):
    order_id: uuid.UUID
    order_no: str
    created_at: datetime
    display_status: str
    grand_total: int
    buyer_name: str
    buyer_email: str
    sub_orders: list[AdminOrderCardSub]


class AdminOrderList(BaseModel):
    items: list[AdminOrderCard]
    total: int
    page: int
    size: int


class AdminOrderCancelRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=500)
    responsibility: str = Field(default="admin", pattern=r"^(buyer|seller|admin)$")
    note: str = Field(default="", max_length=500)


class AdminItemCancelRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=500)
    responsibility: str = Field(pattern=r"^(buyer|seller|admin)$")
    note: str = Field(default="", max_length=500)


class AdminSubTransitionRequest(BaseModel):
    to_status: str = Field(pattern=r"^(shipping|delivered)$")
    carrier: str | None = Field(default=None, max_length=50)
    tracking_number: str | None = Field(default=None, max_length=50)
    note: str = Field(default="", max_length=500)


_ADMIN_STATUS = ("awaiting_payment", "preparing", "shipping", "delivered", "canceled")


@router.get("/orders", response_model=AdminOrderList)
async def admin_search_orders(
    q: str | None = None,
    status: str | None = None,
    page: int = 1,
    _admin: uuid.UUID = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
):
    """전체 주문 검색 (FR-29) — 구매자·브랜드 매칭은 여기(라우터 층)서 선해결 (AD-2)."""
    if page < 1 or page > 10000:
        raise AppError("validation_error", "올바르지 않은 페이지입니다.", status_code=422)
    if status is not None and status not in _ADMIN_STATUS:
        raise AppError("validation_error", "올바르지 않은 상태입니다.", status_code=422)
    if q is not None:
        q = q.strip()
        if q and (len(q) < 2 or len(q) > 100):
            raise AppError("validation_error", "검색어는 2~100자입니다.", status_code=422)
        q = q or None
    user_ids = seller_ids = None
    if q:
        from app.sellers import service as sellers_service2

        user_ids = await auth_service.find_user_ids_by_name_or_email(session, q)
        seller_ids = await sellers_service2.find_seller_ids_by_brand(session, q)
    data = await orders_service.search_orders(session, q=q, status=status, page=page, user_ids=user_ids, seller_ids=seller_ids)
    buyers = await auth_service.get_users_by_ids(session, list({r["user_id"] for r in data["items"]}))
    for row in data["items"]:
        buyer = buyers.get(row.pop("user_id"))
        row["buyer_name"] = (buyer.name if buyer else "") or "(알 수 없는 사용자)"
        row["buyer_email"] = (buyer.email if buyer else "") or ""
    return data


@router.get("/orders/{order_id}")
async def admin_order_detail(
    order_id: uuid.UUID,
    _admin: uuid.UUID = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
):
    """관리자 주문 상세 — 라인 id·취소 기록·이벤트 타임라인 포함 (AC 4)."""
    view = await orders_service.admin_get_order(session, order_id)
    buyers = await auth_service.get_users_by_ids(session, [view["user_id"]])
    buyer = buyers.get(view.pop("user_id"))
    view["buyer_name"] = (buyer.name if buyer else "") or "(알 수 없는 사용자)"
    view["buyer_email"] = (buyer.email if buyer else "") or ""
    return view


@router.post("/orders/{order_id}/cancel")
async def admin_cancel_order(
    order_id: uuid.UUID,
    body: AdminOrderCancelRequest,
    admin_id: uuid.UUID = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
):
    """pending 주문 전체 취소 — 전 라인 + order 전이 (엔진 조합)."""
    n = await orders_service.admin_cancel_order(session, admin_id, order_id, body.reason, body.responsibility, body.note)
    return {"canceled_items": n}


@router.post("/order-items/{order_item_id}/cancel")
async def admin_cancel_item(
    order_item_id: uuid.UUID,
    body: AdminItemCancelRequest,
    admin_id: uuid.UUID = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
):
    """라인 단위 취소 (배송 후 가능 — admin 타이밍 예외) + pending 전-취소 시 order 정합."""
    return await orders_service.admin_cancel_item(
        session, admin_id, order_item_id, body.reason, body.responsibility, body.note
    )


@router.post("/sub-orders/{sub_order_id}/transition", status_code=204)
async def admin_sub_transition(
    sub_order_id: uuid.UUID,
    body: AdminSubTransitionRequest,
    admin_id: uuid.UUID = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
):
    """강제 배송 전이 — 전이표 내에서만 (가드 admin 예외 없음)."""
    await orders_service.admin_transition_sub_order(
        session, admin_id, sub_order_id, body.to_status, body.carrier, body.tracking_number, body.note
    )


@router.post("/cancellations/{cancellation_id}/refunded", status_code=204)
async def admin_mark_refunded(
    cancellation_id: uuid.UUID,
    _admin: uuid.UUID = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
):
    """환불 완료 시각 기록 (AD-6 분리) — 중복 409."""
    await orders_service.mark_refunded(session, cancellation_id)
