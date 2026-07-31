"""반품·교환 (오픈 게이트 P0 · 법정 의무).

검증의 축은 셋이다: 기한(청약철회 7일/30일) · 수량(부분 반품·중복 방지) · 소유 경계.
"""

import uuid as _uuid
from datetime import timedelta

import pytest
from sqlalchemy import select, text

from app.core.db import async_session_factory
from app.orders.models import OrderItem, SubOrder
from tests.helpers import _admin_login, _auth, _buyer, _fees, _paid_order, _shop


async def _delivered_sub(client, qty=2):
    """배송 완료 상태의 묶음을 만든다 — 반품은 배송 후에만 가능하다."""
    st, _pid, vs = await _shop(client, stock=9)
    await _fees(client, st)
    bt = await _buyer(client)
    admin_t = await _admin_login(client)
    oid, sid = await _paid_order(client, bt, admin_t, vs, qty=qty)
    await client.post(f"/api/v1/sellers/sub-orders/{sid}/ship",
                      json={"carrier": "CJ대한통운", "tracking_number": "1234"}, headers=_auth(st))
    await client.post(f"/api/v1/sellers/sub-orders/{sid}/deliver", headers=_auth(st))
    async with async_session_factory() as session:
        item = await session.scalar(select(OrderItem).where(OrderItem.sub_order_id == _uuid.UUID(sid)))
        item_id, item_qty = str(item.id), item.quantity
    return bt, admin_t, st, sid, item_id, item_qty


def _body(sid, item_id, qty=1, **over):
    return {
        "sub_order_id": sid, "kind": "return", "reason": "change_of_mind",
        "detail": "색상이 생각과 달라요.", "items": [{"order_item_id": item_id, "quantity": qty}],
        **over,
    }


@pytest.mark.asyncio
async def test_request_after_delivery(client, clean_products):
    bt, _admin_t, _st, sid, item_id, _q = await _delivered_sub(client)
    res = await client.post("/api/v1/returns", json=_body(sid, item_id), headers=_auth(bt))
    assert res.status_code == 201
    body = res.json()
    assert body["status"] == "requested" and body["items"][0]["quantity"] == 1

    mine = (await client.get("/api/v1/returns", headers=_auth(bt))).json()
    assert mine["total"] == 1


@pytest.mark.asyncio
async def test_cannot_request_before_delivery(client, clean_products):
    """배송 전에는 반품이 아니라 취소다 — 경로를 섞지 않는다."""
    st, _pid, vs = await _shop(client, stock=9)
    await _fees(client, st)
    bt = await _buyer(client)
    admin_t = await _admin_login(client)
    _oid, sid = await _paid_order(client, bt, admin_t, vs)  # preparing 상태
    async with async_session_factory() as session:
        item = await session.scalar(select(OrderItem).where(OrderItem.sub_order_id == _uuid.UUID(sid)))
        item_id = str(item.id)

    res = await client.post("/api/v1/returns", json=_body(sid, item_id), headers=_auth(bt))
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_window_expired(client, clean_products):
    """단순 변심은 배송 완료 후 7일까지 — 지나면 거부한다(서버가 판정)."""
    bt, _admin_t, _st, sid, item_id, _q = await _delivered_sub(client)
    async with async_session_factory() as session:
        await session.execute(
            text("UPDATE sub_orders SET delivered_at = delivered_at - interval '8 days' WHERE id = :sid"),
            {"sid": sid},
        )
        await session.commit()

    res = await client.post("/api/v1/returns", json=_body(sid, item_id), headers=_auth(bt))
    assert res.status_code == 422
    assert res.json()["code"] == "return_window_expired"

    # 하자는 30일 — 같은 시점에도 신청된다
    ok = await client.post("/api/v1/returns", json=_body(sid, item_id, reason="defect"), headers=_auth(bt))
    assert ok.status_code == 201


@pytest.mark.asyncio
async def test_quantity_limit_and_duplicate(client, clean_products):
    """주문 수량을 넘겨 신청할 수 없고, 처리 중 신청이 있으면 중복 신청도 막는다."""
    bt, _admin_t, _st, sid, item_id, qty = await _delivered_sub(client, qty=2)

    over = await client.post("/api/v1/returns", json=_body(sid, item_id, qty=qty + 1), headers=_auth(bt))
    assert over.status_code == 422

    first = await client.post("/api/v1/returns", json=_body(sid, item_id, qty=1), headers=_auth(bt))
    assert first.status_code == 201
    dup = await client.post("/api/v1/returns", json=_body(sid, item_id, qty=1), headers=_auth(bt))
    assert dup.status_code == 409


