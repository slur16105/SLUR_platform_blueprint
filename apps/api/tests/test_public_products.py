"""구매자 공개 상품 조회 테스트 (Story 3.5)."""

import pytest

from tests.helpers import _admin_token, _auth, _category, _product_body, _seller_with_prefix


def test_local_without_supabase_storage_uses_local_demo_image(monkeypatch):
    """로컬 시드 상품은 Storage 없이도 Web이 직접 제공하는 데모 이미지를 쓴다."""
    from app.core.config import get_settings
    from app.products.service import _image_url

    monkeypatch.delenv("SUPABASE_URL", raising=False)
    get_settings.cache_clear()
    try:
        assert _image_url("00000000-0000-0000-0000-000000000000/example.jpg") == "/local-product-images/local-demo.jpg"
    finally:
        get_settings.cache_clear()


async def _setup(client):
    admin_t = await _admin_token(client)
    cid = await _category(client, admin_t, name="공개조회")
    t, sid = await _seller_with_prefix(client, admin_t)
    return admin_t, cid, t, sid


@pytest.mark.asyncio
async def test_hidden_excluded_soldout_shown(client, clean_products):
    admin_t, cid, t, sid = await _setup(client)
    # 판매중(재고 있음) / 품절(재고 0) / 숨김
    p1 = (await client.post("/api/v1/sellers/products", json={**_product_body(sid, cid), "name": "판매중", "stock": 5}, headers=_auth(t))).json()
    p2 = (await client.post("/api/v1/sellers/products", json={**_product_body(sid, cid), "name": "품절이", "stock": 0}, headers=_auth(t))).json()
    p3 = (await client.post("/api/v1/sellers/products", json={**_product_body(sid, cid), "name": "숨김이", "stock": 5}, headers=_auth(t))).json()
    await client.patch(f"/api/v1/sellers/products/{p3['id']}", json={"status": "hidden"}, headers=_auth(t))

    res = await client.get(f"/api/v1/products?category={cid}")
    body = res.json()
    names = {i["name"]: i for i in body["items"]}
    assert set(names) == {"판매중", "품절이"}  # 숨김 제외, 품절 노출
    assert names["품절이"]["sold_out"] is True and names["판매중"]["sold_out"] is False
    assert names["판매중"]["brand_name"] == "슬러굿즈"

    # 숨김 상세 404
    res = await client.get(f"/api/v1/products/{p3['id']}")
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_detail_variant_prices_and_purchasable(client, clean_products):
    admin_t, cid, t, sid = await _setup(client)
    prod = (await client.post("/api/v1/sellers/products", json={**_product_body(sid, cid), "base_price": 10000}, headers=_auth(t))).json()
    await client.put(f"/api/v1/sellers/products/{prod['id']}/variants", headers=_auth(t), json={"variants": [
        {"option1_name": "사이즈", "option1_value": "S", "extra_price": 0, "stock": 3, "is_active": True},
        {"option1_name": "사이즈", "option1_value": "L", "extra_price": 2000, "stock": 0, "is_active": True},
        {"option1_name": "사이즈", "option1_value": "M", "extra_price": 500, "stock": 9, "is_active": False},
    ]})

    res = await client.get(f"/api/v1/products/{prod['id']}")
    d = res.json()
    assert d["price_from"] == 10000  # 활성 조합 최저가 (S)
    by = {v["option1_value"]: v for v in d["variants"]}
    assert by["L"]["final_price"] == 12000 and by["L"]["purchasable"] is False  # 재고 0
    assert by["M"]["purchasable"] is False  # 수동 품절 토글
    assert by["S"]["purchasable"] is True
    assert d["sold_out"] is False


@pytest.mark.asyncio
async def test_pagination_and_all_categories(client, clean_products):
    admin_t, cid, t, sid = await _setup(client)
    for i in range(25):
        await client.post("/api/v1/sellers/products", json={**_product_body(sid, cid), "name": f"상품{i}", "stock": 1}, headers=_auth(t))
    res = await client.get("/api/v1/products?page=1")
    assert res.json()["total"] == 25 and len(res.json()["items"]) == 20
    res = await client.get("/api/v1/products?page=2")
    assert len(res.json()["items"]) == 5


@pytest.mark.asyncio
async def test_detail_seller_info_disclosure(client, clean_products):
    """6.2 (FR-32): 공개 상세에 법정 판매자 신원정보 — 인증 불요."""
    from tests.helpers import _shop

    st, pid, vs = await _shop(client, stock=5)
    d = (await client.get(f"/api/v1/products/{pid}")).json()  # 미인증
    info = d["seller_info"]
    assert info["company_name"] and info["representative_name"]
    assert info["business_registration_number"] and info["mail_order_number"]
    assert info["business_address"] and info["contact_phone"]
    assert info["brand_name"] == d["brand_name"]
