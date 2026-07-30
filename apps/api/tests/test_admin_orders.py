"""관리자 주문 개입 테스트 (Story 5.5)."""

import uuid as u

import pytest
from sqlalchemy import select

from app.orders.models import Cancellation, Order, OrderItem, SubOrder
from tests.helpers import ADDRESS, _admin_login, _auth, _buyer, _cart_ids, _expected, _fees, _paid_order, _shop

SEARCH = "/api/v1/admin/orders"


async def _order(client, bt, vs, idx=0, qty=1) -> tuple[str, str, str]:
    from app.core.db import async_session_factory

    await client.post("/api/v1/carts/items", json={"variant_id": vs[idx]["id"], "quantity": qty}, headers=_auth(bt))
    ids = await _cart_ids(client, bt)
    res = await client.post(
        "/api/v1/orders",
        json={"cart_item_ids": ids, "expected_grand_total": await _expected(client, bt), **ADDRESS}, headers=_auth(bt),
    )
    oid = res.json()["order_id"]
    from sqlalchemy import select as sel

    async with async_session_factory() as session:
        sid = str(await session.scalar(sel(SubOrder.id).where(SubOrder.order_id == u.UUID(oid))))
        item_id = str(await session.scalar(sel(OrderItem.id).where(OrderItem.sub_order_id == u.UUID(sid))))
    return oid, sid, item_id


@pytest.mark.asyncio
async def test_search_and_status_filters(client, clean_products):
    """AC 1: 주문번호 8자·이메일·브랜드 검색, status 필터가 display_status와 동치."""
    st, pid, vs = await _shop(client, stock=19)
    await _fees(client, st)
    bt = await _buyer(client)
    admin_t = await _admin_login(client)

    o_pending, _, _ = await _order(client, bt, vs, idx=0)
    o_paid, s_paid = await _paid_order(client, bt, admin_t, vs)  # preparing
    o_ship, s_ship = await _paid_order(client, bt, admin_t, vs)
    await client.post(f"/api/v1/sellers/sub-orders/{s_ship}/ship",
                      json={"carrier": "CJ", "tracking_number": "1"}, headers=_auth(st))
    o_cancel, s_cancel, _ = await _order(client, bt, vs, idx=1)
    await client.post(f"/api/v1/orders/sub-orders/{s_cancel}/cancel", headers=_auth(bt))

    assert (await client.get(SEARCH, headers=_auth(bt))).status_code == 403

    # 검색: 주문번호 8자
    no8 = o_pending.replace("-", "")[-8:].upper()
    body = (await client.get(SEARCH, params={"q": no8}, headers=_auth(admin_t))).json()
    assert [r["order_id"] for r in body["items"]] == [o_pending]
    # 전체 UUID
    body = (await client.get(SEARCH, params={"q": o_paid}, headers=_auth(admin_t))).json()
    assert [r["order_id"] for r in body["items"]] == [o_paid]
    # 이메일 부분 일치
    body = (await client.get(SEARCH, params={"q": "buyer@"}, headers=_auth(admin_t))).json()
    assert body["total"] == 4
    # 브랜드 부분 일치 (_shop 브랜드)
    brand_q = body["items"][0]["sub_orders"][0]["brand_name"][:2]
    assert (await client.get(SEARCH, params={"q": brand_q}, headers=_auth(admin_t))).json()["total"] >= 1
    # q 1자 422
    assert (await client.get(SEARCH, params={"q": "a"}, headers=_auth(admin_t))).status_code == 422
    # 와일드카드 이스케이프 — "%%"가 전 주문 매칭이 되면 안 됨
    assert (await client.get(SEARCH, params={"q": "%%"}, headers=_auth(admin_t))).json()["total"] == 0
    # 페이징 (리뷰 반영): 상한 422 + 빈 2페이지
    assert (await client.get(SEARCH, params={"page": 10001}, headers=_auth(admin_t))).status_code == 422
    p2 = (await client.get(SEARCH, params={"page": 2}, headers=_auth(admin_t))).json()
    assert p2["items"] == [] and p2["total"] == 4 and p2["size"] >= 1

    # status 필터 — 결과의 display_status가 전부 필터 값과 일치 + 기대 주문 포함
    for status, expect_oid in [
        ("awaiting_payment", o_pending), ("preparing", o_paid), ("shipping", o_ship), ("canceled", o_cancel),
    ]:
        body = (await client.get(SEARCH, params={"status": status}, headers=_auth(admin_t))).json()
        assert all(r["display_status"] == status for r in body["items"]), status
        assert expect_oid in [r["order_id"] for r in body["items"]], status


