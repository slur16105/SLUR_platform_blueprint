"""반품·교환 API — 구매자(신청·조회)와 관리자(처리)."""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.errors import AppError
from app.core.security import get_current_user_id, require_role
from app.returns import service
from app.returns.models import KINDS, REASONS, STATUSES

router = APIRouter(prefix="/returns")
admin_router = APIRouter(prefix="/admin/returns")


class ReturnItemIn(BaseModel):
    order_item_id: uuid.UUID
    quantity: int = Field(ge=1, le=999)


class ReturnCreate(BaseModel):
    sub_order_id: uuid.UUID
    kind: str = "return"
    reason: str
    detail: str = Field(default="", max_length=1000)
    items: list[ReturnItemIn] = Field(min_length=1)

    @field_validator("kind")
    @classmethod
    def known_kind(cls, v: str) -> str:
        if v not in KINDS:
            raise ValueError("반품 또는 교환만 신청할 수 있습니다.")
        return v

    @field_validator("reason")
    @classmethod
    def known_reason(cls, v: str) -> str:
        if v not in REASONS:
            raise ValueError("올바르지 않은 사유입니다.")
        return v


class ResolveRequest(BaseModel):
    note: str = Field(default="", max_length=1000)
    refund_amount: int | None = Field(default=None, ge=0)


class ReturnItemView(BaseModel):
    order_item_id: uuid.UUID
    product_name: str
    option_text: str
    quantity: int


class ReturnView(BaseModel):
    id: uuid.UUID
    sub_order_id: uuid.UUID
    kind: str
    reason: str
    detail: str
    status: str
    admin_note: str
    refund_amount: int
    requested_at: datetime
    resolved_at: datetime | None
    completed_at: datetime | None
    items: list[ReturnItemView]


class ReturnList(BaseModel):
    items: list[ReturnView]
    total: int
    page: int
    size: int


class AdminReturnView(ReturnView):
    user_id: uuid.UUID
    buyer_name: str = ""
    buyer_email: str = ""


class AdminReturnList(BaseModel):
    items: list[AdminReturnView]
    total: int
    page: int
    size: int


def _check_page(page: int) -> None:
    if page < 1 or page > 10000:
        raise AppError("validation_error", "올바르지 않은 페이지입니다.", status_code=422)


@router.post("", response_model=ReturnView, status_code=201)
async def create_return(
    body: ReturnCreate,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
) -> ReturnView:
    """반품·교환 신청 — 기한(변심 7일 / 하자·오배송 30일)은 서버가 판정한다."""
    data = await service.create_return(
        session, user_id,
        sub_order_id=body.sub_order_id, kind=body.kind, reason=body.reason, detail=body.detail,
        items=[{"order_item_id": i.order_item_id, "quantity": i.quantity} for i in body.items],
    )
    return ReturnView(**data)


@router.get("", response_model=ReturnList)
async def list_my_returns(
    page: int = 1,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
) -> ReturnList:
    _check_page(page)
    return ReturnList(**await service.list_mine(session, user_id, page))


@router.get("/{return_id}", response_model=ReturnView)
async def get_my_return(
    return_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
) -> ReturnView:
    return ReturnView(**await service.get_return(session, return_id, user_id))


async def _enrich(session: AsyncSession, items: list[dict]) -> list[dict]:
    from app.auth import service as auth_service

    users = await auth_service.get_users_by_ids(session, list({i["user_id"] for i in items}))
    for i in items:
        u = users.get(i["user_id"])
        i["buyer_name"] = auth_service.display_name(u)  # 탈퇴 회원은 "(탈퇴한 회원)"으로 갈린다
        i["buyer_email"] = (u.email if u else "") or ""
    return items


@admin_router.get("", response_model=AdminReturnList)
async def admin_list(
    status: str | None = None,
    page: int = 1,
    _admin: uuid.UUID = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> AdminReturnList:
    _check_page(page)
    if status is not None and status not in STATUSES:
        raise AppError("validation_error", "올바르지 않은 상태입니다.", status_code=422)
    data = await service.list_admin(session, status=status, page=page)
    data["items"] = await _enrich(session, data["items"])
    return AdminReturnList(**data)


@admin_router.post("/{return_id}/approve", response_model=AdminReturnView)
async def admin_approve(
    return_id: uuid.UUID,
    body: ResolveRequest,
    admin_id: uuid.UUID = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> AdminReturnView:
    row = await service.resolve(session, admin_id, return_id, to_status=service.STATUS_APPROVED, note=body.note)
    return AdminReturnView(**(await _enrich(session, [{**row, "user_id": await _owner(session, return_id)}]))[0])


@admin_router.post("/{return_id}/reject", response_model=AdminReturnView)
async def admin_reject(
    return_id: uuid.UUID,
    body: ResolveRequest,
    admin_id: uuid.UUID = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> AdminReturnView:
    row = await service.resolve(session, admin_id, return_id, to_status=service.STATUS_REJECTED, note=body.note)
    return AdminReturnView(**(await _enrich(session, [{**row, "user_id": await _owner(session, return_id)}]))[0])


@admin_router.post("/{return_id}/complete", response_model=AdminReturnView)
async def admin_complete(
    return_id: uuid.UUID,
    body: ResolveRequest,
    admin_id: uuid.UUID = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> AdminReturnView:
    """환불(또는 재발송) 완료 — 확정 금액을 함께 기록한다.

    PG 연동 전이므로 실제 환불은 계좌 이체로 이뤄지고, 여기서는 **얼마를 환불했는지**를 남긴다.
    이 값이 없으면 나중에 정산·세무에서 답할 데이터가 없다.
    """
    row = await service.resolve(
        session, admin_id, return_id, to_status=service.STATUS_COMPLETED,
        note=body.note, refund_amount=body.refund_amount,
    )
    return AdminReturnView(**(await _enrich(session, [{**row, "user_id": await _owner(session, return_id)}]))[0])


async def _owner(session: AsyncSession, return_id: uuid.UUID) -> uuid.UUID:
    from sqlalchemy import select

    from app.returns.models import ReturnRequest

    return await session.scalar(select(ReturnRequest.user_id).where(ReturnRequest.id == return_id))
