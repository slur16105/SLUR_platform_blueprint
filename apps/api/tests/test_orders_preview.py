"""주문서 미리보기·배송비 계산 테스트 (Story 4.2)."""

import pytest

from tests.test_admin_approval import _admin_token
from tests.test_carts import _buyer, _shop
from tests.test_products import _category, _product_body, _seller_with_prefix, clean_products  # noqa: F401
from tests.test_seller_application import _auth
from tests.test_variants import GRID

PREVIEW = "/api/v1/orders/preview"
FEES = {"base_shipping_fee": 3000, "jeju_extra_fee": 3000, "island_extra_fee": 5000}

ZIP_NORMAL = "06236"  # 서울 강남 — 시드 목록 밖 = 일반
ZIP_JEJU = "63001"
ZIP_ISLAND = "40200"  # 경북 울릉군


async def _set_fees(client, seller_token, **override):
    res = await client.put("/api/v1/sellers/me/shipping-fees", json={**FEES, **override}, headers=_auth(seller_token))
    assert res.status_code == 200


@pytest.mark.asyncio
async def test_seed_remote_area_zips_and_settings(client):
    """AC 1: 마이그레이션 시드 검증 — 판정 테이블과 settings 3종."""
    from app.core.db import async_session_factory
    from app.orders import service

    async with async_session_factory() as session:
        assert await service.get_remote_area_kind(session, ZIP_JEJU) == "jeju"
        assert await service.get_remote_area_kind(session, "63000") == "jeju"  # 범위 시작
        assert await service.get_remote_area_kind(session, "63644") == "jeju"  # 범위 끝
        assert await service.get_remote_area_kind(session, "62999") is None  # 범위 직전 (경계 회귀 그물)
        assert await service.get_remote_area_kind(session, "63645") is None  # 범위 직후
        assert await service.get_remote_area_kind(session, ZIP_ISLAND) == "island"
        assert await service.get_remote_area_kind(session, ZIP_NORMAL) is None  # 목록 밖 = 일반 (앞자리 0 포함)
        assert await service.get_remote_area_kind(session, "04985") is None  # 앞자리 0 일반 지역
        assert await service.get_setting(session, service.SETTING_UNPAID_CANCEL_DAYS) == "3"
        assert await service.get_setting(session, service.SETTING_LOW_STOCK_THRESHOLD) == "5"
        assert await service.get_setting(session, service.SETTING_DEPOSIT_ACCOUNT)  # 값 존재 (placeholder 허용)


@pytest.mark.asyncio
async def test_preview_normal_area_single_seller(client, clean_products):
    """AC 2: 일반 지역 — 기본 배송비만, 추가비 0. 전 금액 백엔드 계산 (AD-12)."""
    st, pid, vs = await _shop(client)
    await _set_fees(client, st)
    bt = await _buyer(client)
    await client.post("/api/v1/carts/items", json={"variant_id": vs[0]["id"], "quantity": 2}, headers=_auth(bt))

    res = await client.post(PREVIEW, json={"postal_code": ZIP_NORMAL}, headers=_auth(bt))
    assert res.status_code == 200
    body = res.json()
    line = (3000 + vs[0]["extra_price"]) * 2
    assert body["remote_area_kind"] is None
    assert len(body["seller_groups"]) == 1
    g = body["seller_groups"][0]
    assert g["item_total"] == line and g["shipping_fee"] == 3000 and g["remote_extra_fee"] == 0
    assert g["shipping_total"] == 3000  # 그룹 표시용 합산도 서버 값 (AD-12)
    assert g["items"][0]["line_total"] == line and g["items"][0]["quantity"] == 2
    assert body["item_total"] == line and body["shipping_total"] == 3000
    assert body["remote_extra_total"] == 0
    assert body["grand_total"] == line + 3000


