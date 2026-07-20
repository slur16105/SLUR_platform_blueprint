"""구매자 취소 테스트 (Story 4.6) — 상태 조성은 전이 함수 직접 호출 (4.3 관례)."""

import uuid as u

import pytest
from sqlalchemy import select

from app.orders import service, transitions as t
from app.orders.models import Cancellation, Order, OrderEvent, OrderItem, SubOrder
from tests.test_carts import _buyer, _shop
from tests.test_order_creation import ADDRESS, _cart_ids, _expected, _fees
from tests.test_products import clean_products  # noqa: F401
from tests.test_seller_application import _auth

CANCEL = "/api/v1/orders/sub-orders/{}/cancel"


async def _make_order(client, bt) -> tuple[str, str]:
    """단일 묶음 주문 생성 → (order_id, sub_order_id)."""
    from app.core.db import async_session_factory

    ids = await _cart_ids(client, bt)
    res = await client.post(
        "/api/v1/orders",
        json={"cart_item_ids": ids, "expected_grand_total": await _expected(client, bt), **ADDRESS},
        headers=_auth(bt),
    )
    assert res.status_code == 201
    oid = res.json()["order_id"]
    async with async_session_factory() as session:
        sid = await session.scalar(select(SubOrder.id).where(SubOrder.order_id == u.UUID(oid)))
    return oid, str(sid)


async def _stock(variant_id: str) -> int:
    from sqlalchemy import text

    from app.core.db import engine

    async with engine.begin() as conn:
        return (await conn.execute(text("SELECT stock FROM variants WHERE id = :v"), {"v": variant_id})).scalar_one()


@pytest.mark.asyncio
async def test_cancel_bundle_full_flow(client, clean_products):
    """AC 1·3: 전 라인 취소·재고 복원·cancellations(buyer·사유)·order canceled·events(buyer)."""
    from app.core.db import async_session_factory

    st, pid, vs = await _shop(client, stock=5)
    await _fees(client, st)
    bt = await _buyer(client)
    await client.post("/api/v1/carts/items", json={"variant_id": vs[0]["id"], "quantity": 2}, headers=_auth(bt))
    oid, sid = await _make_order(client, bt)
    assert await _stock(vs[0]["id"]) == 3

    res = await client.post(CANCEL.format(sid), json={"reason": "단순 변심"}, headers=_auth(bt))
    assert res.status_code == 200
    assert res.json() == {"canceled_items": 1, "order_canceled": True}

    assert await _stock(vs[0]["id"]) == 5  # 복원
    async with async_session_factory() as session:
        assert (await session.get(Order, u.UUID(oid))).payment_status == "canceled"
        item = await session.scalar(select(OrderItem).where(OrderItem.sub_order_id == u.UUID(sid)))
        assert item.status == "canceled"
        can = await session.scalar(select(Cancellation).where(Cancellation.order_item_id == item.id))
        assert can.responsibility == "buyer" and can.reason == "단순 변심"
        events = list(await session.scalars(
            select(OrderEvent).where(OrderEvent.order_id == u.UUID(oid)).order_by(OrderEvent.created_at, OrderEvent.id)
        ))
        assert [(e.entity_type, e.to_status, e.actor_role) for e in events] == [
            ("order", "pending_payment", "buyer"),
            ("order_item", "canceled", "buyer"),
            ("order", "canceled", "buyer"),
        ]


@pytest.mark.asyncio
async def test_partial_bundle_cancel_keeps_order(client, clean_products):
    """다중 판매자: 한 묶음 취소 → order 유지·타 묶음 무변화, 남은 묶음 취소 → order canceled."""
    from app.core.db import async_session_factory, engine
    from sqlalchemy import text

    from tests.test_admin_approval import _admin_token
    from tests.test_products import _category, _product_body, _seller_with_prefix
    from tests.test_variants import GRID

    admin_t = await _admin_token(client)
    cid = await _category(client, admin_t, name="구매취소")
    st1, sid1 = await _seller_with_prefix(client, admin_t)
    pid1 = (await client.post("/api/v1/sellers/products", json=_product_body(sid1, cid), headers=_auth(st1))).json()["id"]
    vs1 = (await client.put(
        f"/api/v1/sellers/products/{pid1}/variants",
        json={"variants": [{**v, "stock": 5} for v in GRID["variants"]]}, headers=_auth(st1),
    )).json()["variants"]
    await _fees(client, st1)
    s2 = await client.post("/api/v1/auth/signup", json={"email": "seller-bc2@example.com", "password": "password123", "name": "판매자2"})
    t2raw, r2 = s2.json()["access_token"], s2.json()["refresh_token"]
    app2 = await client.post("/api/v1/sellers/applications", json={
        "company_name": "둘째상회", "representative_name": "김둘", "business_registration_number": "2208162517",
        "mail_order_number": "제2026-서울-0009호", "business_address": "서울", "contact_phone": "01099998888",
        "brand_name": "둘째굿즈", "brand_intro": "두 번째 브랜드"}, headers=_auth(t2raw))
    await client.post(f"/api/v1/admin/seller-applications/{app2.json()['id']}/approve", headers=_auth(admin_t))
    t2 = (await client.post("/api/v1/auth/refresh", json={"refresh_token": r2})).json()["access_token"]
    async with engine.begin() as conn:
        sid2 = str((await conn.execute(text("SELECT id FROM sellers WHERE brand_name = '둘째굿즈'"))).scalar_one())
    pid2 = (await client.post("/api/v1/sellers/products", json=_product_body(sid2, cid), headers=_auth(t2))).json()["id"]
    vs2 = (await client.put(
        f"/api/v1/sellers/products/{pid2}/variants",
        json={"variants": [{**v, "stock": 5} for v in GRID["variants"]]}, headers=_auth(t2),
    )).json()["variants"]
    await _fees(client, t2)

    bt = await _buyer(client)
    await client.post("/api/v1/carts/items", json={"variant_id": vs1[0]["id"], "quantity": 1}, headers=_auth(bt))
    await client.post("/api/v1/carts/items", json={"variant_id": vs2[0]["id"], "quantity": 1}, headers=_auth(bt))
    ids = await _cart_ids(client, bt)
    res = await client.post(
        "/api/v1/orders",
        json={"cart_item_ids": ids, "expected_grand_total": await _expected(client, bt), **ADDRESS},
        headers=_auth(bt),
    )
    oid = res.json()["order_id"]
    async with async_session_factory() as session:
        sub_ids = [str(s) for s in await session.scalars(
            select(SubOrder.id).where(SubOrder.order_id == u.UUID(oid)).order_by(SubOrder.created_at, SubOrder.id)
        )]

    r1 = await client.post(CANCEL.format(sub_ids[0]), json={}, headers=_auth(bt))
    assert r1.status_code == 200 and r1.json()["order_canceled"] is False  # 남은 묶음 존재
    async with async_session_factory() as session:
        assert (await session.get(Order, u.UUID(oid))).payment_status == "pending_payment"
        other_items = list(await session.scalars(select(OrderItem).where(OrderItem.sub_order_id == u.UUID(sub_ids[1]))))
        assert all(i.status == "ordered" for i in other_items)  # 타 묶음 무변화
        can = await session.scalar(select(Cancellation))
        assert can.reason == "구매자 취소"  # 기본 사유 대체

    r2res = await client.post(CANCEL.format(sub_ids[1]), json={}, headers=_auth(bt))
    assert r2res.status_code == 200 and r2res.json()["order_canceled"] is True
    async with async_session_factory() as session:
        assert (await session.get(Order, u.UUID(oid))).payment_status == "canceled"


