"""반품·교환 요청과 처리.

기한 규칙(전자상거래법 제17조):
  - 단순 변심 → 배송 완료 후 **7일**
  - 하자·오배송 → 사실을 안 날부터 30일(법은 더 길지만 운영 기준으로 30일을 쓴다)
기한은 **서버가 판정한다** — 화면이 계산하면 시계 편차·표시 로직으로 갈린다.

환불 금액은 여기서 확정하지 않는다(완료 처리 시 운영자가 입력). 자동 계산은 반송비 부담·부분
환불 규칙이 정해져야 하고, 그건 PG·정산 설계와 한 묶음이다.
"""

import logging
import uuid
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import AppError
from app.orders import service as orders_service
from app.returns.models import ReturnItem, ReturnRequest

logger = logging.getLogger("slur.returns")

STATUS_REQUESTED = "requested"
STATUS_APPROVED = "approved"
STATUS_REJECTED = "rejected"
STATUS_COMPLETED = "completed"
OPEN_STATUSES = (STATUS_REQUESTED, STATUS_APPROVED)

WINDOW_DAYS = {"change_of_mind": 7, "defect": 30, "wrong_delivery": 30, "etc": 7}


async def _owned_sub(session: AsyncSession, user_id: uuid.UUID, sub_order_id: uuid.UUID) -> dict:
    sub = await orders_service.sub_order_snapshot(session, sub_order_id)
    # 남의 주문과 없는 주문을 구분해 노출하지 않는다(주문 도메인과 같은 규칙)
    if sub is None or sub["user_id"] != user_id:
        raise AppError("not_found", "주문을 찾을 수 없습니다.", status_code=404)
    return sub


async def _returned_quantities(session: AsyncSession, order_item_ids: list[uuid.UUID]) -> dict[uuid.UUID, int]:
    """이미 반품 요청된 수량 — 거부된 건은 제외(다시 요청할 수 있어야 한다)."""
    if not order_item_ids:
        return {}
    rows = (await session.execute(
        select(ReturnItem.order_item_id, func.coalesce(func.sum(ReturnItem.quantity), 0))
        .join(ReturnRequest, ReturnItem.return_id == ReturnRequest.id)
        .where(ReturnItem.order_item_id.in_(order_item_ids), ReturnRequest.status != STATUS_REJECTED)
        .group_by(ReturnItem.order_item_id)
    )).all()
    return {oid: int(qty) for oid, qty in rows}


async def check_returnable(session: AsyncSession, sub: dict, reason: str) -> None:
    """반품 가능 여부 — 배송 완료 상태 + 기한 이내."""
    if not await orders_service.is_delivered(sub["shipping_status"]):
        raise AppError(
            "invalid_transition", "배송이 완료된 주문만 반품·교환을 신청할 수 있습니다.", status_code=422
        )
    if sub["delivered_at"] is None:
        # 컬럼 도입 전 배송된 주문 — 기한을 계산할 수 없다. 막지 않고 운영자 판단에 맡긴다.
        logger.info("sub_order %s 배송 완료 시각 없음 — 기한 검사 생략", sub["sub_order_id"])
        return
    days = WINDOW_DAYS.get(reason, 7)
    now = await session.scalar(select(func.now()))
    if now > sub["delivered_at"] + timedelta(days=days):
        raise AppError(
            "return_window_expired",
            f"신청 기한이 지났습니다. 이 사유는 배송 완료 후 {days}일 이내에만 신청할 수 있습니다.",
            status_code=422,
        )


async def create_return(
    session: AsyncSession, user_id: uuid.UUID, *,
    sub_order_id: uuid.UUID, kind: str, reason: str, detail: str, items: list[dict],
) -> dict:
    sub = await _owned_sub(session, user_id, sub_order_id)
    await check_returnable(session, sub, reason)

    open_exists = await session.scalar(
        select(func.count()).select_from(ReturnRequest)
        .where(ReturnRequest.sub_order_id == sub_order_id, ReturnRequest.status.in_(OPEN_STATUSES))
    )
    if open_exists:
        raise AppError("already_requested", "이미 처리 중인 반품·교환 신청이 있습니다.", status_code=409)

    if not items:
        raise AppError("validation_error", "반품할 상품을 선택해 주세요.", status_code=422)

    lines = {i["order_item_id"]: i for i in await orders_service.active_items_of_sub(session, sub_order_id)}
    already = await _returned_quantities(session, list(lines))
    row = ReturnRequest(
        sub_order_id=sub_order_id, user_id=user_id, kind=kind, reason=reason,
        detail=detail.strip(), status=STATUS_REQUESTED,
    )
    session.add(row)
    await session.flush()

    for entry in items:
        oid = entry["order_item_id"]
        qty = int(entry["quantity"])
        line = lines.get(oid)
        if line is None:  # 이 묶음의 품목이 아니거나 이미 취소된 품목
            raise AppError("not_found", "주문 품목을 찾을 수 없습니다.", status_code=404)
        remain = line["quantity"] - already.get(oid, 0)
        if qty < 1 or qty > remain:
            raise AppError(
                "validation_error",
                f"‘{line['product_name']}'의 신청 가능 수량은 {max(remain, 0)}개입니다.",
                status_code=422,
            )
        session.add(ReturnItem(return_id=row.id, order_item_id=oid, quantity=qty))

    await session.commit()
    logger.info("return %s requested by user %s (sub=%s, kind=%s)", row.id, user_id, sub_order_id, kind)
    return await get_return(session, row.id)


