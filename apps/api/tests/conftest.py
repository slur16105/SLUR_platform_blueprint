import os

import pytest
from httpx import ASGITransport, AsyncClient

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://slur:slur@localhost:5432/slur")


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
