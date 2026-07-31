"""과거 날짜 더미 주문 시더 — 기간 필터(오늘 / 최근 7일 / 최근 30일) 차이를 눈으로 확인하기 위한 것.

실행: docker compose exec -T api uv run python -m app.local_seed_history

`local_seed_bulk`는 주문을 전부 "지금" 만든다. 그래서 오늘·7일·30일 집계가 전부 같은 값이 되어
기간 탭이 동작하는지 확인할 수 없다. 이 시더는 주문을 **정상 API 경로로 만든 뒤 생성 시각만
과거로 옮긴다**. 시각 이동은 API로 할 수 없어 DB를 직접 갱신하는 유일한 지점이며,
`ENVIRONMENT=local` + 로컬 Postgres 가드 안에서만 동작한다.

날짜를 옮길 때 주문 하나에 딸린 시각을 **함께** 옮긴다(묶음·품목·이벤트·취소 기록).
하나만 옮기면 상세 화면의 타임라인이 "배송이 주문보다 먼저"처럼 뒤틀린다.

입금대기 주문은 과거로 보내지 않는다 — 입금 기한이 지난 주문은 자동취소 배치의 대상이라
"기한이 한참 지났는데 살아있는 주문"이라는 실제로는 없는 상태가 만들어진다.
"""

import asyncio
import sys
from datetime import timedelta

import httpx
from sqlalchemy import select, text

from app.auth.bootstrap import grant_admin
from app.core.db import async_session_factory
from app.local_seed import ADMIN, _headers, _require_local_database, _signup_or_login
from app.local_seed_bulk import (
    APPROVED_SELLERS,
    BUYERS,
    CARRIERS,
    MARKER,
    _account,
    _advance_order,
    _check,
    _place_order,
)
from app.main import app
from app.orders.models import Order

# (며칠 전, 주문 수, 목표 상태) — 오늘에서 멀수록 배송이 끝난 주문이 많아지는 자연스러운 분포.
# 오늘 치는 local_seed_bulk가 이미 만들어 두므로 여기서는 2일 전부터 채운다.
HISTORY_PLAN = [
    # 최근 7일 구간 (오늘 제외) — 2~7일 전
    *[(d, 2, "delivered") for d in range(2, 8)],
    *[(d, 1, "shipping") for d in range(2, 6)],
    *[(d, 1, "canceled") for d in (3, 6)],
    # 8~30일 구간
    *[(d, 2, "delivered") for d in range(8, 31, 2)],
    *[(d, 1, "delivered") for d in range(9, 31, 3)],
    *[(d, 1, "canceled") for d in (12, 19, 27)],
]


async def _backdate(order_id: str, days_ago: int) -> None:
    """주문과 딸린 행들의 시각을 함께 과거로 옮긴다 (로컬 전용 · DB 직접 갱신)."""
    async with async_session_factory() as session:
        # 이동 폭은 '며칠 전'을 그대로 쓰되, 시:분은 흩어 놓아 목록이 한 시각에 뭉치지 않게 한다.
        # hash()는 PYTHONHASHSEED 무작위화로 실행마다 값이 달라 재현이 안 된다 — uuid 문자열에서 고정 추출
        spread = int(order_id.replace("-", "")[-4:], 16)
        shift = timedelta(days=days_ago, hours=(spread % 9) - 4, minutes=spread % 60)
        # 초 단위 숫자로 넘기고 SQL에서 interval로 만든다 — timedelta를 그대로 바인딩하면
        # asyncpg가 $1의 타입을 timestamptz로 추론해 타입 불일치가 난다.
        params = {"oid": order_id, "secs": shift.total_seconds()}
        await session.execute(text("""
            UPDATE orders SET created_at = created_at - (:secs * interval '1 second'),
                              updated_at = updated_at - (:secs * interval '1 second'),
                              deposit_due_at = deposit_due_at - (:secs * interval '1 second'),
                              paid_at = CASE WHEN paid_at IS NULL THEN NULL ELSE paid_at - (:secs * interval '1 second') END
             WHERE id = :oid
        """), params)
        await session.execute(text("""
            UPDATE sub_orders SET created_at = created_at - (:secs * interval '1 second'), updated_at = updated_at - (:secs * interval '1 second')
             WHERE order_id = :oid
        """), params)
        await session.execute(text("""
            UPDATE order_items SET created_at = created_at - (:secs * interval '1 second')
             WHERE sub_order_id IN (SELECT id FROM sub_orders WHERE order_id = :oid)
        """), params)
        await session.execute(text("""
            UPDATE order_events SET created_at = created_at - (:secs * interval '1 second') WHERE order_id = :oid
        """), params)
        await session.execute(text("""
            UPDATE cancellations SET canceled_at = canceled_at - (:secs * interval '1 second'),
                                     refunded_at = CASE WHEN refunded_at IS NULL THEN NULL ELSE refunded_at - (:secs * interval '1 second') END
             WHERE order_item_id IN (
                SELECT oi.id FROM order_items oi
                  JOIN sub_orders so ON so.id = oi.sub_order_id
                 WHERE so.order_id = :oid
             )
        """), params)
        await session.commit()


