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
async def test_422_uses_error_envelope(client):
    # 검증 실패를 일으키기 위한 임시 경로: health에 잘못된 쿼리 타입을 줄 수 없으므로
    # 검증용 테스트 라우트를 앱에 추가하지 않고, 존재하는 경로의 잘못된 메서드 대신
    # FastAPI 검증을 트리거하는 가장 단순한 방법을 사용한다.
    from app.main import app

    @app.get("/api/v1/_validation_probe")
    async def _probe(n: int):  # pragma: no cover - 테스트 전용
        return {"n": n}

    res = await client.get("/api/v1/_validation_probe", params={"n": "abc"})
    assert res.status_code == 422
    body = res.json()
    assert set(body) == ENVELOPE_KEYS
    assert body["code"] == "validation_error"
    assert body["details"] and body["details"][0]["field"]
