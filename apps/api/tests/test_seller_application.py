"""입점 신청 테스트 (Story 2.1)."""

import pytest

from tests.helpers import VALID_APP, _auth

SIGNUP = {"email": "brand@example.com", "password": "password123", "name": "브랜드"}


async def _token(client):
    res = await client.post("/api/v1/auth/signup", json=SIGNUP)
    return res.json()["access_token"]


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


@pytest.mark.asyncio
async def test_reapply_after_reject(client, clean_applications):
    t = await _token(client)
    res = await client.post("/api/v1/sellers/applications", json=VALID_APP, headers=_auth(t))
    app_id = res.json()["id"]

    # 반려 처리 (2.2 API 전이라 DB 직접 — 반려 후 재신청 경로 검증)
    from sqlalchemy import text as sqltext
    from app.core.db import engine

    async with engine.begin() as conn:
        await conn.execute(sqltext("UPDATE seller_applications SET status='rejected', rejection_reason='결이 다름' WHERE id = :i"), {"i": app_id})

    me = await client.get("/api/v1/sellers/applications/me", headers=_auth(t))
    assert me.json()["status"] == "rejected" and me.json()["rejection_reason"] == "결이 다름"

    res = await client.post("/api/v1/sellers/applications", json=VALID_APP, headers=_auth(t))
    assert res.status_code == 201  # 재신청은 새 행


@pytest.mark.asyncio
async def test_concurrent_submission_race(client, clean_applications):
    import asyncio

    t = await _token(client)
    results = await asyncio.gather(
        client.post("/api/v1/sellers/applications", json=VALID_APP, headers=_auth(t)),
        client.post("/api/v1/sellers/applications", json=VALID_APP, headers=_auth(t)),
    )
    codes = sorted(r.status_code for r in results)
    assert codes == [201, 409]  # 정확히 하나만 성공


@pytest.mark.asyncio
async def test_fullwidth_brn_rejected(client, clean_applications):
    t = await _token(client)
    res = await client.post(
        "/api/v1/sellers/applications",
        json={**VALID_APP, "business_registration_number": "２２０８１６２５１７"},
        headers=_auth(t),
    )
    assert res.status_code == 422
