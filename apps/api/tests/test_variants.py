"""옵션 조합 그리드·재고 테스트 (Story 3.3)."""

import pytest

from app.products.service import check_purchasable
from tests.helpers import GRID, _admin_token, _auth, _category, _product_body, _seller_with_prefix


async def _product(client, admin_t, t, sid, stock=0):
    cid = await _category(client, admin_t, name="의류잡화")
    res = await client.post("/api/v1/sellers/products", json={**_product_body(sid, cid), "stock": stock}, headers=_auth(t))
    return res.json()


@pytest.mark.asyncio
async def test_default_variant_for_optionless(client, clean_products):
    admin_t = await _admin_token(client)
    t, sid = await _seller_with_prefix(client, admin_t)
    body = await _product(client, admin_t, t, sid, stock=7)
    assert len(body["variants"]) == 1  # AC 2
    assert body["variants"][0]["stock"] == 7 and body["variants"][0]["option1_value"] == ""


@pytest.mark.asyncio
async def test_grid_replace_2x3(client, clean_products):
    admin_t = await _admin_token(client)
    t, sid = await _seller_with_prefix(client, admin_t)
    prod = await _product(client, admin_t, t, sid)

    res = await client.put(f"/api/v1/sellers/products/{prod['id']}/variants", json=GRID, headers=_auth(t))
    assert res.status_code == 200
    vs = res.json()["variants"]
    assert len(vs) == 6  # AC 1: 2×3 조합
    l_black = next(v for v in vs if v["option1_value"] == "블랙" and v["option2_value"] == "L")
    assert l_black["extra_price"] == 1000


@pytest.mark.asyncio
async def test_duplicate_combo_422(client, clean_products):
    admin_t = await _admin_token(client)
    t, sid = await _seller_with_prefix(client, admin_t)
    prod = await _product(client, admin_t, t, sid)
    dup = {"variants": [GRID["variants"][0], GRID["variants"][0]]}
    res = await client.put(f"/api/v1/sellers/products/{prod['id']}/variants", json=dup, headers=_auth(t))
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_foreign_product_404(client, clean_products):
    admin_t = await _admin_token(client)
    t, sid = await _seller_with_prefix(client, admin_t)
    prod = await _product(client, admin_t, t, sid)
    # 다른 판매자 토큰 (구매자 → 판매자 아님이라 403이 먼저 — 여기선 seller 하나뿐이라 미존재 id로 검증)
    import uuid as u
    res = await client.put(f"/api/v1/sellers/products/{u.uuid4()}/variants", json=GRID, headers=_auth(t))
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_purchasable_predicate(client, clean_products):
    from types import SimpleNamespace as NS

    prod = NS(id=1, status="active")
    v = NS(product_id=1, is_active=True, stock=5)
    assert check_purchasable(prod, v, 5) is True
    assert check_purchasable(prod, v, 6) is False               # 재고 부족
    assert check_purchasable(prod, NS(product_id=1, is_active=False, stock=5), 1) is False  # 수동 품절 (AC 3)
    assert check_purchasable(NS(id=1, status="hidden"), v, 1) is False  # 숨김 상품
    assert check_purchasable(prod, NS(product_id=2, is_active=True, stock=5), 1) is False  # 소속 불일치
    assert check_purchasable(prod, v, 0) is False


@pytest.mark.asyncio
async def test_grid_resave_preserves_ids(client, clean_products):
    """4.1 upsert 전환: 재저장해도 동일 조합의 variant id가 보존된다 (장바구니 FK 생존)."""
    admin_t = await _admin_token(client)
    t, sid = await _seller_with_prefix(client, admin_t)
    prod = await _product(client, admin_t, t, sid)

    first = (await client.put(f"/api/v1/sellers/products/{prod['id']}/variants", json=GRID, headers=_auth(t))).json()
    ids_before = {(v["option1_value"], v["option2_value"]): v["id"] for v in first["variants"]}

    changed = {"variants": [{**v, "stock": 9} for v in GRID["variants"]]}
    second = (await client.put(f"/api/v1/sellers/products/{prod['id']}/variants", json=changed, headers=_auth(t))).json()
    for v in second["variants"]:
        assert v["id"] == ids_before[(v["option1_value"], v["option2_value"])]  # id 보존
        assert v["stock"] == 9  # 값은 갱신


@pytest.mark.asyncio
async def test_grid_resave_deletes_only_removed(client, clean_products):
    """제거된 조합만 삭제되고 나머지 id는 유지된다."""
    admin_t = await _admin_token(client)
    t, sid = await _seller_with_prefix(client, admin_t)
    prod = await _product(client, admin_t, t, sid)

    first = (await client.put(f"/api/v1/sellers/products/{prod['id']}/variants", json=GRID, headers=_auth(t))).json()
    kept = [v for v in GRID["variants"] if not (v["option1_value"] == "블랙" and v["option2_value"] == "L")]
    second = (await client.put(f"/api/v1/sellers/products/{prod['id']}/variants", json={"variants": kept}, headers=_auth(t))).json()
    combos = {(v["option1_value"], v["option2_value"]) for v in second["variants"]}
    assert ("블랙", "L") not in combos and len(second["variants"]) == 5
    before = {(v["option1_value"], v["option2_value"]): v["id"] for v in first["variants"]}
    for v in second["variants"]:
        assert v["id"] == before[(v["option1_value"], v["option2_value"])]
