"""장바구니 테스트 (Story 4.1)."""

import asyncio
import uuid as u

import pytest

from tests.helpers import GRID, _auth, _buyer, _shop

CARTS = "/api/v1/carts"


@pytest.mark.asyncio
async def test_add_and_merge_quantity(client, clean_products):
    """AC 1: 조합 단위 저장, 같은 조합 재담기는 수량 합산."""
    _, pid, vs = await _shop(client)
    bt = await _buyer(client)
    vid = vs[0]["id"]

    res = await client.post(f"{CARTS}/items", json={"variant_id": vid, "quantity": 2}, headers=_auth(bt))
    assert res.status_code == 201
    res = await client.post(f"{CARTS}/items", json={"variant_id": vid, "quantity": 1}, headers=_auth(bt))
    assert res.status_code == 201
    assert res.json()["quantity"] == 3  # 합산

    cart = (await client.get(CARTS, headers=_auth(bt))).json()
    assert len(cart["items"]) == 1
    item = cart["items"][0]
    assert item["quantity"] == 3 and item["purchasable"] is True
    assert item["final_price"] == 3000 + vs[0]["extra_price"]  # 백엔드 계산 (AD-12)
    assert cart["purchasable_total"] == item["final_price"] * 3


@pytest.mark.asyncio
async def test_update_quantity_and_delete(client, clean_products):
    """AC 3: 수량 변경·삭제 즉시 반영, 재고는 불변 (담기 시점 차감 없음)."""
    st, pid, vs = await _shop(client)
    bt = await _buyer(client)
    vid = vs[0]["id"]
    item = (await client.post(f"{CARTS}/items", json={"variant_id": vid, "quantity": 1}, headers=_auth(bt))).json()

    res = await client.patch(f"{CARTS}/items/{item['id']}", json={"quantity": 4}, headers=_auth(bt))
    assert res.status_code == 200 and res.json()["quantity"] == 4

    res = await client.delete(f"{CARTS}/items/{item['id']}", headers=_auth(bt))
    assert res.status_code == 204
    assert (await client.get(CARTS, headers=_auth(bt))).json()["items"] == []

    # 재고 불변 확인 (FR-11)
    detail = (await client.get(f"/api/v1/products/{pid}")).json()
    assert all(v["purchasable"] for v in detail["variants"])


@pytest.mark.asyncio
async def test_requires_login(client, clean_products):
    assert (await client.get(CARTS)).status_code == 401
    res = await client.post(f"{CARTS}/items", json={"variant_id": str(u.uuid4()), "quantity": 1})
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_foreign_item_404(client, clean_products):
    """타인 장바구니 항목은 404 (존재 노출 방지) — 실제 제2 구매자 계정."""
    _, pid, vs = await _shop(client)
    bt = await _buyer(client)
    other = await _buyer(client, email="buyer2@example.com")
    item = (await client.post(f"{CARTS}/items", json={"variant_id": vs[0]["id"], "quantity": 1}, headers=_auth(bt))).json()

    assert (await client.patch(f"{CARTS}/items/{item['id']}", json={"quantity": 2}, headers=_auth(other))).status_code == 404
    assert (await client.delete(f"{CARTS}/items/{item['id']}", headers=_auth(other))).status_code == 404
    assert (await client.delete(f"{CARTS}/items/{item['id']}", headers=_auth(bt))).status_code == 204  # 본인은 정상


@pytest.mark.asyncio
async def test_add_unpurchasable_422(client, clean_products):
    """담기 사전 검증: 술어 실패는 422 not_purchasable, 없는 조합은 404."""
    st, pid, vs = await _shop(client)
    bt = await _buyer(client)

    # 수동 품절 조합
    grid = {"variants": [{**v, "is_active": False} if i == 0 else v for i, v in enumerate(GRID["variants"])]}
    await client.put(f"/api/v1/sellers/products/{pid}/variants", json=grid, headers=_auth(st))
    res = await client.post(f"{CARTS}/items", json={"variant_id": vs[0]["id"], "quantity": 1}, headers=_auth(bt))
    assert res.status_code == 422 and res.json()["code"] == "not_purchasable"

    # 재고 초과
    res = await client.post(f"{CARTS}/items", json={"variant_id": vs[1]["id"], "quantity": 6}, headers=_auth(bt))
    assert res.status_code == 422 and res.json()["code"] == "not_purchasable"

    # 없는 조합
    res = await client.post(f"{CARTS}/items", json={"variant_id": str(u.uuid4()), "quantity": 1}, headers=_auth(bt))
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_cart_shows_unavailable_after_soldout_or_hidden(client, clean_products):
    """AC 2: 담긴 후 품절·숨김 → 구매 불가 표시, 합계 제외 (술어 재사용 AD-10)."""
    st, pid, vs = await _shop(client)
    bt = await _buyer(client)
    await client.post(f"{CARTS}/items", json={"variant_id": vs[0]["id"], "quantity": 2}, headers=_auth(bt))
    await client.post(f"{CARTS}/items", json={"variant_id": vs[1]["id"], "quantity": 1}, headers=_auth(bt))

    # vs[0] 조합 수동 품절
    grid = {"variants": [{**v, "is_active": False} if i == 0 else v for i, v in enumerate(GRID["variants"])]}
    await client.put(f"/api/v1/sellers/products/{pid}/variants", json=grid, headers=_auth(st))

    cart = (await client.get(CARTS, headers=_auth(bt))).json()
    by_vid = {i["variant_id"]: i for i in cart["items"]}
    assert by_vid[vs[0]["id"]]["purchasable"] is False  # 숨기지 않고 표시
    assert by_vid[vs[1]["id"]]["purchasable"] is True
    assert cart["purchasable_total"] == by_vid[vs[1]["id"]]["final_price"] * 1  # 불가 항목 제외

    # 상품 자체 숨김 → 전 항목 불가
    await client.patch(f"/api/v1/sellers/products/{pid}", json={"status": "hidden"}, headers=_auth(st))
    cart = (await client.get(CARTS, headers=_auth(bt))).json()
    assert all(i["purchasable"] is False for i in cart["items"])
    assert cart["purchasable_total"] == 0


