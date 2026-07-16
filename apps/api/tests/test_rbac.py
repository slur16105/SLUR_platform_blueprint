"""역할·권한 분기 테스트 (Story 1.4)."""

import pytest

from app.core.security import require_role

SIGNUP = {"email": "rbac@example.com", "password": "password123", "name": "역할테스터"}


@pytest.fixture
def admin_probe():
    """관리자 전용 probe 라우트 — 실 관리자 엔드포인트는 2.2에서."""
    from app.main import app

    @app.get("/api/v1/_admin_probe", dependencies=[__import__("fastapi").Depends(require_role("admin"))])
    async def _probe():  # pragma: no cover
        return {"ok": True}

    yield
    app.router.routes = [r for r in app.router.routes if getattr(r, "path", "") != "/api/v1/_admin_probe"]


async def _grant_admin(email: str):
    from app.auth.bootstrap import grant_admin

    return await grant_admin(email)


@pytest.mark.asyncio
async def test_new_account_has_no_roles(client, clean_auth_tables, admin_probe):
    res = await client.post("/api/v1/auth/signup", json=SIGNUP)
    access = res.json()["access_token"]

    roles = await client.get("/api/v1/auth/roles", headers={"Authorization": f"Bearer {access}"})
    assert roles.json() == {"roles": []}  # 구매자 = 암묵 기본

    probe = await client.get("/api/v1/_admin_probe", headers={"Authorization": f"Bearer {access}"})
    assert probe.status_code == 403
    assert probe.json()["code"] == "forbidden"


@pytest.mark.asyncio
async def test_admin_granted_after_refresh_only(client, clean_auth_tables, admin_probe):
    res = await client.post("/api/v1/auth/signup", json=SIGNUP)
    old_access = res.json()["access_token"]
    refresh = res.json()["refresh_token"]

    assert await _grant_admin(SIGNUP["email"]) == 0
    assert await _grant_admin(SIGNUP["email"]) == 0  # 멱등

    # 이전 access는 여전히 403 (반영 시점 규칙)
    probe = await client.get("/api/v1/_admin_probe", headers={"Authorization": f"Bearer {old_access}"})
    assert probe.status_code == 403

    # refresh 후 새 access로 통과
    res = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
    new_access = res.json()["access_token"]
    probe = await client.get("/api/v1/_admin_probe", headers={"Authorization": f"Bearer {new_access}"})
    assert probe.status_code == 200
    roles = await client.get("/api/v1/auth/roles", headers={"Authorization": f"Bearer {new_access}"})
    assert roles.json() == {"roles": ["admin"]}


@pytest.mark.asyncio
async def test_bootstrap_unknown_email_exit_1(clean_auth_tables):
    assert await _grant_admin("no-such@example.com") == 1


@pytest.mark.asyncio
async def test_probe_requires_auth(client, admin_probe):
    res = await client.get("/api/v1/_admin_probe")
    assert res.status_code == 401
    assert res.json()["code"] == "unauthorized"
