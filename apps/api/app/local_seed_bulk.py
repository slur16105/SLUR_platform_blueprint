"""Hub맥 로컬 콘솔 화면 검증용 대량 더미 데이터 시더.

실행: docker compose exec -T api uv run python -m app.local_seed_bulk

- `ENVIRONMENT=local` + Docker Postgres(host=postgres)에서만 실행한다 (local_seed와 동일 가드).
- 공개/판매자/관리자 API 경로만 사용해 실제 권한·도메인 규칙·상태전이를 통과한다 (DB 직접 쓰기 없음).
- 마커 `[더미]` 접두사로 재실행 안전: 더미 판매자가 이미 있으면 생성은 건너뛰고 검증만 수행한다.
- 원본 local_seed.py는 건드리지 않고 그 헬퍼(로컬 가드·가입/로그인·헤더·관리자 부트스트랩)만 재사용한다.
"""

import asyncio
import sys
import uuid

import httpx
from sqlalchemy import select

from app.auth.bootstrap import grant_admin
from app.core.db import async_session_factory
from app.sellers.models import Seller
from app.local_seed import (
    ADMIN,
    _headers,
    _require_local_database,
    _signup_or_login,
)

MARKER = "[더미]"
POSTAL = "06236"  # 일반 지역(도서산간 아님) — 배송비 단순화

CATEGORIES = ("문구", "생활", "패션", "리빙", "뷰티", "테크", "푸드")


def _make_brn(idx: int) -> str:
    """국세청 체크섬을 만족하는 사업자등록번호 10자리 생성 (판매자 신청 검증 통과용)."""
    prefix = f"{123456780 + idx * 131:09d}"[:9]
    weights = [1, 3, 7, 1, 3, 7, 1, 3, 5]
    total = sum(int(d) * w for d, w in zip(prefix, weights))
    total += (int(prefix[8]) * 5) // 10
    check = (10 - total % 10) % 10
    return prefix + str(check)


# 판매자 정의 — 영업중(approved) 4 / 심사대기(pending) 3 / 반려(rejected) 1
APPROVED_SELLERS = [
    {"key": "objet", "brand": f"{MARKER} 오브제 스튜디오", "company": "오브제스튜디오", "rep": "김오브"},
    {"key": "paper", "brand": f"{MARKER} 노트 앤 페이퍼", "company": "노트앤페이퍼", "rep": "이페이"},
    {"key": "linen", "brand": f"{MARKER} 린넨 데이즈", "company": "린넨데이즈", "rep": "박린넨"},
    {"key": "wood", "brand": f"{MARKER} 우드 무드", "company": "우드무드공방", "rep": "최우드"},
]
PENDING_SELLERS = [
    {"key": "gray", "brand": f"{MARKER} 그레이 톤", "company": "그레이톤", "rep": "정그레"},
    {"key": "botanic", "brand": f"{MARKER} 보태니컬 랩", "company": "보태니컬랩", "rep": "한보태"},
    {"key": "minimal", "brand": f"{MARKER} 미니멀 키트", "company": "미니멀키트", "rep": "오미니"},
]
REJECTED_SELLERS = [
    {"key": "reject", "brand": f"{MARKER} 샘플 반려샵", "company": "샘플반려샵", "rep": "윤반려"},
]

# 판매자별 상품 톤(디자인 편집숍) — 상품 6개(주문 가능) + 품절(재고0) + 숨김 = 8개
PRODUCT_NAMES = {
    "objet": ["세라믹 오브제 볼", "라운드 트레이", "석고 오브제 세트", "미니 화병", "우드 스탠드", "황동 문진", "리미티드 오브제(품절)", "아카이브 컬렉션(숨김)"],
    "paper": ["린넨 노트 A5", "그리드 다이어리", "레터프레스 카드", "월간 플래너", "떡메모지 세트", "가죽 노트커버", "핸드메이드 노트(품절)", "시즌 노트(숨김)"],
    "linen": ["워시드 린넨 코스터", "린넨 앞치마", "테이블 러너", "린넨 냅킨 4p", "패브릭 파우치", "리넨 티코지", "핸드룸 러그(품절)", "샘플 패브릭(숨김)"],
    "wood": ["오크 도마", "월넛 트레이", "원목 컵받침", "우드 스푼 세트", "티크 정리함", "원목 벽시계", "빈티지 스툴(품절)", "프로토타입 선반(숨김)"],
}

