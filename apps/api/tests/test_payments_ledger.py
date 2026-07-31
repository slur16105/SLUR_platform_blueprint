"""결제·환불 거래 원장 (오픈 게이트 P0 — PG 연동 선결).

검증의 축: 입금 확인이 원장에 남는가 · 중복 확인이 두 줄로 늘지 않는가 ·
환불이 결제에 매달리는가 · "받은 돈 − 돌려준 돈"이 맞는가.
"""

import uuid as _uuid

import pytest
from sqlalchemy import select

from app.core.db import async_session_factory
from app.orders.models import OrderItem
from app.payments import service as payments_service
from app.payments.models import Payment
from tests.helpers import _admin_login, _auth, _buyer, _fees, _paid_order, _shop


@pytest.mark.asyncio
async def test_deposit_confirm_records_payment(client, clean_products):
    """입금 확인 → 결제 원장 1건. 상태와 원장이 같은 트랜잭션에서 만들어진다."""
    st, _pid, vs = await _shop(client, stock=9)
    await _fees(client, st)
    bt = await _buyer(client)
    admin_t = await _admin_login(client)
    oid, _sid = await _paid_order(client, bt, admin_t, vs)

    async with async_session_factory() as session:
        rows = list(await session.scalars(select(Payment).where(Payment.order_id == _uuid.UUID(oid))))
        assert len(rows) == 1
        p = rows[0]
        assert p.status == "paid" and p.method == "bank_transfer" and p.amount > 0
        assert p.paid_at is not None
        # PG 연동 전이라 승인번호 자리는 비어 있다 — 구조만 준비된 상태
        assert p.provider == "" and p.provider_tid == ""


@pytest.mark.asyncio
async def test_idempotent_payment_record(client, clean_products):
    """같은 주문을 두 번 기록해도 원장은 한 줄 — PG 웹훅 중복 수신 방어와 같은 구조."""
    st, _pid, vs = await _shop(client, stock=9)
    await _fees(client, st)
    bt = await _buyer(client)
    admin_t = await _admin_login(client)
    oid, _sid = await _paid_order(client, bt, admin_t, vs)

    async with async_session_factory() as session:
        again = await payments_service.record_payment(
            session, _uuid.UUID(oid), amount=999, idempotency_key=f"bank:{oid}"
        )
        await session.commit()
        rows = list(await session.scalars(select(Payment).where(Payment.order_id == _uuid.UUID(oid))))
        assert len(rows) == 1
        assert again.amount != 999  # 새로 만들지 않고 기존 행을 돌려준다


@pytest.mark.asyncio
async def test_return_completion_records_refund(client, clean_products):
    """반품 완료 → 환불이 결제에 매달린다. 받은 돈 − 돌려준 돈이 맞아야 한다."""
    st, _pid, vs = await _shop(client, stock=9)
    await _fees(client, st)
    bt = await _buyer(client)
    admin_t = await _admin_login(client)
    oid, sid = await _paid_order(client, bt, admin_t, vs, qty=2)
    await client.post(f"/api/v1/sellers/sub-orders/{sid}/ship",
                      json={"carrier": "CJ", "tracking_number": "1"}, headers=_auth(st))
    await client.post(f"/api/v1/sellers/sub-orders/{sid}/deliver", headers=_auth(st))

    async with async_session_factory() as session:
        item = await session.scalar(select(OrderItem).where(OrderItem.sub_order_id == _uuid.UUID(sid)))
        item_id = str(item.id)

    rid = (await client.post("/api/v1/returns", json={
        "sub_order_id": sid, "kind": "return", "reason": "defect", "detail": "하자",
        "items": [{"order_item_id": item_id, "quantity": 1}],
    }, headers=_auth(bt))).json()["id"]
    await client.post(f"/api/v1/admin/returns/{rid}/approve", json={}, headers=_auth(admin_t))
    await client.post(f"/api/v1/admin/returns/{rid}/complete",
                      json={"refund_amount": 5000, "note": "부분 환불"}, headers=_auth(admin_t))

    async with async_session_factory() as session:
        ledger = await payments_service.order_ledger(session, _uuid.UUID(oid))
    assert len(ledger["refunds"]) == 1
    assert ledger["refunds"][0]["amount"] == 5000 and ledger["refunds"][0]["reason"] == "return"
    assert ledger["refunded_total"] == 5000
    assert ledger["net_total"] == ledger["paid_total"] - 5000


@pytest.mark.asyncio
async def test_ledger_empty_for_unpaid_order(client, clean_products):
    """입금 전 주문은 원장이 비어 있다 — 받지도 않은 돈이 잡히면 안 된다."""
    from tests.helpers import _cart_ids, _expected, ADDRESS

    st, _pid, vs = await _shop(client, stock=9)
    await _fees(client, st)
    bt = await _buyer(client)
    await client.post("/api/v1/carts/items", json={"variant_id": vs[0]["id"], "quantity": 1}, headers=_auth(bt))
    ids = await _cart_ids(client, bt)
    res = await client.post("/api/v1/orders", json={
        "cart_item_ids": ids, "expected_grand_total": await _expected(client, bt), **ADDRESS,
    }, headers=_auth(bt))
    oid = res.json()["order_id"]

    async with async_session_factory() as session:
        ledger = await payments_service.order_ledger(session, _uuid.UUID(oid))
    assert ledger["payments"] == [] and ledger["paid_total"] == 0
