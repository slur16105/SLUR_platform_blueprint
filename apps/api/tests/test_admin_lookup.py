"""관리자 조회 테스트 (Story 5.6)."""

import pytest

from tests.helpers import _admin_login, _auth, _buyer, _shop

USERS = "/api/v1/admin/users"
SELLERS = "/api/v1/admin/sellers"
PRODUCTS = "/api/v1/admin/products"


@pytest.mark.asyncio
async def test_lookup_users(client, clean_products):
    """AC 1: 이메일·이름 검색, 역할(다중)·가입일, 403·이스케이프."""
    st, pid, vs = await _shop(client, stock=5)
    bt = await _buyer(client)
    admin_t = await _admin_login(client)

    assert (await client.get(USERS)).status_code == 401
    assert (await client.get(USERS, headers=_auth(bt))).status_code == 403
    assert (await client.get(USERS, params={"page": 0}, headers=_auth(admin_t))).status_code == 422
    assert (await client.get(USERS, params={"page": 10001}, headers=_auth(admin_t))).status_code == 422
    body_all = (await client.get(USERS, headers=_auth(admin_t))).json()
    assert body_all["size"] >= 1 and body_all["page"] == 1
    body = (await client.get(USERS, params={"q": "buyer@"}, headers=_auth(admin_t))).json()
    assert body["total"] == 1
    row = body["items"][0]
    assert row["email"] == "buyer@example.com" and row["roles"] == []  # 구매자는 별도 role 없음(로그인만)

    body = (await client.get(USERS, params={"q": "admin@"}, headers=_auth(admin_t))).json()
    assert "admin" in body["items"][0]["roles"]
    # 판매자 역할
    body = (await client.get(USERS, params={"q": "brand2@"}, headers=_auth(admin_t))).json()
    assert "seller" in body["items"][0]["roles"]
    # 이스케이프 — %%는 아무것도 매칭하지 않아야
    assert (await client.get(USERS, params={"q": "%%"}, headers=_auth(admin_t))).json()["total"] == 0
    assert (await client.get(USERS, params={"q": "a"}, headers=_auth(admin_t))).status_code == 422


@pytest.mark.asyncio
async def test_lookup_sellers_and_products(client, clean_products):
    """AC 2·3: 판매자 신원·배송비·상품 수 / 상품 검색·필터·재고 합계."""
    st, pid, vs = await _shop(client, stock=5)  # 조합 6개 — 재고 합계 계산 대상
    await client.put(
        "/api/v1/sellers/me/shipping-fees",
        json={"base_shipping_fee": 3000, "jeju_extra_fee": 1000, "island_extra_fee": 2000}, headers=_auth(st),
    )
    admin_t = await _admin_login(client)

    body = (await client.get(SELLERS, headers=_auth(admin_t))).json()
    assert body["total"] == 1
    row = body["items"][0]
    assert row["product_count"] == 1 and row["base_shipping_fee"] == 3000
    assert row["business_registration_number"] and row["mail_order_number"]  # 법정 신원

    # 상호 검색
    assert (await client.get(SELLERS, params={"q": row["company_name"][:2]}, headers=_auth(admin_t))).json()["total"] == 1
    assert (await client.get(SELLERS, params={"q": "없는브랜드"}, headers=_auth(admin_t))).json()["total"] == 0

    # 상품: 이름 검색 + 재고 합계 + 브랜드 enrich
    body = (await client.get(PRODUCTS, params={"q": "엽서"}, headers=_auth(admin_t))).json()
    assert body["total"] == 1
    prow = body["items"][0]
    assert prow["brand_name"] == row["brand_name"] and prow["base_price"] == 3000
    assert prow["stock_sum"] > 0 and prow["status"] == "active"

    # 브랜드명으로도 상품 검색 (선해결 seller_ids)
    assert (await client.get(PRODUCTS, params={"q": row["brand_name"][:2]}, headers=_auth(admin_t))).json()["total"] == 1
    # 상태 필터
    await client.patch(f"/api/v1/sellers/products/{pid}", json={"status": "hidden"}, headers=_auth(st))
    assert (await client.get(PRODUCTS, params={"status": "active"}, headers=_auth(admin_t))).json()["total"] == 0
    assert (await client.get(PRODUCTS, params={"status": "hidden"}, headers=_auth(admin_t))).json()["total"] == 1
    assert (await client.get(PRODUCTS, params={"status": "bogus"}, headers=_auth(admin_t))).status_code == 422
    # 카테고리 필터
    from sqlalchemy import text

    from app.core.db import engine

    async with engine.begin() as conn:
        cat_id = str((await conn.execute(text("SELECT category_id FROM products LIMIT 1"))).scalar_one())
    assert (await client.get(PRODUCTS, params={"category_id": cat_id}, headers=_auth(admin_t))).json()["total"] == 1
