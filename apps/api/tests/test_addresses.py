"""배송지 주소록 (오픈 게이트 P1).

핵심은 셋이다: 기본 배송지가 항상 정확히 하나 · 남의 주소는 안 보임 · 주문 검증 규칙과 동일.
"""

import uuid as _uuid

import pytest

from tests.helpers import _auth, _buyer

BODY = {
    "label": "집",
    "recipient_name": "김구매",
    "recipient_phone": "01012345678",
    "postal_code": "06236",
    "address1": "서울특별시 강남구 테헤란로 1",
    "address2": "101호",
}


@pytest.mark.asyncio
async def test_first_address_becomes_default(client, clean_auth_tables):
    """첫 배송지는 자동으로 기본 — 주문서가 빈 상태로 시작하지 않게."""
    bt = await _buyer(client, email="addr-first@example.com")
    res = await client.post("/api/v1/addresses", json=BODY, headers=_auth(bt))
    assert res.status_code == 201
    assert res.json()["is_default"] is True


@pytest.mark.asyncio
async def test_only_one_default(client, clean_auth_tables):
    """기본은 항상 하나 — 새로 지정하면 이전 것이 내려간다."""
    bt = await _buyer(client, email="addr-default@example.com")
    first = (await client.post("/api/v1/addresses", json=BODY, headers=_auth(bt))).json()
    second = (await client.post(
        "/api/v1/addresses", json={**BODY, "label": "회사", "is_default": True}, headers=_auth(bt)
    )).json()

    rows = (await client.get("/api/v1/addresses", headers=_auth(bt))).json()
    defaults = [r for r in rows if r["is_default"]]
    assert len(defaults) == 1 and defaults[0]["id"] == second["id"]
    # 기본이 목록 맨 앞 — 주문서가 첫 항목을 바로 쓴다
    assert rows[0]["id"] == second["id"]

    back = await client.post(f"/api/v1/addresses/{first['id']}/default", headers=_auth(bt))
    assert back.status_code == 200
    rows = (await client.get("/api/v1/addresses", headers=_auth(bt))).json()
    assert [r["is_default"] for r in rows].count(True) == 1


@pytest.mark.asyncio
async def test_delete_default_promotes_another(client, clean_auth_tables):
    """기본을 지우면 남은 것 중 하나가 기본이 된다 — '기본 없음'으로 남지 않게."""
    bt = await _buyer(client, email="addr-delete@example.com")
    first = (await client.post("/api/v1/addresses", json=BODY, headers=_auth(bt))).json()
    await client.post("/api/v1/addresses", json={**BODY, "label": "회사"}, headers=_auth(bt))

    assert (await client.delete(f"/api/v1/addresses/{first['id']}", headers=_auth(bt))).status_code == 204
    rows = (await client.get("/api/v1/addresses", headers=_auth(bt))).json()
    assert len(rows) == 1 and rows[0]["is_default"] is True


@pytest.mark.asyncio
async def test_others_address_hidden(client, clean_auth_tables):
    """배송지는 개인정보다 — 남의 것은 없는 것과 같게 404."""
    a = await _buyer(client, email="addr-a@example.com")
    b = await _buyer(client, email="addr-b@example.com")
    aid = (await client.post("/api/v1/addresses", json=BODY, headers=_auth(a))).json()["id"]

    assert (await client.put(f"/api/v1/addresses/{aid}", json=BODY, headers=_auth(b))).status_code == 404
    assert (await client.delete(f"/api/v1/addresses/{aid}", headers=_auth(b))).status_code == 404
    assert (await client.get("/api/v1/addresses", headers=_auth(b))).json() == []


@pytest.mark.asyncio
async def test_validation_matches_order_rules(client, clean_auth_tables):
    """주문 생성과 같은 규칙 — 저장은 됐는데 주문이 거부되는 상황을 만들지 않는다."""
    bt = await _buyer(client, email="addr-valid@example.com")
    bad_cases = [
        {**BODY, "postal_code": "123"},          # 5자리 아님
        {**BODY, "recipient_phone": "010-1234"},  # 숫자만 9~11자리
        {**BODY, "recipient_name": "  "},
        {**BODY, "address1": ""},
    ]
    for bad in bad_cases:
        assert (await client.post("/api/v1/addresses", json=bad, headers=_auth(bt))).status_code == 422, bad


@pytest.mark.asyncio
async def test_requires_login(client, clean_auth_tables):
    assert (await client.get("/api/v1/addresses")).status_code == 401
    assert (await client.post("/api/v1/addresses", json=BODY)).status_code == 401


@pytest.mark.asyncio
async def test_unknown_address_404(client, clean_auth_tables):
    bt = await _buyer(client, email="addr-unknown@example.com")
    assert (await client.put(f"/api/v1/addresses/{_uuid.uuid4()}", json=BODY, headers=_auth(bt))).status_code == 404
