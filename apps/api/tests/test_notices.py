"""공지사항 (오픈 게이트 P0).

핵심은 "미공개 문서가 새지 않는가"다 — 임시저장·예약 게시가 공개 목록에 뜨면
시행 전 약관 개정 내용이 미리 노출된다.
"""

import uuid as _uuid
from datetime import datetime, timedelta, timezone

import pytest

from tests.helpers import _admin_token, _auth, _buyer

WRITE = {"title": "약관 개정 안내", "body": "2026-08-10부터 이용약관이 개정됩니다.", "is_pinned": False}


def _iso(dt):
    return dt.isoformat()


@pytest.mark.asyncio
async def test_published_notice_is_public(client, clean_auth_tables):
    admin_t = await _admin_token(client)
    past = datetime.now(timezone.utc) - timedelta(minutes=5)
    res = await client.post(
        "/api/v1/admin/notices", json={**WRITE, "published_at": _iso(past)}, headers=_auth(admin_t)
    )
    assert res.status_code == 201

    rows = (await client.get("/api/v1/notices")).json()  # 로그인 없이 조회 가능
    assert rows["total"] == 1
    assert rows["items"][0]["title"] == "약관 개정 안내"


@pytest.mark.asyncio
async def test_draft_and_scheduled_are_hidden(client, clean_auth_tables):
    """임시저장(published_at=None)과 예약(미래)은 공개 목록에 없다."""
    admin_t = await _admin_token(client)
    future = datetime.now(timezone.utc) + timedelta(days=3)
    draft = (await client.post("/api/v1/admin/notices", json={**WRITE, "title": "임시저장", "published_at": None},
                               headers=_auth(admin_t))).json()
    sched = (await client.post("/api/v1/admin/notices", json={**WRITE, "title": "예약", "published_at": _iso(future)},
                               headers=_auth(admin_t))).json()

    public = (await client.get("/api/v1/notices")).json()
    assert public["total"] == 0

    # 상세 직접 접근도 막힌다 — 존재를 노출하지 않는다
    assert (await client.get(f"/api/v1/notices/{draft['id']}")).status_code == 404
    assert (await client.get(f"/api/v1/notices/{sched['id']}")).status_code == 404

    # 관리자 목록에는 둘 다 보인다
    admin_rows = (await client.get("/api/v1/admin/notices", headers=_auth(admin_t))).json()
    assert admin_rows["total"] == 2


@pytest.mark.asyncio
async def test_pinned_first(client, clean_auth_tables):
    """고정 공지가 먼저 — 약관 개정 고지를 상단에 붙잡아 둘 수 있어야 한다."""
    admin_t = await _admin_token(client)
    now = datetime.now(timezone.utc)
    await client.post("/api/v1/admin/notices",
                      json={**WRITE, "title": "최신 일반 공지", "published_at": _iso(now - timedelta(minutes=1))},
                      headers=_auth(admin_t))
    await client.post("/api/v1/admin/notices",
                      json={**WRITE, "title": "고정 공지", "is_pinned": True,
                            "published_at": _iso(now - timedelta(days=5))},
                      headers=_auth(admin_t))

    items = (await client.get("/api/v1/notices")).json()["items"]
    assert items[0]["title"] == "고정 공지"


@pytest.mark.asyncio
async def test_admin_only_writes(client, clean_auth_tables):
    bt = await _buyer(client, email="notice-buyer@example.com")
    assert (await client.post("/api/v1/admin/notices", json={**WRITE, "published_at": None},
                              headers=_auth(bt))).status_code == 403
    assert (await client.get("/api/v1/admin/notices", headers=_auth(bt))).status_code == 403


@pytest.mark.asyncio
async def test_update_and_delete(client, clean_auth_tables):
    admin_t = await _admin_token(client)
    past = datetime.now(timezone.utc) - timedelta(minutes=1)
    created = (await client.post("/api/v1/admin/notices", json={**WRITE, "published_at": _iso(past)},
                                 headers=_auth(admin_t))).json()

    res = await client.put(f"/api/v1/admin/notices/{created['id']}",
                           json={**WRITE, "title": "수정됨", "published_at": _iso(past)}, headers=_auth(admin_t))
    assert res.status_code == 200 and res.json()["title"] == "수정됨"

    # 게시 취소 — published_at을 비우면 공개 목록에서 사라진다
    await client.put(f"/api/v1/admin/notices/{created['id']}",
                     json={**WRITE, "title": "수정됨", "published_at": None}, headers=_auth(admin_t))
    assert (await client.get("/api/v1/notices")).json()["total"] == 0

    assert (await client.delete(f"/api/v1/admin/notices/{created['id']}", headers=_auth(admin_t))).status_code == 204
    assert (await client.get(f"/api/v1/admin/notices/{created['id']}", headers=_auth(admin_t))).status_code == 404


@pytest.mark.asyncio
async def test_validation_and_unknown(client, clean_auth_tables):
    admin_t = await _admin_token(client)
    assert (await client.post("/api/v1/admin/notices", json={**WRITE, "title": "  ", "published_at": None},
                              headers=_auth(admin_t))).status_code == 422
    assert (await client.get(f"/api/v1/notices/{_uuid.uuid4()}")).status_code == 404
