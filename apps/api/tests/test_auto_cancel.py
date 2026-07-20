"""미입금 자동취소 테스트 (Story 4.5) — 작업 함수 직접 호출 (스케줄러는 배선만)."""

import uuid as u
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select, text, update as sa_update

from app.orders import service
from app.orders.models import Cancellation, Order, OrderEvent, OrderItem, SubOrder
from tests.helpers import ADDRESS, _auth, _buyer, _cart_ids, _expected, _fees, _shop


async def _make_order(client, bt, ids, exp) -> str:
    res = await client.post("/api/v1/orders", json={"cart_item_ids": ids, "expected_grand_total": exp, **ADDRESS}, headers=_auth(bt))
    assert res.status_code == 201
    return res.json()["order_id"]


async def _expire(order_id: str) -> None:
    """기한을 과거로 — deposit_due_at은 상태 컬럼이 아니라 직접 수정 가능 (테스트 조성)."""
    from app.core.db import async_session_factory

    async with async_session_factory() as session:
        await session.execute(
            sa_update(Order).where(Order.id == u.UUID(order_id))
            .values(deposit_due_at=datetime.now(timezone.utc) - timedelta(hours=1))
        )
        await session.commit()


async def _stock(variant_id: str) -> int:
    from app.core.db import engine

    async with engine.begin() as conn:
        return (await conn.execute(text("SELECT stock FROM variants WHERE id = :v"), {"v": variant_id})).scalar_one()


@pytest.mark.asyncio
async def test_expired_order_auto_canceled(client, clean_products):
    """AC 1: 기한 경과 → 전 라인 취소·재고 복원·cancellations(system)·order canceled·events."""
    from app.core.db import async_session_factory

    st, pid, vs = await _shop(client, stock=5)
    await _fees(client, st)
    bt = await _buyer(client)
    await client.post("/api/v1/carts/items", json={"variant_id": vs[0]["id"], "quantity": 2}, headers=_auth(bt))
    ids = await _cart_ids(client, bt)
    oid = await _make_order(client, bt, ids, await _expected(client, bt))
    assert await _stock(vs[0]["id"]) == 3
    await _expire(oid)

    async with async_session_factory() as session:
        assert await service.auto_cancel_expired_orders(session) == 1

    assert await _stock(vs[0]["id"]) == 5  # 복원
    async with async_session_factory() as session:
        order = await session.get(Order, u.UUID(oid))
        assert order.payment_status == "canceled"
        item = await session.scalar(
            select(OrderItem).join(SubOrder, OrderItem.sub_order_id == SubOrder.id).where(SubOrder.order_id == order.id)
        )
        assert item.status == "canceled"
        can = await session.scalar(select(Cancellation).where(Cancellation.order_item_id == item.id))
        assert can.responsibility == "system" and can.reason == "미입금 자동취소" and can.created_by is None
        events = list(await session.scalars(
            select(OrderEvent).where(OrderEvent.order_id == order.id).order_by(OrderEvent.created_at, OrderEvent.id)
        ))
        # 창생(buyer) + 라인 취소(system) + order 취소(system)
        assert [(e.entity_type, e.to_status, e.actor_role) for e in events] == [
            ("order", "pending_payment", "buyer"),
            ("order_item", "canceled", "system"),
            ("order", "canceled", "system"),
        ]
        assert events[1].actor_user_id is None


@pytest.mark.asyncio
async def test_within_deadline_untouched(client, clean_products):
    """AC 2: 기한 이내 주문 무변화 + paid·canceled 주문 대상 제외."""
    from app.core.db import async_session_factory
    from app.orders import transitions as t

    st, pid, vs = await _shop(client, stock=9)
    await _fees(client, st)
    bt = await _buyer(client)
    # 기한 이내 주문
    await client.post("/api/v1/carts/items", json={"variant_id": vs[0]["id"], "quantity": 1}, headers=_auth(bt))
    fresh_oid = await _make_order(client, bt, await _cart_ids(client, bt), await _expected(client, bt))
    # paid 주문 (기한 경과지만 결제됨)
    await client.post("/api/v1/carts/items", json={"variant_id": vs[1]["id"], "quantity": 1}, headers=_auth(bt))
    paid_oid = await _make_order(client, bt, await _cart_ids(client, bt), await _expected(client, bt))
    await _expire(paid_oid)
    async with async_session_factory() as session:
        await service.transition(
            session, layer=t.LAYER_ORDER, entity_id=u.UUID(paid_oid), to_status=t.ORDER_PAID,
            actor_role=t.ROLE_ADMIN, actor_user_id=None,
        )
        await session.commit()

    async with async_session_factory() as session:
        assert await service.auto_cancel_expired_orders(session) == 0  # 대상 없음
        assert (await session.get(Order, u.UUID(fresh_oid))).payment_status == "pending_payment"
        assert (await session.get(Order, u.UUID(paid_oid))).payment_status == "paid"


