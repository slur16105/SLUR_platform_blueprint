"""관리자 설정 테스트 (Story 5.7)."""

import pytest

from tests.test_carts import _buyer, _shop
from tests.test_order_creation import ADDRESS, _cart_ids, _expected, _fees
from tests.test_products import clean_products  # noqa: F401
from tests.test_seller_application import _auth
from tests.test_seller_orders import _admin_login

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
