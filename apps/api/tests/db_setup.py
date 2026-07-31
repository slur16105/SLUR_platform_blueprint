"""테스트 전용 데이터베이스 준비.

**테스트는 개발용 DB를 건드리지 않는다.** 이전에는 둘이 같은 DB를 써서, 테스트를 한 번 돌릴
때마다 로컬 서버의 회원·주문 데이터가 통째로 지워졌다(테스트가 users를 TRUNCATE한다).

규칙 세 가지:
  ① 테스트 DB 이름은 반드시 `_test`로 끝난다. 아니면 시작조차 하지 않는다.
  ② 없으면 만들고, 스키마는 alembic으로 올린다 — 사람이 준비할 것이 없다.
  ③ 접속 정보(호스트·계정·비밀번호)는 개발용 DATABASE_URL에서 **DB 이름만 바꿔** 가져온다.
     그래야 각자 환경의 비밀번호를 따로 관리하지 않아도 된다.
"""

import os
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

DEFAULT_DEV_URL = "postgresql+asyncpg://slur:slur@localhost:5432/slur"
TEST_SUFFIX = "_test"


def _dev_url() -> str:
    """개발용 접속 문자열 — 환경변수가 없으면 apps/api/.env에서 읽는다."""
    env_url = os.environ.get("DATABASE_URL")
    if env_url:
        return env_url
    dotenv = Path(__file__).resolve().parent.parent / ".env"
    if dotenv.exists():
        for line in dotenv.read_text().splitlines():
            if line.startswith("DATABASE_URL="):
                return line.split("=", 1)[1].strip()
    return DEFAULT_DEV_URL


def test_database_url() -> str:
    """개발용 URL에서 DB 이름만 `<name>_test`로 바꾼다."""
    override = os.environ.get("TEST_DATABASE_URL")
    if override:
        return override
    parts = urlsplit(_dev_url())
    name = parts.path.lstrip("/") or "slur"
    if name.endswith(TEST_SUFFIX):
        return urlunsplit(parts)
    return urlunsplit(parts._replace(path=f"/{name}{TEST_SUFFIX}"))


def assert_is_test_db(url: str) -> None:
    """이름이 `_test`로 끝나지 않으면 즉시 중단 — 개발·운영 DB를 지우는 사고를 막는 최종 방어."""
    name = urlsplit(url).path.lstrip("/")
    if not name.endswith(TEST_SUFFIX):
        raise RuntimeError(
            f"테스트는 이름이 '{TEST_SUFFIX}'로 끝나는 DB에서만 실행한다 (현재: {name!r}). "
            "TEST_DATABASE_URL을 확인하세요."
        )


def ensure_database(url: str) -> None:
    """없으면 만든다. 이미 있으면 아무것도 하지 않는다.

    드라이버는 이미 쓰는 asyncpg를 그대로 쓴다 — 이 하나 때문에 의존성을 늘리지 않는다.
    """
    import asyncio

    import asyncpg

    parts = urlsplit(url)
    name = parts.path.lstrip("/")
    # 관리 접속은 항상 존재하는 postgres DB로 — 만들 대상에는 붙을 수 없다
    admin = urlunsplit(parts._replace(scheme="postgresql", path="/postgres"))

    async def _create() -> None:
        conn = await asyncpg.connect(admin)
        try:
            exists = await conn.fetchval("SELECT 1 FROM pg_database WHERE datname = $1", name)
            if not exists:
                await conn.execute(f'CREATE DATABASE "{name}"')
        finally:
            await conn.close()

    asyncio.run(_create())


def migrate(url: str) -> None:
    """스키마를 최신으로 — 마이그레이션이 늘어도 테스트 쪽에서 할 일이 없다."""
    from alembic import command
    from alembic.config import Config

    root = Path(__file__).resolve().parent.parent
    cfg = Config(str(root / "alembic.ini"))
    cfg.set_main_option("script_location", str(root / "alembic"))
    cfg.set_main_option("sqlalchemy.url", url.replace("%", "%%"))
    command.upgrade(cfg, "head")
