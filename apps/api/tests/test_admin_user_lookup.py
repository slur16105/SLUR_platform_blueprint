"""관리자 회원 조회 개편 — 역할 필터(role) + 회원 상세(GET /admin/users/{id}).

역할 탭(전체/관리자/판매자/일반회원)의 백엔드 필터와, 판매자 프로필·상품 수를
라우터 층에서 합성하는 회원 상세를 검증한다.
"""

import uuid

import pytest

from tests.helpers import _admin_token, _auth, _buyer, _seller_with_prefix

USERS = "/api/v1/admin/users"


def _emails(res):
    return {r["email"] for r in res.json()["items"]}


@pytest.mark.asyncio
async def test_user_role_filter(client, clean_products):
    admin_t = await _admin_token(client)
    await _seller_with_prefix(client, admin_t)  # brand2@example.com = 판매자
    await _buyer(client, email="buyer1@example.com")  # 일반회원

    all_res = await client.get(USERS, headers=_auth(admin_t))
    assert all_res.status_code == 200
    assert {"admin@example.com", "brand2@example.com", "buyer1@example.com"} <= _emails(all_res)

    sellers = await client.get(USERS, params={"role": "seller"}, headers=_auth(admin_t))
    assert _emails(sellers) == {"brand2@example.com"}

    admins = await client.get(USERS, params={"role": "admin"}, headers=_auth(admin_t))
    assert _emails(admins) == {"admin@example.com"}

    buyers = await client.get(USERS, params={"role": "buyer"}, headers=_auth(admin_t))
    be = _emails(buyers)
    assert "buyer1@example.com" in be
    assert "brand2@example.com" not in be and "admin@example.com" not in be

    bad = await client.get(USERS, params={"role": "ghost"}, headers=_auth(admin_t))
    assert bad.status_code == 422


@pytest.mark.asyncio
async def test_user_detail(client, clean_products):
    admin_t = await _admin_token(client)
    await _seller_with_prefix(client, admin_t)
    await _buyer(client, email="buyer1@example.com")

    rows = (await client.get(USERS, headers=_auth(admin_t))).json()["items"]
    seller_row = next(r for r in rows if r["email"] == "brand2@example.com")
    buyer_row = next(r for r in rows if r["email"] == "buyer1@example.com")

    # 판매자 회원 상세 — 사업자 프로필 블록 + 상품 수(0) 합성
    detail = await client.get(f"{USERS}/{seller_row['id']}", headers=_auth(admin_t))
    assert detail.status_code == 200
    d = detail.json()
    assert "seller" in d["roles"]
    assert d["seller"] is not None
    assert d["seller"]["brand_name"] == "슬러굿즈"
    assert d["seller"]["product_count"] == 0

    # 일반회원 상세 — seller None
    bdetail = await client.get(f"{USERS}/{buyer_row['id']}", headers=_auth(admin_t))
    assert bdetail.status_code == 200
    assert bdetail.json()["seller"] is None

    # 없는 회원 404
    missing = await client.get(f"{USERS}/{uuid.uuid4()}", headers=_auth(admin_t))
    assert missing.status_code == 404