@pytest.mark.asyncio
async def test_others_order_hidden(client, clean_products):
    bt, _admin_t, _st, sid, item_id, _q = await _delivered_sub(client)
    other = await _buyer(client, email="return-other@example.com")
    res = await client.post("/api/v1/returns", json=_body(sid, item_id), headers=_auth(other))
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_admin_flow_approve_and_complete(client, clean_products):
    """요청 → 승인 → 완료(환불 금액 기록). 완료 후에는 더 처리할 수 없다."""
    bt, admin_t, _st, sid, item_id, _q = await _delivered_sub(client)
    rid = (await client.post("/api/v1/returns", json=_body(sid, item_id), headers=_auth(bt))).json()["id"]

    pending = (await client.get("/api/v1/admin/returns?status=requested", headers=_auth(admin_t))).json()
    assert pending["total"] == 1 and pending["items"][0]["buyer_email"]

    ap = await client.post(f"/api/v1/admin/returns/{rid}/approve", json={"note": "회수 진행"}, headers=_auth(admin_t))
    assert ap.status_code == 200 and ap.json()["status"] == "approved"

    done = await client.post(
        f"/api/v1/admin/returns/{rid}/complete", json={"refund_amount": 12000, "note": "계좌 환불"},
        headers=_auth(admin_t),
    )
    assert done.status_code == 200
    assert done.json()["status"] == "completed" and done.json()["refund_amount"] == 12000

    again = await client.post(f"/api/v1/admin/returns/{rid}/approve", json={}, headers=_auth(admin_t))
    assert again.status_code == 422  # 종결 건 재처리 불가

    mine = (await client.get(f"/api/v1/returns/{rid}", headers=_auth(bt))).json()
    assert mine["status"] == "completed" and mine["refund_amount"] == 12000


@pytest.mark.asyncio
async def test_complete_requires_amount(client, clean_products):
    """환불 금액 없이 완료 처리할 수 없다 — 없으면 나중에 정산·세무에서 답할 데이터가 없다."""
    bt, admin_t, _st, sid, item_id, _q = await _delivered_sub(client)
    rid = (await client.post("/api/v1/returns", json=_body(sid, item_id), headers=_auth(bt))).json()["id"]
    await client.post(f"/api/v1/admin/returns/{rid}/approve", json={}, headers=_auth(admin_t))

    res = await client.post(f"/api/v1/admin/returns/{rid}/complete", json={}, headers=_auth(admin_t))
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_rejected_allows_new_request(client, clean_products):
    """거부된 신청은 수량 계산에서 빠진다 — 다시 신청할 수 있어야 한다."""
    bt, admin_t, _st, sid, item_id, _q = await _delivered_sub(client)
    rid = (await client.post("/api/v1/returns", json=_body(sid, item_id), headers=_auth(bt))).json()["id"]
    await client.post(f"/api/v1/admin/returns/{rid}/reject", json={"note": "사용 흔적"}, headers=_auth(admin_t))

    again = await client.post("/api/v1/returns", json=_body(sid, item_id), headers=_auth(bt))
    assert again.status_code == 201


@pytest.mark.asyncio
async def test_admin_only(client, clean_products):
    bt, _admin_t, _st, sid, item_id, _q = await _delivered_sub(client)
    rid = (await client.post("/api/v1/returns", json=_body(sid, item_id), headers=_auth(bt))).json()["id"]
    assert (await client.get("/api/v1/admin/returns", headers=_auth(bt))).status_code == 403
    assert (await client.post(f"/api/v1/admin/returns/{rid}/approve", json={}, headers=_auth(bt))).status_code == 403


@pytest.mark.asyncio
async def test_delivered_at_recorded(client, clean_products):
    """배송 완료 시각이 남아야 기한을 판정할 수 있다."""
    _bt, _admin_t, _st, sid, _item_id, _q = await _delivered_sub(client)
    async with async_session_factory() as session:
        sub = await session.scalar(select(SubOrder).where(SubOrder.id == _uuid.UUID(sid)))
        assert sub.delivered_at is not None
