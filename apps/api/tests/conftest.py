import os

import pytest
from httpx import ASGITransport, AsyncClient

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://slur:slur@localhost:5432/slur")
os.environ.setdefault("JWT_SECRET", "test-secret")


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


@pytest.fixture
async def clean_auth_tables():
    """auth 테스트 격리 — 테스트 종료 후 생성 데이터 제거."""
    yield
    from sqlalchemy import text
    from app.core.db import engine

    async with engine.begin() as conn:
        await conn.execute(text("TRUNCATE refresh_tokens, users CASCADE"))