@pytest.mark.asyncio
async def test_paid_fully_canceled_maps_to_canceled_filter(client, clean_products):
    """매핑 표 핵심 케이스: paid 후 전 라인 취소(admin) — canceled 필터·display 정합, delivered 오검색 없음."""
    st, pid, vs = await _shop(client, stock=9)
    await _fees(client, st)
    bt = await _buyer(client)
    admin_t = await _admin_login(client)
    oid, sid, item_id = await _order(client, bt, vs)
    exp = (await client.get(f"/api/v1/orders/{oid}", headers=_auth(bt))).json()["grand_total"]
    await client.post(f"/api/v1/admin/orders/{oid}/confirm-payment",
                      json={"expected_grand_total": exp}, headers=_auth(admin_t))

    r = await client.post(f"/api/v1/admin/order-items/{item_id}/cancel",
                          json={"reason": "판매자 품절", "responsibility": "seller"}, headers=_auth(admin_t))
    assert r.status_code == 200 and r.json()["order_canceled"] is False  # paid — order 층 전이 없음

    body = (await client.get(SEARCH, params={"status": "canceled"}, headers=_auth(admin_t))).json()
    assert oid in [x["order_id"] for x in body["items"]]
    body = (await client.get(SEARCH, params={"status": "delivered"}, headers=_auth(admin_t))).json()
    assert oid not in [x["order_id"] for x in body["items"]]  # 공진리 오검색 방지


