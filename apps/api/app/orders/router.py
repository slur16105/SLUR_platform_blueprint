import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import get_current_user_id
from app.orders import service
from app.orders.schemas import OrderPreviewRequest, OrderPreviewResponse

router = APIRouter(prefix="/orders")


@router.post("/preview", response_model=OrderPreviewResponse)
async def preview_order(
    body: OrderPreviewRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
):
    """주문서 미리보기 — 계산만, 주문 생성·재고 차감은 4.4."""
    return await service.preview_order(session, user_id, body.postal_code)
