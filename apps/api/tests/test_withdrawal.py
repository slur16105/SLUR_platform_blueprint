"""회원 탈퇴 (오픈 게이트 — 개인정보처리방침이 이미 공지한 파기 의무).

축은 셋이다.
  1. **지울 것은 지운다** — 이름·이메일·전화·비밀번호와 주소록·소셜연결·세션·장바구니·역할.
  2. **남길 것은 남긴다** — 주문 기록은 전자상거래법상 5년 보존이라 한 줄도 사라지면 안 된다.
     이 파일에서 가장 중요한 테스트다(익명화 구현이 잘못되면 여기서만 드러난다).
  3. **끝나지 않은 거래는 막는다** — 입금 대기·배송 중 주문, 처리 중 반품, 판매자 계정.
"""

import uuid as _uuid

import pytest
from sqlalchemy import func, select, text

from app.auth.models import AuthProvider, RefreshToken, User, UserRole
from app.core.db import async_session_factory
from tests.helpers import (
    _admin_login, _admin_token, _auth, _buyer, _cart_ids, _expected, _fees, _paid_order, _shop, ADDRESS,
)

BUYER_EMAIL = "withdraw@example.com"

ADDRESS_BODY = {
    "label": "집",
    "recipient_name": "김구매",
    "recipient_phone": "01012345678",
    "postal_code": "06236",
    "address1": "서울특별시 강남구 테헤란로 1",
    "address2": "101호",
}


async def _shop_and_buyer(client, email=BUYER_EMAIL, stock=9):
    """판매자·상품·배송비까지 갖춘 상태의 구매자 → (buyer_token, admin_token, seller_token, variants)."""
    st, _pid, vs = await _shop(client, stock=stock)
    await _fees(client, st)
    bt = await _buyer(client, email=email)
    admin_t = await _admin_login(client)
    return bt, admin_t, st, vs


async def _me_id(client, token) -> _uuid.UUID:
    res = await client.get("/api/v1/auth/me", headers=_auth(token))
    assert res.status_code == 200
    return _uuid.UUID(res.json()["id"])


async def _count(model, user_id) -> int:
    async with async_session_factory() as session:
        return int(await session.scalar(
            select(func.count()).select_from(model).where(model.user_id == user_id)
        ) or 0)


async def _deliver(client, st, sub_order_id):
    """배송 완료까지 — 끝난 거래여야 탈퇴가 열린다."""
    await client.post(f"/api/v1/sellers/sub-orders/{sub_order_id}/ship",
                      json={"carrier": "CJ대한통운", "tracking_number": "1234"}, headers=_auth(st))
    await client.post(f"/api/v1/sellers/sub-orders/{sub_order_id}/deliver", headers=_auth(st))


# ── 파기 ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_withdraw_erases_personal_data(client, clean_products):
    """개인정보 칸은 비고, 딸린 행은 사라진다. users 행 자체는 남는다(FK RESTRICT)."""
    bt, _admin_t, _st, vs = await _shop_and_buyer(client)
    uid = await _me_id(client, bt)
    await client.post("/api/v1/carts/items", json={"variant_id": vs[0]["id"], "quantity": 1}, headers=_auth(bt))
    assert (await client.post("/api/v1/addresses", json=ADDRESS_BODY, headers=_auth(bt))).status_code == 201
    async with async_session_factory() as session:
        # 소셜 연결은 API로 만들기 어렵다(카카오 왕복) — 직접 심어 삭제만 검증한다.
        # 역할 행은 심지 않는다: seller·admin 둘 다 탈퇴가 막히는 값이라(셀프 탈퇴는 구매자 전용)
        # 심으면 이 테스트가 409가 된다. 탈퇴에 성공하는 계정은 정의상 역할 행이 0개다.
        session.add(AuthProvider(user_id=uid, provider="kakao", provider_user_id="kakao-withdraw-1"))
        await session.commit()

    res = await client.delete("/api/v1/auth/me", headers=_auth(bt))
    assert res.status_code == 204

    async with async_session_factory() as session:
        user = await session.get(User, uid)
        assert user is not None  # 행은 남아야 한다 — 지우면 주문·동의 이력이 함께 무너진다
        assert user.name == "" and user.email is None and user.phone is None
        assert user.password_hash is None and user.deleted_at is not None
        addresses = await session.scalar(
            text("SELECT count(*) FROM addresses WHERE user_id = :u"), {"u": uid}
        )
        cart_items = await session.scalar(
            text("SELECT count(*) FROM cart_items WHERE user_id = :u"), {"u": uid}
        )
    assert addresses == 0 and cart_items == 0
    assert await _count(AuthProvider, uid) == 0
    assert await _count(RefreshToken, uid) == 0
    assert await _count(UserRole, uid) == 0