@pytest.mark.asyncio
async def test_admin_detail_and_interventions(client, clean_products):
    """AC 1~4: 상세(타임라인·취소기록) / pending 전체 취소 / delivered 후 라인 취소 / refunded 중복."""
    from app.core.db import async_session_factory

    st, pid, vs = await _shop(client, stock=19)
    await _fees(client, st)
    bt = await _buyer(client)
    admin_t = await _admin_login(client)

    # pending 전체 취소 — 복원·order canceled·이벤트
    oid, sid, item_id = await _order(client, bt, vs, qty=2)
    r = await client.post(f"/api/v1/admin/orders/{oid}/cancel",
                          json={"reason": "구매자 요청 대행", "responsibility": "buyer"}, headers=_auth(admin_t))
    assert r.status_code == 200 and r.json()["canceled_items"] == 1
    d = (await client.get(f"/api/v1/admin/orders/{oid}", headers=_auth(admin_t))).json()
    assert d["display_status"] == "canceled" and d["buyer_email"] == "buyer@example.com"
    line = d["sub_orders"][0]["items"][0]
    assert line["cancellation"]["responsibility"] == "buyer" and line["cancellation"]["refunded_at"] is None
    kinds = [(e["entity_type"], e["to_status"], e["actor_role"]) for e in d["events"]]
    assert ("order", "canceled", "admin") in kinds and ("order_item", "canceled", "admin") in kinds
    # 재취소 422
    assert (await client.post(f"/api/v1/admin/orders/{oid}/cancel",
                              json={"reason": "x", "responsibility": "admin"}, headers=_auth(admin_t))).status_code == 422

    # delivered 후 라인 취소 (admin 타이밍 예외) + 재고 복원
    oid2, sid2 = await _paid_order(client, bt, admin_t, vs)
    await client.post(f"/api/v1/sellers/sub-orders/{sid2}/ship",
                      json={"carrier": "CJ", "tracking_number": "9"}, headers=_auth(st))
    await client.post(f"/api/v1/sellers/sub-orders/{sid2}/deliver", headers=_auth(st))
    from sqlalchemy import text

    from app.core.db import engine

    async with engine.begin() as conn:
        before = (await conn.execute(text("SELECT stock FROM variants WHERE id = :v"), {"v": vs[0]["id"]})).scalar_one()
        item2_id = (await conn.execute(text(
            "SELECT id FROM order_items WHERE sub_order_id = :s"), {"s": sid2})).scalar_one()
    r = await client.post(f"/api/v1/admin/order-items/{item2_id}/cancel",
                          json={"reason": "배송 후 환불", "responsibility": "admin"}, headers=_auth(admin_t))
    assert r.status_code == 200
    async with engine.begin() as conn:
        after = (await conn.execute(text("SELECT stock FROM variants WHERE id = :v"), {"v": vs[0]["id"]})).scalar_one()
    assert after == before + 1  # 복원

    # refunded 기록 + 중복 409
    async with async_session_factory() as session:
        can_id = str(await session.scalar(select(Cancellation.id).where(Cancellation.order_item_id == item2_id)))
    assert (await client.post(f"/api/v1/admin/cancellations/{can_id}/refunded", headers=_auth(admin_t))).status_code == 204
    r = await client.post(f"/api/v1/admin/cancellations/{can_id}/refunded", headers=_auth(admin_t))
    assert r.status_code == 409 and r.json()["code"] == "duplicate_request"
    assert (await client.post(f"/api/v1/admin/cancellations/{u.uuid4()}/refunded", headers=_auth(admin_t))).status_code == 404
    d2 = (await client.get(f"/api/v1/admin/orders/{oid2}", headers=_auth(admin_t))).json()
    assert d2["sub_orders"][0]["items"][0]["cancellation"]["refunded_at"] is not None


@pytest.mark.asyncio
async def test_admin_sub_transition_and_guards(client, clean_products):
    """강제 전이 — 송장 없이 422·전-취소 묶음 422(admin도 가드)·정의 밖 전이 422·pending 마지막 라인 취소 정합."""
    st, pid, vs = await _shop(client, stock=19)
    await _fees(client, st)
    bt = await _buyer(client)
    admin_t = await _admin_login(client)
    oid, sid = await _paid_order(client, bt, admin_t, vs)
    from app.core.db import async_session_factory as _asf

    async with _asf() as session:
        item_id = str(await session.scalar(select(OrderItem.id).where(OrderItem.sub_order_id == u.UUID(sid))))

    # 송장 없이 shipping 422
    r = await client.post(f"/api/v1/admin/sub-orders/{sid}/transition",
                          json={"to_status": "shipping"}, headers=_auth(admin_t))
    assert r.status_code == 422
    # 정의 밖 전이 (preparing→delivered) 422
    r = await client.post(f"/api/v1/admin/sub-orders/{sid}/transition",
                          json={"to_status": "delivered"}, headers=_auth(admin_t))
    assert r.status_code == 422
    # 전-취소 묶음 shipping 422 (admin도 가드)
    await client.post(f"/api/v1/admin/order-items/{item_id}/cancel",
                      json={"reason": "품절", "responsibility": "seller"}, headers=_auth(admin_t))
    r = await client.post(f"/api/v1/admin/sub-orders/{sid}/transition",
                          json={"to_status": "shipping", "carrier": "CJ", "tracking_number": "1"}, headers=_auth(admin_t))
    assert r.status_code == 422 and "취소" in r.json()["message"]

    # pending 마지막 라인 취소 → order 자동 canceled (5.2 유령 방지)
    oid2, sid2, item2 = await _order(client, bt, vs, idx=1)
    r = await client.post(f"/api/v1/admin/order-items/{item2}/cancel",
                          json={"reason": "요청", "responsibility": "buyer"}, headers=_auth(admin_t))
    assert r.status_code == 200 and r.json()["order_canceled"] is True
    body = (await client.get("/api/v1/admin/orders/pending", headers=_auth(admin_t))).json()
    assert oid2 not in [x["order_id"] for x in body["items"]]  # 입금대기 목록에서 사라짐