async def _spread_user_signups() -> int:
    """더미 구매자 가입일을 30일에 걸쳐 흩는다 — 안 하면 '신규 가입'이 기간마다 같은 값이 된다.

    오늘 가입한 더미 계정만 대상이라 재실행해도 계속 과거로 밀리지 않는다.
    """
    async with async_session_factory() as session:
        result = await session.execute(text("""
            UPDATE users
               SET created_at = created_at - ((row_number * 2) * interval '1 day')
              FROM (
                SELECT id, (ROW_NUMBER() OVER (ORDER BY created_at)) - 1 AS row_number
                  FROM users
                 WHERE email LIKE 'dummy-buyer%'
                   AND created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul'
              ) AS ranked
             WHERE users.id = ranked.id
        """))
        await session.commit()
        return result.rowcount or 0


async def _seller_pools(client) -> tuple[dict, dict]:
    """더미 판매자 토큰과 주문 가능한 variant 목록을 다시 확보한다 (재고가 남은 것만)."""
    tokens: dict[str, str] = {}
    pools: dict[str, list] = {}
    for idx, spec in enumerate(APPROVED_SELLERS, start=1):
        acct = await _account(spec["key"], spec["rep"], idx)
        session = await _signup_or_login(client, acct)
        token = session["access_token"]
        tokens[spec["brand"]] = token
        r = await client.get("/api/v1/sellers/products", headers=_headers(token))
        _check(r, f"판매자 상품목록({spec['brand']})")
        pool = []
        for p in r.json():
            if p["status"] != "active":
                continue
            for v in p["variants"]:
                if v["stock"] > 0 and v["is_active"]:
                    pool.append({"variant_id": v["id"], "price": p["base_price"], "stock": v["stock"]})
        pools[spec["brand"]] = pool
    return tokens, pools


async def _restock(client, tokens: dict) -> None:
    """더미 상품 재고를 넉넉히 되채운다 — 과거 주문을 많이 만들면 재고가 먼저 마른다."""
    for brand, token in tokens.items():
        r = await client.get("/api/v1/sellers/products", headers=_headers(token))
        _check(r, f"재고확인({brand})")
        for p in r.json():
            if p["status"] != "active":
                continue
            if len(p["variants"]) != 1:
                continue  # variants PUT은 전체 교체다 — 조합이 여럿인 상품에 1개만 보내면 나머지가 삭제된다
            v = p["variants"][0]
            if v["stock"] >= 200:
                continue
            body = {"variants": [{
                "option1_name": v["option1_name"], "option1_value": v["option1_value"],
                "option2_name": v["option2_name"], "option2_value": v["option2_value"],
                "extra_price": v["extra_price"], "stock": 400, "is_active": True,
            }]}
            rr = await client.put(f"/api/v1/sellers/products/{p['id']}/variants", json=body, headers=_headers(token))
            _check(rr, f"재고보충({p['name']})")