@pytest.mark.asyncio
async def test_deleted_variant_survives_as_ended(client, clean_products):
    """조합 삭제(그리드에서 제거) → SET NULL로 행 생존, '판매 종료' 표시 (FR-35)."""
    st, pid, vs = await _shop(client)
    bt = await _buyer(client)
    target = next(v for v in vs if v["option1_value"] == "블랙" and v["option2_value"] == "L")
    await client.post(f"{CARTS}/items", json={"variant_id": target["id"], "quantity": 1}, headers=_auth(bt))

    kept = [v for v in GRID["variants"] if not (v["option1_value"] == "블랙" and v["option2_value"] == "L")]
    await client.put(f"/api/v1/sellers/products/{pid}/variants", json={"variants": kept}, headers=_auth(st))

    cart = (await client.get(CARTS, headers=_auth(bt))).json()
    assert len(cart["items"]) == 1  # 조용히 사라지지 않는다
    item = cart["items"][0]
    assert item["variant_id"] is None and item["purchasable"] is False
    assert item["final_price"] is None
    assert "판매 종료" in item["product_name"]
    assert cart["purchasable_total"] == 0


@pytest.mark.asyncio
async def test_quantity_validation(client, clean_products):
    """qty 0·음수·1000 초과 422, 합산은 999 캡."""
    _, pid, vs = await _shop(client, stock=2000)
    bt = await _buyer(client)
    vid = vs[0]["id"]

    for bad in (0, -1, 1000):
        res = await client.post(f"{CARTS}/items", json={"variant_id": vid, "quantity": bad}, headers=_auth(bt))
        assert res.status_code == 422

    await client.post(f"{CARTS}/items", json={"variant_id": vid, "quantity": 999}, headers=_auth(bt))
    res = await client.post(f"{CARTS}/items", json={"variant_id": vid, "quantity": 999}, headers=_auth(bt))
    assert res.status_code == 201 and res.json()["quantity"] == 999  # 캡


async def _row_count(user_email="buyer@example.com"):
    """cart_items 실제 행 수 — API 응답이 아닌 DB 진실로 중복 행을 검증한다."""
    from sqlalchemy import text

    from app.core.db import engine

    async with engine.begin() as conn:
        return (await conn.execute(text(
            "SELECT count(*) FROM cart_items c JOIN users u ON u.id = c.user_id WHERE u.email = :e"
        ), {"e": user_email})).scalar()


@pytest.mark.asyncio
async def test_concurrent_add_is_atomic(client, clean_products):
    """동시 담기 레이스 회귀 봉인 — ON CONFLICT DO UPDATE + LEAST의 원자성 (4.1 defer 해소).

    같은 (user, variant)로 병행 담기 → 행 중복 없음(1행)·수량 정확 합산.
    """
    _, pid, vs = await _shop(client, stock=2000)
    bt = await _buyer(client)
    vid = vs[0]["id"]

    results = await asyncio.gather(*[
        client.post(f"{CARTS}/items", json={"variant_id": vid, "quantity": 3}, headers=_auth(bt))
        for _ in range(10)
    ])
    assert all(r.status_code == 201 for r in results)

    assert await _row_count() == 1  # 행 중복 없음 (UNIQUE + upsert)
    cart = (await client.get(CARTS, headers=_auth(bt))).json()
    assert len(cart["items"]) == 1
    assert cart["items"][0]["quantity"] == 30  # 3 × 10 정확 합산 — lost update 없음


@pytest.mark.asyncio
async def test_concurrent_add_respects_cap(client, clean_products):
    """동시 담기로도 999 캡을 넘지 않는다 (LEAST가 upsert 안에서 평가되므로)."""
    _, pid, vs = await _shop(client, stock=2000)
    bt = await _buyer(client)
    vid = vs[0]["id"]

    results = await asyncio.gather(*[
        client.post(f"{CARTS}/items", json={"variant_id": vid, "quantity": 200}, headers=_auth(bt))
        for _ in range(10)
    ])
    assert all(r.status_code == 201 for r in results)

    assert await _row_count() == 1
    cart = (await client.get(CARTS, headers=_auth(bt))).json()
    assert cart["items"][0]["quantity"] == 999  # 2000 요청 → 캡, 초과 없음


@pytest.mark.asyncio
async def test_patch_quantity_bounds(client, clean_products):
    """PATCH 수량 상·하한(1~999) 계약 회귀 봉인 — 스테퍼가 아닌 API가 최종 방어선 (4.1 defer 해소)."""
    _, pid, vs = await _shop(client, stock=2000)
    bt = await _buyer(client)
    item = (await client.post(
        f"{CARTS}/items", json={"variant_id": vs[0]["id"], "quantity": 1}, headers=_auth(bt)
    )).json()

    for bad in (1000, 0, -1):
        res = await client.patch(f"{CARTS}/items/{item['id']}", json={"quantity": bad}, headers=_auth(bt))
        assert res.status_code == 422, bad

    # 경계값은 통과 — 상한 자체가 내려가지 않았음을 함께 봉인
    for ok in (1, 999):
        res = await client.patch(f"{CARTS}/items/{item['id']}", json={"quantity": ok}, headers=_auth(bt))
        assert res.status_code == 200 and res.json()["quantity"] == ok