@pytest.mark.asyncio
async def test_orders_survive_withdrawal(client, clean_products):
    """🚨 이 파일의 핵심 — 탈퇴해도 주문 기록은 한 줄도 사라지지 않고 수령인 스냅샷도 그대로다.

    주문의 배송지는 주소록이 아니라 orders의 스냅샷이다(AD-7). 주소록을 지우는 탈퇴가
    그 스냅샷까지 건드리면 "누구에게 보냈는지 모르는 주문"이 남는다.
    """
    bt, admin_t, st, vs = await _shop_and_buyer(client)
    uid = await _me_id(client, bt)
    _oid, sid = await _paid_order(client, bt, admin_t, vs)
    await _deliver(client, st, sid)

    async with async_session_factory() as session:
        before = (await session.execute(
            text("SELECT count(*), min(recipient_name) FROM orders WHERE user_id = :u"), {"u": uid}
        )).one()
    assert before[0] == 1 and before[1] == ADDRESS["recipient_name"]

    assert (await client.delete("/api/v1/auth/me", headers=_auth(bt))).status_code == 204

    async with async_session_factory() as session:
        after = (await session.execute(
            text("SELECT count(*), min(recipient_name) FROM orders WHERE user_id = :u"), {"u": uid}
        )).one()
        items = await session.scalar(text(
            "SELECT count(*) FROM order_items oi"
            " JOIN sub_orders so ON so.id = oi.sub_order_id"
            " JOIN orders o ON o.id = so.order_id WHERE o.user_id = :u"
        ), {"u": uid})
    assert after == before  # 행 수·수령인 모두 불변
    assert items > 0


@pytest.mark.asyncio
async def test_agreements_survive_withdrawal(client, clean_auth_tables):
    """동의 이력은 분쟁 시 유일한 증거다 — 탈퇴해도 남는다(user_id는 RESTRICT)."""
    bt = await _buyer(client, email="withdraw-agree@example.com")
    uid = await _me_id(client, bt)
    assert (await client.delete("/api/v1/auth/me", headers=_auth(bt))).status_code == 204
    async with async_session_factory() as session:
        n = await session.scalar(text("SELECT count(*) FROM user_agreements WHERE user_id = :u"), {"u": uid})
    assert n > 0


# ── 탈퇴 후의 문 ──────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_signup_again_with_same_email(client, clean_auth_tables):
    """이메일을 NULL로 비우는 이유 — 같은 주소로 다시 가입할 수 있어야 한다."""
    signup = {"email": "rejoin@example.com", "password": "password123", "name": "재가입"}
    first = await client.post("/api/v1/auth/signup", json=signup)
    assert first.status_code == 201
    assert (await client.delete("/api/v1/auth/me", headers=_auth(first.json()["access_token"]))).status_code == 204

    again = await client.post("/api/v1/auth/signup", json=signup)
    assert again.status_code == 201
    assert again.json()["access_token"] != first.json()["access_token"]


@pytest.mark.asyncio
async def test_access_token_rejected_after_withdrawal(client, clean_auth_tables):
    """access token은 30분짜리 무상태 JWT다 — 탈퇴로 서명이 깨지지 않으므로 DB 지점에서 막아야 한다."""
    bt = await _buyer(client, email="withdraw-token@example.com")
    assert (await client.delete("/api/v1/auth/me", headers=_auth(bt))).status_code == 204

    res = await client.get("/api/v1/auth/me", headers=_auth(bt))
    assert res.status_code == 401 and res.json()["code"] == "unauthorized"
    # 두 번째 탈퇴 요청도 401 — 멱등이 아니라 "이미 없는 회원"이다
    assert (await client.delete("/api/v1/auth/me", headers=_auth(bt))).status_code == 401