# 구매자 12명
BUYERS = [
    {"key": f"buyer{i:02d}", "name": name}
    for i, name in enumerate(
        ["김민지", "이서준", "박지후", "최유나", "정하람", "강서연", "조은우", "윤도영", "임채원", "한지민", "오세훈", "신아라"],
        start=1,
    )
]

# 주문 계획 — (목표상태, 판매자 수). 총 34건, 멀티 판매자 묶음 포함.
ORDER_PLAN = (
    [("awaiting_payment", 1)] * 9
    + [("awaiting_payment", 2)] * 3
    + [("preparing", 1)] * 5
    + [("preparing", 2)] * 2
    + [("shipping", 1)] * 5
    + [("shipping", 2)] * 1
    + [("delivered", 1)] * 4
    + [("delivered", 2)] * 1
    + [("canceled", 1)] * 3
    + [("canceled", 2)] * 1
)

CARRIERS = ("CJ대한통운", "한진택배", "롯데택배", "우체국택배")


def _email(key: str) -> str:
    return f"dummy-{key}@example.com"


def _phone(idx: int) -> str:
    return f"0101234{idx:04d}"  # 01012340001 형태 — signup 전화 패턴 충족


async def _account(key: str, name: str, idx: int) -> dict:
    return {"email": _email(key), "password": "dummy-password-2026", "name": name, "phone": _phone(idx)}


async def _create_seller(client, admin_token, spec, idx, *, approve, reject=False):
    """가입 → 입점신청 → (approve/reject/보류). 반환: seller_token 또는 None."""
    acct = await _account(spec["key"], spec["rep"], idx)
    session = await _signup_or_login(client, acct)
    token = session["access_token"]
    # 이미 신청이 있으면 재사용 (재실행 안전)
    existing = await client.get("/api/v1/sellers/applications/me", headers=_headers(token))
    if existing.status_code == 200:
        app_id = existing.json()["id"]
    else:
        r = await client.post(
            "/api/v1/sellers/applications",
            json={
                "company_name": spec["company"],
                "representative_name": spec["rep"],
                "business_registration_number": _make_brn(idx),
                "mail_order_number": f"2026-서울-{1000 + idx:05d}",
                "business_address": f"서울특별시 성동구 더미로 {idx}길 {idx * 3}",
                "contact_phone": _phone(idx),
                "brand_name": spec["brand"],
                "brand_intro": f"{spec['brand']} — 로컬 콘솔 화면 검증용 더미 편집숍입니다.",
            },
            headers=_headers(token),
        )
        _check(r, f"입점신청({spec['key']})")
        app_id = r.json()["id"]
    if reject:
        r = await client.post(
            f"/api/v1/admin/seller-applications/{app_id}/reject",
            json={"reason": "더미 데이터: 서류 미비로 반려 처리(테스트)"},
            headers=_headers(admin_token),
        )
        # 이미 반려됨이면 무시
        if r.status_code not in (200, 409, 422):
            _check(r, f"반려({spec['key']})")
        return None
    if approve:
        r = await client.post(
            f"/api/v1/admin/seller-applications/{app_id}/approve",
            headers=_headers(admin_token),
        )
        if r.status_code not in (200, 409, 422):
            _check(r, f"승인({spec['key']})")
        session = await _signup_or_login(client, acct)  # role=seller 반영 토큰 재발급
        return session["access_token"]
    return None  # pending 보류


def _check(resp: httpx.Response, ctx: str) -> None:
    if resp.status_code >= 400:
        raise RuntimeError(f"{ctx} 실패 [{resp.status_code}]: {resp.text}")


async def _seller_id_by_brand(brand: str) -> uuid.UUID:
    """이미지 경로 소유권 규약용 seller_id — /sellers/me가 노출하지 않아 DB 조회 (local_seed 선례)."""
    async with async_session_factory() as session:
        sid = await session.scalar(select(Seller.id).where(Seller.brand_name == brand))
    if sid is None:
        raise RuntimeError(f"seller_id를 찾을 수 없습니다: {brand}")
    return sid


