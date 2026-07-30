"""카테고리 관리 테스트 (Story 3.1)."""

import pytest

from tests.helpers import _admin_token, _auth


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


@pytest.mark.asyncio
async def test_admin_list_includes_product_count(client, clean_products):
    """관리자 카테고리 목록 — 상품 수 포함(삭제 가능 여부와 같은 기준) + 공개 목록엔 넣지 않는다."""
    from tests.helpers import _admin_login, _buyer, _shop

    st, pid, vs = await _shop(client, stock=3)  # 카테고리 1개 + 그 안에 상품 1개 (admin 가입도 여기서 수행)
    admin_t = await _admin_login(client)
    bt = await _buyer(client)

    res = await client.get("/api/v1/admin/categories", headers=_auth(admin_t))
    assert res.status_code == 200
    rows = res.json()
    assert len(rows) >= 1
    used = [r for r in rows if r["product_count"] > 0]
    assert len(used) == 1 and used[0]["product_count"] == 1
    # 순서 필드는 공개 목록과 같은 규칙(sort_order)
    assert [r["sort_order"] for r in rows] == sorted(r["sort_order"] for r in rows)

    # 상품이 속한 카테고리는 삭제 거부 — 화면이 버튼을 막는 근거와 서버 판정이 같다
    assert (await client.delete(f"/api/v1/admin/categories/{used[0]['id']}", headers=_auth(admin_t))).status_code >= 400

    # 권한 — 구매자·비인증은 접근 불가
    assert (await client.get("/api/v1/admin/categories", headers=_auth(bt))).status_code == 403
    assert (await client.get("/api/v1/admin/categories")).status_code == 401

    # 공개 목록에는 product_count가 없다(구매자 필터 칩이 쓰지 않는 정보)
    pub = (await client.get("/api/v1/products/categories")).json()
    assert pub and "product_count" not in pub[0]
