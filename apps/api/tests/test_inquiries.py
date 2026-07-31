"""1:1 문의 (오픈 게이트 P0).

소유 경계가 핵심이다 — 남의 문의를 열람하면 개인정보 유출이다.
"""

import uuid as _uuid

import pytest

from tests.helpers import _admin_login, _auth, _buyer, _expected, _fees, _shop, make_order


async def _new_inquiry(client, token, **over):
    body = {"category": "etc", "title": "배송 문의", "body": "언제 발송되나요?", **over}
    return await client.post("/api/v1/inquiries", json=body, headers=_auth(token))


@pytest.mark.asyncio
async def test_create_and_list_my_inquiry(client, clean_auth_tables):
    bt = await _buyer(client, email="inq-buyer@example.com")
    res = await _new_inquiry(client, bt)
    assert res.status_code == 201
    created = res.json()
    assert created["status"] == "open" and created["replies"] == []

    rows = (await client.get("/api/v1/inquiries", headers=_auth(bt))).json()
    assert rows["total"] == 1
    assert rows["items"][0]["title"] == "배송 문의"


@pytest.mark.asyncio
async def test_requires_login(client, clean_auth_tables):
    res = await client.post("/api/v1/inquiries", json={"category": "etc", "title": "x", "body": "y"})
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_cannot_read_others_inquiry(client, clean_auth_tables):
    """남의 문의는 없는 것과 같게 404 — 존재 자체를 노출하지 않는다."""
    a = await _buyer(client, email="inq-a@example.com")
    b = await _buyer(client, email="inq-b@example.com")
    iid = (await _new_inquiry(client, a)).json()["id"]

    res = await client.get(f"/api/v1/inquiries/{iid}", headers=_auth(b))
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_foreign_order_link_rejected(client, clean_products):
    """남의 주문번호를 붙여 주문 존재를 떠보는 경로를 막는다."""
    st, _pid, vs = await _shop(client)
    admin_t = await _admin_login(client)
    await _fees(client, st)
    owner = await _buyer(client, email="inq-owner@example.com")
    await client.post("/api/v1/carts/items", json={"variant_id": vs[0]["id"], "quantity": 1}, headers=_auth(owner))
    await _expected(client, owner)
    oid, _sub = await make_order(client, owner)

    other = await _buyer(client, email="inq-other@example.com")
    res = await _new_inquiry(client, other, order_id=oid, category="order")
    assert res.status_code == 404

    # 본인 주문이면 연결된다
    ok = await _new_inquiry(client, owner, order_id=oid, category="order")
    assert ok.status_code == 201 and ok.json()["order_id"] == oid


@pytest.mark.asyncio
async def test_admin_reply_flow(client, clean_auth_tables):
    """운영자 답변 → 상태가 answered로 바뀌고 작성자에게 보인다."""
    from tests.helpers import _admin_token

    admin_t = await _admin_token(client)
    bt = await _buyer(client, email="inq-reply@example.com")
    iid = (await _new_inquiry(client, bt)).json()["id"]

    res = await client.post(
        f"/api/v1/admin/inquiries/{iid}/replies", json={"body": "내일 발송 예정입니다."}, headers=_auth(admin_t)
    )
    assert res.status_code == 201
    body = res.json()
    assert body["status"] == "answered" and len(body["replies"]) == 1
    assert body["buyer_email"] == "inq-reply@example.com"

    mine = (await client.get(f"/api/v1/inquiries/{iid}", headers=_auth(bt))).json()
    assert mine["replies"][0]["body"] == "내일 발송 예정입니다."


@pytest.mark.asyncio
async def test_buyer_cannot_use_admin_endpoints(client, clean_auth_tables):
    bt = await _buyer(client, email="inq-noadmin@example.com")
    assert (await client.get("/api/v1/admin/inquiries", headers=_auth(bt))).status_code == 403


@pytest.mark.asyncio
async def test_closed_inquiry_rejects_reply(client, clean_auth_tables):
    from tests.helpers import _admin_token

    admin_t = await _admin_token(client)
    bt = await _buyer(client, email="inq-closed@example.com")
    iid = (await _new_inquiry(client, bt)).json()["id"]

    assert (await client.post(f"/api/v1/admin/inquiries/{iid}/close", headers=_auth(admin_t))).status_code == 200
    res = await client.post(
        f"/api/v1/admin/inquiries/{iid}/replies", json={"body": "추가 답변"}, headers=_auth(admin_t)
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_unknown_inquiry_404(client, clean_auth_tables):
    from tests.helpers import _admin_token

    admin_t = await _admin_token(client)
    res = await client.get(f"/api/v1/admin/inquiries/{_uuid.uuid4()}", headers=_auth(admin_t))
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_validation(client, clean_auth_tables):
    bt = await _buyer(client, email="inq-valid@example.com")
    assert (await _new_inquiry(client, bt, category="없는유형")).status_code == 422
    assert (await _new_inquiry(client, bt, title="   ")).status_code == 422
    assert (await _new_inquiry(client, bt, body="")).status_code == 422
