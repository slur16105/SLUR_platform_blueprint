"""판매자 대시보드 테스트 (Story 5.4)."""

import pytest

from tests.helpers import _admin_login, _auth, _buyer, _paid_order, _shop, second_seller

DASH = "/api/v1/sellers/dashboard"


@pytest.mark.asyncio
async def test_dashboard_counts_and_low_stock(client, clean_products):
    """AC 1: preparing·shipping 카운트, 품절 임박(경계 =5 포함·비활성 제외·정렬), 서버 계산."""
    st, pid, vs = await _shop(client, stock=9)
    await _fees_and_grid(client, st, pid)
    bt = await _buyer(client)
    admin_t = await _admin_login(client)

    assert (await client.get(DASH)).status_code == 401
    assert (await client.get(DASH, headers=_auth(bt))).status_code == 403

    d0 = (await client.get(DASH, headers=_auth(st))).json()
    assert d0["preparing_count"] == 0 and d0["shipping_count"] == 0
    # threshold는 settings 시드값과 대조 (하드코딩 대신 — 5.7 변경 내성)
    from app.core.db import async_session_factory
    from app.orders import service as orders_service

    async with async_session_factory() as session:
        seeded = await orders_service.get_int_setting(session, orders_service.SETTING_LOW_STOCK_THRESHOLD, minimum=0)
    assert d0["low_stock_threshold"] == seeded

    # 미결제 주문 존재 상태 — 카운트 제외 실증
    from tests.helpers import ADDRESS, _cart_ids, _expected

    await client.post("/api/v1/carts/items", json={"variant_id": vs[0]["id"], "quantity": 1}, headers=_auth(bt))
    ids = await _cart_ids(client, bt)
    await client.post(
        "/api/v1/orders",
        json={"cart_item_ids": ids, "expected_grand_total": await _expected(client, bt), **ADDRESS}, headers=_auth(bt),
    )
    d_unpaid = (await client.get(DASH, headers=_auth(st))).json()
    assert d_unpaid["preparing_count"] == 0  # NULL(미결제)은 신규 주문 아님

    # preparing 1건 조성 (주문+입금확인) → 카운트 1
    oid, sid = await _paid_order(client, bt, admin_t, vs)
    d1 = (await client.get(DASH, headers=_auth(st))).json()
    assert d1["preparing_count"] == 1 and d1["shipping_count"] == 0

    # 배송 시작 → shipping 1
    await client.post(
        f"/api/v1/sellers/sub-orders/{sid}/ship",
        json={"carrier": "CJ", "tracking_number": "1"}, headers=_auth(st),
    )
    d2 = (await client.get(DASH, headers=_auth(st))).json()
    assert d2["preparing_count"] == 0 and d2["shipping_count"] == 1

    # 배송 완료 → 카운트 대상 제외
    await client.post(f"/api/v1/sellers/sub-orders/{sid}/deliver", headers=_auth(st))
    d3 = (await client.get(DASH, headers=_auth(st))).json()
    assert d3["preparing_count"] == 0 and d3["shipping_count"] == 0

    # 품절 임박: 경계 =5 포함, 6 제외, 비활성 조합 제외, 재고 오름차순
    lows = d3["low_stock"]
    stocks = [r["stock"] for r in lows]
    assert stocks == sorted(stocks)
    assert all(r["stock"] <= 5 for r in lows)
    assert any(r["stock"] == 5 for r in lows)  # 경계 =threshold 포함
    assert all(" / " in r["option_text"] and ": " in r["option_text"] for r in lows)  # 표시 포맷 회귀 그물
    assert not any(r["stock"] == 6 for r in lows)
    assert not any(r["stock"] == 0 for r in lows)  # stock 0인 비활성 조합이 제외됐다는 실증


