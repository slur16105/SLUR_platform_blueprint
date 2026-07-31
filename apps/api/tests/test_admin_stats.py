"""관리자 대시보드 집계 (콘솔 통계 타일).

금액 규칙 검증이 핵심이다 — 총액 컬럼이 없어(AD-12) 매번 품목·배송비에서 파생하므로,
"취소된 품목이 매출에 남지 않는가"가 회귀 위험 지점이다.
"""

import pytest

from tests.helpers import _admin_login, _admin_token, _auth, _buyer, _expected, _fees, _shop, make_order


async def _stats(client, admin_t, period=None):
    url = "/api/v1/admin/stats" + (f"?period={period}" if period else "")
    res = await client.get(url, headers=_auth(admin_t))
    assert res.status_code == 200
    return res.json()


@pytest.mark.asyncio
async def test_stats_empty(client, clean_products):
    """주문이 없으면 전부 0 — 빈 값이 null로 새지 않는다."""
    admin_t = await _admin_token(client)
    body = await _stats(client, admin_t)
    assert body["period"] == "today"
    for key in ("new_orders", "paid_orders", "revenue", "pending_payment_count", "pending_payment_amount"):
        assert body[key] == 0, key


@pytest.mark.asyncio
async def test_pending_then_paid_moves_amount(client, clean_products):
    """입금 전에는 대기 금액, 입금 확인 후에는 매출 — 같은 금액이 한 번만 잡힌다."""
    st, _pid, vs = await _shop(client)  # 내부에서 admin 가입까지 수행
    admin_t = await _admin_login(client)
    await _fees(client, st)
    bt = await _buyer(client, email="stats-buyer@example.com")
    await client.post("/api/v1/carts/items", json={"variant_id": vs[0]["id"], "quantity": 2}, headers=_auth(bt))
    expected = await _expected(client, bt)
    oid, _sub = await make_order(client, bt)

    before = await _stats(client, admin_t)
    assert before["new_orders"] == 1
    assert before["pending_payment_count"] == 1
    assert before["pending_payment_amount"] == expected  # 배송비 포함
    assert before["revenue"] == 0  # 아직 입금 전 — 매출 아님

    r = await client.post(
        f"/api/v1/admin/orders/{oid}/confirm-payment",
        json={"expected_grand_total": expected}, headers=_auth(admin_t),
    )
    assert r.status_code == 204

    after = await _stats(client, admin_t)
    assert after["pending_payment_count"] == 0
    assert after["pending_payment_amount"] == 0
    assert after["paid_orders"] == 1
    assert after["revenue"] == expected


@pytest.mark.asyncio
async def test_canceled_order_not_counted_as_revenue(client, clean_products):
    """품목이 전부 취소되면 매출에서 빠진다 — 배송비만 남는 유령 금액 방지.

    입금 후 주문은 전체 취소가 막혀 있고(입금대기만 가능) 품목 단위로 취소한다 —
    실제 운영 경로를 그대로 태운다.
    """
    st, _pid, vs = await _shop(client)  # 내부에서 admin 가입까지 수행
    admin_t = await _admin_login(client)
    await _fees(client, st)
    bt = await _buyer(client, email="stats-cancel@example.com")
    await client.post("/api/v1/carts/items", json={"variant_id": vs[0]["id"], "quantity": 1}, headers=_auth(bt))
    expected = await _expected(client, bt)
    oid, _sub = await make_order(client, bt)
    await client.post(
        f"/api/v1/admin/orders/{oid}/confirm-payment",
        json={"expected_grand_total": expected}, headers=_auth(admin_t),
    )
    assert (await _stats(client, admin_t))["revenue"] == expected

    detail = (await client.get(f"/api/v1/admin/orders/{oid}", headers=_auth(admin_t))).json()
    item_id = detail["sub_orders"][0]["items"][0]["order_item_id"]
    r = await client.post(
        f"/api/v1/admin/order-items/{item_id}/cancel",
        json={"reason": "집계 검증용 취소", "responsibility": "admin"}, headers=_auth(admin_t),
    )
    assert r.status_code == 200  # 품목 취소는 취소 건수를 담은 200 (계약 고정)

    after = await _stats(client, admin_t)
    assert after["revenue"] == 0  # 품목도 배송비도 남지 않는다