@pytest.mark.asyncio
async def test_period_filter(client, clean_products):
    """기간 필터(period) — 오늘/최근 N일 경계는 KST 자정 기준, 잘못된 값은 422."""
    st, pid, vs = await _shop(client, stock=9)
    await _fees(client, st)
    bt = await _buyer(client)
    admin_t = await _admin_login(client)

    o_today, _, _ = await _order(client, bt, vs, idx=0)
    o_old, _, _ = await _order(client, bt, vs, idx=1)

    # o_old를 40일 전으로 밀어 경계를 실제로 검증한다 (API로는 과거 주문을 만들 수 없음)
    from datetime import datetime, timedelta, timezone

    from app.core.db import async_session_factory

    async with async_session_factory() as session:
        order = await session.scalar(select(Order).where(Order.id == u.UUID(o_old)))
        order.created_at = datetime.now(timezone.utc) - timedelta(days=40)
        await session.commit()

    def ids(body):
        return [r["order_id"] for r in body["items"]]

    # 필터 없음 — 둘 다 보인다
    body = (await client.get(SEARCH, headers=_auth(admin_t))).json()
    assert o_today in ids(body) and o_old in ids(body)

    # today·7d·30d — 오늘 주문만
    for period in ("today", "7d", "30d"):
        body = (await client.get(SEARCH, params={"period": period}, headers=_auth(admin_t))).json()
        assert o_today in ids(body), period
        assert o_old not in ids(body), period

    # 다른 필터와 조합 — 상태 필터가 함께 적용된다
    body = (await client.get(SEARCH, params={"period": "today", "status": "awaiting_payment"},
                             headers=_auth(admin_t))).json()
    assert o_today in ids(body) and o_old not in ids(body)

    # 잘못된 값 422
    assert (await client.get(SEARCH, params={"period": "1y"}, headers=_auth(admin_t))).status_code == 422


@pytest.mark.asyncio
async def test_detail_remote_total_splits_shipping(client, clean_products):
    """상세 응답의 remote_total — shipping_total에 포함된 도서산간 몫이며 합이 어긋나지 않는다."""
    st, pid, vs = await _shop(client, stock=9)
    await _fees(client, st, base=3000, jeju=3000)
    bt = await _buyer(client)
    admin_t = await _admin_login(client)

    # 제주 주소로 주문 — 도서산간 추가비가 실제로 붙는 경로
    await client.post("/api/v1/carts/items", json={"variant_id": vs[0]["id"], "quantity": 1}, headers=_auth(bt))
    ids = await _cart_ids(client, bt)
    jeju = {**ADDRESS, "postal_code": "63001"}
    res = await client.post(
        "/api/v1/orders",
        json={"cart_item_ids": ids, "expected_grand_total": await _expected(client, bt, postal="63001"), **jeju},
        headers=_auth(bt),
    )
    assert res.status_code == 201
    oid = res.json()["order_id"]

    d = (await client.get(f"{SEARCH}/{oid}", headers=_auth(admin_t))).json()
    assert d["remote_total"] == 3000
    # 화면은 "배송비 = shipping_total − remote_total"으로 쪼개 보여준다 — 음수·합 불일치가 없어야 한다
    assert d["shipping_total"] - d["remote_total"] == 3000
    assert d["item_total"] + d["shipping_total"] == d["grand_total"]
    # 묶음별 값과도 대사된다
    assert sum(s["remote_extra_fee"] for s in d["sub_orders"]) == d["remote_total"]