@pytest.mark.asyncio
async def test_preview_jeju_and_island_extra(client, clean_products):
    """AC 2: 제주는 jeju_extra_fee, 도서는 island_extra_fee (FR-17)."""
    st, pid, vs = await _shop(client)
    await _set_fees(client, st)
    bt = await _buyer(client)
    await client.post("/api/v1/carts/items", json={"variant_id": vs[0]["id"], "quantity": 1}, headers=_auth(bt))
    line = 3000 + vs[0]["extra_price"]

    jeju = (await client.post(PREVIEW, json={"postal_code": ZIP_JEJU}, headers=_auth(bt))).json()
    assert jeju["remote_area_kind"] == "jeju"
    assert jeju["remote_extra_total"] == 3000
    assert jeju["seller_groups"][0]["shipping_total"] == 3000 + 3000  # 그룹 합산 서버 값
    assert jeju["grand_total"] == line + 3000 + 3000

    island = (await client.post(PREVIEW, json={"postal_code": ZIP_ISLAND}, headers=_auth(bt))).json()
    assert island["remote_area_kind"] == "island"
    assert island["remote_extra_total"] == 5000
    assert island["grand_total"] == line + 3000 + 5000


@pytest.mark.asyncio
async def test_preview_free_shipping(client, clean_products):
    """무료 배송(0원) 판매자 — 일반 지역 총액 = 상품 합계."""
    st, pid, vs = await _shop(client)
    await _set_fees(client, st, base_shipping_fee=0)
    bt = await _buyer(client)
    await client.post("/api/v1/carts/items", json={"variant_id": vs[0]["id"], "quantity": 1}, headers=_auth(bt))

    body = (await client.post(PREVIEW, json={"postal_code": ZIP_NORMAL}, headers=_auth(bt))).json()
    assert body["shipping_total"] == 0
    assert body["grand_total"] == body["item_total"]


@pytest.mark.asyncio
async def test_preview_multi_seller_grouping(client, clean_products):
    """AC 2: 판매자별 그룹·배송비는 판매자마다 각각 부과 (FR-14·17)."""
    # 판매자 2명은 admin 토큰 1회로 구성 (_admin_token은 signup 1회만 가능)
    admin_t = await _admin_token(client)
    cid = await _category(client, admin_t, name="미리보기")
    st1, sid1 = await _seller_with_prefix(client, admin_t)
    pid1 = (await client.post("/api/v1/sellers/products", json=_product_body(sid1, cid), headers=_auth(st1))).json()["id"]
    vs1 = (await client.put(
        f"/api/v1/sellers/products/{pid1}/variants",
        json={"variants": [{**v, "stock": 5} for v in GRID["variants"]]}, headers=_auth(st1),
    )).json()["variants"]
    await _set_fees(client, st1)  # 3000
    # 제2 판매자 — _seller_with_prefix는 고정 이메일·단일 seller 전제라 인라인 구성 (test_products 관례)
    s2 = await client.post("/api/v1/auth/signup", json={"email": "seller-preview2@example.com", "password": "password123", "name": "판매자2"})
    t2raw, r2 = s2.json()["access_token"], s2.json()["refresh_token"]
    app2 = await client.post("/api/v1/sellers/applications", json={
        "company_name": "둘째상회", "representative_name": "김둘", "business_registration_number": "2208162517",
        "mail_order_number": "제2026-서울-0009호", "business_address": "서울", "contact_phone": "01099998888",
        "brand_name": "둘째굿즈", "brand_intro": "두 번째 브랜드"}, headers=_auth(t2raw))
    await client.post(f"/api/v1/admin/seller-applications/{app2.json()['id']}/approve", headers=_auth(admin_t))
    t2 = (await client.post("/api/v1/auth/refresh", json={"refresh_token": r2})).json()["access_token"]
    from sqlalchemy import text
    from app.core.db import engine
    async with engine.begin() as conn:  # 최신 행 추정 대신 brand_name 정확 조회 (리뷰 반영)
        sid2 = str((await conn.execute(text("SELECT id FROM sellers WHERE brand_name = '둘째굿즈'"))).scalar_one())
    pid2 = (await client.post("/api/v1/sellers/products", json=_product_body(sid2, cid), headers=_auth(t2))).json()["id"]
    vs2 = (await client.put(
        f"/api/v1/sellers/products/{pid2}/variants",
        json={"variants": [{**v, "stock": 5} for v in GRID["variants"]]}, headers=_auth(t2),
    )).json()["variants"]
    await _set_fees(client, t2, base_shipping_fee=2500, jeju_extra_fee=1000)

    bt = await _buyer(client)
    await client.post("/api/v1/carts/items", json={"variant_id": vs1[0]["id"], "quantity": 1}, headers=_auth(bt))
    await client.post("/api/v1/carts/items", json={"variant_id": vs2[0]["id"], "quantity": 2}, headers=_auth(bt))

    body = (await client.post(PREVIEW, json={"postal_code": ZIP_NORMAL}, headers=_auth(bt))).json()
    assert len(body["seller_groups"]) == 2
    assert body["shipping_total"] == 3000 + 2500  # 판매자별 각각 부과 후 합산
    assert body["item_total"] == sum(g["item_total"] for g in body["seller_groups"])

    jeju = (await client.post(PREVIEW, json={"postal_code": ZIP_JEJU}, headers=_auth(bt))).json()
    assert jeju["remote_extra_total"] == 3000 + 1000  # 판매자별 제주 추가비 합