@pytest.mark.asyncio
async def test_stats_rejects_bad_period(client, clean_products):
    admin_t = await _admin_token(client)
    res = await client.get("/api/v1/admin/stats?period=1y", headers=_auth(admin_t))
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_stats_requires_admin(client, clean_products):
    signup = await client.post(
        "/api/v1/auth/signup",
        json={"email": "stats-nobody@example.com", "password": "password123", "name": "구매자"},
    )
    res = await client.get("/api/v1/admin/stats", headers=_auth(signup.json()["access_token"]))
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_period_window_widens(client, clean_products):
    """기간이 넓어지면 집계도 넓어진다 — 오늘엔 없고 30일엔 잡히는 주문으로 확인.

    _period_start의 오프바이원(예: 7d가 8일치를 세는 회귀)을 잡는 자리다.
    과거 주문은 API로 만들 수 없어 paid_at·created_at을 직접 뒤로 민다(테스트 전용).
    """
    from sqlalchemy import text

    from app.core.db import async_session_factory

    st, _pid, vs = await _shop(client)
    admin_t = await _admin_login(client)
    await _fees(client, st)
    bt = await _buyer(client, email="stats-period@example.com")
    await client.post("/api/v1/carts/items", json={"variant_id": vs[0]["id"], "quantity": 1}, headers=_auth(bt))
    expected = await _expected(client, bt)
    oid, _sub = await make_order(client, bt)
    await client.post(
        f"/api/v1/admin/orders/{oid}/confirm-payment",
        json={"expected_grand_total": expected}, headers=_auth(admin_t),
    )

    # 10일 전으로 밀면 today·7d에서는 빠지고 30d에만 남아야 한다
    async with async_session_factory() as session:
        await session.execute(
            text("UPDATE orders SET created_at = created_at - interval '10 days',"
                 "                  paid_at = paid_at - interval '10 days' WHERE id = :oid"),
            {"oid": oid},
        )
        await session.commit()

    today = await _stats(client, admin_t, "today")
    week = await _stats(client, admin_t, "7d")
    month = await _stats(client, admin_t, "30d")

    assert today["revenue"] == 0 and today["new_orders"] == 0
    assert week["revenue"] == 0 and week["new_orders"] == 0
    assert month["revenue"] == expected and month["new_orders"] == 1


@pytest.mark.asyncio
async def test_period_boundary_is_kst_midnight(client, clean_products):
    """'오늘'의 경계는 KST 자정 — 25시간 전 주문은 오늘에서 빠지고 7일엔 남는다."""
    from sqlalchemy import text

    from app.core.db import async_session_factory

    st, _pid, vs = await _shop(client)
    admin_t = await _admin_login(client)
    await _fees(client, st)
    bt = await _buyer(client, email="stats-boundary@example.com")
    await client.post("/api/v1/carts/items", json={"variant_id": vs[0]["id"], "quantity": 1}, headers=_auth(bt))
    expected = await _expected(client, bt)
    oid, _sub = await make_order(client, bt)
    await client.post(
        f"/api/v1/admin/orders/{oid}/confirm-payment",
        json={"expected_grand_total": expected}, headers=_auth(admin_t),
    )
    async with async_session_factory() as session:
        await session.execute(
            text("UPDATE orders SET created_at = created_at - interval '25 hours',"
                 "                  paid_at = paid_at - interval '25 hours' WHERE id = :oid"),
            {"oid": oid},
        )
        await session.commit()

    assert (await _stats(client, admin_t, "today"))["new_orders"] == 0
    assert (await _stats(client, admin_t, "7d"))["new_orders"] == 1
