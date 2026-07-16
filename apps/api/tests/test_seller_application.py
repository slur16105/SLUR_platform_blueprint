"""입점 신청 테스트 (Story 2.1)."""

import pytest

SIGNUP = {"email": "brand@example.com", "password": "password123", "name": "브랜드"}
VALID_APP = {
    "company_name": "슬러상회",
    "representative_name": "김슬러",
    "business_registration_number": "220-81-62517",  # 체크섬 유효 (테스트용 공개 번호)
    "mail_order_number": "제2026-서울-0001호",
    "business_address": "서울시 어딘가 1-2",
    "contact_phone": "01012345678",
    "brand_name": "슬러굿즈",
    "brand_intro": "결이 맞는 디자인 소품을 만듭니다.",
}


async def _token(client):
    res = await client.post("/api/v1/auth/signup", json=SIGNUP)
    return res.json()["access_token"]


def _auth(t):
    return {"Authorization": f"Bearer {t}"}


@pytest.fixture
async def clean_applications(clean_auth_tables):
    yield  # users CASCADE가 applications도 정리


@pytest.mark.asyncio
async def test_submit_and_status(client, clean_applications):
    t = await _token(client)
    res = await client.post("/api/v1/sellers/applications", json=VALID_APP, headers=_auth(t))
    assert res.status_code == 201
    body = res.json()
    assert body["status"] == "pending" and body["brand_name"] == "슬러굿즈"

    me = await client.get("/api/v1/sellers/applications/me", headers=_auth(t))
    assert me.status_code == 200 and me.json()["status"] == "pending"


@pytest.mark.asyncio
async def test_duplicate_pending_409(client, clean_applications):
    t = await _token(client)
    await client.post("/api/v1/sellers/applications", json=VALID_APP, headers=_auth(t))
    res = await client.post("/api/v1/sellers/applications", json=VALID_APP, headers=_auth(t))
    assert res.status_code == 409
    assert res.json()["code"] == "application_already_pending"


@pytest.mark.asyncio
async def test_invalid_brn_422(client, clean_applications):
    t = await _token(client)
    res = await client.post(
        "/api/v1/sellers/applications",
        json={**VALID_APP, "business_registration_number": "123-45-67890"},  # 체크섬 불일치
        headers=_auth(t),
    )
    assert res.status_code == 422
    assert res.json()["code"] == "validation_error"


@pytest.mark.asyncio
async def test_missing_fields_422_details(client, clean_applications):
    t = await _token(client)
    res = await client.post("/api/v1/sellers/applications", json={"brand_name": "x"}, headers=_auth(t))
    assert res.status_code == 422
    assert len(res.json()["details"]) >= 5  # 필드별 오류


@pytest.mark.asyncio
async def test_requires_auth_401(client):
    res = await client.post("/api/v1/sellers/applications", json=VALID_APP)
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_no_application_404(client, clean_applications):
    t = await _token(client)
    res = await client.get("/api/v1/sellers/applications/me", headers=_auth(t))
    assert res.status_code == 404
