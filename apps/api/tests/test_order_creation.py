"""주문 생성 테스트 (Story 4.4)."""

import asyncio
import uuid as u
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select, text

from app.orders.models import Order, OrderEvent, OrderItem, SubOrder
from tests.test_carts import _buyer, _shop
from tests.test_products import clean_products  # noqa: F401
from tests.test_seller_application import _auth

ORDERS = "/api/v1/orders"
ADDRESS = {
    "postal_code": "06236", "recipient_name": "김수령", "recipient_phone": "01012345678",
    "address1": "서울시 강남구 테헤란로 1", "address2": "101호", "order_note": "문 앞에 놓아주세요",
}


async def _fees(client, st, base=3000, jeju=3000, island=5000):
    res = await client.put(
        "/api/v1/sellers/me/shipping-fees",
        json={"base_shipping_fee": base, "jeju_extra_fee": jeju, "island_extra_fee": island}, headers=_auth(st),
    )
    assert res.status_code == 200


async def _cart_ids(client, bt) -> list[str]:
    cart = (await client.get("/api/v1/carts", headers=_auth(bt))).json()
    return [i["id"] for i in cart["items"] if i["purchasable"]]


async def _stock(variant_id: str) -> int:
    from app.core.db import engine

    async with engine.begin() as conn:
        return (await conn.execute(text("SELECT stock FROM variants WHERE id = :v"), {"v": variant_id})).scalar_one()


@pytest.mark.asyncio
async def test_create_order_snapshots_and_cart_cleanup(client, clean_products):
    """AC 1·2·3: 스냅샷 행·재고 차감·장바구니 삭제·창생 이벤트·입금 안내."""
    from app.core.db import async_session_factory

    st, pid, vs = await _shop(client, stock=5)
    await _fees(client, st)
    bt = await _buyer(client)
    await client.post("/api/v1/carts/items", json={"variant_id": vs[0]["id"], "quantity": 2}, headers=_auth(bt))
    ids = await _cart_ids(client, bt)

    res = await client.post(ORDERS, json={"cart_item_ids": ids, **ADDRESS}, headers=_auth(bt))
    assert res.status_code == 201
    body = res.json()
    line = (3000 + vs[0]["extra_price"]) * 2
    assert body["grand_total"] == line + 3000
    assert body["deposit_account"]  # settings 값 존재
    due = datetime.fromisoformat(body["deposit_due_at"])
    assert timedelta(days=2, hours=23) < due - datetime.now(timezone.utc) < timedelta(days=3, hours=1)  # now+3일

    assert await _stock(vs[0]["id"]) == 3  # 5 - 2 차감
    assert (await client.get("/api/v1/carts", headers=_auth(bt))).json()["items"] == []  # 삭제 (AD-10)

    async with async_session_factory() as session:
        order = await session.get(Order, u.UUID(body["order_id"]))
        assert order.payment_status == "pending_payment" and order.recipient_name == "김수령"
        subs = list(await session.scalars(select(SubOrder).where(SubOrder.order_id == order.id)))
        assert len(subs) == 1 and subs[0].shipping_fee == 3000 and subs[0].remote_extra_fee == 0
        assert subs[0].shipping_status is None  # 결제 전 NULL
        items = list(await session.scalars(select(OrderItem).where(OrderItem.sub_order_id == subs[0].id)))
        assert len(items) == 1
        it = items[0]
        assert it.product_name == "결 좋은 엽서" and it.unit_price == 3000
        assert it.extra_price == vs[0]["extra_price"] and it.quantity == 2  # 분리 스냅샷 (AD-7)
        events = list(await session.scalars(select(OrderEvent).where(OrderEvent.order_id == order.id)))
        assert len(events) == 1
        assert events[0].entity_type == "order" and events[0].from_status is None
        assert events[0].to_status == "pending_payment" and events[0].actor_role == "buyer"


@pytest.mark.asyncio
async def test_create_order_jeju_snapshot(client, clean_products):
    """제주 배송지 — remote_extra_fee가 sub_orders에 스냅샷 (AD-11)."""
    from app.core.db import async_session_factory

    st, pid, vs = await _shop(client, stock=5)
    await _fees(client, st)
    bt = await _buyer(client)
    await client.post("/api/v1/carts/items", json={"variant_id": vs[0]["id"], "quantity": 1}, headers=_auth(bt))
    ids = await _cart_ids(client, bt)
    res = await client.post(ORDERS, json={"cart_item_ids": ids, **{**ADDRESS, "postal_code": "63001"}}, headers=_auth(bt))
    assert res.status_code == 201
    async with async_session_factory() as session:
        sub = await session.scalar(select(SubOrder).where(SubOrder.order_id == u.UUID(res.json()["order_id"])))
        assert sub.shipping_fee == 3000 and sub.remote_extra_fee == 3000


