"""표준 커머스 잔여 항목 — 조건부 무료배송·정산 계좌·SKU·재고 원장·분할배송.

각각 "없으면 실서비스에서 바로 체감되는" 것들이라 동작을 봉인해 둔다.
"""

import uuid as _uuid

import pytest
from sqlalchemy import select

from app.core.db import async_session_factory
from app.orders import service as orders_service
from app.orders.shipment_models import Shipment
from app.products.inventory_models import InventoryTransaction
from tests.helpers import _admin_login, _auth, _buyer, _cart_ids, _expected, _fees, _paid_order, _shop, ADDRESS


@pytest.mark.asyncio
async def test_free_shipping_threshold(client, clean_products):
    """기준 이상이면 기본 배송비 면제 — 단, 도서산간 추가비는 면제하지 않는다."""
    st, _pid, vs = await _shop(client, stock=9)
    await _fees(client, st, base=3000, jeju=3000, island=5000)
    bt = await _buyer(client)

    # 상품가 3,000원 × 2 = 6,000원. 기준을 5,000원으로 잡으면 기본 배송비가 빠진다.
    res = await client.put(
        "/api/v1/sellers/me/shipping-fees",
        json={"base_shipping_fee": 3000, "jeju_extra_fee": 3000, "island_extra_fee": 5000,
              "free_shipping_threshold": 5000},
        headers=_auth(st),
    )
    assert res.status_code == 200 and res.json()["free_shipping_threshold"] == 5000

    await client.post("/api/v1/carts/items", json={"variant_id": vs[0]["id"], "quantity": 2}, headers=_auth(bt))
    quote = (await client.post("/api/v1/orders/preview", json={"postal_code": "06236"}, headers=_auth(bt))).json()
    assert quote["shipping_total"] == 0, "기준 이상이면 기본 배송비 면제"

    # 제주는 추가비가 그대로 남는다 — 실제 추가 운임이 나가는 비용이다
    jeju = (await client.post("/api/v1/orders/preview", json={"postal_code": "63000"}, headers=_auth(bt))).json()
    assert jeju["shipping_total"] == 0 and jeju["remote_extra_total"] > 0


@pytest.mark.asyncio
async def test_threshold_below_keeps_fee(client, clean_products):
    """기준 미만이면 그대로 부과."""
    st, _pid, vs = await _shop(client, stock=9)
    await _fees(client, st, base=3000)
    bt = await _buyer(client, email="threshold-below@example.com")
    await client.put(
        "/api/v1/sellers/me/shipping-fees",
        json={"base_shipping_fee": 3000, "jeju_extra_fee": 3000, "island_extra_fee": 5000,
              "free_shipping_threshold": 50000},
        headers=_auth(st),
    )
    await client.post("/api/v1/carts/items", json={"variant_id": vs[0]["id"], "quantity": 1}, headers=_auth(bt))
    quote = (await client.post("/api/v1/orders/preview", json={"postal_code": "06236"}, headers=_auth(bt))).json()
    assert quote["shipping_total"] == 3000


@pytest.mark.asyncio
async def test_payout_account(client, clean_products):
    """정산 지급 계좌 — 중개 모델에서 대금을 넘기려면 필수."""
    st, _pid, _vs = await _shop(client)
    res = await client.put(
        "/api/v1/sellers/me/payout-account",
        json={"payout_bank": "국민은행", "payout_account_no": "123456-78-901234", "payout_holder": "오이뮤"},
        headers=_auth(st),
    )
    assert res.status_code == 200
    me = (await client.get("/api/v1/sellers/me", headers=_auth(st))).json()
    assert me["payout_bank"] == "국민은행" and me["payout_holder"] == "오이뮤"