async def seed() -> None:
    _require_local_database()
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://local-seed-history", timeout=120) as client:
        await _signup_or_login(client, ADMIN)
        if await grant_admin(ADMIN["email"]) != 0:
            raise RuntimeError("로컬 관리자 권한을 부여할 수 없습니다.")
        admin_token = (await _signup_or_login(client, ADMIN))["access_token"]

        # 이미 과거 주문이 있으면 중복 생성하지 않는다 (재실행 안전)
        async with async_session_factory() as session:
            oldest = await session.scalar(select(Order.created_at).order_by(Order.created_at).limit(1))
        if oldest is not None:
            from datetime import datetime, timezone

            age_days = (datetime.now(timezone.utc) - oldest).days
            if age_days >= 2:
                print(f"과거 주문이 이미 있습니다(가장 오래된 주문 {age_days}일 전). 생성을 건너뜁니다.")
                await _report(client, admin_token)
                return

        tokens, _ = await _seller_pools(client)
        if not tokens:
            print("더미 판매자가 없습니다. 먼저 `python -m app.local_seed_bulk`를 실행하세요.")
            return
        await _restock(client, tokens)
        _, pools = await _seller_pools(client)

        buyer_tokens = []
        for b_i, b in enumerate(BUYERS, start=1):
            acct = await _account(b["key"], b["name"], 100 + b_i)
            s = await _signup_or_login(client, acct)
            buyer_tokens.append((s["access_token"], b["name"], 100 + b_i))

        # 계정을 다 만든 뒤에 분산한다 — 생성 전에 돌리면 대상이 0명이라 아무 효과가 없다
        moved = await _spread_user_signups()
        if moved:
            print(f"더미 구매자 가입일 분산: {moved}명")

        brands = [b for b in pools if pools[b]]
        if not brands:
            print("주문 가능한 더미 상품이 없습니다. 먼저 `python -m app.local_seed_bulk`를 실행하세요.")
            return
        made = {"delivered": 0, "shipping": 0, "canceled": 0}
        skipped = 0
        order_idx = 1000
        for plan_i, (days_ago, count, target) in enumerate(HISTORY_PLAN):
            for k in range(count):
                order_idx += 1
                buyer_token, buyer_name, buyer_idx = buyer_tokens[order_idx % len(buyer_tokens)]
                brand = brands[(plan_i + k) % len(brands)]
                pool = pools[brand]
                if not pool:
                    skipped += 1
                    continue
                pick = pool[(order_idx // 3) % len(pool)]
                picks = [{"variant_id": pick["variant_id"], "price": pick["price"], "qty": 1 + (order_idx % 3)}]
                placed = await _place_order(client, buyer_token, picks, buyer_name, buyer_idx, order_idx)
                if placed is None:
                    skipped += 1
                    continue
                oid, grand = placed
                await _advance_order(client, admin_token, oid, grand, target, tokens)
                await _backdate(oid, days_ago)
                made[target] += 1
            print(f"  {days_ago}일 전 · {target} {count}건 처리")

        print(f"\n과거 주문 생성 완료: {made} (건너뜀 {skipped})")
        await _report(client, admin_token)


async def _report(client, admin_token) -> None:
    print("\n===== 기간별 집계 (관리자 통계 API) =====")
    for period, label in (("today", "오늘"), ("7d", "최근 7일"), ("30d", "최근 30일")):
        r = await client.get(f"/api/v1/admin/stats?period={period}", headers=_headers(admin_token))
        _check(r, f"통계({period})")
        d = r.json()
        print(f"  {label:>7}: 매출 {d['revenue']:>12,}원 · 신규주문 {d['new_orders']:>3}건 · 입금확인 {d['paid_orders']:>3}건")


if __name__ == "__main__":
    try:
        asyncio.run(seed())
    except Exception as exc:  # pragma: no cover - 로컬 도구
        print(f"실패: {exc}", file=sys.stderr)
        raise
