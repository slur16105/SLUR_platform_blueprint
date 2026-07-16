"""걷는 뼈대 스모크: 헬스체크 + 에러 봉투 계약.

에러 봉투는 모든 클라이언트가 code로 분기하는 계약이므로 여기서 형식을 고정한다.
"""

import pytest

ENVELOPE_KEYS = {"code", "message", "details"}


@pytest.mark.asyncio
async def test_health_returns_ok(client):
    res = await client.get("/api/v1/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_404_uses_error_envelope(client):
    res = await client.get("/api/v1/no-such-path")
    assert res.status_code == 404
    body = res.json()
    assert set(body) == ENVELOPE_KEYS
    assert body["code"] == "not_found"


@pytest.mark.asyncio
async def test_422_uses_error_envelope(client, validation_probe):
    res = await client.get("/api/v1/_validation_probe", params={"n": "abc"})
    assert res.status_code == 422
    body = res.json()
    assert set(body) == ENVELOPE_KEYS
    assert body["code"] == "validation_error"
    assert body["details"] and body["details"][0]["field"]


@pytest.mark.asyncio
async def test_405_uses_error_envelope(client):
    res = await client.post("/api/v1/health")
    assert res.status_code == 405
    body = res.json()
    assert set(body) == ENVELOPE_KEYS
    assert body["code"] == "method_not_allowed"
