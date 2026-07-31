"""문의 API — 구매자(내 문의)와 관리자(전체·답변) 두 갈래."""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.errors import AppError
from app.core.security import get_current_user_id, require_role
from app.support import service
from app.support.models import CATEGORIES, STATUSES

router = APIRouter(prefix="/inquiries")
admin_router = APIRouter(prefix="/admin/inquiries")


class InquiryCreate(BaseModel):
    category: str = Field(default="etc")
    title: str = Field(min_length=1, max_length=100)
    body: str = Field(min_length=1, max_length=2000)
    order_id: uuid.UUID | None = None

    @field_validator("category")
    @classmethod
    def known_category(cls, v: str) -> str:
        if v not in CATEGORIES:
            raise ValueError("올바르지 않은 문의 유형입니다.")
        return v

    @field_validator("title", "body")
    @classmethod
    def not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("필수 입력입니다.")
        return v


class ReplyCreate(BaseModel):
    body: str = Field(min_length=1, max_length=2000)

    @field_validator("body")
    @classmethod
    def not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("답변 내용을 입력해 주세요.")
        return v


class ReplyItem(BaseModel):
    id: uuid.UUID
    body: str
    created_at: datetime


class InquiryItem(BaseModel):
    id: uuid.UUID
    category: str
    title: str
    body: str
    status: str
    order_id: uuid.UUID | None
    created_at: datetime
    answered_at: datetime | None
    replies: list[ReplyItem]


class InquiryList(BaseModel):
    items: list[InquiryItem]
    total: int
    page: int
    size: int


class AdminInquiryItem(InquiryItem):
    user_id: uuid.UUID
    buyer_name: str = ""
    buyer_email: str = ""


class AdminInquiryList(BaseModel):
    items: list[AdminInquiryItem]
    total: int
    page: int
    size: int


def _check_page(page: int) -> None:
    if page < 1 or page > 10000:
        raise AppError("validation_error", "올바르지 않은 페이지입니다.", status_code=422)


# ── 구매자 ────────────────────────────────────────────────


@router.post("", response_model=InquiryItem, status_code=201)
async def create_inquiry(
    body: InquiryCreate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
) -> InquiryItem:
    row = await service.create_inquiry(
        session, user_id, category=body.category, title=body.title, body=body.body, order_id=body.order_id
    )
    return InquiryItem(**await service.get_my_inquiry(session, user_id, row.id))


@router.get("", response_model=InquiryList)
async def list_my_inquiries(
    page: int = 1,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
) -> InquiryList:
    _check_page(page)
    return InquiryList(**await service.list_my_inquiries(session, user_id, page))


@router.get("/{inquiry_id}", response_model=InquiryItem)
async def get_my_inquiry(
    inquiry_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
) -> InquiryItem:
    return InquiryItem(**await service.get_my_inquiry(session, user_id, inquiry_id))


# ── 관리자 ────────────────────────────────────────────────


async def _enrich_buyers(session: AsyncSession, items: list[dict]) -> list[dict]:
    """작성자 이름·이메일 — 다른 관리자 목록과 같은 방식(라우터 층 합성, AD-2)."""
    from app.auth import service as auth_service

    users = await auth_service.get_users_by_ids(session, list({i["user_id"] for i in items}))
    for i in items:
        u = users.get(i["user_id"])
        i["buyer_name"] = (u.name if u else "") or "(알 수 없는 사용자)"
        i["buyer_email"] = (u.email if u else "") or ""
    return items


@admin_router.get("", response_model=AdminInquiryList)
async def admin_list_inquiries(
    status: str | None = None,
    page: int = 1,
    _admin: uuid.UUID = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> AdminInquiryList:
    _check_page(page)
    if status is not None and status not in STATUSES:
        raise AppError("validation_error", "올바르지 않은 상태입니다.", status_code=422)
    data = await service.list_inquiries_admin(session, status=status, page=page)
    data["items"] = await _enrich_buyers(session, data["items"])
    return AdminInquiryList(**data)


@admin_router.get("/{inquiry_id}", response_model=AdminInquiryItem)
async def admin_get_inquiry(
    inquiry_id: uuid.UUID,
    _admin: uuid.UUID = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> AdminInquiryItem:
    row = await service.get_inquiry_admin(session, inquiry_id)
    return AdminInquiryItem(**(await _enrich_buyers(session, [row]))[0])


@admin_router.post("/{inquiry_id}/replies", response_model=AdminInquiryItem, status_code=201)
async def admin_reply(
    inquiry_id: uuid.UUID,
    body: ReplyCreate,
    admin_id: uuid.UUID = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> AdminInquiryItem:
    row = await service.reply_inquiry(session, admin_id, inquiry_id, body.body)
    return AdminInquiryItem(**(await _enrich_buyers(session, [row]))[0])


@admin_router.post("/{inquiry_id}/close", response_model=AdminInquiryItem)
async def admin_close(
    inquiry_id: uuid.UUID,
    admin_id: uuid.UUID = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> AdminInquiryItem:
    row = await service.close_inquiry(session, admin_id, inquiry_id)
    return AdminInquiryItem(**(await _enrich_buyers(session, [row]))[0])