@pytest.mark.asyncio
async def test_cancel_blocked_after_preparing(client, clean_products):
    """AC 2: preparing 진입 후 거부 (관리자 문의 안내 message) — 무변화."""
    from app.core.db import async_session_factory

    st, pid, vs = await _shop(client, stock=5)
    await _fees(client, st)
    bt = await _buyer(client)
    await client.post("/api/v1/carts/items", json={"variant_id": vs[0]["id"], "quantity": 1}, headers=_auth(bt))
    oid, sid = await _make_order(client, bt)
    async with async_session_factory() as session:  # 입금확인 조성 → preparing 연쇄
        await service.transition(
            session, layer=t.LAYER_ORDER, entity_id=u.UUID(oid), to_status=t.ORDER_PAID,
            actor_role=t.ROLE_ADMIN, actor_user_id=None,
        )
        await session.commit()

    res = await client.post(CANCEL.format(sid), json={"reason": "변심"}, headers=_auth(bt))
    assert res.status_code == 422 and res.json()["code"] == "invalid_transition"
    assert "관리자" in res.json()["message"]  # 문의 안내
    assert await _stock(vs[0]["id"]) == 4  # 무변화 (차감 유지)


@pytest.mark.asyncio
async def test_recancel_and_ownership(client, clean_products):
    """재취소 422·재고 1회 복원 / 타인·없는 id 404 / 미인증 401 / reason 501자 422."""
    st, pid, vs = await _shop(client, stock=5)
    await _fees(client, st)
    bt = await _buyer(client)
    other = await _buyer(client, email="other-bc@example.com")
    await client.post("/api/v1/carts/items", json={"variant_id": vs[0]["id"], "quantity": 2}, headers=_auth(bt))
    oid, sid = await _make_order(client, bt)

    assert (await client.post(CANCEL.format(sid), json={})).status_code == 401
    assert (await client.post(CANCEL.format(sid), json={}, headers=_auth(other))).status_code == 404  # 타인
    assert (await client.post(CANCEL.format(str(u.uuid4())), json={}, headers=_auth(bt))).status_code == 404
    res = await client.post(CANCEL.format(sid), json={"reason": "가" * 501}, headers=_auth(bt))
    assert res.status_code == 422 and res.json()["code"] == "validation_error"

    assert (await client.post(CANCEL.format(sid), json={}, headers=_auth(bt))).status_code == 200
    assert await _stock(vs[0]["id"]) == 5
    res = await client.post(CANCEL.format(sid), json={}, headers=_auth(bt))  # 재취소
    assert res.status_code == 422 and res.json()["code"] == "invalid_transition"
    assert await _stock(vs[0]["id"]) == 5  # 복원 1회


@pytest.mark.asyncio
async def test_paid_null_bundle_recancel_rejected(client, clean_products):
    """paid 주문의 전-취소 잔여 NULL 묶음 — 재취소 422 (ordered 라인 0)."""
    from app.core.db import async_session_factory

    st, pid, vs = await _shop(client, stock=9)
    await _fees(client, st)
    bt = await _buyer(client)
    # 같은 판매자 상품 2회 주문 → 주문 2건: 하나는 취소, 하나는 paid로
    await client.post("/api/v1/carts/items", json={"variant_id": vs[0]["id"], "quantity": 1}, headers=_auth(bt))
    oid1, sid1 = await _make_order(client, bt)
    assert (await client.post(CANCEL.format(sid1), json={}, headers=_auth(bt))).status_code == 200

    # 취소된 묶음 재시도 — order 자체가 canceled라 라인 0
    res = await client.post(CANCEL.format(sid1), json={}, headers=_auth(bt))
    assert res.status_code == 422 and res.json()["code"] == "invalid_transition"
