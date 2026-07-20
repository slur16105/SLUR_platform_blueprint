"""관리자 입금 확인 테스트 (Story 5.2)."""

import asyncio
import uuid as u

import pytest
from sqlalchemy import select

from app.orders.models import Order, OrderEvent, SubOrder
from tests.test_admin_approval import ADMIN
from tests.test_carts import _buyer, _shop
from tests.test_order_creation import ADDRESS, _cart_ids, _expected, _fees
from tests.test_products import clean_products  # noqa: F401
from tests.test_seller_application import _auth

PENDING = "/api/v1/admin/orders/pending"


def _confirm(oid: str) -> str:
    return f"/api/v1/admin/orders/{oid}/confirm-payment"


async def _admin_login(client) -> str:
    """_shop이 admin 가입을 이미 수행하므로 로그인으로 토큰만 받는다."""
    res = await client.post("/api/v1/auth/login", json={"email": ADMIN["email"], "password": ADMIN["password"]})
    assert res.status_code == 200
    return res.json()["access_token"]


async def _make_order(client, bt) -> tuple[str, str]:
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


@pytest.mark.asyncio
async def test_pending_list_fields_and_rbac(client, clean_products):
    """AC 1·2·3: pending만·필드(전체 UUID·8자·buyer·활성 금액·expired)·admin 전용."""
    st, pid, vs = await _shop(client, stock=9)
    await _fees(client, st)
    bt = await _buyer(client)
    admin_t = await _admin_login(client)

    await client.post("/api/v1/carts/items", json={"variant_id": vs[0]["id"], "quantity": 2}, headers=_auth(bt))
    oid, _ = await _make_order(client, bt)

    assert (await client.get(PENDING)).status_code == 401
    assert (await client.get(PENDING, headers=_auth(bt))).status_code == 403  # 구매자 403 (R7)

    body = (await client.get(PENDING, headers=_auth(admin_t))).json()
    assert body["total"] == 1
    row = body["items"][0]
    assert row["order_id"] == oid  # 전체 UUID 병기 (8자 충돌 대응)
    assert row["order_no"] == oid.replace("-", "")[-8:].upper()
    assert row["buyer_email"] == "buyer@example.com" and row["buyer_name"] == "구매자"
    assert row["grand_total"] == (3000 + vs[0]["extra_price"]) * 2 + 3000
    assert row["expired"] is False
    assert "결 좋은 엽서" in row["title"]


@pytest.mark.asyncio
async def test_confirm_transitions_and_cascade(client, clean_products):
    """AC 1: 확인 → paid + preparing 연쇄 + 이벤트(admin·note). 목록에서 제외."""
    from app.core.db import async_session_factory

    st, pid, vs = await _shop(client, stock=9)
    await _fees(client, st)
    bt = await _buyer(client)
    admin_t = await _admin_login(client)
    await client.post("/api/v1/carts/items", json={"variant_id": vs[0]["id"], "quantity": 1}, headers=_auth(bt))
    oid, sid = await _make_order(client, bt)

    grand = (3000 + vs[0]["extra_price"]) * 1 + 3000
    res = await client.post(_confirm(oid), json={"note": "국민은행 입금 확인", "expected_grand_total": grand}, headers=_auth(admin_t))
    assert res.status_code == 204
    async with async_session_factory() as session:
        assert (await session.get(Order, u.UUID(oid))).payment_status == "paid"
        assert (await session.get(SubOrder, u.UUID(sid))).shipping_status == "preparing"  # 연쇄
        ev = await session.scalar(select(OrderEvent).where(
            OrderEvent.order_id == u.UUID(oid), OrderEvent.entity_type == "order", OrderEvent.to_status == "paid"
        ))
        assert ev.actor_role == "admin" and ev.note == "국민은행 입금 확인" and ev.actor_user_id is not None

    assert (await client.get(PENDING, headers=_auth(admin_t))).json()["total"] == 0  # 목록 제외
    # 재확인 422
    res = await client.post(_confirm(oid), json={"expected_grand_total": grand}, headers=_auth(admin_t))
    assert res.status_code == 422 and res.json()["code"] == "invalid_transition"
    # 미존재 404
    assert (await client.post(_confirm(str(u.uuid4())), json={"expected_grand_total": 0}, headers=_auth(admin_t))).status_code == 404
    # 구매자가 확인 시도 403
    assert (await client.post(_confirm(oid), json={"expected_grand_total": grand}, headers=_auth(bt))).status_code == 403