@pytest.mark.asyncio
async def test_multi_seller_sub_orders(client, clean_products):
    """AC 1 (FR-15): 판매자 2명 → sub_orders 2행, 배송비 각각 스냅샷."""
    from app.core.db import async_session_factory, engine
    from tests.test_admin_approval import _admin_token
    from tests.test_products import _category, _product_body, _seller_with_prefix
    from tests.test_variants import GRID

    admin_t = await _admin_token(client)
    cid = await _category(client, admin_t, name="주문다중")
    st1, sid1 = await _seller_with_prefix(client, admin_t)
    pid1 = (await client.post("/api/v1/sellers/products", json=_product_body(sid1, cid), headers=_auth(st1))).json()["id"]
    vs1 = (await client.put(
        f"/api/v1/sellers/products/{pid1}/variants",
        json={"variants": [{**v, "stock": 5} for v in GRID["variants"]]}, headers=_auth(st1),
    )).json()["variants"]
    await _fees(client, st1, base=3000)
    # 제2 판매자 (preview 테스트 관례)
    s2 = await client.post("/api/v1/auth/signup", json={"email": "seller-order2@example.com", "password": "password123", "name": "판매자2"})
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
    await _fees(client, t2, base=2500)

    bt = await _buyer(client)
    await client.post("/api/v1/carts/items", json={"variant_id": vs1[0]["id"], "quantity": 1}, headers=_auth(bt))
    await client.post("/api/v1/carts/items", json={"variant_id": vs2[0]["id"], "quantity": 2}, headers=_auth(bt))
    ids = await _cart_ids(client, bt)
    res = await client.post(ORDERS, json={"cart_item_ids": ids, **ADDRESS}, headers=_auth(bt))
    assert res.status_code == 201

    async with async_session_factory() as session:
        subs = list(await session.scalars(select(SubOrder).where(SubOrder.order_id == u.UUID(res.json()["order_id"]))))
        assert len(subs) == 2
        assert sorted(s.shipping_fee for s in subs) == [2500, 3000]  # 판매자별 각각 스냅샷


@pytest.mark.asyncio
async def test_out_of_stock_rolls_back_everything(client, clean_products):
    """AC 4: 재고 부족 — 전체 미생성, 재고 원복, 장바구니 보존, details 특정 (복수)."""
    from app.core.db import async_session_factory

    st, pid, vs = await _shop(client, stock=5)
    await _fees(client, st)
    bt = await _buyer(client)
    await client.post("/api/v1/carts/items", json={"variant_id": vs[0]["id"], "quantity": 3}, headers=_auth(bt))
    await client.post("/api/v1/carts/items", json={"variant_id": vs[1]["id"], "quantity": 2}, headers=_auth(bt))
    ids = await _cart_ids(client, bt)
    assert len(ids) == 2

    # 두 조합 모두 주문 직전 재고 하락 (비-레이스 조성) → 술어 재검증이 복수 details로 잡는다
    from sqlalchemy import update as sa_update

    from app.products.models import Variant

    async with async_session_factory() as session:
        await session.execute(sa_update(Variant).where(Variant.id.in_([u.UUID(vs[0]["id"]), u.UUID(vs[1]["id"])])).values(stock=1))
        await session.commit()

    res = await client.post(ORDERS, json={"cart_item_ids": ids, **ADDRESS}, headers=_auth(bt))
    assert res.status_code == 422 and res.json()["code"] == "out_of_stock"
    assert len(res.json()["details"]) == 2  # 복수 특정

    async with async_session_factory() as session:
        assert (await session.scalar(select(Order))) is None  # 전체 미생성
    assert await _stock(vs[0]["id"]) == 1 and await _stock(vs[1]["id"]) == 1  # 원복(차감 안 됨)
    assert len(await _cart_ids(client, bt)) == 0 or len((await client.get("/api/v1/carts", headers=_auth(bt))).json()["items"]) == 2  # 장바구니 보존


@pytest.mark.asyncio
async def test_concurrent_orders_stock_one(client, clean_products):
    """AC 5: 재고 1, 두 구매자 동시 주문 — 정확히 1명 성공, 재고 0 (음수 아님)."""
    st, pid, vs = await _shop(client, stock=1)
    await _fees(client, st)
    b1 = await _buyer(client, email="race1@example.com")
    b2 = await _buyer(client, email="race2@example.com")
    vid = vs[0]["id"]
    await client.post("/api/v1/carts/items", json={"variant_id": vid, "quantity": 1}, headers=_auth(b1))
    await client.post("/api/v1/carts/items", json={"variant_id": vid, "quantity": 1}, headers=_auth(b2))
    ids1, ids2 = await _cart_ids(client, b1), await _cart_ids(client, b2)

    r1, r2 = await asyncio.gather(
        client.post(ORDERS, json={"cart_item_ids": ids1, **ADDRESS}, headers=_auth(b1)),
        client.post(ORDERS, json={"cart_item_ids": ids2, **ADDRESS}, headers=_auth(b2)),
    )
    codes = sorted([r1.status_code, r2.status_code])
    assert codes == [201, 422]  # 정확히 1명
    loser = r1 if r1.status_code == 422 else r2
    assert loser.json()["code"] == "out_of_stock"
    assert await _stock(vid) == 0  # 음수 아님


