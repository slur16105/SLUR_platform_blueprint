"""배송지 주소록 CRUD.

기본 배송지는 회원당 하나다 — 새로 지정하면 기존 것을 먼저 내리고 지정한다. 그 순서를 지켜도
동시 요청에서는 둘 다 기본이 될 수 있어, 최종 방어는 부분 유니크 인덱스가 한다.
"""

import logging
import uuid

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.addresses.models import MAX_PER_USER, Address
from app.core.errors import AppError

logger = logging.getLogger("slur.addresses")


def _view(row: Address) -> dict:
    return {
        "id": row.id,
        "label": row.label,
        "recipient_name": row.recipient_name,
        "recipient_phone": row.recipient_phone,
        "postal_code": row.postal_code,
        "address1": row.address1,
        "address2": row.address2,
        "is_default": row.is_default,
    }


async def list_mine(session: AsyncSession, user_id: uuid.UUID) -> list[dict]:
    """기본 배송지를 먼저, 그다음 최근 등록순 — 주문서가 첫 항목을 바로 쓸 수 있게."""
    rows = await session.scalars(
        select(Address)
        .where(Address.user_id == user_id)
        .order_by(Address.is_default.desc(), Address.created_at.desc(), Address.id.desc())
    )
    return [_view(r) for r in rows]


async def _owned(session: AsyncSession, user_id: uuid.UUID, address_id: uuid.UUID) -> Address:
    row = await session.scalar(select(Address).where(Address.id == address_id))
    # 남의 주소와 없는 주소를 구분해 노출하지 않는다 — 배송지는 개인정보다
    if row is None or row.user_id != user_id:
        raise AppError("not_found", "배송지를 찾을 수 없습니다.", status_code=404)
    return row


async def _clear_default(session: AsyncSession, user_id: uuid.UUID, keep_id: uuid.UUID | None = None) -> None:
    stmt = update(Address).where(Address.user_id == user_id, Address.is_default.is_(True)).values(is_default=False)
    if keep_id is not None:
        stmt = stmt.where(Address.id != keep_id)
    await session.execute(stmt)


async def create(session: AsyncSession, user_id: uuid.UUID, data: dict) -> dict:
    count = await session.scalar(
        select(func.count()).select_from(Address).where(Address.user_id == user_id)
    ) or 0
    if count >= MAX_PER_USER:
        raise AppError(
            "validation_error", f"배송지는 최대 {MAX_PER_USER}개까지 저장할 수 있습니다.", status_code=422
        )
    # 첫 배송지는 자동으로 기본이 된다 — 주문서가 비어 있는 상태로 시작하지 않게
    make_default = bool(data.get("is_default")) or count == 0
    if make_default:
        await _clear_default(session, user_id)
    row = Address(
        user_id=user_id,
        label=(data.get("label") or "").strip(),
        recipient_name=data["recipient_name"].strip(),
        recipient_phone=data["recipient_phone"].strip(),
        postal_code=data["postal_code"].strip(),
        address1=data["address1"].strip(),
        address2=(data.get("address2") or "").strip(),
        is_default=make_default,
    )
    session.add(row)
    await session.commit()
    return _view(row)


async def update_address(session: AsyncSession, user_id: uuid.UUID, address_id: uuid.UUID, data: dict) -> dict:
    row = await _owned(session, user_id, address_id)
    row.label = (data.get("label") or "").strip()
    row.recipient_name = data["recipient_name"].strip()
    row.recipient_phone = data["recipient_phone"].strip()
    row.postal_code = data["postal_code"].strip()
    row.address1 = data["address1"].strip()
    row.address2 = (data.get("address2") or "").strip()
    if data.get("is_default"):
        await _clear_default(session, user_id, keep_id=row.id)
        row.is_default = True
    await session.commit()
    return _view(row)


async def set_default(session: AsyncSession, user_id: uuid.UUID, address_id: uuid.UUID) -> dict:
    row = await _owned(session, user_id, address_id)
    await _clear_default(session, user_id, keep_id=row.id)
    row.is_default = True
    await session.commit()
    return _view(row)


async def delete(session: AsyncSession, user_id: uuid.UUID, address_id: uuid.UUID) -> None:
    row = await _owned(session, user_id, address_id)
    was_default = row.is_default
    await session.delete(row)
    await session.flush()
    if was_default:
        # 기본을 지웠으면 남은 것 중 최신을 기본으로 — 주문서가 "기본 없음" 상태로 남지 않게
        nxt = await session.scalar(
            select(Address)
            .where(Address.user_id == user_id)
            .order_by(Address.created_at.desc(), Address.id.desc())
            .limit(1)
        )
        if nxt is not None:
            nxt.is_default = True
    await session.commit()
