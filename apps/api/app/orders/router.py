import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import get_current_user_id
from app.orders import service
from app.orders.schemas import (
    OrderCreateRequest,
    OrderCreateResponse,
    OrderPreviewRequest,
    OrderPreviewResponse,
    SubOrderCancelRequest,
    SubOrderCancelResponse,
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
    body: SubOrderCancelRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
):
    """구매자 묶음 취소 — preparing 진입 전만 (가드는 전이 엔진 소유)."""
    return await service.cancel_sub_order(session, user_id, sub_order_id, body.reason)
