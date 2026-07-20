"""공용 테스트 헬퍼 (회고 액션 A-E456-2).

파일 간 사적 import로 얽혀 있던 헬퍼들을 한곳에 승격.
- conftest.py는 픽스처 전용 (client·clean_auth_tables·clean_products 등)
- 각 헬퍼의 docstring에 원 출처 스토리를 표기한다.
"""

import uuid as _uuid

from sqlalchemy import text

from app.auth.bootstrap import grant_admin

# ── 상수 ──────────────────────────────────────────────────────────

ADMIN = {"email": "admin@example.com", "password": "password123", "name": "관리자"}  # Story 2.2
BRAND = {"email": "brand2@example.com", "password": "password123", "name": "브랜드2"}  # Story 2.2

VALID_APP = {  # Story 2.1
    "company_name": "슬러상회",
    "representative_name": "김슬러",
    "business_registration_number": "220-81-62517",  # 체크섬 유효 (테스트용 공개 번호)
    "mail_order_number": "제2026-서울-0001호",
    "business_address": "서울시 어딘가 1-2",
    "contact_phone": "01012345678",
    "brand_name": "슬러굿즈",
    "brand_intro": "결이 맞는 디자인 소품을 만듭니다.",
}

GRID = {  # Story 3.3 — 2×3 옵션 조합 그리드
    "variants": [
        {"option1_name": "색상", "option1_value": c, "option2_name": "사이즈", "option2_value": s,
         "extra_price": 1000 if s == "L" else 0, "stock": 5, "is_active": True}
        for c in ["블랙", "화이트"] for s in ["S", "M", "L"]
    ]
}

ADDRESS = {  # Story 4.4 — 주문 배송지
    "postal_code": "06236", "recipient_name": "김수령", "recipient_phone": "01012345678",
    "address1": "서울시 강남구 테헤란로 1", "address2": "101호", "order_note": "문 앞에 놓아주세요",
}

# ── auth ─────────────────────────────────────────────────────────


def _auth(t):
    """Story 2.1 — Bearer 헤더."""
    return {"Authorization": f"Bearer {t}"}


async def _buyer(client, email="buyer@example.com"):
    """Story 4.1 — 구매자 가입 → access_token."""
    res = await client.post("/api/v1/auth/signup", json={"email": email, "password": "password123", "name": "구매자"})
    return res.json()["access_token"]


async def _admin_token(client):
    """Story 2.2 — ADMIN 가입 + grant_admin + refresh → access_token (테스트당 1회만 가능)."""
    signup = await client.post("/api/v1/auth/signup", json=ADMIN)
    refresh = signup.json()["refresh_token"]
    await grant_admin(ADMIN["email"])
    res = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
    return res.json()["access_token"]


async def _admin_login(client) -> str:
    """Story 5.3 — _shop 등이 admin 가입을 이미 수행했을 때 로그인으로 토큰만 받는다."""
    res = await client.post("/api/v1/auth/login", json={"email": ADMIN["email"], "password": ADMIN["password"]})
    return res.json()["access_token"]


async def _submit_application(client):
    """Story 2.2 — BRAND 가입 + 입점 신청 → (application_id, refresh_token)."""
    signup = await client.post("/api/v1/auth/signup", json=BRAND)
    t = signup.json()["access_token"]
    res = await client.post("/api/v1/sellers/applications", json=VALID_APP, headers=_auth(t))
    return res.json()["id"], signup.json()["refresh_token"]


# ── 판매자·상품 ───────────────────────────────────────────────────


async def _category(client, admin_t, name="문구"):
    """Story 3.2 — 카테고리 생성 → id."""
    res = await client.post("/api/v1/admin/categories", json={"name": name}, headers=_auth(admin_t))
    return res.json()["id"]


def _product_body(seller_prefix, category_id, n_images=2):
    """Story 3.2 — 상품 등록 body."""
    return {
        "name": "결 좋은 엽서",
        "base_price": 3000,
        "description": "손으로 그린 엽서입니다.",
        "category_id": category_id,
        "image_paths": [f"{seller_prefix}/{_uuid.uuid7()}.jpg" for i in range(n_images)],
    }


async def _seller_with_prefix(client, admin_t):
    """Story 3.2 — BRAND 입점 신청·승인 → (seller_token, seller_id). admin 토큰 재사용 (중복 admin 가입 방지)."""
    app_id, brand_refresh = await _submit_application(client)
    await client.post(f"/api/v1/admin/seller-applications/{app_id}/approve", headers=_auth(admin_t))
    r = await client.post("/api/v1/auth/refresh", json={"refresh_token": brand_refresh})
    t = r.json()["access_token"]
    from app.core.db import engine

    async with engine.begin() as conn:
        sid = (await conn.execute(text("SELECT id FROM sellers LIMIT 1"))).scalar()
    return t, str(sid)


