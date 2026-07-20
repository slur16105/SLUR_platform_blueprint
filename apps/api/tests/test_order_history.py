"""구매자 주문내역·상세 테스트 (Story 5.1)."""

import uuid as u

import pytest
from sqlalchemy import select

from app.orders import service, transitions as t
from app.orders.models import SubOrder
from tests.test_carts import _buyer, _shop
from tests.test_order_creation import ADDRESS, _cart_ids, _expected, _fees
from tests.test_products import clean_products  # noqa: F401
from tests.test_seller_application import _auth

ORDERS = "/api/v1/orders"


async def _make_order(client, bt) -> tuple[str, str]:
    from app.core.db import async_session_factory

    ids = await _cart_ids(client, bt)
    res = await client.post(
        ORDERS, json={"cart_item_ids": ids, "expected_grand_total": await _expected(client, bt), **ADDRESS}, headers=_auth(bt)
    )
    assert res.status_code == 201
    oid = res.json()["order_id"]
    async with async_session_factory() as session:
        sid = await session.scalar(select(SubOrder.id).where(SubOrder.order_id == u.UUID(oid)))
    return oid, str(sid)


async def _pay(oid: str) -> None:
    from app.core.db import async_session_factory

    async with async_session_factory() as session:
        await service.transition(
            session, layer=t.LAYER_ORDER, entity_id=u.UUID(oid), to_status=t.ORDER_PAID,
            actor_role=t.ROLE_ADMIN, actor_user_id=None,
        )
        await session.commit()


async def _ship(sid: str, to: str = "shipping") -> None:
    from app.core.db import async_session_factory

    async with async_session_factory() as session:
        await service.transition(
            session, layer=t.LAYER_SUB_ORDER, entity_id=u.UUID(sid), to_status="shipping",
            actor_role=t.ROLE_SELLER, actor_user_id=None, carrier="CJ대한통운", tracking_number="9876543210",
        )
        if to == "delivered":
            await service.transition(
                session, layer=t.LAYER_SUB_ORDER, entity_id=u.UUID(sid), to_status="delivered",
                actor_role=t.ROLE_SELLER, actor_user_id=None,
            )
        await session.commit()


@pytest.mark.asyncio
async def test_list_latest_first_and_fields(client, clean_products):
    """AC 1: 최신순·카드 필드·묶음 상태·타인 미노출·미인증 401."""
    st, pid, vs = await _shop(client, stock=9)
    await _fees(client, st)
    bt = await _buyer(client)
    other = await _buyer(client, email="hist-other@example.com")

    await client.post("/api/v1/carts/items", json={"variant_id": vs[0]["id"], "quantity": 1}, headers=_auth(bt))
    o1, _ = await _make_order(client, bt)
    await client.post("/api/v1/carts/items", json={"variant_id": vs[1]["id"], "quantity": 2}, headers=_auth(bt))
    o2, _ = await _make_order(client, bt)

    assert (await client.get(ORDERS)).status_code == 401
    assert (await client.get(ORDERS, headers=_auth(other))).json()["total"] == 0  # 타인 미노출

    body = (await client.get(ORDERS, headers=_auth(bt))).json()
    assert body["total"] == 2 and body["page"] == 1
    assert [i["order_id"] for i in body["items"]] == [o2, o1]  # 최신순
    card = body["items"][0]
    assert card["order_no"] == o2.replace("-", "")[-8:].upper()
    assert card["display_status"] == "awaiting_payment"
    assert card["sub_orders"][0]["display_status"] == "awaiting_payment"
    assert card["grand_total"] == (3000 + vs[1]["extra_price"]) * 2 + 3000
    assert "결 좋은 엽서" in card["title"]

    res = await client.get(ORDERS, params={"page": 0}, headers=_auth(bt))
    assert res.status_code == 422 and res.json()["code"] == "validation_error"


@pytest.mark.asyncio
async def test_derive_matrix(client, clean_products):
    """파생 표: awaiting → preparing → shipping → delivered / 전 취소 canceled."""
    st, pid, vs = await _shop(client, stock=9)
    await _fees(client, st)
    bt = await _buyer(client)
    await client.post("/api/v1/carts/items", json={"variant_id": vs[0]["id"], "quantity": 1}, headers=_auth(bt))
    oid, sid = await _make_order(client, bt)

    async def status():
        d = (await client.get(f"{ORDERS}/{oid}", headers=_auth(bt))).json()
        return d["display_status"], d["sub_orders"][0]["display_status"], d["sub_orders"][0]["cancellable"]

    assert await status() == ("awaiting_payment", "awaiting_payment", True)
    await _pay(oid)
    assert await status() == ("preparing", "preparing", False)  # preparing 진입 → 취소 불가 (AC 3 파생)
    await _ship(sid)
    d = (await client.get(f"{ORDERS}/{oid}", headers=_auth(bt))).json()
    assert d["display_status"] == "shipping"
    assert d["sub_orders"][0]["carrier"] == "CJ대한통운" and d["sub_orders"][0]["tracking_number"] == "9876543210"  # FR-21

    # 별도 주문: 전 취소 → canceled
    await client.post("/api/v1/carts/items", json={"variant_id": vs[1]["id"], "quantity": 1}, headers=_auth(bt))
    oid2, sid2 = await _make_order(client, bt)
    await client.post(f"/api/v1/orders/sub-orders/{sid2}/cancel", headers=_auth(bt))
    d2 = (await client.get(f"{ORDERS}/{oid2}", headers=_auth(bt))).json()
    assert d2["display_status"] == "canceled"
    assert d2["sub_orders"][0]["display_status"] == "canceled" and d2["sub_orders"][0]["cancellable"] is False


