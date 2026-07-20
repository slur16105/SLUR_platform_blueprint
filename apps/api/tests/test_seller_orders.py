"""판매자 주문관리·배송 처리 테스트 (Story 5.3)."""

import uuid as u

import pytest
from sqlalchemy import select

from app.orders import service, transitions as t
from app.orders.models import OrderEvent, SubOrder
from tests.helpers import ADDRESS, _admin_login, _auth, _buyer, _cart_ids, _expected, _fees, _paid_order, _shop, second_seller

ORDERS_URL = "/api/v1/sellers/orders"


@pytest.mark.asyncio
async def test_list_filter_and_isolation(client, clean_products):
    """AC 2·3: 자기 sub_orders만·상태 필터·배송지·라인 표시. paid 전 주문 미노출."""
    st, pid, vs = await _shop(client, stock=9)
    await _fees(client, st)
    bt = await _buyer(client)
    admin_t = await _admin_login(client)

    # 미결제 주문 — 목록에 없어야 함
    await client.post("/api/v1/carts/items", json={"variant_id": vs[1]["id"], "quantity": 1}, headers=_auth(bt))
    ids = await _cart_ids(client, bt)
    await client.post(
        "/api/v1/orders",
        json={"cart_item_ids": ids, "expected_grand_total": await _expected(client, bt), **ADDRESS}, headers=_auth(bt),
    )
    # 결제 확인된 주문 — preparing 목록 대상
    oid, sid = await _paid_order(client, bt, admin_t, vs, qty=2)

    assert (await client.get(ORDERS_URL)).status_code == 401
    assert (await client.get(ORDERS_URL, headers=_auth(bt))).status_code == 403  # 구매자 403

    body = (await client.get(ORDERS_URL, headers=_auth(st))).json()
    assert body["total"] == 1  # 미결제(NULL) 자연 배제
    row = body["items"][0]
    assert row["sub_order_id"] == sid and row["order_id"] == oid
    assert row["recipient_name"] == ADDRESS["recipient_name"] and row["postal_code"] == ADDRESS["postal_code"]
    assert row["items"][0]["quantity"] == 2 and row["items"][0]["status"] == "ordered"
    assert row["shipping_status"] == "preparing" and row["carrier"] is None
    assert body["size"] >= 1

    assert (await client.get(ORDERS_URL, params={"status": "shipping"}, headers=_auth(st))).json()["total"] == 0
    assert (await client.get(ORDERS_URL, params={"status": "bogus"}, headers=_auth(st))).status_code == 422