@pytest.mark.asyncio
async def test_inventory_ledger_records_order_and_cancel(client, clean_products):
    """재고가 왜 줄었는지 답할 수 있어야 한다 — 주문 차감·취소 복원이 원장에 남는다."""
    st, _pid, vs = await _shop(client, stock=9)
    await _fees(client, st)
    bt = await _buyer(client, email="inv-ledger@example.com")
    await client.post("/api/v1/carts/items", json={"variant_id": vs[0]["id"], "quantity": 2}, headers=_auth(bt))
    ids = await _cart_ids(client, bt)
    oid = (await client.post("/api/v1/orders", json={
        "cart_item_ids": ids, "expected_grand_total": await _expected(client, bt), **ADDRESS,
    }, headers=_auth(bt))).json()["order_id"]

    async with async_session_factory() as session:
        rows = list(await session.scalars(
            select(InventoryTransaction).where(InventoryTransaction.variant_id == _uuid.UUID(vs[0]["id"]))
        ))
    assert len(rows) == 1
    assert rows[0].delta == -2 and rows[0].reason == "order"
    assert rows[0].stock_after == 7, "기록 시점 재고 — 실사 대조의 기준"
    assert rows[0].order_id == _uuid.UUID(oid)

    # 취소 → 복원도 남는다
    detail = (await client.get(f"/api/v1/orders/{oid}", headers=_auth(bt))).json()
    sid = detail["sub_orders"][0]["sub_order_id"]
    await client.post(f"/api/v1/orders/sub-orders/{sid}/cancel", headers=_auth(bt))

    async with async_session_factory() as session:
        rows = list(await session.scalars(
            select(InventoryTransaction)
            .where(InventoryTransaction.variant_id == _uuid.UUID(vs[0]["id"]))
            .order_by(InventoryTransaction.created_at)
        ))
    assert len(rows) == 2
    assert rows[1].delta == 2 and rows[1].reason == "cancel" and rows[1].stock_after == 9


@pytest.mark.asyncio
async def test_split_shipment(client, clean_products):
    """분할배송 — 2박스로 나눠 보내도 송장이 덮이지 않고 둘 다 남는다."""
    st, _pid, vs = await _shop(client, stock=9)
    await _fees(client, st)
    bt = await _buyer(client, email="split-ship@example.com")
    admin_t = await _admin_login(client)
    _oid, sid = await _paid_order(client, bt, admin_t, vs, qty=2)

    await client.post(f"/api/v1/sellers/sub-orders/{sid}/ship",
                      json={"carrier": "CJ대한통운", "tracking_number": "1111"}, headers=_auth(st))

    async with async_session_factory() as session:
        seller_id = (await orders_service.sub_order_snapshot(session, _uuid.UUID(sid)))
        assert seller_id is not None
        # 두 번째 박스 추가 — 상태 전이는 없고 송장만 늘어난다
        added = await orders_service.add_shipment(
            session,
            (await session.scalar(select(__import__("app.orders.models", fromlist=["SubOrder"]).SubOrder.seller_id)
                                  .where(__import__("app.orders.models", fromlist=["SubOrder"]).SubOrder.id == _uuid.UUID(sid)))),
            _uuid.UUID(sid), "한진택배", "2222", note="2/2박스",
        )
        assert added["tracking_number"] == "2222"
        rows = list(await session.scalars(select(Shipment).where(Shipment.sub_order_id == _uuid.UUID(sid))))
    assert len(rows) == 2
    assert {r.tracking_number for r in rows} == {"1111", "2222"}

    # 대표 송장은 최신 — 기존 화면이 최근 것을 보인다
    listed = (await client.get("/api/v1/sellers/orders?status=shipping&page=1", headers=_auth(st))).json()
    row = next(i for i in listed["items"] if i["sub_order_id"] == sid)
    assert row["tracking_number"] == "2222"


@pytest.mark.asyncio
async def test_sku_saved(client, clean_products):
    """SKU — 택배사 연동·정산 대조·재고 실사의 공통 키."""
    from sqlalchemy import update

    from app.products.models import Variant

    st, _pid, vs = await _shop(client)
    async with async_session_factory() as session:
        await session.execute(
            update(Variant).where(Variant.id == _uuid.UUID(vs[0]["id"])).values(sku="OIMU-TOWEL-GRAY")
        )
        await session.commit()
        got = await session.scalar(select(Variant.sku).where(Variant.id == _uuid.UUID(vs[0]["id"])))
    assert got == "OIMU-TOWEL-GRAY"
