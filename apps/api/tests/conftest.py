import os

import pytest
from httpx import ASGITransport, AsyncClient

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://slur:slur@localhost:5432/slur")
os.environ.setdefault("JWT_SECRET", "test-secret-minimum-32-characters-long!")


@pytest.fixture
async def client():
    from app.main import app

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.fixture
def validation_probe():
    """422 검증 트리거용 임시 라우트 — 테스트 후 제거해 전역 app 오염을 남기지 않는다."""
    from app.main import app

    @app.get("/api/v1/_validation_probe")
    async def _probe(n: int):  # pragma: no cover - 테스트 전용
        return {"n": n}

    yield
    app.router.routes = [r for r in app.router.routes if getattr(r, "path", "") != "/api/v1/_validation_probe"]


async def _truncate_auth():
    from sqlalchemy import text
    from app.core.config import get_settings
    from app.core.db import engine

    # 안전장치: 로컬 DB가 아니면 절대 TRUNCATE하지 않는다
    if "localhost" not in get_settings().database_url and "127.0.0.1" not in get_settings().database_url:
        raise RuntimeError("테스트 정리는 로컬 DB에서만 허용된다")
    async with engine.begin() as conn:
        await conn.execute(text("TRUNCATE refresh_tokens, users CASCADE"))


@pytest.fixture
async def clean_auth_tables():
    """auth 테스트 격리 — 시작 전·종료 후 모두 정리 (직전 크래시 잔재 방어)."""
    await _truncate_auth()
    yield
    await _truncate_auth()
