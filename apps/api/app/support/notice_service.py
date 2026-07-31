"""공지사항 조회·작성.

공개 목록과 관리자 목록의 차이는 **published_at 조건 하나**다 — 공개는 게시 시각이 지난 것만,
관리자는 임시저장·예약까지 전부 본다. 이 조건이 어긋나면 미공개 문서가 노출된다.
"""

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import AppError
from app.support.notice_models import Notice

logger = logging.getLogger("slur.support")


def _view(row: Notice) -> dict:
    return {
        "id": row.id,
        "title": row.title,
        "body": row.body,
        "is_pinned": row.is_pinned,
        "published_at": row.published_at,
        "created_at": row.created_at,
    }


def _published_only():
    """공개 조건 — 게시 시각이 있고 지금 이하. 예약 게시는 시각이 될 때까지 자동으로 숨는다."""
    now = datetime.now(timezone.utc)
    return (Notice.published_at.is_not(None)) & (Notice.published_at <= now)


async def list_public(session: AsyncSession, page: int) -> dict:
    size = get_settings().page_size
    base = select(Notice).where(_published_only())
    total = await session.scalar(select(func.count()).select_from(base.subquery())) or 0
    rows = list(await session.scalars(
        # 고정 공지를 먼저, 그다음 최신순 — 약관 개정 고지를 상단에 붙잡아 둘 수 있어야 한다
        base.order_by(Notice.is_pinned.desc(), Notice.published_at.desc(), Notice.id.desc())
        .offset((page - 1) * size).limit(size)
    ))
    return {"items": [_view(r) for r in rows], "total": total, "page": page, "size": size}


async def get_public(session: AsyncSession, notice_id: uuid.UUID) -> dict:
    row = await session.scalar(select(Notice).where(Notice.id == notice_id, _published_only()))
    if row is None:  # 미공개·미존재를 구분하지 않는다 — 임시저장 문서의 존재를 노출하지 않는다
        raise AppError("not_found", "공지를 찾을 수 없습니다.", status_code=404)
    return _view(row)


async def list_admin(session: AsyncSession, page: int) -> dict:
    size = get_settings().page_size
    total = await session.scalar(select(func.count()).select_from(Notice)) or 0
    rows = list(await session.scalars(
        select(Notice)
        .order_by(Notice.is_pinned.desc(), func.coalesce(Notice.published_at, Notice.created_at).desc(), Notice.id.desc())
        .offset((page - 1) * size).limit(size)
    ))
    return {"items": [_view(r) for r in rows], "total": total, "page": page, "size": size}


async def get_admin(session: AsyncSession, notice_id: uuid.UUID) -> dict:
    row = await session.scalar(select(Notice).where(Notice.id == notice_id))
    if row is None:
        raise AppError("not_found", "공지를 찾을 수 없습니다.", status_code=404)
    return _view(row)


async def create(
    session: AsyncSession, admin_id: uuid.UUID, *, title: str, body: str, is_pinned: bool, published_at: datetime | None
) -> dict:
    row = Notice(
        title=title.strip(), body=body.strip(), is_pinned=is_pinned,
        published_at=published_at, created_by=admin_id,
    )
    session.add(row)
    await session.commit()
    logger.info("notice %s created by admin %s (published=%s)", row.id, admin_id, published_at is not None)
    return _view(row)


async def update(
    session: AsyncSession, notice_id: uuid.UUID, *,
    title: str, body: str, is_pinned: bool, published_at: datetime | None,
) -> dict:
    row = await session.scalar(select(Notice).where(Notice.id == notice_id))
    if row is None:
        raise AppError("not_found", "공지를 찾을 수 없습니다.", status_code=404)
    row.title = title.strip()
    row.body = body.strip()
    row.is_pinned = is_pinned
    row.published_at = published_at
    await session.commit()
    return _view(row)


async def delete(session: AsyncSession, notice_id: uuid.UUID) -> None:
    row = await session.scalar(select(Notice).where(Notice.id == notice_id))
    if row is None:
        raise AppError("not_found", "공지를 찾을 수 없습니다.", status_code=404)
    await session.delete(row)
    await session.commit()
