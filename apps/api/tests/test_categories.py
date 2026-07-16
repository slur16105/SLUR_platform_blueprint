"""카테고리 관리 테스트 (Story 3.1)."""

import pytest

from tests.test_admin_approval import _admin_token
from tests.test_seller_application import _auth


@pytest.fixture
async def clean_categories(clean_auth_tables):
    yield
    from sqlalchemy import text
    from app.core.db import engine

    async with engine.begin() as conn:
        await conn.execute(text("TRUNCATE categories CASCADE"))


@pytest.mark.asyncio
async def test_crud_and_order(client, clean_categories):
    t = await _admin_token(client)
    ids = []
    for name in ["문구", "리빙", "오브제"]:
        res = await client.post("/api/v1/admin/categories", json={"name": name}, headers=_auth(t))
        assert res.status_code == 201
        ids.append(res.json()["id"])

    # 공개 목록 (무인증) — 생성 순서
    pub = await client.get("/api/v1/products/categories")
    assert pub.status_code == 200
    assert [c["name"] for c in pub.json()] == ["문구", "리빙", "오브제"]

    # 순서 변경 (역순)
    res = await client.put("/api/v1/admin/categories/order", json={"ids": ids[::-1]}, headers=_auth(t))
    assert [c["name"] for c in res.json()] == ["오브제", "리빙", "문구"]

    # 이름 수정
    res = await client.patch(f"/api/v1/admin/categories/{ids[0]}", json={"name": "종이 위의 것들"}, headers=_auth(t))
    assert res.json()["name"] == "종이 위의 것들"

    # 삭제
    res = await client.delete(f"/api/v1/admin/categories/{ids[2]}", headers=_auth(t))
    assert res.status_code == 204
    pub = await client.get("/api/v1/products/categories")
    assert len(pub.json()) == 2


@pytest.mark.asyncio
async def test_duplicate_name_409(client, clean_categories):
    t = await _admin_token(client)
    await client.post("/api/v1/admin/categories", json={"name": "문구"}, headers=_auth(t))
    res = await client.post("/api/v1/admin/categories", json={"name": "문구"}, headers=_auth(t))
    assert res.status_code == 409 and res.json()["code"] == "category_name_exists"


@pytest.mark.asyncio
async def test_reorder_stale_list_422(client, clean_categories):
    t = await _admin_token(client)
    res = await client.post("/api/v1/admin/categories", json={"name": "문구"}, headers=_auth(t))
    cid = res.json()["id"]
    import uuid as u
    res = await client.put("/api/v1/admin/categories/order", json={"ids": [cid, str(u.uuid4())]}, headers=_auth(t))
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_non_admin_403(client, clean_categories):
    signup = await client.post("/api/v1/auth/signup", json={"email": "x@example.com", "password": "password123", "name": "x"})
    res = await client.post("/api/v1/admin/categories", json={"name": "문구"}, headers=_auth(signup.json()["access_token"]))
    assert res.status_code == 403