async def _fees_and_grid(client, st, pid):
    """배송비 + 임박 경계 그리드: stock 5(경계)·6(제외)·0(비활성 — 제외)."""
    from tests.helpers import GRID

    await client.put(
        "/api/v1/sellers/me/shipping-fees",
        json={"base_shipping_fee": 3000, "jeju_extra_fee": 3000, "island_extra_fee": 5000}, headers=_auth(st),
    )
    variants = [dict(v) for v in GRID["variants"]]
    variants[0]["stock"] = 9  # _paid_order가 쓰는 vs[0] — 임박 아님 (주문 차감 후에도 >6 유지 어려우니 9)
    variants[1]["stock"] = 5   # 경계 — 포함
    variants[2]["stock"] = 6   # 제외
    if len(variants) > 3:
        variants[3]["stock"] = 0
        variants[3]["is_active"] = False  # 비활성 — 제외
    await client.put(f"/api/v1/sellers/products/{pid}/variants", json={"variants": variants}, headers=_auth(st))


@pytest.mark.asyncio
async def test_hidden_product_excluded(client, clean_products):
    """숨김 상품의 조합은 품절 임박 대상 아님."""
    st, pid, vs = await _shop(client, stock=2)  # 전 조합 임박
    await client.put(
        "/api/v1/sellers/me/shipping-fees",
        json={"base_shipping_fee": 0, "jeju_extra_fee": 0, "island_extra_fee": 0}, headers=_auth(st),
    )
    assert len((await client.get(DASH, headers=_auth(st))).json()["low_stock"]) > 0
    await client.patch(f"/api/v1/sellers/products/{pid}", json={"status": "hidden"}, headers=_auth(st))
    assert (await client.get(DASH, headers=_auth(st))).json()["low_stock"] == []


@pytest.mark.asyncio
async def test_seller_isolation_and_limit(client, clean_products):
    """리뷰 반영: 타 판매자 분리(카운트·임박 모두 0) + limit 절단 + 전-취소 묶음 카운트 제외."""
    import uuid as u

    from sqlalchemy import select

    from app.core.db import async_session_factory
    from app.orders import service as orders_service, transitions as t
    from app.orders.models import OrderItem, SubOrder
    from app.products import service as products_service

    st, pid, vs = await _shop(client, stock=2)  # 전 조합 임박
    await client.put(
        "/api/v1/sellers/me/shipping-fees",
        json={"base_shipping_fee": 3000, "jeju_extra_fee": 0, "island_extra_fee": 0}, headers=_auth(st),
    )
    bt = await _buyer(client)
    admin_t = await _admin_login(client)
    oid, sid = await _paid_order(client, bt, admin_t, vs)  # seller1 preparing 1

    # limit 절단 (직접 호출 — 라우터 기본 상한은 LOW_STOCK_LIMIT 상수)
    async with async_session_factory() as session:
        seller_uuid = (await session.execute(select(SubOrder.seller_id).where(SubOrder.id == u.UUID(sid)))).scalar_one()
        rows = await products_service.low_stock_variants(session, seller_uuid, threshold=5, limit=2)
        assert len(rows) == 2  # 전 조합 임박(6개) 중 2개로 절단

    # 제2 판매자 (상품·주문 없음) — 완전 분리: 전부 0
    t2, _sid2 = await second_seller(client, admin_t, email="seller-dash2@example.com")
    d2 = (await client.get(DASH, headers=_auth(t2))).json()
    assert d2["preparing_count"] == 0 and d2["shipping_count"] == 0 and d2["low_stock"] == []  # seller1 데이터 미노출

    # 전-취소 묶음은 신규 주문 카운트에서 제외 (유령 할 일 방지)
    assert (await client.get(DASH, headers=_auth(st))).json()["preparing_count"] == 1
    async with async_session_factory() as session:
        item_id = await session.scalar(select(OrderItem.id).where(OrderItem.sub_order_id == u.UUID(sid)))
        await orders_service.cancel_order_item(
            session, order_item_id=item_id, actor_role=t.ROLE_ADMIN, actor_user_id=None,
            reason="품절", responsibility="seller",
        )
        await session.commit()
    assert (await client.get(DASH, headers=_auth(st))).json()["preparing_count"] == 0
