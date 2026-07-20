"""관리자 설정 테스트 (Story 5.7)."""

import pytest

from tests.helpers import ADDRESS, _admin_login, _auth, _buyer, _cart_ids, _expected, _fees, _shop

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
    assert keys == {"deposit_account", "unpaid_cancel_days", "low_stock_threshold"}

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