@pytest.mark.asyncio
async def test_refresh_rejected_after_withdrawal(client, clean_auth_tables):
    """refresh 토큰 행을 지우므로 갱신 경로는 즉시 닫힌다."""
    signup = await client.post(
        "/api/v1/auth/signup",
        json={"email": "withdraw-refresh@example.com", "password": "password123", "name": "탈퇴자"},
    )
    access, refresh = signup.json()["access_token"], signup.json()["refresh_token"]
    assert (await client.delete("/api/v1/auth/me", headers=_auth(access))).status_code == 204

    res = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
    assert res.status_code == 401 and res.json()["code"] == "invalid_token"


@pytest.mark.asyncio
async def test_login_rejected_after_withdrawal(client, clean_auth_tables):
    """비밀번호 해시도 지운다 — 옛 비밀번호로 되살아나지 않는다."""
    signup = {"email": "withdraw-login@example.com", "password": "password123", "name": "탈퇴자"}
    res = await client.post("/api/v1/auth/signup", json=signup)
    assert (await client.delete("/api/v1/auth/me", headers=_auth(res.json()["access_token"]))).status_code == 204

    res = await client.post("/api/v1/auth/login", json={"email": signup["email"], "password": signup["password"]})
    assert res.status_code == 401 and res.json()["code"] == "invalid_credentials"


# ── 차단 게이트 ───────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_pending_payment_order_blocks(client, clean_products):
    """입금 대기 = 돈이 들어올 수 있는 상태 — 여기서 탈퇴시키면 입금자를 찾을 수 없다."""
    bt, _admin_t, _st, vs = await _shop_and_buyer(client)
    await client.post("/api/v1/carts/items", json={"variant_id": vs[0]["id"], "quantity": 1}, headers=_auth(bt))
    order = await client.post("/api/v1/orders", json={
        "cart_item_ids": await _cart_ids(client, bt),
        "expected_grand_total": await _expected(client, bt), **ADDRESS,
    }, headers=_auth(bt))
    assert order.status_code == 201

    res = await client.delete("/api/v1/auth/me", headers=_auth(bt))
    assert res.status_code == 409
    assert res.json()["code"] == "withdrawal_blocked_orders"
    assert "입금 대기" in res.json()["message"]


@pytest.mark.asyncio
async def test_shipping_order_blocks(client, clean_products):
    """배송 중 = 물건이 가는 중 — 받는 사람이 사라지면 안 된다."""
    bt, admin_t, st, vs = await _shop_and_buyer(client)
    _oid, sid = await _paid_order(client, bt, admin_t, vs)
    await client.post(f"/api/v1/sellers/sub-orders/{sid}/ship",
                      json={"carrier": "CJ대한통운", "tracking_number": "1234"}, headers=_auth(st))

    res = await client.delete("/api/v1/auth/me", headers=_auth(bt))
    assert res.status_code == 409 and res.json()["code"] == "withdrawal_blocked_orders"


@pytest.mark.asyncio
async def test_delivered_order_allows_withdrawal(client, clean_products):
    """끝난 거래까지 막으면 보존 기간 5년 동안 아무도 탈퇴할 수 없다."""
    bt, admin_t, st, vs = await _shop_and_buyer(client)
    _oid, sid = await _paid_order(client, bt, admin_t, vs)
    await _deliver(client, st, sid)

    assert (await client.delete("/api/v1/auth/me", headers=_auth(bt))).status_code == 204


@pytest.mark.asyncio
async def test_open_return_blocks(client, clean_products):
    """처리 중 반품 = 회수·환불이 남은 상태."""
    bt, admin_t, st, vs = await _shop_and_buyer(client)
    _oid, sid = await _paid_order(client, bt, admin_t, vs)
    await _deliver(client, st, sid)
    async with async_session_factory() as session:
        item_id = str(await session.scalar(
            text("SELECT id FROM order_items WHERE sub_order_id = :s LIMIT 1"), {"s": sid}
        ))
    ret = await client.post("/api/v1/returns", json={
        "sub_order_id": sid, "kind": "return", "reason": "change_of_mind",
        "detail": "색상이 생각과 달라요.", "items": [{"order_item_id": item_id, "quantity": 1}],
    }, headers=_auth(bt))
    assert ret.status_code == 201

    res = await client.delete("/api/v1/auth/me", headers=_auth(bt))
    assert res.status_code == 409
    assert res.json()["code"] == "withdrawal_blocked_returns"
    assert "반품" in res.json()["message"]