async def _create_products(client, seller_token, spec, category_ids):
    """판매자 상품 8개 생성. 반환: 주문 가능 variant 목록 [{variant_id, price}]."""
    seller_id = await _seller_id_by_brand(spec["brand"])
    orderable = []
    names = PRODUCT_NAMES[spec["key"]]
    cats = list(category_ids.items())
    for i, pname in enumerate(names):
        is_soldout_stock = i == 6  # 재고 0 → 품절 파생
        is_hidden = i == 7
        stock = 0 if is_soldout_stock else (20 + (i * 13) % 70)
        price = 6000 + ((i * 7 + 3) % 12) * 2500  # 6,000 ~ 33,500 다양
        cat_name, cat_id = cats[i % len(cats)]
        body = {
            "name": f"{MARKER} {pname}",
            "base_price": price,
            "description": f"{spec['brand']}의 로컬 검증용 더미 상품입니다. 실제 판매 상품이 아닙니다.",
            "category_id": cat_id,
            "image_paths": [f"{seller_id}/{uuid.uuid4()}.jpg"],
            "stock": stock,
        }
        r = await client.post("/api/v1/sellers/products", json=body, headers=_headers(seller_token))
        _check(r, f"상품생성({pname})")
        data = r.json()
        pid = data["id"]
        vid = data["variants"][0]["id"]
        if is_hidden:
            pr = await client.patch(
                f"/api/v1/sellers/products/{pid}", json={"status": "hidden"}, headers=_headers(seller_token)
            )
            _check(pr, f"숨김전환({pname})")
        elif is_soldout_stock:
            pr = await client.patch(
                f"/api/v1/sellers/products/{pid}", json={"status": "soldout"}, headers=_headers(seller_token)
            )
            _check(pr, f"품절전환({pname})")
        else:
            orderable.append({"variant_id": vid, "price": price})
    return orderable


async def _place_order(client, buyer_token, picks, buyer_name, buyer_idx, order_idx):
    """picks: [{variant_id, price, qty}]. 반환: (order_id, grand_total) 또는 None(스킵)."""
    for p in picks:
        r = await client.post(
            "/api/v1/carts/items",
            json={"variant_id": p["variant_id"], "quantity": p["qty"]},
            headers=_headers(buyer_token),
        )
        if r.status_code >= 400:
            return None  # 재고 소진 등 — 이 주문은 스킵
    preview = await client.post("/api/v1/orders/preview", json={"postal_code": POSTAL}, headers=_headers(buyer_token))
    if preview.status_code >= 400:
        return None
    pv = preview.json()
    cart_item_ids = [it["cart_item_id"] for g in pv["seller_groups"] for it in g["items"]]
    grand = pv["grand_total"]
    body = {
        "cart_item_ids": cart_item_ids,
        "expected_grand_total": grand,
        "postal_code": POSTAL,
        "recipient_name": buyer_name,
        "recipient_phone": _phone(buyer_idx),
        "address1": f"서울특별시 마포구 더미대로 {order_idx}길 {order_idx * 2}",
        "address2": f"{100 + order_idx}호",
        "order_note": "부재 시 문 앞에 놓아주세요 (더미 주문)",
    }
    r = await client.post("/api/v1/orders", json=body, headers=_headers(buyer_token))
    if r.status_code >= 400:
        return None
    data = r.json()
    return data["order_id"], data["grand_total"]