@pytest.mark.asyncio
async def test_fully_canceled_order_rejected_and_partial_amount(client, clean_products):
    """전 라인 취소 주문 확인 422 / 부분 취소 주문 금액 = 잔여 활성분 (입금 대조 정합)."""
    st, pid, vs = await _shop(client, stock=9)
    await _fees(client, st)
    bt = await _buyer(client)
    admin_t = await _admin_login(client)

    # 전 취소 주문
    await client.post("/api/v1/carts/items", json={"variant_id": vs[0]["id"], "quantity": 1}, headers=_auth(bt))
    oid1, sid1 = await _make_order(client, bt)
    await client.post(f"/api/v1/orders/sub-orders/{sid1}/cancel", headers=_auth(bt))
    res = await client.post(_confirm(oid1), json={"expected_grand_total": 0}, headers=_auth(admin_t))
    assert res.status_code == 422 and res.json()["code"] == "invalid_transition"  # order canceled — 전이표 거부

    # 같은 묶음 2라인 주문: 상세는 불가(조합 단위)지만 라인 취소는 관리자 영역 — 여기서는 stale 금액 확인 방지를 검증
    await client.post("/api/v1/carts/items", json={"variant_id": vs[1]["id"], "quantity": 2}, headers=_auth(bt))
    oid2, sid2 = await _make_order(client, bt)
    body = (await client.get(PENDING, headers=_auth(admin_t))).json()
    row = next(r for r in body["items"] if r["order_id"] == oid2)
    full = (3000 + vs[1]["extra_price"]) * 2 + 3000
    assert row["grand_total"] == full
    assert body["size"] >= 1  # size 필드 (클라 페이지 계산용)

    # stale 금액으로 확인 시도 → 409 price_changed (구매자가 그 사이 취소해 잔여 0)
    await client.post(f"/api/v1/orders/sub-orders/{sid2}/cancel", headers=_auth(bt))
    # 취소로 order도 canceled — 전이표 422 (부분 취소 잔여 금액·409는 아래 2판매자 테스트가 실검증)
    res = await client.post(_confirm(oid2), json={"expected_grand_total": full}, headers=_auth(admin_t))
    assert res.status_code in (409, 422)  # canceled면 전이표 422, 잔여 변경이면 409 — 여기선 전 취소라 422


@pytest.mark.asyncio
async def test_concurrent_confirm_vs_buyer_cancel(client, clean_products):
    """동시성: 입금 확인 vs 구매자 취소 — 정합 종착 상태 (4.6 대칭)."""
    st, pid, vs = await _shop(client, stock=9)
    await _fees(client, st)
    bt = await _buyer(client)
    admin_t = await _admin_login(client)
    await client.post("/api/v1/carts/items", json={"variant_id": vs[0]["id"], "quantity": 1}, headers=_auth(bt))
    oid, sid = await _make_order(client, bt)

    r_cancel, r_confirm = await asyncio.wait_for(asyncio.gather(
        client.post(f"/api/v1/orders/sub-orders/{sid}/cancel", headers=_auth(bt)),
        client.post(_confirm(oid), json={}, headers=_auth(admin_t)),
    ), timeout=10)

    from app.core.db import async_session_factory

    async with async_session_factory() as session:
        order = await session.get(Order, u.UUID(oid))
        sub = await session.get(SubOrder, u.UUID(sid))
    assert (order.payment_status, sub.shipping_status) in [
        ("canceled", None),        # 취소 선행 — 확인은 422
        ("paid", "preparing"),     # 확인 선행 — 취소는 422
    ]
    codes = sorted([r_cancel.status_code, r_confirm.status_code])
    assert codes[0] in (200, 204) and codes[1] == 422