@pytest.mark.asyncio
async def test_resolved_return_does_not_block(client, clean_products):
    """거부된 신청은 끝난 건이다 — 막지 않는다."""
    bt, admin_t, st, vs = await _shop_and_buyer(client)
    _oid, sid = await _paid_order(client, bt, admin_t, vs)
    await _deliver(client, st, sid)
    async with async_session_factory() as session:
        item_id = str(await session.scalar(
            text("SELECT id FROM order_items WHERE sub_order_id = :s LIMIT 1"), {"s": sid}
        ))
    ret = await client.post("/api/v1/returns", json={
        "sub_order_id": sid, "kind": "return", "reason": "change_of_mind",
        "detail": "색상이 생각과 달라요.", "items": [{"order_item_id": item_id, "quantity": 1}],
    }, headers=_auth(bt))
    rid = ret.json()["id"]
    reject = await client.post(f"/api/v1/admin/returns/{rid}/reject",
                               json={"note": "기한 경과"}, headers=_auth(admin_t))
    assert reject.status_code == 200

    assert (await client.delete("/api/v1/auth/me", headers=_auth(bt))).status_code == 204


@pytest.mark.asyncio
async def test_seller_cannot_withdraw(client, clean_products):
    """판매자 해지는 정산·상품·입점 계약이 함께 걸린 일이라 v1에서는 사람이 처리한다."""
    st, _pid, _vs = await _shop(client)

    res = await client.delete("/api/v1/auth/me", headers=_auth(st))
    assert res.status_code == 409
    assert res.json()["code"] == "withdrawal_blocked_seller"
    assert "고객센터" in res.json()["message"]


@pytest.mark.asyncio
async def test_admin_cannot_withdraw(client):
    """관리자가 스스로 사라지면 입금확인·주문개입 기록의 주체를 되짚을 수 없다 (Slur 승인 2026-08-04).

    안내 문구가 '고객센터'가 아니어야 한다 — 관리자에게 고객센터는 자기 자신이라 막다른 길이 된다.
    """
    # ADMIN 가입은 테스트당 1회만 가능하다(고정 이메일) — 차단 확인과 무결성 확인을
    # 한 테스트에 둔다. 나누면 뒤 테스트가 409(이미 가입)로 깨진다.
    admin_t = await _admin_token(client)
    uid = await _me_id(client, admin_t)

    res = await client.delete("/api/v1/auth/me", headers=_auth(admin_t))
    assert res.status_code == 409
    assert res.json()["code"] == "withdrawal_blocked_admin"
    assert "고객센터" not in res.json()["message"]
    assert "권한 회수" in res.json()["message"]

    # 막힌 탈퇴가 계정을 반쯤 지워놓으면 안 된다 — 차단은 부작용 없이 끝나야 한다.
    me = await client.get("/api/v1/auth/me", headers=_auth(admin_t))
    assert me.status_code == 200 and me.json()["email"]  # 여전히 조회된다
    assert await _count(UserRole, uid) == 1  # 관리자 역할도 그대로


# ── 관리자 화면에서의 표시 ─────────────────────────────────────────


@pytest.mark.asyncio
async def test_admin_still_sees_withdrawn_buyer(client, clean_products):
    """탈퇴 회원을 목록에서 숨기면 "주문은 있는데 회원이 없다"가 되어 조회가 끊긴다."""
    bt, admin_t, st, vs = await _shop_and_buyer(client)
    uid = await _me_id(client, bt)
    oid, sid = await _paid_order(client, bt, admin_t, vs)
    await _deliver(client, st, sid)
    assert (await client.delete("/api/v1/auth/me", headers=_auth(bt))).status_code == 204

    detail = await client.get(f"/api/v1/admin/orders/{oid}", headers=_auth(admin_t))
    assert detail.status_code == 200 and detail.json()["buyer_name"] == "(탈퇴한 회원)"

    user = await client.get(f"/api/v1/admin/users/{uid}", headers=_auth(admin_t))
    assert user.status_code == 200 and user.json()["withdrawn"] is True

    listed = await client.get("/api/v1/admin/users", headers=_auth(admin_t))
    row = next(r for r in listed.json()["items"] if r["id"] == str(uid))
    assert row["withdrawn"] is True
