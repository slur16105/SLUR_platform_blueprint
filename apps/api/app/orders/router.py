import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.errors import AppError
from app.core.security import get_current_user_id
from app.orders import service
from app.orders.schemas import (
    OrderCreateRequest,
    OrderCreateResponse,
    OrderPreviewRequest,
    OrderPreviewResponse,
    SubOrderCancelRequest,
    SubOrderCancelResponse,
    OrderDetailResponse,
    OrderListResponse,
)

router = APIRouter(prefix="/orders")


@router.post("/preview", response_model=OrderPreviewResponse)
async def preview_order(
    body: OrderPreviewRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
):
    """주문서 미리보기 — 계산만, 주문 생성·재고 차감은 4.4."""
    return await service.preview_order(session, user_id, body.postal_code)


@router.post("", response_model=OrderCreateResponse, status_code=201)
async def create_order(
    body: OrderCreateRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
):
    """주문 생성 — 재고 차감·스냅샷·장바구니 삭제까지 한 트랜잭션 (AD-4·AD-10)."""
    return await service.create_order(session, user_id, body)


@router.post("/sub-orders/{sub_order_id}/cancel", response_model=SubOrderCancelResponse)
async def cancel_sub_order(
    sub_order_id: uuid.UUID,
    body: SubOrderCancelRequest | None = None,  # 전 필드 optional — body 없는 POST 허용
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
):
    """구매자 묶음 취소 — preparing 진입 전만 (가드는 전이 엔진 소유)."""
    body = body or SubOrderCancelRequest()
    return await service.cancel_sub_order(session, user_id, sub_order_id, body.reason)


@router.get("", response_model=OrderListResponse)
async def list_my_orders(
    page: int = 1,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
):
    """주문내역 목록 (최신순, page 기반) — 대표 상태·금액은 서버 파생 (AD-12)."""
    if page < 1 or page > 10000:  # 상한 — 거대 offset 스캔 부하 방지
        raise AppError("validation_error", "올바르지 않은 페이지입니다.", status_code=422)
    return await service.list_my_orders(session, user_id, page)


@router.get("/{order_id}", response_model=OrderDetailResponse)
async def get_my_order(
    order_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
):
    """주문상세 — 스냅샷·파생 값·입금 안내 (FR-22·23)."""
    return await service.get_my_order(session, user_id, order_id)
