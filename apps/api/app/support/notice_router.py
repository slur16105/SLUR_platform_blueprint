"""공지사항 API — 공개 조회와 관리자 CRUD."""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.errors import AppError
from app.core.security import require_role
from app.support import notice_service as service

router = APIRouter(prefix="/notices")
admin_router = APIRouter(prefix="/admin/notices")


class NoticeItem(BaseModel):
    id: uuid.UUID
    title: str
    body: str
    is_pinned: bool
    published_at: datetime | None
    created_at: datetime


class NoticeList(BaseModel):
    items: list[NoticeItem]
    total: int
    page: int
    size: int


class NoticeWrite(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=20000)
    is_pinned: bool = False
    published_at: datetime | None = None  # None = 임시저장, 미래 = 예약 게시

    @field_validator("title", "body")
    @classmethod
    def not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("필수 입력입니다.")
        return v


def _check_page(page: int) -> None:
    if page < 1 or page > 10000:
        raise AppError("validation_error", "올바르지 않은 페이지입니다.", status_code=422)


@router.get("", response_model=NoticeList)
async def list_notices(page: int = 1, session: AsyncSession = Depends(get_session)) -> NoticeList:
    """공개 목록 — 게시 시각이 지난 것만. 약관 개정 고지가 여기 실린다."""
    _check_page(page)
    return NoticeList(**await service.list_public(session, page))


@router.get("/{notice_id}", response_model=NoticeItem)
async def get_notice(notice_id: uuid.UUID, session: AsyncSession = Depends(get_session)) -> NoticeItem:
    return NoticeItem(**await service.get_public(session, notice_id))


@admin_router.get("", response_model=NoticeList)
async def admin_list(
    page: int = 1,
    _admin: uuid.UUID = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> NoticeList:
    """관리자 목록 — 임시저장·예약까지 전부 보인다."""
    _check_page(page)
    return NoticeList(**await service.list_admin(session, page))


@admin_router.get("/{notice_id}", response_model=NoticeItem)
async def admin_get(
    notice_id: uuid.UUID,
    _admin: uuid.UUID = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> NoticeItem:
    return NoticeItem(**await service.get_admin(session, notice_id))


@admin_router.post("", response_model=NoticeItem, status_code=201)
async def admin_create(
    body: NoticeWrite,
    admin_id: uuid.UUID = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> NoticeItem:
    return NoticeItem(**await service.create(
        session, admin_id, title=body.title, body=body.body,
        is_pinned=body.is_pinned, published_at=body.published_at,
    ))


@admin_router.put("/{notice_id}", response_model=NoticeItem)
async def admin_update(
    notice_id: uuid.UUID,
    body: NoticeWrite,
    _admin: uuid.UUID = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> NoticeItem:
    return NoticeItem(**await service.update(
        session, notice_id, title=body.title, body=body.body,
        is_pinned=body.is_pinned, published_at=body.published_at,
    ))


@admin_router.delete("/{notice_id}", status_code=204)
async def admin_delete(
    notice_id: uuid.UUID,
    _admin: uuid.UUID = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> None:
    await service.delete(session, notice_id)
