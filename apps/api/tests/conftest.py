import os

import pytest
from httpx import ASGITransport, AsyncClient

from tests.db_setup import assert_is_test_db, ensure_database, migrate, test_database_url

# 🚨 테스트는 **전용 DB**에서만 돈다. 개발용 DB와 같은 곳을 쓰면 테스트가 users를 TRUNCATE할 때
#    로컬 서버의 회원·주문 데이터가 함께 사라진다(실제로 반복해서 겪었다).
#
# 환경변수는 **전부** DB 준비보다 먼저 확정한다 — 마이그레이션이 설정 객체를 만들어 캐시하므로,
# 그 뒤에 넣은 값은 앱에 반영되지 않는다(카카오 키가 실값으로 굳어 실서버를 호출한 적이 있다).
os.environ.setdefault("JWT_SECRET", "test-secret-minimum-32-characters-long!")
os.environ["KAKAO_REST_API_KEY"] = "test-kakao-key"
os.environ["KAKAO_CLIENT_SECRET"] = "test-kakao-secret"
os.environ["KAKAO_APP_ID"] = "999999"

_TEST_DB_URL = test_database_url()
assert_is_test_db(_TEST_DB_URL)
os.environ["DATABASE_URL"] = _TEST_DB_URL
ensure_database(_TEST_DB_URL)
migrate(_TEST_DB_URL)


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

    # 안전장치: 이름이 _test로 끝나는 DB에서만 지운다.
    # (이전에는 "localhost 포함"만 봤다 — 로컬 개발 DB도 통과해 실제로 데이터가 지워졌다)
    assert_is_test_db(get_settings().database_url)
    async with engine.begin() as conn:
        await conn.execute(text("TRUNCATE refresh_tokens, users CASCADE"))  # FK CASCADE로 하위 테이블 동반 정리


@pytest.fixture
async def clean_auth_tables():
    """auth 테스트 격리 — 시작 전·종료 후 모두 정리 (직전 크래시 잔재 방어)."""
    await _truncate_auth()
    yield
    await _truncate_auth()


@pytest.fixture
async def clean_products(clean_auth_tables):
    """상품 도메인 격리 (Story 3.2 — tests/helpers.py 승격과 함께 conftest로 이동)."""
    yield
    from sqlalchemy import text
    from app.core.db import engine

    async with engine.begin() as conn:
        await conn.execute(text("TRUNCATE products, categories CASCADE"))
