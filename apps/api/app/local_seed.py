"""Hub맥 로컬 검증 전용 데모 카탈로그 시더.

실행: docker compose --profile tools run --rm seed

- `ENVIRONMENT=local` + Docker Postgres(host=postgres)에서만 실행한다.
- 공개 API/관리 API/판매자 API 경로를 사용해 실제 권한·도메인 규칙을 통과한다.
- 같은 로컬 DB에서 여러 번 실행해도 시드 상품이 있으면 no-op이다.
- Supabase Storage는 요구하지 않는다. Storage 미설정 시 공개 응답은 이미지 URL을 null로 반환한다.
"""

import asyncio
import sys
import uuid
from urllib.parse import urlsplit

import httpx
from sqlalchemy import select

from app.auth.bootstrap import grant_admin
from app.core.config import get_settings
from app.core.db import async_session_factory
from app.main import app
from app.sellers.models import Seller

ADMIN = {
    "email": "local-admin@example.com",
    "password": "local-admin-password-2026",
    "name": "로컬 관리자",
}
SELLER = {
    "email": "local-seller@example.com",
    "password": "local-seller-password-2026",
    "name": "로컬 판매자",
}
BRAND_NAME = "SLUR 로컬 스튜디오"
MARKER = "[로컬 검증]"

CATEGORIES = ("문구", "생활")
PRODUCTS = (
    {"name": "[로컬 검증] 페이퍼 트레이", "category": "문구", "price": 18000, "stock": 12},
    {"name": "[로컬 검증] 오브제 엽서 세트", "category": "문구", "price": 6500, "stock": 24},
    {"name": "[로컬 검증] 데스크 메모 패드", "category": "문구", "price": 9000, "stock": 0},
    {"name": "[로컬 검증] 리넨 코스터", "category": "생활", "price": 14000, "stock": 16},
    {"name": "[로컬 검증] 유리 머그", "category": "생활", "price": 22000, "stock": 8},
    {"name": "[로컬 검증] 소프트 타월", "category": "생활", "price": 12000, "stock": 20},
)

# 홈 편성(시안 C · Epic 9) 데모. 관리자 편성 API를 통해 멱등 생성한다.
# 로컬은 Supabase Storage 미연결이라 히어로 이미지 없이 표제 블록으로 뜬다(프론트가 null 이미지를 배경으로 처리).
HERO = {
    "kind": "hero",
    "layout": "feature",
    "title": f"{MARKER} 이번 지면",
    "issue_no": "NO. 01",
    "issue_label": "2026.07",
    "lead_text": "Hub맥에서 편성 흐름을 검증하는 로컬 데모 지면입니다. 골라온 것들을 천천히 봅니다.",
    "display_order": 0,
}
# 슬롯: (레이아웃, 제목, 리드, 노출순서, 카테고리, 담을 상품 수)
SLOTS = (
    {"layout": "feature", "title": f"{MARKER} 골라온 문구", "lead": "책상 위에 두고 오래 쓰는 것들.", "order": 1, "category": "문구", "count": 2},
    {"layout": "strip", "title": f"{MARKER} 함께 보기", "lead": "생활을 조금 더 단정하게.", "order": 2, "category": "생활", "count": 3},
)


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _require_local_database() -> None:
    settings = get_settings()
    normalized = settings.database_url.replace("postgresql+asyncpg://", "postgresql://", 1)
    host = urlsplit(normalized).hostname
    if settings.environment != "local" or host != "postgres":
        raise RuntimeError(
            "로컬 시더는 ENVIRONMENT=local 및 Docker Postgres(host=postgres)에서만 실행할 수 있습니다."
        )


async def _signup_or_login(client: httpx.AsyncClient, account: dict[str, str]) -> dict:
    signup = await client.post("/api/v1/auth/signup", json=account)
    if signup.status_code == 201:
        return signup.json()
    login = await client.post(
        "/api/v1/auth/login", json={"email": account["email"], "password": account["password"]}
    )
    login.raise_for_status()
    return login.json()


async def _seller_id() -> uuid.UUID:
    async with async_session_factory() as session:
        seller_id = await session.scalar(select(Seller.id).where(Seller.brand_name == BRAND_NAME))
    if seller_id is None:
        raise RuntimeError("로컬 판매자 프로필을 찾을 수 없습니다.")
    return seller_id