def _view(row: ReturnRequest, items: list[dict]) -> dict:
    return {
        "id": row.id,
        "sub_order_id": row.sub_order_id,
        "kind": row.kind,
        "reason": row.reason,
        "detail": row.detail,
        "status": row.status,
        "admin_note": row.admin_note,
        "refund_amount": row.refund_amount,
        "requested_at": row.requested_at,
        "resolved_at": row.resolved_at,
        "completed_at": row.completed_at,
        "items": items,
    }


async def _items_view(session: AsyncSession, return_ids: list[uuid.UUID]) -> dict:
    if not return_ids:
        return {}
    rows = list(await session.scalars(
        select(ReturnItem).where(ReturnItem.return_id.in_(return_ids)).order_by(ReturnItem.created_at)
    ))
    names = await orders_service.order_items_by_ids(session, [r.order_item_id for r in rows])
    grouped: dict = {}
    for ri in rows:
        meta = names.get(ri.order_item_id, {})
        grouped.setdefault(ri.return_id, []).append({
            "order_item_id": ri.order_item_id,
            "product_name": meta.get("product_name", ""),
            "option_text": meta.get("option_text", ""),
            "quantity": ri.quantity,
        })
    return grouped


async def get_return(session: AsyncSession, return_id: uuid.UUID, user_id: uuid.UUID | None = None) -> dict:
    row = await session.scalar(select(ReturnRequest).where(ReturnRequest.id == return_id))
    if row is None or (user_id is not None and row.user_id != user_id):
        raise AppError("not_found", "신청 내역을 찾을 수 없습니다.", status_code=404)
    items = await _items_view(session, [row.id])
    return _view(row, items.get(row.id, []))


async def list_mine(session: AsyncSession, user_id: uuid.UUID, page: int) -> dict:
    size = get_settings().page_size
    base = select(ReturnRequest).where(ReturnRequest.user_id == user_id)
    total = await session.scalar(select(func.count()).select_from(base.subquery())) or 0
    rows = list(await session.scalars(
        base.order_by(ReturnRequest.requested_at.desc(), ReturnRequest.id.desc())
        .offset((page - 1) * size).limit(size)
    ))
    items = await _items_view(session, [r.id for r in rows])
    return {"items": [_view(r, items.get(r.id, [])) for r in rows], "total": total, "page": page, "size": size}


async def list_admin(session: AsyncSession, *, status: str | None, page: int) -> dict:
    size = get_settings().page_size
    base = select(ReturnRequest)
    if status:
        base = base.where(ReturnRequest.status == status)
    total = await session.scalar(select(func.count()).select_from(base.subquery())) or 0
    rows = list(await session.scalars(
        base.order_by(ReturnRequest.requested_at.desc(), ReturnRequest.id.desc())
        .offset((page - 1) * size).limit(size)
    ))
    items = await _items_view(session, [r.id for r in rows])
    return {
        "items": [{**_view(r, items.get(r.id, [])), "user_id": r.user_id} for r in rows],
        "total": total, "page": page, "size": size,
    }


async def count_open(session: AsyncSession) -> int:
    """처리 대기 중인 신청 수 — 관리자 대시보드 큐."""
    return int(await session.scalar(
        select(func.count()).select_from(ReturnRequest).where(ReturnRequest.status == STATUS_REQUESTED)
    ) or 0)


_ALLOWED = {  # 상태 전이표 — 주문 도메인과 같은 방식으로 표에 못박는다
    STATUS_REQUESTED: {STATUS_APPROVED, STATUS_REJECTED},
    STATUS_APPROVED: {STATUS_COMPLETED},
    STATUS_REJECTED: set(),
    STATUS_COMPLETED: set(),
}


async def resolve(
    session: AsyncSession, admin_id: uuid.UUID, return_id: uuid.UUID, *,
    to_status: str, note: str = "", refund_amount: int | None = None,
) -> dict:
    row = await session.scalar(select(ReturnRequest).where(ReturnRequest.id == return_id).with_for_update())
    if row is None:
        raise AppError("not_found", "신청 내역을 찾을 수 없습니다.", status_code=404)
    if to_status not in _ALLOWED.get(row.status, set()):
        raise AppError("invalid_transition", "지금 상태에서는 할 수 없는 처리입니다.", status_code=422)

    row.status = to_status
    if note:
        row.admin_note = note.strip()
    now = await session.scalar(select(func.now()))
    if to_status in (STATUS_APPROVED, STATUS_REJECTED):
        row.resolved_at = now
    if to_status == STATUS_COMPLETED:
        if refund_amount is None or refund_amount < 0:
            raise AppError("validation_error", "환불 금액을 입력해 주세요.", status_code=422)
        row.refund_amount = refund_amount
        row.completed_at = now
    await session.commit()
    logger.info("return %s -> %s by admin %s", return_id, to_status, admin_id)
    return await get_return(session, return_id)
