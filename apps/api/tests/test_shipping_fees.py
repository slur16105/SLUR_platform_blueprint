"""판매자 배송비 설정 테스트 (Story 2.3)."""

import pytest

from tests.test_admin_approval import _admin_token, _submit_application
from tests.test_seller_application import _auth

FEES = {"base_shipping_fee": 3000, "jeju_extra_fee": 3000, "island_extra_fee": 5000}


async def _seller_token(client):
    admin_t = await _admin_token(client)
    app_id, brand_refresh = await _submit_application(client)
    await client.post(f"/api/v1/admin/seller-applications/{app_id}/approve", headers=_auth(admin_t))
    r = await client.post("/api/v1/auth/refresh", json={"refresh_token": brand_refresh})
    return r.json()["access_token"]


@pytest.mark.asyncio
async def test_save_and_reload(client, clean_auth_tables):
    t = await _seller_token(client)
    res = await client.put("/api/v1/sellers/me/shipping-fees", json=FEES, headers=_auth(t))
    assert res.status_code == 200 and res.json()["base_shipping_fee"] == 3000

    me = await client.get("/api/v1/sellers/me", headers=_auth(t))
    assert me.json()["island_extra_fee"] == 5000 and me.json()["brand_name"] == "슬러굿즈"


@pytest.mark.asyncio
async def test_invalid_amounts_422(client, clean_auth_tables):
    t = await _seller_token(client)
    for bad in [{"base_shipping_fee": -1}, {"base_shipping_fee": 2.5}, {"base_shipping_fee": "삼천원"}, {"base_shipping_fee": 200000}]:
        res = await client.put("/api/v1/sellers/me/shipping-fees", json={**FEES, **bad}, headers=_auth(t))
        assert res.status_code == 422, bad


@pytest.mark.asyncio
async def test_non_seller_403(client, clean_auth_tables):
    signup = await client.post("/api/v1/auth/signup", json={"email": "buyer@example.com", "password": "password123", "name": "구매자"})
    res = await client.get("/api/v1/sellers/me", headers=_auth(signup.json()["access_token"]))
    assert res.status_code == 403