@pytest.mark.asyncio
async def test_partial_cancel_amount_and_price_changed(client, clean_products):
    """리뷰 F5·F3: 2판매자 주문 부분 취소 → 목록 금액 = 잔여 활성분, stale 금액 확인은 409."""
    from app.core.db import engine
    from sqlalchemy import text

    from tests.test_admin_approval import _admin_token
    from tests.test_products import _category, _product_body, _seller_with_prefix
    from tests.test_variants import GRID

    admin_t = await _admin_token(client)
    cid = await _category(client, admin_t, name="입금부분")
    st1, sid1 = await _seller_with_prefix(client, admin_t)
    pid1 = (await client.post("/api/v1/sellers/products", json=_product_body(sid1, cid), headers=_auth(st1))).json()["id"]
    vs1 = (await client.put(
        f"/api/v1/sellers/products/{pid1}/variants",
        json={"variants": [{**v, "stock": 5} for v in GRID["variants"]]}, headers=_auth(st1),
    )).json()["variants"]
    await _fees(client, st1)
    s2 = await client.post("/api/v1/auth/signup", json={"email": "seller-pay2@example.com", "password": "password123", "name": "판매자2"})
    t2raw, r2 = s2.json()["access_token"], s2.json()["refresh_token"]
    app2 = await client.post("/api/v1/sellers/applications", json={
        "company_name": "둘째상회", "representative_name": "김둘", "business_registration_number": "2208162517",
        "mail_order_number": "제2026-서울-0009호", "business_address": "서울", "contact_phone": "01099998888",
        "brand_name": "둘째굿즈", "brand_intro": "두 번째 브랜드"}, headers=_auth(t2raw))
    await client.post(f"/api/v1/admin/seller-applications/{app2.json()['id']}/approve", headers=_auth(admin_t))
    t2 = (await client.post("/api/v1/auth/refresh", json={"refresh_token": r2})).json()["access_token"]
    async with engine.begin() as conn:
        sid2v = str((await conn.execute(text("SELECT id FROM sellers WHERE brand_name = '둘째굿즈'"))).scalar_one())
    pid2 = (await client.post("/api/v1/sellers/products", json=_product_body(sid2v, cid), headers=_auth(t2))).json()["id"]
    vs2 = (await client.put(
        f"/api/v1/sellers/products/{pid2}/variants",
        json={"variants": [{**v, "stock": 5} for v in GRID["variants"]]}, headers=_auth(t2),
    )).json()["variants"]
    await _fees(client, t2, base=2500)

    bt = await _buyer(client)
    await client.post("/api/v1/carts/items", json={"variant_id": vs1[0]["id"], "quantity": 1}, headers=_auth(bt))
    await client.post("/api/v1/carts/items", json={"variant_id": vs2[0]["id"], "quantity": 1}, headers=_auth(bt))
    oid, _ = await _make_order(client, bt)

    full = (await client.get(PENDING, headers=_auth(admin_t))).json()["items"][0]["grand_total"]
    # 첫째 판매자 묶음만 취소 (부분 취소)
    d0 = (await client.get(f"/api/v1/orders/{oid}", headers=_auth(bt))).json()
    cancel_sid = next(sv["sub_order_id"] for sv in d0["sub_orders"] if sv["brand_name"] != "둘째굿즈")
    await client.post(f"/api/v1/orders/sub-orders/{cancel_sid}/cancel", headers=_auth(bt))

    row = (await client.get(PENDING, headers=_auth(admin_t))).json()["items"][0]
    remaining = (3000 + vs2[0]["extra_price"]) + 2500
    assert row["grand_total"] == remaining and row["grand_total"] < full  # 잔여 활성분

    # stale(부분 취소 전) 금액으로 확인 → 409 price_changed + 새 금액
    res = await client.post(_confirm(oid), json={"expected_grand_total": full}, headers=_auth(admin_t))
    assert res.status_code == 409 and res.json()["code"] == "price_changed"
    assert res.json()["details"][0]["grand_total"] == remaining
    # 갱신 금액으로 확인 → 성공
    res = await client.post(_confirm(oid), json={"expected_grand_total": remaining}, headers=_auth(admin_t))
    assert res.status_code == 204
