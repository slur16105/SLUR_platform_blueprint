"""상품 등록 테스트 (Story 3.2)."""

import pytest

from tests.test_admin_approval import _admin_token, _submit_application
from tests.test_seller_application import _auth


@pytest.fixture
async def clean_products(clean_auth_tables):
    yield
    from sqlalchemy import text
    from app.core.db import engine

    async with engine.begin() as conn:
        await conn.execute(text("TRUNCATE products, categories CASCADE"))


async def _category(client, admin_t, name="문구"):
    res = await client.post("/api/v1/admin/categories", json={"name": name}, headers=_auth(admin_t))
    return res.json()["id"]


def _product_body(seller_prefix, category_id, n_images=2):
    import uuid as _u

    return {
        "name": "결 좋은 엽서",
        "base_price": 3000,
        "description": "손으로 그린 엽서입니다.",
        "category_id": category_id,
        "image_paths": [f"{seller_prefix}/{_u.uuid7()}.jpg" for i in range(n_images)],
    }


async def _seller_with_prefix(client, admin_t):
    # admin 토큰 재사용 (중복 admin 가입 방지)
    app_id, brand_refresh = await _submit_application(client)
    await client.post(f"/api/v1/admin/seller-applications/{app_id}/approve", headers=_auth(admin_t))
    r = await client.post("/api/v1/auth/refresh", json={"refresh_token": brand_refresh})
    t = r.json()["access_token"]
    from sqlalchemy import text
    from app.core.db import engine

    async with engine.begin() as conn:
        sid = (await conn.execute(text("SELECT id FROM sellers LIMIT 1"))).scalar()
    return t, str(sid)


@pytest.mark.asyncio
async def test_create_and_list(client, clean_products):
    admin_t = await _admin_token(client)
    cid = await _category(client, admin_t)
    t, sid = await _seller_with_prefix(client, admin_t)

    res = await client.post("/api/v1/sellers/products", json=_product_body(sid, cid), headers=_auth(t))
    assert res.status_code == 201
    body = res.json()
    assert body["status"] == "active"  # 즉시 노출 (FR-8)
    assert body["images"][0]["sort_order"] == 0

    rows = await client.get("/api/v1/sellers/products", headers=_auth(t))
    assert len(rows.json()) == 1


@pytest.mark.asyncio
async def test_image_limits(client, clean_products):
    admin_t = await _admin_token(client)
    cid = await _category(client, admin_t)
    t, sid = await _seller_with_prefix(client, admin_t)

    res = await client.post("/api/v1/sellers/products", json={**_product_body(sid, cid), "image_paths": []}, headers=_auth(t))
    assert res.status_code == 422  # 대표 이미지 필수

    res = await client.post("/api/v1/sellers/products", json=_product_body(sid, cid, n_images=12), headers=_auth(t))
    assert res.status_code == 422  # 11장 초과


@pytest.mark.asyncio
async def test_foreign_image_path_403(client, clean_products):
    admin_t = await _admin_token(client)
    cid = await _category(client, admin_t)
    t, _sid = await _seller_with_prefix(client, admin_t)

    import uuid as _u
    res = await client.post(
        "/api/v1/sellers/products",
        json={**_product_body(str(_u.uuid4()), cid)},  # 형식은 유효하나 타 판매자 prefix
        headers=_auth(t),
    )
    assert res.status_code == 403
    assert res.json()["code"] == "invalid_image_path"


@pytest.mark.asyncio
async def test_category_in_use_blocks_delete(client, clean_products):
    admin_t = await _admin_token(client)
    cid = await _category(client, admin_t)
    t, sid = await _seller_with_prefix(client, admin_t)
    await client.post("/api/v1/sellers/products", json=_product_body(sid, cid), headers=_auth(t))

    res = await client.delete(f"/api/v1/admin/categories/{cid}", headers=_auth(admin_t))
    assert res.status_code == 409
    assert res.json()["code"] == "category_in_use"  # 3.1 보류 경로 이행


@pytest.mark.asyncio
async def test_presign_requires_seller(client, clean_products):
    signup = await client.post("/api/v1/auth/signup", json={"email": "b2@example.com", "password": "password123", "name": "구매자"})
    res = await client.post("/api/v1/sellers/products/images/presign", json={"content_type": "image/jpeg"}, headers=_auth(signup.json()["access_token"]))
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_malformed_image_path_403(client, clean_products):
    admin_t = await _admin_token(client)
    cid = await _category(client, admin_t, name="잡화")
    t, sid = await _seller_with_prefix(client, admin_t)
    for bad in [f"{sid}/evil.html", f"{sid}/a?b=c.jpg", f"{sid}/../x.jpg", "x" * 301]:
        res = await client.post("/api/v1/sellers/products",
            json={**_product_body(sid, cid), "image_paths": [bad]}, headers=_auth(t))
        assert res.status_code == 403, bad


@pytest.mark.asyncio
async def test_update_product(client, clean_products):
    admin_t = await _admin_token(client)
    cid = await _category(client, admin_t, name="수정테스트")
    t, sid = await _seller_with_prefix(client, admin_t)
    res = await client.post("/api/v1/sellers/products", json=_product_body(sid, cid), headers=_auth(t))
    pid = res.json()["id"]

    res = await client.patch(f"/api/v1/sellers/products/{pid}", json={"base_price": 4500, "status": "hidden"}, headers=_auth(t))
    assert res.status_code == 200
    assert res.json()["base_price"] == 4500 and res.json()["status"] == "hidden"
    assert res.json()["name"] == "결 좋은 엽서"  # 부분 수정 — 나머지 유지

    res = await client.patch(f"/api/v1/sellers/products/{pid}", json={"status": "판매중"}, headers=_auth(t))
    assert res.status_code == 422  # Literal 밖

    import uuid as u
    res = await client.patch(f"/api/v1/sellers/products/{u.uuid4()}", json={"name": "x"}, headers=_auth(t))
    assert res.status_code == 404