@pytest.mark.asyncio
async def test_ship_and_deliver_flow(client, clean_products):
    """AC 1: ship(송장 필수) → 구매자 상세 송장 노출 → deliver. order_events(seller)."""
    from app.core.db import async_session_factory

    st, pid, vs = await _shop(client, stock=9)
    await _fees(client, st)
    bt = await _buyer(client)
    admin_t = await _admin_login(client)
    oid, sid = await _paid_order(client, bt, admin_t, vs)

    # 송장 누락 422 (엔진 가드)
    res = await client.post(f"/api/v1/sellers/sub-orders/{sid}/ship", json={"carrier": "CJ", "tracking_number": " "}, headers=_auth(st))
    assert res.status_code == 422
    # preparing에서 deliver 422 (순서 위반)
    res = await client.post(f"/api/v1/sellers/sub-orders/{sid}/deliver", headers=_auth(st))
    assert res.status_code == 422 and res.json()["code"] == "invalid_transition"

    res = await client.post(
        f"/api/v1/sellers/sub-orders/{sid}/ship",
        json={"carrier": "CJ대한통운", "tracking_number": "1122334455"}, headers=_auth(st),
    )
    assert res.status_code == 204
    # 구매자 상세에 송장 노출 (FR-21 — 5.1 화면 데이터)
    d = (await client.get(f"/api/v1/orders/{oid}", headers=_auth(bt))).json()
    assert d["sub_orders"][0]["carrier"] == "CJ대한통운" and d["sub_orders"][0]["tracking_number"] == "1122334455"
    assert d["display_status"] == "shipping"

    assert (await client.post(f"/api/v1/sellers/sub-orders/{sid}/deliver", headers=_auth(st))).status_code == 204
    d = (await client.get(f"/api/v1/orders/{oid}", headers=_auth(bt))).json()
    assert d["display_status"] == "delivered"

    async with async_session_factory() as session:
        events = list(await session.scalars(select(OrderEvent).where(
            OrderEvent.order_id == u.UUID(oid), OrderEvent.actor_role == "seller"
        )))
        assert [(e.from_status, e.to_status) for e in events] == [("preparing", "shipping"), ("shipping", "delivered")]
        assert all(e.actor_user_id is not None for e in events)

    # 이미 delivered에서 재-ship 422
    res = await client.post(
        f"/api/v1/sellers/sub-orders/{sid}/ship",
        json={"carrier": "CJ", "tracking_number": "99"}, headers=_auth(st),
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_other_seller_403(client, clean_products):
    """AC 2: 타 판매자 처리 403 (epics 명시 — 404 아님)."""
    st, pid, vs = await _shop(client, stock=9)
    await _fees(client, st)
    bt = await _buyer(client)
    admin_t = await _admin_login(client)
    oid, sid = await _paid_order(client, bt, admin_t, vs)

    # 제2 판매자 생성 (승인만 — 상품 불요)
    t2, _sid2 = await second_seller(client, admin_t, email="seller-ship2@example.com")

    res = await client.post(
        f"/api/v1/sellers/sub-orders/{sid}/ship", json={"carrier": "CJ", "tracking_number": "1"}, headers=_auth(t2)
    )
    assert res.status_code == 403 and res.json()["code"] == "forbidden"
    assert (await client.get(ORDERS_URL, headers=_auth(t2))).json()["total"] == 0  # 목록 분리
    # 미존재는 404
    assert (await client.post(
        f"/api/v1/sellers/sub-orders/{u.uuid4()}/deliver", headers=_auth(t2)
    )).status_code == 404


@pytest.mark.asyncio
async def test_canceled_lines_and_ghost_ship_guard(client, clean_products):
    """리뷰 반영: 취소 라인 구분 표시·all_canceled·전-취소 묶음 배송 시작 422·NULL ship 422·페이지 경계."""
    from app.core.db import async_session_factory

    st, pid, vs = await _shop(client, stock=9)
    await _fees(client, st)
    bt = await _buyer(client)
    admin_t = await _admin_login(client)

    # 미결제(NULL) sub_order에 ship → 422 (전이표 미정의)
    await client.post("/api/v1/carts/items", json={"variant_id": vs[2]["id"], "quantity": 1}, headers=_auth(bt))
    ids = await _cart_ids(client, bt)
    r = await client.post(
        "/api/v1/orders",
        json={"cart_item_ids": ids, "expected_grand_total": await _expected(client, bt), **ADDRESS}, headers=_auth(bt),
    )
    async with async_session_factory() as session:
        null_sid = str(await session.scalar(select(SubOrder.id).where(SubOrder.order_id == u.UUID(r.json()["order_id"]))))
    res = await client.post(
        f"/api/v1/sellers/sub-orders/{null_sid}/ship",
        json={"carrier": "CJ", "tracking_number": "1"}, headers=_auth(st),
    )
    assert res.status_code == 422 and res.json()["code"] == "invalid_transition"

    # paid 주문에서 관리자 라인 취소로 전-취소 묶음 조성 → all_canceled·유령 발송 가드
    oid, sid = await _paid_order(client, bt, admin_t, vs)
    from app.orders.models import OrderItem as OI

    async with async_session_factory() as session:
        item_id = await session.scalar(select(OI.id).join(SubOrder, OI.sub_order_id == SubOrder.id)
                                       .where(SubOrder.id == u.UUID(sid)))
        await service.cancel_order_item(
            session, order_item_id=item_id, actor_role=t.ROLE_ADMIN, actor_user_id=None,
            reason="판매자 품절", responsibility="seller",
        )
        await session.commit()

    body = (await client.get(ORDERS_URL, headers=_auth(st))).json()
    row = next(r2 for r2 in body["items"] if r2["sub_order_id"] == sid)
    assert row["all_canceled"] is True
    assert row["items"][0]["status"] == "canceled"  # 취소 라인 구분 표시

    res = await client.post(
        f"/api/v1/sellers/sub-orders/{sid}/ship",
        json={"carrier": "CJ대한통운", "tracking_number": "555"}, headers=_auth(st),
    )
    assert res.status_code == 422 and "취소" in res.json()["message"]  # 유령 발송 가드

    # carrier·tracking strip 저장 확인
    oid2, sid2 = await _paid_order(client, bt, admin_t, vs)
    res = await client.post(
        f"/api/v1/sellers/sub-orders/{sid2}/ship",
        json={"carrier": "  CJ대한통운  ", "tracking_number": " 777 "}, headers=_auth(st),
    )
    assert res.status_code == 204
    async with async_session_factory() as session:
        sub = await session.get(SubOrder, u.UUID(sid2))
        assert sub.carrier == "CJ대한통운" and sub.tracking_number == "777"

    # 페이지 경계
    assert (await client.get(ORDERS_URL, params={"page": 0}, headers=_auth(st))).status_code == 422
    assert (await client.get(ORDERS_URL, params={"page": 10001}, headers=_auth(st))).status_code == 422
