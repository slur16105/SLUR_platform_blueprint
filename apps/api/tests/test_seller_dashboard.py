"""판매자 대시보드 테스트 (Story 5.4)."""

import pytest

from tests.test_carts import _buyer, _shop
from tests.test_products import clean_products  # noqa: F401
from tests.test_seller_application import _auth
from tests.test_seller_orders import _admin_login, _paid_order

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
    assert d0["low_stock_threshold"] == 5

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
    names = {(r["option_text"], r["stock"]) for r in lows}
    assert ("색상: 블랙 / 사이즈: L", 5) in names or any(r["stock"] == 5 for r in lows)  # 경계 포함
    assert not any(r["stock"] == 6 for r in lows)
    assert not any(r["stock"] == 0 for r in lows)  # stock 0인 비활성 조합이 제외됐다는 실증


async def _fees_and_grid(client, st, pid):
    """배송비 + 임박 경계 그리드: stock 5(경계)·6(제외)·0(비활성 — 제외)."""
    from tests.test_variants import GRID

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