@pytest.mark.asyncio
async def test_snapshot_immutable_after_seller_changes(client, clean_products):
    """AD-7: 주문 후 상품명·가격 수정·조합 삭제에도 스냅샷 불변."""
    from app.core.db import async_session_factory

    st, pid, vs = await _shop(client, stock=5)
    await _fees(client, st)
    bt = await _buyer(client)
    await client.post("/api/v1/carts/items", json={"variant_id": vs[0]["id"], "quantity": 1}, headers=_auth(bt))
    ids = await _cart_ids(client, bt)
    order_id = (await client.post(ORDERS, json={"cart_item_ids": ids, **ADDRESS}, headers=_auth(bt))).json()["order_id"]

    # 판매자 변경: 이름·가격 수정 + 전 조합 교체(기존 조합 삭제 → order_items.variant_id SET NULL)
    await client.patch(f"/api/v1/sellers/products/{pid}", json={"name": "바뀐 이름", "base_price": 9900}, headers=_auth(st))
    await client.put(
        f"/api/v1/sellers/products/{pid}/variants",
        json={"variants": [{"option1_name": "색상", "option1_value": "화이트", "option2_name": "", "option2_value": "",
                            "extra_price": 0, "stock": 1, "is_active": True}]},
        headers=_auth(st),
    )
    async with async_session_factory() as session:
        item = await session.scalar(
            select(OrderItem).join(SubOrder, OrderItem.sub_order_id == SubOrder.id).where(SubOrder.order_id == u.UUID(order_id))
        )
        assert item.product_name == "결 좋은 엽서" and item.unit_price == 3000  # 스냅샷 불변
        assert item.variant_id is None  # SET NULL — 복원 no-op 대상 (4.2 결정 ②)


@pytest.mark.asyncio
async def test_validation_and_auth(client, clean_products):
    """요청 검증: 타인/없는 cart id 404, 빈 목록·필드 형식 422, 미인증 401."""
    st, pid, vs = await _shop(client, stock=5)
    bt = await _buyer(client)
    other = await _buyer(client, email="other-order@example.com")
    await client.post("/api/v1/carts/items", json={"variant_id": vs[0]["id"], "quantity": 1}, headers=_auth(bt))
    ids = await _cart_ids(client, bt)

    assert (await client.post(ORDERS, json={"cart_item_ids": ids, **ADDRESS})).status_code == 401
    # 타인의 장바구니 항목 id → 404 (존재 노출 방지)
    res = await client.post(ORDERS, json={"cart_item_ids": ids, **ADDRESS}, headers=_auth(other))
    assert res.status_code == 404
    # 없는 id 혼입 → 404
    res = await client.post(ORDERS, json={"cart_item_ids": ids + [str(u.uuid4())], **ADDRESS}, headers=_auth(bt))
    assert res.status_code == 404
    # 형식 위반 422
    for bad in ({"cart_item_ids": []}, {"postal_code": "123"}, {"recipient_phone": "abc"}, {"recipient_name": ""}):
        res = await client.post(ORDERS, json={"cart_item_ids": ids, **ADDRESS, **bad}, headers=_auth(bt))
        assert res.status_code == 422 and res.json()["code"] == "validation_error"


@pytest.mark.asyncio
async def test_unpurchasable_requested_item_fails_whole_order(client, clean_products):
    """부분 주문 서프라이즈 방지: 요청 항목 중 숨김 상품이 생기면 전체 실패 + details."""
    st, pid, vs = await _shop(client, stock=5)
    await _fees(client, st)
    bt = await _buyer(client)
    await client.post("/api/v1/carts/items", json={"variant_id": vs[0]["id"], "quantity": 1}, headers=_auth(bt))
    ids = await _cart_ids(client, bt)
    await client.patch(f"/api/v1/sellers/products/{pid}", json={"status": "hidden"}, headers=_auth(st))

    res = await client.post(ORDERS, json={"cart_item_ids": ids, **ADDRESS}, headers=_auth(bt))
    assert res.status_code == 422 and res.json()["code"] == "out_of_stock"
    assert res.json()["details"][0]["cart_item_id"] == ids[0]
    from app.core.db import async_session_factory

    async with async_session_factory() as session:
        assert (await session.scalar(select(Order))) is None