@pytest.mark.asyncio
async def test_paid_null_bundle_shows_canceled(client, clean_products):
    """AC 4 (4.3 이월 계약): paid + NULL 배송층(전-취소 묶음) = canceled 표시, 미결제 오해 금지."""
    from app.core.db import async_session_factory, engine
    from sqlalchemy import text

    from tests.test_admin_approval import _admin_token
    from tests.test_products import _category, _product_body, _seller_with_prefix
    from tests.test_variants import GRID

    admin_t = await _admin_token(client)
    cid = await _category(client, admin_t, name="내역다중")
    st1, sid1 = await _seller_with_prefix(client, admin_t)
    pid1 = (await client.post("/api/v1/sellers/products", json=_product_body(sid1, cid), headers=_auth(st1))).json()["id"]
    vs1 = (await client.put(
        f"/api/v1/sellers/products/{pid1}/variants",
        json={"variants": [{**v, "stock": 5} for v in GRID["variants"]]}, headers=_auth(st1),
    )).json()["variants"]
    await _fees(client, st1)
    s2 = await client.post("/api/v1/auth/signup", json={"email": "seller-hist2@example.com", "password": "password123", "name": "판매자2"})
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
    # 브랜드로 묶음 특정 (묶음 순서는 보장 대상 아님) — 첫째 판매자 묶음을 취소
    d0 = (await client.get(f"{ORDERS}/{oid}", headers=_auth(bt))).json()
    by_brand = {s["brand_name"]: s["sub_order_id"] for s in d0["sub_orders"]}
    cancel_sid = next(sid for b, sid in by_brand.items() if b != "둘째굿즈")
    keep_sid = by_brand["둘째굿즈"]

    r = await client.post(f"/api/v1/orders/sub-orders/{cancel_sid}/cancel", headers=_auth(bt))
    assert r.status_code == 200 and r.json()["order_canceled"] is False
    # 부분 취소 후 입금 안내 = 잔여 활성분만 (과입금 방지)
    d = (await client.get(f"{ORDERS}/{oid}", headers=_auth(bt))).json()
    line2 = (3000 + vs2[0]["extra_price"]) * 1
    assert d["deposit_info"]["grand_total"] == line2 + 2500
    assert d["grand_total"] == line2 + 2500

    await _pay(oid)
    d = (await client.get(f"{ORDERS}/{oid}", headers=_auth(bt))).json()
    by_id = {s["sub_order_id"]: s for s in d["sub_orders"]}
    assert by_id[cancel_sid]["display_status"] == "canceled"  # paid+NULL = 취소된 묶음 (AC 4)
    assert by_id[keep_sid]["display_status"] == "preparing"
    assert d["display_status"] == "preparing"  # 대표 상태는 활성 묶음 기준
    assert d["deposit_info"] is None  # paid — 입금 안내 없음


@pytest.mark.asyncio
async def test_detail_snapshot_immutable_and_ownership(client, clean_products):
    """상세: 스냅샷 불변(AD-7)·금액 요약 합계·소유 404."""
    st, pid, vs = await _shop(client, stock=5)
    await _fees(client, st)
    bt = await _buyer(client)
    other = await _buyer(client, email="hist-own@example.com")
    await client.post("/api/v1/carts/items", json={"variant_id": vs[0]["id"], "quantity": 2}, headers=_auth(bt))
    oid, sid = await _make_order(client, bt)

    assert (await client.get(f"{ORDERS}/{oid}", headers=_auth(other))).status_code == 404
    assert (await client.get(f"{ORDERS}/{u.uuid4()}", headers=_auth(bt))).status_code == 404

    await client.patch(f"/api/v1/sellers/products/{pid}", json={"name": "바뀐 이름", "base_price": 9900}, headers=_auth(st))
    d = (await client.get(f"{ORDERS}/{oid}", headers=_auth(bt))).json()
    line = d["sub_orders"][0]["items"][0]
    assert line["product_name"] == "결 좋은 엽서" and line["unit_price"] == 3000  # 스냅샷 불변
    assert d["item_total"] == line["line_total"]
    assert d["grand_total"] == d["item_total"] + d["shipping_total"]
    assert d["recipient_name"] == ADDRESS["recipient_name"]
