"""관리자 입점 신청 목록 검색 테스트 (q) — Story 2.2 심사 화면.

status 필터 위에 brand_name·company_name·representative_name·
business_registration_number·contact_phone 다섯 컬럼 부분검색(ilike)을 검증한다.
"""

import pytest

from tests.helpers import VALID_APP, _admin_token, _auth

APPS = "/api/v1/admin/seller-applications"


async def _apply(client, email, **overrides):
    """신규 계정 가입 + 입점 신청 (신청당 계정 1개 — pending 유니크). overrides로 필드 커스터마이즈."""
    signup = await client.post("/api/v1/auth/signup", json={"email": email, "password": "password123", "name": email})
    t = signup.json()["access_token"]
    body = {**VALID_APP, **overrides}
    res = await client.post("/api/v1/sellers/applications", json=body, headers=_auth(t))
    assert res.status_code == 201, res.text
    return res.json()["id"]


@pytest.mark.asyncio
async def test_application_search(client, clean_auth_tables):
    admin_t = await _admin_token(client)

    # 서로 다른 신원 필드를 가진 신청 3건
    await _apply(
        client, "b1@example.com",
        brand_name="달빛공방", company_name="달빛상회", representative_name="김달빛",
        business_registration_number="1112233443", contact_phone="01011112222",
    )
    await _apply(
        client, "b2@example.com",
        brand_name="햇살스튜디오", company_name="햇살상회", representative_name="이햇살",
        business_registration_number="5556677887", contact_phone="01033334444",
    )
    await _apply(
        client, "b3@example.com",
        brand_name="바람상점", company_name="바람컴퍼니", representative_name="박바람",
        business_registration_number="9990011226", contact_phone="01055556666",
    )

    # q 없으면 status(pending) 전체
    body = (await client.get(APPS, headers=_auth(admin_t))).json()
    assert body["total"] == 3

    # 브랜드명
    body = (await client.get(APPS, params={"q": "달빛"}, headers=_auth(admin_t))).json()
    assert body["total"] == 1 and body["items"][0]["brand_name"] == "달빛공방"

    # 상호(company_name)
    body = (await client.get(APPS, params={"q": "햇살상회"}, headers=_auth(admin_t))).json()
    assert body["total"] == 1 and body["items"][0]["company_name"] == "햇살상회"

    # 대표자명
    body = (await client.get(APPS, params={"q": "박바람"}, headers=_auth(admin_t))).json()
    assert body["total"] == 1 and body["items"][0]["representative_name"] == "박바람"

    # 사업자등록번호(부분)
    body = (await client.get(APPS, params={"q": "5556677"}, headers=_auth(admin_t))).json()
    assert body["total"] == 1 and body["items"][0]["business_registration_number"] == "5556677887"

    # 연락처(부분)
    body = (await client.get(APPS, params={"q": "5555666"}, headers=_auth(admin_t))).json()
    assert body["total"] == 1 and body["items"][0]["contact_phone"] == "01055556666"

    # 대소문자 무시 — "상회"는 달빛상회·햇살상회 둘 다 매칭
    body = (await client.get(APPS, params={"q": "상회"}, headers=_auth(admin_t))).json()
    assert body["total"] == 2

    # 매칭 없음
    assert (await client.get(APPS, params={"q": "없는브랜드"}, headers=_auth(admin_t))).json()["total"] == 0

    # 와일드카드 이스케이프 — %는 리터럴로 취급되어 매칭 없음
    assert (await client.get(APPS, params={"q": "%%"}, headers=_auth(admin_t))).json()["total"] == 0

    # 2자 미만 검색어는 422 (주문/조회 검색과 동일 규칙)
    assert (await client.get(APPS, params={"q": "가"}, headers=_auth(admin_t))).status_code == 422

    # 공백만 → None 취급, 전체 반환
    body = (await client.get(APPS, params={"q": "  "}, headers=_auth(admin_t))).json()
    assert body["total"] == 3


@pytest.mark.asyncio
async def test_application_search_case_insensitive_ascii(client, clean_auth_tables):
    """ASCII 대소문자 무시 확인 (ilike)."""
    admin_t = await _admin_token(client)
    await _apply(client, "b1@example.com", brand_name="MoonLight", company_name="MoonLight Co")

    body = (await client.get(APPS, params={"q": "moonlight"}, headers=_auth(admin_t))).json()
    assert body["total"] == 1
    body = (await client.get(APPS, params={"q": "MOONLIGHT"}, headers=_auth(admin_t))).json()
    assert body["total"] == 1
