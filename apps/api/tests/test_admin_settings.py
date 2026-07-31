"""관리자 설정 테스트 (Story 5.7)."""

import pytest

from tests.helpers import ADDRESS, _admin_login, _admin_token, _auth, _buyer, _cart_ids, _expected, _fees, _shop

SETTINGS = "/api/v1/admin/settings"
UPDATE = "/api/v1/admin/settings/deposit-account"


@pytest.mark.asyncio
async def test_settings_read_update_and_propagation(client, clean_products):
    """AC 1·2: 3키 조회 / 계좌 갱신 → 주문 완료·입금 안내 즉시 반영 / 검증·권한."""
    st, pid, vs = await _shop(client, stock=5)
    await _fees(client, st)
    bt = await _buyer(client)
    admin_t = await _admin_login(client)

    assert (await client.get(SETTINGS)).status_code == 401
    assert (await client.get(SETTINGS, headers=_auth(bt))).status_code == 403

    body = (await client.get(SETTINGS, headers=_auth(admin_t))).json()
    keys = {i["key"] for i in body["items"]}
    # deposit_* 3필드는 2026-07-31 분리 도입(은행·계좌번호·예금주). deposit_account는 조립 표시용으로 남는다.
    assert keys == {
        "deposit_account", "deposit_bank", "deposit_account_no", "deposit_holder",
        "unpaid_cancel_days", "low_stock_threshold",
    }

    # 검증: 빈 값·공백만·201자
    for bad in ("", "   ", "가" * 201):
        r = await client.put(UPDATE, json={"value": bad}, headers=_auth(admin_t))
        assert r.status_code == 422, bad
    assert (await client.put(UPDATE, json={"value": "국민 1-2 슬러"}, headers=_auth(bt))).status_code == 403

    # 제어문자 차단
    r = await client.put(UPDATE, json={"value": "국민\n123"}, headers=_auth(admin_t))
    assert r.status_code == 422

    # 소급 방향: 변경 "전" 생성된 pending 주문의 안내도 새 계좌 (의도 — 폐쇄 계좌 입금 방지)
    await client.post("/api/v1/carts/items", json={"variant_id": vs[1]["id"], "quantity": 1}, headers=_auth(bt))
    pre_ids = await _cart_ids(client, bt)
    pre_res = await client.post(
        "/api/v1/orders",
        json={"cart_item_ids": pre_ids, "expected_grand_total": await _expected(client, bt), **ADDRESS}, headers=_auth(bt),
    )
    pre_oid = pre_res.json()["order_id"]

    # 갱신 → 주문 완료 응답·입금 안내 반영 (4.4·5.1)
    new_acct = "국민은행 123456-78-901234 (주)슬러"
    assert (await client.put(UPDATE, json={"value": new_acct}, headers=_auth(admin_t))).status_code == 204
    assert next(i["value"] for i in (await client.get(SETTINGS, headers=_auth(admin_t))).json()["items"]
                if i["key"] == "deposit_account") == new_acct

    await client.post("/api/v1/carts/items", json={"variant_id": vs[0]["id"], "quantity": 1}, headers=_auth(bt))
    ids = await _cart_ids(client, bt)
    res = await client.post(
        "/api/v1/orders",
        json={"cart_item_ids": ids, "expected_grand_total": await _expected(client, bt), **ADDRESS}, headers=_auth(bt),
    )
    assert res.json()["deposit_account"] == new_acct  # 4.4 주문 완료 반영
    d = (await client.get(f"/api/v1/orders/{res.json()['order_id']}", headers=_auth(bt))).json()
    assert d["deposit_info"]["deposit_account"] == new_acct  # 5.1 입금 안내 반영
    d_pre = (await client.get(f"/api/v1/orders/{pre_oid}", headers=_auth(bt))).json()
    assert d_pre["deposit_info"]["deposit_account"] == new_acct  # 소급 — 기존 pending 안내도 새 계좌
    assert all("updated_at" in i for i in (await client.get(SETTINGS, headers=_auth(admin_t))).json()["items"])


@pytest.mark.asyncio
async def test_deposit_fields_split(client, clean_auth_tables):
    """입금 계좌 3필드 — 저장하면 구매자 안내 문자열도 같이 맞춰진다."""
    admin_t = await _admin_token(client)

    res = await client.put(
        "/api/v1/admin/settings/deposit-fields",
        json={"bank": "국민은행", "account_no": "123456-78-901234", "holder": "(주)슬러"},
        headers=_auth(admin_t),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["bank"] == "국민은행" and body["holder"] == "(주)슬러"
    # 화면마다 조립하지 않도록 서버가 한 줄 표기를 만든다
    assert body["display"] == "국민은행 123456-78-901234 ((주)슬러)"

    got = (await client.get("/api/v1/admin/settings/deposit-account", headers=_auth(admin_t))).json()
    assert got == body

    # 빈 값·과도한 길이는 거부 — 구매자가 입금할 곳을 못 찾는 상태를 만들지 않는다
    for bad in ({"bank": "  ", "account_no": "1", "holder": "x"}, {"bank": "국민", "account_no": "1" * 101, "holder": "x"}):
        assert (await client.put("/api/v1/admin/settings/deposit-fields", json=bad,
                                 headers=_auth(admin_t))).status_code == 422


@pytest.mark.asyncio
async def test_deposit_fields_require_admin(client, clean_auth_tables):
    bt = await _buyer(client, email="deposit-nobody@example.com")
    res = await client.put(
        "/api/v1/admin/settings/deposit-fields",
        json={"bank": "국민은행", "account_no": "1", "holder": "x"}, headers=_auth(bt),
    )
    assert res.status_code == 403