async def _advance_order(client, admin_token, order_id, grand, target, seller_tokens_by_brand):
    """목표 상태까지 전이. seller_tokens_by_brand: {brand_name: token}."""
    if target == "canceled":
        r = await client.post(
            f"/api/v1/admin/orders/{order_id}/cancel",
            json={"reason": "더미: 구매자 요청 취소", "responsibility": "buyer", "note": "로컬 검증"},
            headers=_headers(admin_token),
        )
        _check(r, "관리자 주문취소")
        return
    if target == "awaiting_payment":
        return
    # preparing / shipping / delivered → 입금확인
    r = await client.post(
        f"/api/v1/admin/orders/{order_id}/confirm-payment",
        json={"note": "더미: 무통장입금 확인", "expected_grand_total": grand},
        headers=_headers(admin_token),
    )
    _check(r, "입금확인")
    if target == "preparing":
        return
    # 배송중/배송완료 — 각 판매자 묶음(sub_order)을 송장 발송
    detail = await client.get(f"/api/v1/admin/orders/{order_id}", headers=_headers(admin_token))
    _check(detail, "관리자 주문상세")
    for sub in detail.json()["sub_orders"]:
        brand = sub["brand_name"]
        token = seller_tokens_by_brand.get(brand)
        if token is None:
            continue
        sub_id = await _find_sub_order(client, token, order_id, "preparing")
        if sub_id is None:
            continue
        r = await client.post(
            f"/api/v1/sellers/sub-orders/{sub_id}/ship",
            json={"carrier": CARRIERS[hash(sub_id) % len(CARRIERS)], "tracking_number": f"{abs(hash(order_id)) % 10**12:012d}"},
            headers=_headers(token),
        )
        _check(r, "판매자 송장발송")
        if target == "delivered":
            r = await client.post(
                f"/api/v1/sellers/sub-orders/{sub_id}/deliver", headers=_headers(token)
            )
            _check(r, "판매자 배송완료")


async def _find_sub_order(client, seller_token, order_id, status):
    r = await client.get(f"/api/v1/sellers/orders?status={status}&page=1", headers=_headers(seller_token))
    _check(r, "판매자 주문목록")
    for it in r.json()["items"]:
        if it["order_id"] == order_id:
            return it["sub_order_id"]
    return None


async def _already_seeded(client, admin_token) -> bool:
    # 더미 상품 존재 여부로 판정 — 최종 산출물 기준(부분 판매자만 만들어진 중단 상태는 재개 가능).
    r = await client.get("/api/v1/admin/products", params={"q": MARKER}, headers=_headers(admin_token))
    if r.status_code >= 400:
        return False
    return r.json().get("total", 0) > 0


async def _report(client, admin_token) -> None:
    print("\n===== 최종 데이터 카운트 =====")
    # 판매자
    approved = (await client.get("/api/v1/admin/seller-applications", params={"status": "approved"}, headers=_headers(admin_token))).json()
    pending = (await client.get("/api/v1/admin/seller-applications", params={"status": "pending"}, headers=_headers(admin_token))).json()
    rejected = (await client.get("/api/v1/admin/seller-applications", params={"status": "rejected"}, headers=_headers(admin_token))).json()
    print(f"판매자 신청 — 승인(영업중): {approved['total']}, 심사대기: {pending['total']}, 반려: {rejected['total']}")
    sellers = (await client.get("/api/v1/admin/sellers", headers=_headers(admin_token))).json()
    print(f"판매자(seller 프로필) 총: {sellers['total']}")
    # 회원(구매자 포함 전체)
    users = (await client.get("/api/v1/admin/users", headers=_headers(admin_token))).json()
    print(f"회원(전체 계정) 총: {users['total']}")
    # 상품
    products = (await client.get("/api/v1/admin/products", headers=_headers(admin_token))).json()
    active = (await client.get("/api/v1/admin/products", params={"status": "active"}, headers=_headers(admin_token))).json()
    soldout = (await client.get("/api/v1/admin/products", params={"status": "soldout"}, headers=_headers(admin_token))).json()
    hidden = (await client.get("/api/v1/admin/products", params={"status": "hidden"}, headers=_headers(admin_token))).json()
    print(f"상품 총: {products['total']} (active {active['total']} / soldout {soldout['total']} / hidden {hidden['total']})")
    # 입금대기(입금확인 큐)
    pendingpay = (await client.get("/api/v1/admin/orders/pending", headers=_headers(admin_token))).json()
    print(f"입금대기(입금확인 큐) 총: {pendingpay['total']}")
    # 주문 상태별
    print("주문 상태별 분포:")
    order_total = 0
    for st in ("awaiting_payment", "preparing", "shipping", "delivered", "canceled"):
        d = (await client.get("/api/v1/admin/orders", params={"status": st}, headers=_headers(admin_token))).json()
        order_total += d["total"]
        print(f"  - {st}: {d['total']}")
    allorders = (await client.get("/api/v1/admin/orders", headers=_headers(admin_token))).json()
    print(f"주문 총건수(전체 조회): {allorders['total']}  (상태별 합: {order_total})")