async def second_seller(client, admin_t, email, brand="둘째굿즈"):
    """Story 4.2 preview 관례 승격 — 제2 판매자 가입·신청·승인 → (seller_token, seller_id).

    _seller_with_prefix는 고정 이메일·단일 seller 전제라 다중 판매자 시나리오는 이 함수를 쓴다.
    seller_id는 brand_name 정확 조회 (최신 행 추정 금지 — 4.2 리뷰 반영).
    """
    s2 = await client.post("/api/v1/auth/signup", json={"email": email, "password": "password123", "name": "판매자2"})
    t2raw, r2 = s2.json()["access_token"], s2.json()["refresh_token"]
    app2 = await client.post("/api/v1/sellers/applications", json={
        "company_name": "둘째상회", "representative_name": "김둘", "business_registration_number": "2208162517",
        "mail_order_number": "제2026-서울-0009호", "business_address": "서울", "contact_phone": "01099998888",
        "brand_name": brand, "brand_intro": "두 번째 브랜드"}, headers=_auth(t2raw))
    await client.post(f"/api/v1/admin/seller-applications/{app2.json()['id']}/approve", headers=_auth(admin_t))
    t2 = (await client.post("/api/v1/auth/refresh", json={"refresh_token": r2})).json()["access_token"]
    from app.core.db import engine

    async with engine.begin() as conn:
        sid2 = str((await conn.execute(text("SELECT id FROM sellers WHERE brand_name = :b"), {"b": brand})).scalar_one())
    return t2, sid2


async def _shop(client, stock=5):
    """Story 4.1 — 판매자·상품·2×3 옵션 그리드 준비 → (seller_token, product_id, variants)."""
    admin_t = await _admin_token(client)
    t, sid = await _seller_with_prefix(client, admin_t)
    cid = await _category(client, admin_t, name="장바구니용")
    res = await client.post("/api/v1/sellers/products", json=_product_body(sid, cid), headers=_auth(t))
    pid = res.json()["id"]
    grid = {"variants": [{**v, "stock": stock} for v in GRID["variants"]]}
    res = await client.put(f"/api/v1/sellers/products/{pid}/variants", json=grid, headers=_auth(t))
    return t, pid, res.json()["variants"]


# ── 주문 ─────────────────────────────────────────────────────────


async def _fees(client, st, base=3000, jeju=3000, island=5000):
    """Story 4.4 — 판매자 배송비 설정."""
    res = await client.put(
        "/api/v1/sellers/me/shipping-fees",
        json={"base_shipping_fee": base, "jeju_extra_fee": jeju, "island_extra_fee": island}, headers=_auth(st),
    )
    assert res.status_code == 200


async def _expected(client, bt, postal="06236") -> int:
    """Story 4.4 — 미리보기 총액 — 주문 body의 expected_grand_total 소스 (price_changed 방지 계약)."""
    res = await client.post("/api/v1/orders/preview", json={"postal_code": postal}, headers=_auth(bt))
    assert res.status_code == 200
    return res.json()["grand_total"]


async def _cart_ids(client, bt) -> list[str]:
    """Story 4.4 — 구매 가능 장바구니 항목 id 목록."""
    cart = (await client.get("/api/v1/carts", headers=_auth(bt))).json()
    return [i["id"] for i in cart["items"] if i["purchasable"]]


async def make_order(client, bt) -> tuple[str, str]:
    """Story 4.6·5.1 — 장바구니 전체로 주문 생성 → (order_id, 첫 sub_order_id)."""
    from sqlalchemy import select

    from app.core.db import async_session_factory
    from app.orders.models import SubOrder

    ids = await _cart_ids(client, bt)
    res = await client.post(
        "/api/v1/orders",
        json={"cart_item_ids": ids, "expected_grand_total": await _expected(client, bt), **ADDRESS},
        headers=_auth(bt),
    )
    assert res.status_code == 201
    oid = res.json()["order_id"]
    async with async_session_factory() as session:
        sid = await session.scalar(select(SubOrder.id).where(SubOrder.order_id == _uuid.UUID(oid)))
    return oid, str(sid)


async def _paid_order(client, bt, admin_t, vs, qty=1) -> tuple[str, str]:
    """Story 5.3 — 주문 생성 + 입금 확인 → (order_id, sub_order_id) — preparing 상태 조성."""
    from sqlalchemy import select

    from app.core.db import async_session_factory
    from app.orders.models import SubOrder

    await client.post("/api/v1/carts/items", json={"variant_id": vs[0]["id"], "quantity": qty}, headers=_auth(bt))
    ids = await _cart_ids(client, bt)
    exp = await _expected(client, bt)
    res = await client.post(
        "/api/v1/orders", json={"cart_item_ids": ids, "expected_grand_total": exp, **ADDRESS}, headers=_auth(bt)
    )
    oid = res.json()["order_id"]
    r = await client.post(
        f"/api/v1/admin/orders/{oid}/confirm-payment", json={"expected_grand_total": exp}, headers=_auth(admin_t)
    )
    assert r.status_code == 204
    async with async_session_factory() as session:
        sid = await session.scalar(select(SubOrder.id).where(SubOrder.order_id == _uuid.UUID(oid)))
    return oid, str(sid)