async def _seed_home_features(client: httpx.AsyncClient, admin_token: str) -> None:
    """홈 편성(Epic 9) 데모를 멱등 생성한다. 카탈로그 유무와 독립 — 편성 없는 기존 로컬 DB에도 채워진다."""
    listing = await client.get("/api/v1/admin/home/features", headers=_headers(admin_token))
    listing.raise_for_status()
    if any(row["title"].startswith(MARKER) for row in listing.json()["items"]):
        print("로컬 데모 편성이 이미 있습니다. 편성 생성은 건너뜁니다.")
        return

    categories = (await client.get("/api/v1/products/categories")).json()
    category_ids = {row["name"]: row["id"] for row in categories}
    products = (await client.get("/api/v1/products")).json()["items"]

    def picks(category_name: str, count: int) -> list[str]:
        cid = category_ids.get(category_name)
        return [p["id"] for p in products if p.get("category_id") == cid and p["name"].startswith(MARKER)][:count]

    # 히어로 — 시안 C상 상품 카드를 그리지 않으므로 품목은 비운다(표제·서문·이미지 자리만).
    created = await client.post(
        "/api/v1/admin/home/features", json={**HERO, "product_ids": []}, headers=_headers(admin_token)
    )
    created.raise_for_status()

    for slot in SLOTS:
        created = await client.post(
            "/api/v1/admin/home/features",
            json={
                "kind": "slot",
                "layout": slot["layout"],
                "title": slot["title"],
                "lead_text": slot["lead"],
                "display_order": slot["order"],
                "product_ids": picks(slot["category"], slot["count"]),
            },
            headers=_headers(admin_token),
        )
        created.raise_for_status()

    print(f"로컬 데모 편성 생성 완료: 히어로 1 + 슬롯 {len(SLOTS)}개")


async def seed() -> None:
    _require_local_database()
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://local-seed") as client:
        # 관리자 준비 — 카탈로그·편성 양쪽에 필요하므로 카탈로그 no-op 분기보다 먼저 확보한다.
        await _signup_or_login(client, ADMIN)
        if await grant_admin(ADMIN["email"]) != 0:
            raise RuntimeError("로컬 관리자 권한을 부여할 수 없습니다.")
        admin = await _signup_or_login(client, ADMIN)
        admin_token = admin["access_token"]

        existing = await client.get("/api/v1/products")
        existing.raise_for_status()
        if any(item["name"].startswith(MARKER) for item in existing.json()["items"]):
            print("로컬 데모 카탈로그가 이미 있습니다. 카탈로그 생성은 건너뜁니다.")
        else:
            categories = (await client.get("/api/v1/products/categories")).json()
            category_ids = {row["name"]: row["id"] for row in categories}
            for name in CATEGORIES:
                if name not in category_ids:
                    created = await client.post("/api/v1/admin/categories", json={"name": name}, headers=_headers(admin_token))
                    created.raise_for_status()
                    category_ids[name] = created.json()["id"]

            seller = await _signup_or_login(client, SELLER)
            seller_token = seller["access_token"]
            profile = await client.get("/api/v1/sellers/me", headers=_headers(seller_token))
            if profile.status_code != 200:
                application = await client.get("/api/v1/sellers/applications/me", headers=_headers(seller_token))
                if application.status_code == 404:
                    application = await client.post(
                        "/api/v1/sellers/applications",
                        json={
                            "company_name": "SLUR 로컬 테스트 상점",
                            "representative_name": "로컬 운영자",
                            "business_registration_number": "2208162517",
                            "mail_order_number": "로컬 검증 전용",
                            "business_address": "Hub맥 로컬 환경",
                            "contact_phone": "01012345678",
                            "brand_name": BRAND_NAME,
                            "brand_intro": "Hub맥에서 서비스 운영 흐름을 검증하는 로컬 전용 데모 상점입니다.",
                        },
                        headers=_headers(seller_token),
                    )
                application.raise_for_status()
                approval = await client.post(
                    f"/api/v1/admin/seller-applications/{application.json()['id']}/approve",
                    headers=_headers(admin_token),
                )
                # 이미 승인된 신청을 다시 시도할 때만 명시적으로 실패시킨다.
                approval.raise_for_status()
                seller = await _signup_or_login(client, SELLER)
                seller_token = seller["access_token"]

            seller_id = await _seller_id()
            for product in PRODUCTS:
                created = await client.post(
                    "/api/v1/sellers/products",
                    json={
                        "name": product["name"],
                        "base_price": product["price"],
                        "description": "실제 운영 데이터와 분리된 Hub맥 로컬 검증용 데모 상품입니다.",
                        "category_id": category_ids[product["category"]],
                        # 등록 API의 이미지 소유권 규약을 만족하는 경로. Storage 미연결 로컬 환경에서는 공개 URL을 만들지 않는다.
                        "image_paths": [f"{seller_id}/{uuid.uuid7()}.jpg"],
                        "stock": product["stock"],
                    },
                    headers=_headers(seller_token),
                )
                created.raise_for_status()

            print(f"로컬 데모 카탈로그 생성 완료: 카테고리 {len(CATEGORIES)}개, 상품 {len(PRODUCTS)}개")

        # 편성은 카탈로그와 독립적으로 멱등 처리 — 기존 로컬 DB(편성 이전 시드)에도 편성이 채워지게 한다.
        await _seed_home_features(client, admin_token)


if __name__ == "__main__":
    try:
        asyncio.run(seed())
    except Exception as exc:
        print(f"로컬 시드 실패: {type(exc).__name__}: {exc}", file=sys.stderr)
        raise SystemExit(1)
