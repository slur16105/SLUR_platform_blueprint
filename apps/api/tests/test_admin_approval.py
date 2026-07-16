"""관리자 입점 승인·반려 테스트 (Story 2.2)."""

import pytest

from app.auth.bootstrap import grant_admin
from tests.test_seller_application import VALID_APP, _auth

ADMIN = {"email": "admin@example.com", "password": "password123", "name": "관리자"}
BRAND = {"email": "brand2@example.com", "password": "password123", "name": "브랜드2"}


async def _admin_token(client):
    signup = await client.post("/api/v1/auth/signup", json=ADMIN)
    refresh = signup.json()["refresh_token"]
    await grant_admin(ADMIN["email"])
    res = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
    return res.json()["access_token"]


async def _submit_application(client):
    signup = await client.post("/api/v1/auth/signup", json=BRAND)
    t = signup.json()["access_token"]
    res = await client.post("/api/v1/sellers/applications", json=VALID_APP, headers=_auth(t))
    return res.json()["id"], signup.json()["refresh_token"]


@pytest.mark.asyncio
async def test_approve_creates_seller_and_role(client, clean_auth_tables):
    admin_t = await _admin_token(client)
    app_id, brand_refresh = await _submit_application(client)

    listed = await client.get("/api/v1/admin/seller-applications", headers=_auth(admin_t))
    assert listed.json()["total"] == 1

    res = await client.post(f"/api/v1/admin/seller-applications/{app_id}/approve", headers=_auth(admin_t))
    assert res.status_code == 200 and res.json()["status"] == "approved"

    # 신청자 refresh → seller 역할 반영 (1.4 규칙)
    r = await client.post("/api/v1/auth/refresh", json={"refresh_token": brand_refresh})
    roles = await client.get("/api/v1/auth/roles", headers=_auth(r.json()["access_token"]))
    assert roles.json()["roles"] == ["seller"]

    # 이중 처리 409
    res = await client.post(f"/api/v1/admin/seller-applications/{app_id}/approve", headers=_auth(admin_t))
    assert res.status_code == 409 and res.json()["code"] == "application_not_pending"


@pytest.mark.asyncio
async def test_reject_requires_reason(client, clean_auth_tables):
    admin_t = await _admin_token(client)
    app_id, _ = await _submit_application(client)

    res = await client.post(f"/api/v1/admin/seller-applications/{app_id}/reject", json={"reason": "  "}, headers=_auth(admin_t))
    assert res.status_code == 422

    res = await client.post(f"/api/v1/admin/seller-applications/{app_id}/reject", json={"reason": "결이 다릅니다"}, headers=_auth(admin_t))
    assert res.status_code == 200 and res.json()["rejection_reason"] == "결이 다릅니다"


@pytest.mark.asyncio
async def test_non_admin_403(client, clean_auth_tables):
    signup = await client.post("/api/v1/auth/signup", json=BRAND)
    t = signup.json()["access_token"]
    res = await client.get("/api/v1/admin/seller-applications", headers=_auth(t))
    assert res.status_code == 403 and res.json()["code"] == "forbidden"


@pytest.mark.asyncio
async def test_approve_already_seller_409(client, clean_auth_tables):
    admin_t = await _admin_token(client)
    app_id, brand_refresh = await _submit_application(client)
    await client.post(f"/api/v1/admin/seller-applications/{app_id}/approve", headers=_auth(admin_t))

    # 같은 계정이 (비정상적으로) 다시 신청 — pending 인덱스는 새 신청을 허용
    r = await client.post("/api/v1/auth/refresh", json={"refresh_token": brand_refresh})
    t = r.json()["access_token"]
    res = await client.post("/api/v1/sellers/applications", json=VALID_APP, headers=_auth(t))
    second_id = res.json()["id"]

    res = await client.post(f"/api/v1/admin/seller-applications/{second_id}/approve", headers=_auth(admin_t))
    assert res.status_code == 409
    assert res.json()["code"] == "application_not_pending"