@pytest.mark.asyncio
async def test_preview_excludes_unpurchasable(client, clean_products):
    """AC 4: 구매 불가 항목 제외 (AD-10), 전부 불가면 422 empty_cart."""
    st, pid, vs = await _shop(client)
    await _set_fees(client, st)
    bt = await _buyer(client)
    await client.post("/api/v1/carts/items", json={"variant_id": vs[0]["id"], "quantity": 1}, headers=_auth(bt))
    await client.post("/api/v1/carts/items", json={"variant_id": vs[1]["id"], "quantity": 1}, headers=_auth(bt))

    # vs[0] 조합 수동 품절 → 미리보기에서 제외
    grid = {"variants": [{**v, "stock": 5, "is_active": i != 0} for i, v in enumerate(GRID["variants"])]}
    await client.put(f"/api/v1/sellers/products/{pid}/variants", json=grid, headers=_auth(st))
    body = (await client.post(PREVIEW, json={"postal_code": ZIP_NORMAL}, headers=_auth(bt))).json()
    assert len(body["seller_groups"]) == 1
    assert len(body["seller_groups"][0]["items"]) == 1  # 품절 조합 빠짐

    # 상품 숨김 → 전부 불가 = empty_cart
    await client.patch(f"/api/v1/sellers/products/{pid}", json={"status": "hidden"}, headers=_auth(st))
    res = await client.post(PREVIEW, json={"postal_code": ZIP_NORMAL}, headers=_auth(bt))
    assert res.status_code == 422 and res.json()["code"] == "empty_cart"


@pytest.mark.asyncio
async def test_preview_empty_cart_422(client, clean_products):
    """장바구니가 비어 있어도 422 empty_cart."""
    bt = await _buyer(client)
    res = await client.post(PREVIEW, json={"postal_code": ZIP_NORMAL}, headers=_auth(bt))
    assert res.status_code == 422 and res.json()["code"] == "empty_cart"


@pytest.mark.asyncio
async def test_preview_postal_code_validation(client, clean_products):
    """우편번호 형식(숫자 5자리) 위반은 422 validation_error 봉투."""
    bt = await _buyer(client)
    for bad in ("1234", "123456", "abcde", "6323a", ""):
        res = await client.post(PREVIEW, json={"postal_code": bad}, headers=_auth(bt))
        assert res.status_code == 422 and res.json()["code"] == "validation_error"


@pytest.mark.asyncio
async def test_preview_requires_login(client, clean_products):
    assert (await client.post(PREVIEW, json={"postal_code": ZIP_NORMAL})).status_code == 401