async def seed() -> None:
    _require_local_database()
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://local-seed-bulk", timeout=60) as client:
        # 관리자 확보
        await _signup_or_login(client, ADMIN)
        if await grant_admin(ADMIN["email"]) != 0:
            raise RuntimeError("로컬 관리자 권한을 부여할 수 없습니다.")
        admin = await _signup_or_login(client, ADMIN)
        admin_token = admin["access_token"]

        if await _already_seeded(client, admin_token):
            print("더미 데이터가 이미 있습니다. 생성은 건너뛰고 검증만 수행합니다.")
            await _report(client, admin_token)
            return

        # 카테고리
        existing_cats = (await client.get("/api/v1/products/categories")).json()
        category_ids = {c["name"]: c["id"] for c in existing_cats}
        for name in CATEGORIES:
            if name not in category_ids:
                r = await client.post("/api/v1/admin/categories", json={"name": name}, headers=_headers(admin_token))
                _check(r, f"카테고리({name})")
                category_ids[name] = r.json()["id"]
        # 더미 카탈로그가 쓸 카테고리만 추림(순서 고정)
        cat_subset = {n: category_ids[n] for n in CATEGORIES}
        print(f"카테고리 준비 완료: {len(cat_subset)}개")

        # 판매자 + 상품
        idx = 1
        seller_tokens_by_brand: dict[str, str] = {}
        orderable_by_seller: dict[str, list] = {}
        for spec in APPROVED_SELLERS:
            token = await _create_seller(client, admin_token, spec, idx, approve=True)
            seller_tokens_by_brand[spec["brand"]] = token
            orderable_by_seller[spec["brand"]] = await _create_products(client, token, spec, cat_subset)
            print(f"영업중 판매자 생성: {spec['brand']} (상품 8, 주문가능 {len(orderable_by_seller[spec['brand']])})")
            idx += 1
        for spec in PENDING_SELLERS:
            await _create_seller(client, admin_token, spec, idx, approve=False)
            print(f"심사대기 판매자 생성: {spec['brand']}")
            idx += 1
        for spec in REJECTED_SELLERS:
            await _create_seller(client, admin_token, spec, idx, approve=False, reject=True)
            print(f"반려 판매자 생성: {spec['brand']}")
            idx += 1

        # 구매자
        buyer_tokens = []
        for b_i, b in enumerate(BUYERS, start=1):
            acct = await _account(b["key"], b["name"], 100 + b_i)
            s = await _signup_or_login(client, acct)
            buyer_tokens.append((s["access_token"], b["name"], 100 + b_i))
        print(f"구매자 생성 완료: {len(buyer_tokens)}명")

        # 주문
        brands = list(orderable_by_seller.keys())
        cursors = {brand: 0 for brand in brands}  # 판매자별 variant 순환 커서
        made = {"awaiting_payment": 0, "preparing": 0, "shipping": 0, "delivered": 0, "canceled": 0}
        for o_i, (target, n_sellers) in enumerate(ORDER_PLAN):
            buyer_token, buyer_name, buyer_idx = buyer_tokens[o_i % len(buyer_tokens)]
            chosen = [brands[(o_i + k) % len(brands)] for k in range(n_sellers)]
            picks = []
            for brand in chosen:
                pool = orderable_by_seller[brand]
                if not pool:
                    continue
                v = pool[cursors[brand] % len(pool)]
                cursors[brand] += 1
                picks.append({"variant_id": v["variant_id"], "price": v["price"], "qty": 1 + (o_i % 2)})
            if not picks:
                continue
            result = await _place_order(client, buyer_token, picks, buyer_name, buyer_idx, o_i + 1)
            if result is None:
                continue
            order_id, grand = result
            await _advance_order(client, admin_token, order_id, grand, target, seller_tokens_by_brand)
            made[target] += 1
        print(f"주문 생성 완료: {made}")

        await _report(client, admin_token)


# app import는 가드 통과 후 무겁지 않게 — main 하위 import 순서 유지
from app.main import app  # noqa: E402


if __name__ == "__main__":
    try:
        asyncio.run(seed())
    except Exception as exc:
        print(f"대량 시드 실패: {type(exc).__name__}: {exc}", file=sys.stderr)
        raise SystemExit(1)
