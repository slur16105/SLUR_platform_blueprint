"""결제·환불 기록.

**결제 상태의 진실은 여전히 `orders.payment_status`다.** 이 층은 거래 원장(ledger)이다 —
누가 언제 얼마를 어떤 수단으로 승인·환불했는지를 남긴다. 두 곳이 어긋나지 않도록,
주문 상태를 바꾸는 쪽(입금 확인·취소)이 여기에 함께 기록한다.

PG 연동 시 바뀌는 것은 `provider`·`provider_tid`·`raw_response`를 채우는 주체뿐이고,
호출부(입금 확인 → record_payment)와 구조는 그대로 쓴다.
"""

import logging
import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.payments.models import Payment, Refund

logger = logging.getLogger("slur.payments")

METHOD_BANK = "bank_transfer"
STATUS_PAID = "paid"
STATUS_PENDING = "pending"
REFUND_DONE = "done"


async def record_payment(
    session: AsyncSession, order_id: uuid.UUID, *, amount: int,
    method: str = METHOD_BANK, status: str = STATUS_PAID,
    provider: str = "", provider_tid: str = "", idempotency_key: str | None = None,
    raw_response: str = "", paid_at=None,
) -> Payment:
    """결제 1건 기록. commit은 호출자(주문 상태 전이와 한 트랜잭션이어야 한다).

    멱등키가 이미 있으면 그 행을 반환한다 — PG 웹훅이 같은 승인을 두 번 보내도 두 번 잡히지 않는다.
    """
    if idempotency_key:
        existing = await session.scalar(select(Payment).where(Payment.idempotency_key == idempotency_key))
        if existing is not None:
            logger.info("payment 멱등 재수신 — 기존 %s 반환 (key=%s)", existing.id, idempotency_key)
            return existing
    row = Payment(
        order_id=order_id, method=method, status=status, amount=amount,
        provider=provider, provider_tid=provider_tid, idempotency_key=idempotency_key,
        raw_response=raw_response,
        paid_at=paid_at if paid_at is not None else (await session.scalar(select(func.now())) if status == STATUS_PAID else None),
    )
    session.add(row)
    await session.flush()
    logger.info("payment %s recorded (order=%s, %s, %d원)", row.id, order_id, method, amount)
    return row


async def record_refund(
    session: AsyncSession, payment_id: uuid.UUID, *, amount: int, reason: str,
    admin_id: uuid.UUID | None = None, return_id: uuid.UUID | None = None,
    note: str = "", status: str = REFUND_DONE, idempotency_key: str | None = None,
) -> Refund:
    """환불 1건 기록. commit은 호출자.

    금액이 여기 있다 — 이전에는 "얼마를 환불했는지"에 답할 데이터가 없었다.
    """
    if idempotency_key:
        existing = await session.scalar(select(Refund).where(Refund.idempotency_key == idempotency_key))
        if existing is not None:
            return existing
    row = Refund(
        payment_id=payment_id, amount=amount, reason=reason, status=status,
        return_id=return_id, note=note, created_by=admin_id,
        refunded_at=await session.scalar(select(func.now())) if status == REFUND_DONE else None,
        idempotency_key=idempotency_key,
    )
    session.add(row)
    await session.flush()
    logger.info("refund %s recorded (payment=%s, %d원, %s)", row.id, payment_id, amount, reason)
    return row


async def latest_paid_payment(session: AsyncSession, order_id: uuid.UUID) -> Payment | None:
    """주문의 승인된 결제 — 환불은 이 결제에 매단다."""
    return await session.scalar(
        select(Payment)
        .where(Payment.order_id == order_id, Payment.status == STATUS_PAID)
        .order_by(Payment.paid_at.desc(), Payment.created_at.desc())
        .limit(1)
    )


async def order_ledger(session: AsyncSession, order_id: uuid.UUID) -> dict:
    """주문의 결제·환불 원장 — 관리자 주문 상세에서 "받은 돈과 돌려준 돈"을 본다."""
    payments = list(await session.scalars(
        select(Payment).where(Payment.order_id == order_id).order_by(Payment.created_at)
    ))
    refunds: list[Refund] = []
    if payments:
        refunds = list(await session.scalars(
            select(Refund).where(Refund.payment_id.in_([p.id for p in payments])).order_by(Refund.created_at)
        ))
    paid_total = sum(p.amount for p in payments if p.status == STATUS_PAID)
    refunded_total = sum(r.amount for r in refunds if r.status == REFUND_DONE)
    return {
        "payments": [{
            "id": p.id, "method": p.method, "status": p.status, "amount": p.amount,
            "provider": p.provider, "provider_tid": p.provider_tid, "paid_at": p.paid_at,
        } for p in payments],
        "refunds": [{
            "id": r.id, "amount": r.amount, "reason": r.reason, "status": r.status,
            "note": r.note, "refunded_at": r.refunded_at,
        } for r in refunds],
        "paid_total": paid_total,
        "refunded_total": refunded_total,
        "net_total": paid_total - refunded_total,  # 실제로 남은 금액 — 정산·세무의 기준값
    }
