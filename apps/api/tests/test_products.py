"""상품 등록 테스트 (Story 3.2)."""

import pytest

from tests.helpers import _admin_token, _auth, _category, _product_body, _seller_with_prefix, second_seller


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
    items = rows.json()
    assert len(items) == 1
    # 판매자 콘솔이 Storage 주소를 조립하지 않도록 서버가 완성된 URL을 함께 준다.
    # (Storage 미연결 환경은 None 또는 로컬 데모 경로 — 어느 쪽이든 화면이 처리한다)
    img = items[0]["images"][0]
    # Storage 미연결 로컬은 데모 경로, 연결 환경은 path가 포함된 공개 URL — 둘 중 하나여야 한다
    # (OR를 느슨하게 두면 어떤 값이든 통과해 검증이 무의미해진다)
    assert img["url"] == "/local-product-images/local-demo.jpg" or img["path"] in img["url"]


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


@pytest.mark.asyncio
async def test_other_seller_cannot_patch(client, clean_products):
    admin_t = await _admin_token(client)
    cid = await _category(client, admin_t, name="권한테스트")
    t1, sid1 = await _seller_with_prefix(client, admin_t)
    pid = (await client.post("/api/v1/sellers/products", json=_product_body(sid1, cid), headers=_auth(t1))).json()["id"]

    # 제2 판매자 생성
    t2, _sid2 = await second_seller(client, admin_t, email="seller2@example.com")

    res = await client.patch(f"/api/v1/sellers/products/{pid}", json={"base_price": 1}, headers=_auth(t2))
    assert res.status_code == 404  # 타인 상품 — 존재 비노출


@pytest.mark.asyncio
async def test_replace_images(client, clean_products):
    """이미지 교체 — 등록 후 사진을 바꾸는 경로(판매자 상품 수정 화면)."""
    import uuid as _uuid

    admin_t = await _admin_token(client)
    cid = await _category(client, admin_t)
    t, sid = await _seller_with_prefix(client, admin_t)

    pid = (await client.post(
        "/api/v1/sellers/products", json=_product_body(sid, cid, n_images=2), headers=_auth(t)
    )).json()["id"]

    new_paths = [f"{sid}/{_uuid.uuid7()}.jpg" for _ in range(3)]
    res = await client.put(f"/api/v1/sellers/products/{pid}/images", json={"image_paths": new_paths}, headers=_auth(t))
    assert res.status_code == 200
    images = res.json()["images"]
    # 보낸 순서가 곧 노출 순서이고 [0]이 대표
    assert [i["path"] for i in images] == new_paths
    assert [i["sort_order"] for i in images] == [0, 1, 2]


@pytest.mark.asyncio
async def test_replace_images_rejects_foreign_path(client, clean_products):
    """타 판매자 경로·임의 문자열은 거부 — 등록과 같은 소유권 검사."""
    admin_t = await _admin_token(client)
    cid = await _category(client, admin_t)
    t, sid = await _seller_with_prefix(client, admin_t)
    pid = (await client.post(
        "/api/v1/sellers/products", json=_product_body(sid, cid), headers=_auth(t)
    )).json()["id"]

    res = await client.put(
        f"/api/v1/sellers/products/{pid}/images",
        json={"image_paths": ["../other-seller/steal.jpg"]},
        headers=_auth(t),
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_replace_images_foreign_product_404(client, clean_products):
    """남의 상품 이미지는 못 바꾼다 (존재 노출 방지로 404)."""
    import uuid as _uuid

    admin_t = await _admin_token(client)
    cid = await _category(client, admin_t)
    t, sid = await _seller_with_prefix(client, admin_t)
    pid = (await client.post(
        "/api/v1/sellers/products", json=_product_body(sid, cid), headers=_auth(t)
    )).json()["id"]

    t2, sid2 = await second_seller(client, admin_t, email="seller-img@example.com")
    res = await client.put(
        f"/api/v1/sellers/products/{pid}/images",
        json={"image_paths": [f"{sid2}/{_uuid.uuid7()}.jpg"]},  # 형식은 유효한 본인 경로 — 막히는 건 상품 소유권
        headers=_auth(t2),
    )
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_replace_images_deletes_removed_objects(client, clean_products, monkeypatch):
    """교체로 빠진 사진은 Storage에서도 지운다 — 안 지우면 공개 URL로 계속 열린다."""
    import uuid as _uuid

    from app.products import storage as products_storage

    deleted: list[list[str]] = []

    async def _spy(paths):
        deleted.append(list(paths))
        return len(paths)

    monkeypatch.setattr(products_storage, "delete_objects", _spy)

    admin_t = await _admin_token(client)
    cid = await _category(client, admin_t)
    t, sid = await _seller_with_prefix(client, admin_t)
    body = _product_body(sid, cid, n_images=2)
    pid = (await client.post("/api/v1/sellers/products", json=body, headers=_auth(t))).json()["id"]
    old = body["image_paths"]

    keep, new_path = old[0], f"{sid}/{_uuid.uuid7()}.jpg"
    res = await client.put(
        f"/api/v1/sellers/products/{pid}/images", json={"image_paths": [keep, new_path]}, headers=_auth(t)
    )
    assert res.status_code == 200

    # 남긴 사진은 지우지 않고, 빠진 사진만 지운다
    assert deleted == [[old[1]]], deleted


@pytest.mark.asyncio
async def test_replace_images_survives_storage_failure(client, clean_products, monkeypatch):
    """Storage 삭제가 실패해도 상품 수정은 성공한다 — 판매자가 수정 자체를 못 하게 되면 안 된다."""
    import uuid as _uuid

    from app.products import storage as products_storage

    async def _boom(paths):
        raise RuntimeError("storage down")

    monkeypatch.setattr(products_storage, "delete_objects", _boom)

    admin_t = await _admin_token(client)
    cid = await _category(client, admin_t)
    t, sid = await _seller_with_prefix(client, admin_t)
    body = _product_body(sid, cid, n_images=2)
    pid = (await client.post("/api/v1/sellers/products", json=body, headers=_auth(t))).json()["id"]

    res = await client.put(
        f"/api/v1/sellers/products/{pid}/images",
        json={"image_paths": [f"{sid}/{_uuid.uuid7()}.jpg"]}, headers=_auth(t),
    )
    assert res.status_code == 200