@pytest.mark.asyncio
async def test_idempotent_and_isolated_failure(client, clean_products, monkeypatch):
    """멱등(2회 실행 무변화) + 한 주문 실패가 다른 주문 취소를 막지 않음."""
    from app.core.db import async_session_factory

    st, pid, vs = await _shop(client, stock=9)
    await _fees(client, st)
    b1 = await _buyer(client, email="ac1@example.com")
    b2 = await _buyer(client, email="ac2@example.com")
    await client.post("/api/v1/carts/items", json={"variant_id": vs[0]["id"], "quantity": 1}, headers=_auth(b1))
    o1 = await _make_order(client, b1, await _cart_ids(client, b1), await _expected(client, b1))
    await client.post("/api/v1/carts/items", json={"variant_id": vs[1]["id"], "quantity": 1}, headers=_auth(b2))
    o2 = await _make_order(client, b2, await _cart_ids(client, b2), await _expected(client, b2))
    await _expire(o1)
    await _expire(o2)

    # o1(정렬상 먼저)의 라인 취소를 인위 실패시켜 격리 확인 — cancel_order_item를 선택적으로 폭파
    real_cancel = service.cancel_order_item

    async def flaky_cancel(session, **kw):
        item = await session.get(OrderItem, kw["order_item_id"])
        sub = await session.get(SubOrder, item.sub_order_id)
        if str(sub.order_id) == o1:
            raise RuntimeError("인위 실패 (테스트)")
        return await real_cancel(session, **kw)

    monkeypatch.setattr(service, "cancel_order_item", flaky_cancel)
    async with async_session_factory() as session:
        assert await service.auto_cancel_expired_orders(session) == 1  # o2만 성공
        assert (await session.get(Order, u.UUID(o1))).payment_status == "pending_payment"  # rollback 격리
        assert (await session.get(Order, u.UUID(o2))).payment_status == "canceled"

    monkeypatch.setattr(service, "cancel_order_item", real_cancel)
    async with async_session_factory() as session:
        assert await service.auto_cancel_expired_orders(session) == 1  # o1 재시도 성공
        assert await service.auto_cancel_expired_orders(session) == 0  # 멱등


@pytest.mark.asyncio
async def test_deleted_variant_line_cancels_with_noop_restore(client, clean_products):
    """variant SET NULL 라인 포함 주문 — 복원 no-op으로 정상 취소 (4.2 결정 ②)."""
    from app.core.db import async_session_factory
    from tests.helpers import GRID

    st, pid, vs = await _shop(client, stock=5)
    await _fees(client, st)
    bt = await _buyer(client)
    await client.post("/api/v1/carts/items", json={"variant_id": vs[0]["id"], "quantity": 1}, headers=_auth(bt))
    oid = await _make_order(client, bt, await _cart_ids(client, bt), await _expected(client, bt))
    # 주문된 조합 삭제 → order_items.variant_id SET NULL
    kept = [v for v in GRID["variants"] if not (v["option1_value"] == vs[0]["option1_value"] and v["option2_value"] == vs[0]["option2_value"])]
    await client.put(f"/api/v1/sellers/products/{pid}/variants", json={"variants": kept}, headers=_auth(st))
    await _expire(oid)

    async with async_session_factory() as session:
        assert await service.auto_cancel_expired_orders(session) == 1
        assert (await session.get(Order, u.UUID(oid))).payment_status == "canceled"


@pytest.mark.asyncio
async def test_paid_race_skipped_after_targeting(client, clean_products):
    """리뷰 반영: 대상 확정 후 입금확인 경합 — 잠금 후 재검증이 스킵 (취소·복원 없음, 장애 아님)."""
    from app.core.db import async_session_factory
    from app.orders import transitions as t

    st, pid, vs = await _shop(client, stock=5)
    await _fees(client, st)
    bt = await _buyer(client)
    await client.post("/api/v1/carts/items", json={"variant_id": vs[0]["id"], "quantity": 2}, headers=_auth(bt))
    oid = await _make_order(client, bt, await _cart_ids(client, bt), await _expected(client, bt))
    await _expire(oid)
    # 대상 확정 후 시점을 재현: paid로 전이해 두고 per-order 경로 직접 호출
    async with async_session_factory() as session:
        await service.transition(
            session, layer=t.LAYER_ORDER, entity_id=u.UUID(oid), to_status=t.ORDER_PAID,
            actor_role=t.ROLE_ADMIN, actor_user_id=None,
        )
        await session.commit()

    async with async_session_factory() as session:
        assert await service._auto_cancel_order(session, u.UUID(oid)) is False  # 스킵
        await session.rollback()
        assert (await session.get(Order, u.UUID(oid))).payment_status == "paid"  # 무변화
    assert await _stock(vs[0]["id"]) == 3  # 복원 없음 (차감 유지)


def test_scheduler_wiring():
    """배선 검증: interval이 config 값이고 job이 등록된다 (기동은 lifespan 몫)."""
    from app.core.config import get_settings
    from app.core.scheduler import create_scheduler

    sch = create_scheduler()
    jobs = sch.get_jobs()
    assert len(jobs) == 1
    assert jobs[0].trigger.interval.total_seconds() == get_settings().auto_cancel_interval_minutes * 60
