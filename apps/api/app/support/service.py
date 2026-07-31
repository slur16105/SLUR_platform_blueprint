"""문의 생성·조회·답변.

소유 검증은 여기서 한다 — 남의 문의를 열람하면 개인정보 유출이므로, 없는 문의와 남의 문의를
같은 404로 돌려 존재 자체를 노출하지 않는다(주문 도메인과 같은 규칙).
"""

import logging
import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import AppError
from app.orders import service as orders_service
from app.support.models import Inquiry, InquiryReply

logger = logging.getLogger("slur.support")

STATUS_OPEN = "open"
STATUS_ANSWERED = "answered"
STATUS_CLOSED = "closed"


async def create_inquiry(
    session: AsyncSession, user_id: uuid.UUID, *, category: str, title: str, body: str, order_id: uuid.UUID | None
) -> Inquiry:
    if order_id is not None:
        # 남의 주문 번호를 붙여 남의 주문 정보를 유도하지 못하게 소유를 확인한다
        owner = await orders_service.order_owner_id(session, order_id)
        if owner is None or owner != user_id:
            raise AppError("not_found", "주문을 찾을 수 없습니다.", status_code=404)
    row = Inquiry(
        user_id=user_id, order_id=order_id, category=category,
        title=title.strip(), body=body.strip(), status=STATUS_OPEN,
    )
    session.add(row)
    await session.commit()
    logger.info("inquiry %s created by user %s (category=%s)", row.id, user_id, category)
    return row


async def _replies_by_inquiry(session: AsyncSession, inquiry_ids: list[uuid.UUID]) -> dict:
    if not inquiry_ids:
        return {}
    rows = await session.scalars(
        select(InquiryReply).where(InquiryReply.inquiry_id.in_(inquiry_ids)).order_by(InquiryReply.created_at)
    )
    grouped: dict = {}
    for r in rows:
        grouped.setdefault(r.inquiry_id, []).append(r)
    return grouped


def _view(row: Inquiry, replies: list[InquiryReply]) -> dict:
    return {
        "id": row.id,
        "category": row.category,
        "title": row.title,
        "body": row.body,
        "status": row.status,
        "order_id": row.order_id,
        "created_at": row.created_at,
        "answered_at": row.answered_at,
        "replies": [{"id": r.id, "body": r.body, "created_at": r.created_at} for r in replies],
    }


async def list_my_inquiries(session: AsyncSession, user_id: uuid.UUID, page: int) -> dict:
    size = get_settings().page_size
    base = select(Inquiry).where(Inquiry.user_id == user_id)
    total = await session.scalar(select(func.count()).select_from(base.subquery())) or 0
    rows = list(await session.scalars(
        base.order_by(Inquiry.created_at.desc(), Inquiry.id.desc()).offset((page - 1) * size).limit(size)
    ))
    replies = await _replies_by_inquiry(session, [r.id for r in rows])
    return {
        "items": [_view(r, replies.get(r.id, [])) for r in rows],
        "total": total, "page": page, "size": size,
    }


async def get_my_inquiry(session: AsyncSession, user_id: uuid.UUID, inquiry_id: uuid.UUID) -> dict:
    row = await session.scalar(select(Inquiry).where(Inquiry.id == inquiry_id))
    # 남의 문의와 없는 문의를 구분해 노출하지 않는다
    if row is None or row.user_id != user_id:
        raise AppError("not_found", "문의를 찾을 수 없습니다.", status_code=404)
    replies = await _replies_by_inquiry(session, [row.id])
    return _view(row, replies.get(row.id, []))


async def list_inquiries_admin(session: AsyncSession, *, status: str | None, page: int) -> dict:
    size = get_settings().page_size
    base = select(Inquiry)
    if status:
        base = base.where(Inquiry.status == status)
    total = await session.scalar(select(func.count()).select_from(base.subquery())) or 0
    rows = list(await session.scalars(
        # 미답변을 먼저 — 이 목록은 "처리해야 할 일" 대기열이다
        base.order_by(Inquiry.created_at.desc(), Inquiry.id.desc()).offset((page - 1) * size).limit(size)
    ))
    replies = await _replies_by_inquiry(session, [r.id for r in rows])
    return {
        "items": [{**_view(r, replies.get(r.id, [])), "user_id": r.user_id} for r in rows],
        "total": total, "page": page, "size": size,
    }


async def get_inquiry_admin(session: AsyncSession, inquiry_id: uuid.UUID) -> dict:
    row = await session.scalar(select(Inquiry).where(Inquiry.id == inquiry_id))
    if row is None:
        raise AppError("not_found", "문의를 찾을 수 없습니다.", status_code=404)
    replies = await _replies_by_inquiry(session, [row.id])
    return {**_view(row, replies.get(row.id, [])), "user_id": row.user_id}


async def reply_inquiry(session: AsyncSession, admin_id: uuid.UUID, inquiry_id: uuid.UUID, body: str) -> dict:
    row = await session.scalar(select(Inquiry).where(Inquiry.id == inquiry_id))
    if row is None:
        raise AppError("not_found", "문의를 찾을 수 없습니다.", status_code=404)
    if row.status == STATUS_CLOSED:
        raise AppError("invalid_transition", "종료된 문의에는 답변할 수 없습니다.", status_code=422)
    session.add(InquiryReply(inquiry_id=inquiry_id, admin_user_id=admin_id, body=body.strip()))
    row.status = STATUS_ANSWERED
    row.answered_at = func.now()
    await session.commit()
    logger.info("inquiry %s answered by admin %s", inquiry_id, admin_id)
    return await get_inquiry_admin(session, inquiry_id)


async def close_inquiry(session: AsyncSession, admin_id: uuid.UUID, inquiry_id: uuid.UUID) -> dict:
    row = await session.scalar(select(Inquiry).where(Inquiry.id == inquiry_id))
    if row is None:
        raise AppError("not_found", "문의를 찾을 수 없습니다.", status_code=404)
    row.status = STATUS_CLOSED
    await session.commit()
    logger.info("inquiry %s closed by admin %s", inquiry_id, admin_id)
    return await get_inquiry_admin(session, inquiry_id)


async def count_open(session: AsyncSession) -> int:
    """미답변 문의 수 — 관리자 대시보드 처리 대기 큐용."""
    return int(await session.scalar(
        select(func.count()).select_from(Inquiry).where(Inquiry.status == STATUS_OPEN)
    ) or 0)
