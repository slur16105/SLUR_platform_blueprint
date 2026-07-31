"""약관 버전·동의 이력 (오픈 게이트 P0).

핵심은 "가입하면 반드시 기록이 남는가"다 — 계정만 생기고 동의 기록이 빠지면 소급이 불가능하다.
"""

import pytest

from tests.helpers import _admin_token, _auth, _buyer


@pytest.mark.asyncio
async def test_current_agreements_are_public(client, clean_auth_tables):
    """가입 화면이 "무엇에 동의하는지" 표기할 수 있어야 한다 — 로그인 없이 조회 가능."""
    res = await client.get("/api/v1/legal/agreements")
    assert res.status_code == 200
    body = res.json()
    types = {a["type"] for a in body}
    assert {"terms", "privacy"} <= types
    for a in body:
        assert a["version"] and a["label"] and a["effective_at"]


@pytest.mark.asyncio
async def test_signup_records_consent(client, clean_auth_tables):
    """이메일 가입 — 필수 약관 2종의 동의가 남는다."""
    bt = await _buyer(client, email="consent@example.com")
    res = await client.get("/api/v1/legal/agreements/me", headers=_auth(bt))
    assert res.status_code == 200
    rows = res.json()
    assert {r["type"] for r in rows} == {"terms", "privacy"}
    for r in rows:
        assert r["agreed_at"] and r["version"]


@pytest.mark.asyncio
async def test_consent_requires_login(client, clean_auth_tables):
    res = await client.get("/api/v1/legal/agreements/me")
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_versions_are_not_duplicated_on_resync(client, clean_auth_tables):
    """버전 동기화는 멱등이다 — 재기동마다 행이 늘면 어떤 버전에 동의했는지 흐려진다."""
    from sqlalchemy import func, select

    from app.core.db import async_session_factory
    from app.legal import service
    from app.legal.models import Agreement

    async with async_session_factory() as session:
        await service.sync_versions(session)
        before = await session.scalar(select(func.count()).select_from(Agreement))
        await service.sync_versions(session)
        after = await session.scalar(select(func.count()).select_from(Agreement))
    assert before == after


@pytest.mark.asyncio
async def test_admin_can_see_member_consent(client, clean_auth_tables):
    """분쟁 시 확인 경로 — 관리자가 회원 상세에서 동의 이력을 본다."""
    admin_t = await _admin_token(client)
    bt = await _buyer(client, email="consent-admin@example.com")
    me = (await client.get("/api/v1/auth/me", headers=_auth(bt))).json()

    res = await client.get(f"/api/v1/admin/users/{me['id']}", headers=_auth(admin_t))
    assert res.status_code == 200
    agreements = res.json().get("agreements")
    assert agreements is not None, "회원 상세에 동의 이력이 포함돼야 한다"
    assert {a["type"] for a in agreements} == {"terms", "privacy"}
