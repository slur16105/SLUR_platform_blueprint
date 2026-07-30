"""홈 편성 (시안 C · Epic 9) 테스트 — 공개 조회 + 관리자 CRUD."""

import pytest

from tests.helpers import _admin_token, _auth, _buyer, _category, _product_body, _seller_with_prefix


async def _setup(client):
    admin_t = await _admin_token(client)
    cid = await _category(client, admin_t, name="편성용")
    t, sid = await _seller_with_prefix(client, admin_t)
    return admin_t, cid, t, sid


async def _make_product(client, t, sid, cid, name, stock=5):
    return (await client.post(
        "/api/v1/sellers/products",
        json={**_product_body(sid, cid), "name": name, "stock": stock},
        headers=_auth(t),
    )).json()["id"]


async def _truncate_home():
    from sqlalchemy import text

    from app.core.db import engine

    async with engine.begin() as conn:
        await conn.execute(text("TRUNCATE home_features CASCADE"))  # home_feature_items 동반


@pytest.fixture
async def clean_home(clean_products):
    """편성 격리 — 시작 전·종료 후 모두 정리.

    시작 전 정리가 없으면 로컬 seed로 넣어둔 편성 데이터(히어로/슬롯)가 남아
    '비어 있어야 한다'를 검증하는 테스트가 깨진다. clean_auth_tables와 같은 방식.
    """
    await _truncate_home()
    yield
    await _truncate_home()


@pytest.mark.asyncio
async def test_empty_home_hero_null(client, clean_home):
    res = await client.get("/api/v1/home")
    assert res.status_code == 200
    body = res.json()
    assert body["hero"] is None
    assert body["slots"] == []


@pytest.mark.asyncio
async def test_hero_and_slot_exposed_with_soldout(client, clean_home):
    admin_t, cid, t, sid = await _setup(client)
    p_live = await _make_product(client, t, sid, cid, "판매중", stock=5)
    p_sold = await _make_product(client, t, sid, cid, "품절이", stock=0)

    # 히어로 편성
    await client.post("/api/v1/admin/home/features", headers=_auth(admin_t), json={
        "kind": "hero", "layout": "feature", "title": "이번 호 히어로",
        "issue_no": "01", "issue_label": "ISSUE", "lead_text": "서문",
        "display_order": 0, "product_ids": [p_live, p_sold],
    })
    # 슬롯 편성
    await client.post("/api/v1/admin/home/features", headers=_auth(admin_t), json={
        "kind": "slot", "layout": "strip", "title": "슬롯 A",
        "display_order": 1, "product_ids": [p_live],
    })

    body = (await client.get("/api/v1/home")).json()
    assert body["hero"]["title"] == "이번 호 히어로"
    assert body["hero"]["issue_no"] == "01"
    names = {i["name"]: i for i in body["hero"]["items"]}
    assert set(names) == {"판매중", "품절이"}  # 품절도 숨기지 않음
    assert names["품절이"]["sold_out"] is True and names["판매중"]["sold_out"] is False
    assert names["판매중"]["brand_name"] == "슬러굿즈"
    assert len(body["slots"]) == 1 and body["slots"][0]["title"] == "슬롯 A"


@pytest.mark.asyncio
async def test_hidden_product_excluded_from_feature(client, clean_home):
    admin_t, cid, t, sid = await _setup(client)
    p_vis = await _make_product(client, t, sid, cid, "노출상품", stock=5)
    p_hid = await _make_product(client, t, sid, cid, "숨김상품", stock=5)

    # 추가 시점엔 둘 다 노출 상태 — 편성 생성 후 한쪽을 숨긴다(추가 시점 숨김은 결함 #5에서 400으로 막힌다).
    await client.post("/api/v1/admin/home/features", headers=_auth(admin_t), json={
        "kind": "hero", "layout": "feature", "title": "히어로",
        "display_order": 0, "product_ids": [p_vis, p_hid],
    })
    await client.patch(f"/api/v1/sellers/products/{p_hid}", json={"status": "hidden"}, headers=_auth(t))

    body = (await client.get("/api/v1/home")).json()
    names = {i["name"] for i in body["hero"]["items"]}
    assert names == {"노출상품"}  # 숨김 상품은 구매자 홈에서 제외


@pytest.mark.asyncio
async def test_inactive_feature_excluded_and_empty_slot_dropped(client, clean_home):
    admin_t, cid, t, sid = await _setup(client)
    p = await _make_product(client, t, sid, cid, "상품", stock=5)

    # 비활성 hero → hero=null
    await client.post("/api/v1/admin/home/features", headers=_auth(admin_t), json={
        "kind": "hero", "layout": "feature", "title": "비활성히어로",
        "display_order": 0, "is_active": False, "product_ids": [p],
    })
    # 품목 0인 슬롯 → 결과에서 제외
    await client.post("/api/v1/admin/home/features", headers=_auth(admin_t), json={
        "kind": "slot", "layout": "strip", "title": "빈슬롯",
        "display_order": 1, "product_ids": [],
    })
    body = (await client.get("/api/v1/home")).json()
    assert body["hero"] is None
    assert body["slots"] == []


@pytest.mark.asyncio
async def test_hero_lowest_display_order_wins(client, clean_home):
    admin_t, cid, t, sid = await _setup(client)
    p = await _make_product(client, t, sid, cid, "상품", stock=5)
    await client.post("/api/v1/admin/home/features", headers=_auth(admin_t), json={
        "kind": "hero", "layout": "feature", "title": "둘째", "display_order": 5, "product_ids": [p],
    })
    await client.post("/api/v1/admin/home/features", headers=_auth(admin_t), json={
        "kind": "hero", "layout": "feature", "title": "첫째", "display_order": 1, "product_ids": [p],
    })
    body = (await client.get("/api/v1/home")).json()
    assert body["hero"]["title"] == "첫째"


@pytest.mark.asyncio
async def test_admin_crud_roundtrip(client, clean_home):
    admin_t, cid, t, sid = await _setup(client)
    p1 = await _make_product(client, t, sid, cid, "상품1", stock=5)
    p2 = await _make_product(client, t, sid, cid, "상품2", stock=5)

    # 생성
    created = (await client.post("/api/v1/admin/home/features", headers=_auth(admin_t), json={
        "kind": "hero", "layout": "feature", "title": "편성",
        "display_order": 0, "product_ids": [p1, p2],
    })).json()
    fid = created["id"]
    assert [i["product_id"] for i in created["items"]] == [p1, p2]

    # 목록
    lst = (await client.get("/api/v1/admin/home/features", headers=_auth(admin_t))).json()
    assert any(f["id"] == fid and f["item_count"] == 2 for f in lst["items"])

    # 상세
    detail = (await client.get(f"/api/v1/admin/home/features/{fid}", headers=_auth(admin_t))).json()
    assert detail["title"] == "편성" and len(detail["items"]) == 2

    # 수정 — 제목 + 품목 전량 교체(순서 뒤집기)
    patched = (await client.patch(f"/api/v1/admin/home/features/{fid}", headers=_auth(admin_t), json={
        "title": "편성 수정", "product_ids": [p2, p1],
    })).json()
    assert patched["title"] == "편성 수정"
    assert [i["product_id"] for i in patched["items"]] == [p2, p1]

    # 삭제
    d = await client.delete(f"/api/v1/admin/home/features/{fid}", headers=_auth(admin_t))
    assert d.status_code == 204
    assert (await client.get(f"/api/v1/admin/home/features/{fid}", headers=_auth(admin_t))).status_code == 404


@pytest.mark.asyncio
async def test_create_with_unknown_product_400(client, clean_home):
    import uuid

    admin_t, cid, t, sid = await _setup(client)
    res = await client.post("/api/v1/admin/home/features", headers=_auth(admin_t), json={
        "kind": "slot", "layout": "strip", "title": "잘못된편성",
        "product_ids": [str(uuid.uuid7())],
    })
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_ends_before_starts_rejected_422(client, clean_home):
    """노출 종료가 시작 이하면 422 — 프론트뿐 아니라 백엔드에서도 막는다 (결함 #4)."""
    admin_t, cid, t, sid = await _setup(client)
    # 생성: 종료 < 시작
    res = await client.post("/api/v1/admin/home/features", headers=_auth(admin_t), json={
        "kind": "slot", "layout": "strip", "title": "역전창",
        "starts_at": "2026-08-10T00:00:00+00:00", "ends_at": "2026-08-01T00:00:00+00:00",
        "product_ids": [],
    })
    assert res.status_code == 422
    # 생성: 종료 == 시작도 거부
    res_eq = await client.post("/api/v1/admin/home/features", headers=_auth(admin_t), json={
        "kind": "slot", "layout": "strip", "title": "동일창",
        "starts_at": "2026-08-01T00:00:00+00:00", "ends_at": "2026-08-01T00:00:00+00:00",
        "product_ids": [],
    })
    assert res_eq.status_code == 422
    # 정상 창은 통과
    ok = await client.post("/api/v1/admin/home/features", headers=_auth(admin_t), json={
        "kind": "slot", "layout": "strip", "title": "정상창",
        "starts_at": "2026-08-01T00:00:00+00:00", "ends_at": "2026-08-10T00:00:00+00:00",
        "product_ids": [],
    })
    assert ok.status_code == 201
    fid = ok.json()["id"]
    # 수정: 둘 다 전달돼 역전이면 422
    bad_patch = await client.patch(f"/api/v1/admin/home/features/{fid}", headers=_auth(admin_t), json={
        "starts_at": "2026-08-10T00:00:00+00:00", "ends_at": "2026-08-05T00:00:00+00:00",
    })
    assert bad_patch.status_code == 422


@pytest.mark.asyncio
async def test_hidden_product_rejected_on_create_400(client, clean_home):
    """숨김 상품을 편성에 추가하면 400 — API 직접 호출 방어 (결함 #5, AC 9.2)."""
    admin_t, cid, t, sid = await _setup(client)
    p_vis = await _make_product(client, t, sid, cid, "노출상품", stock=5)
    p_hid = await _make_product(client, t, sid, cid, "숨김상품", stock=5)
    await client.patch(f"/api/v1/sellers/products/{p_hid}", json={"status": "hidden"}, headers=_auth(t))

    res = await client.post("/api/v1/admin/home/features", headers=_auth(admin_t), json={
        "kind": "hero", "layout": "feature", "title": "히어로",
        "display_order": 0, "product_ids": [p_vis, p_hid],
    })
    assert res.status_code == 400
    body = res.json()
    assert p_hid in body["details"][0]["reason"]  # 어떤 id가 문제인지 알려준다


@pytest.mark.asyncio
async def test_create_auto_display_order_avoids_zero_collision(client, clean_home):
    """display_order 미지정 신규 편성은 같은 kind 내 max+1을 받아 0↔0 스왑 무효를 피한다 (결함 #6)."""
    admin_t, cid, t, sid = await _setup(client)
    # display_order 미전달(기본 0) 슬롯 2건
    a = (await client.post("/api/v1/admin/home/features", headers=_auth(admin_t), json={
        "kind": "slot", "layout": "strip", "title": "슬롯1", "product_ids": [],
    })).json()
    b = (await client.post("/api/v1/admin/home/features", headers=_auth(admin_t), json={
        "kind": "slot", "layout": "strip", "title": "슬롯2", "product_ids": [],
    })).json()
    assert a["display_order"] == 1
    assert b["display_order"] == 2
    assert a["display_order"] != b["display_order"]  # 둘 다 0이 아니라 스왑이 유효
    # 명시적 양수는 존중
    c = (await client.post("/api/v1/admin/home/features", headers=_auth(admin_t), json={
        "kind": "slot", "layout": "strip", "title": "슬롯3", "display_order": 9, "product_ids": [],
    })).json()
    assert c["display_order"] == 9


@pytest.mark.asyncio
async def test_item_count_excludes_hidden(client, clean_home):
    """관리자 목록 item_count는 숨김 품목을 빼고 센다 — 구매자 홈 노출 수와 정합 (결함 #11)."""
    admin_t, cid, t, sid = await _setup(client)
    p_vis = await _make_product(client, t, sid, cid, "노출상품", stock=5)
    p_hid = await _make_product(client, t, sid, cid, "숨김상품", stock=5)
    created = (await client.post("/api/v1/admin/home/features", headers=_auth(admin_t), json={
        "kind": "slot", "layout": "strip", "title": "혼합편성",
        "display_order": 1, "product_ids": [p_vis, p_hid],
    })).json()
    fid = created["id"]
    # 품목 추가 후 하나를 숨김 처리
    await client.patch(f"/api/v1/sellers/products/{p_hid}", json={"status": "hidden"}, headers=_auth(t))

    lst = (await client.get("/api/v1/admin/home/features", headers=_auth(admin_t))).json()
    row = next(f for f in lst["items"] if f["id"] == fid)
    assert row["item_count"] == 1  # 숨김 1건 제외


@pytest.mark.asyncio
async def test_non_admin_forbidden(client, clean_home):
    buyer_t = await _buyer(client)
    # 인증 없음 → 401
    assert (await client.get("/api/v1/admin/home/features")).status_code == 401
    # 구매자 토큰 → 403
    assert (await client.get("/api/v1/admin/home/features", headers=_auth(buyer_t))).status_code == 403
    r = await client.post("/api/v1/admin/home/features", headers=_auth(buyer_t), json={
        "kind": "slot", "layout": "strip", "title": "x", "product_ids": [],
    })
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_admin_list_display_state_reflects_window(client, clean_home):
    """관리자 목록의 display_state — 토글만이 아니라 노출 기간까지 반영한다(구매자 홈 노출 규칙과 정합)."""
    from datetime import datetime, timedelta, timezone

    admin_t, cid, t, sid = await _setup(client)
    p = await _make_product(client, t, sid, cid, "상태확인상품", stock=5)
    now = datetime.now(timezone.utc)

    def iso(dt):
        return dt.isoformat()

    async def create(title, **extra):
        body = {"kind": "slot", "layout": "strip", "title": title, "product_ids": [p], **extra}
        res = await client.post("/api/v1/admin/home/features", headers=_auth(admin_t), json=body)
        assert res.status_code == 201, res.text
        return res.json()["id"]

    live = await create("지금 노출")
    scheduled = await create("아직 시작 전", starts_at=iso(now + timedelta(days=1)))
    ended = await create("기간 끝남", starts_at=iso(now - timedelta(days=2)), ends_at=iso(now - timedelta(days=1)))
    off = await create("스위치 꺼짐", is_active=False)

    states = {f["id"]: f["display_state"] for f in
              (await client.get("/api/v1/admin/home/features", headers=_auth(admin_t))).json()["items"]}
    assert states[live] == "live"
    assert states[scheduled] == "scheduled"
    assert states[ended] == "ended"
    assert states[off] == "off"

    # 구매자 홈과 정합: live만 실제로 노출된다
    slots = (await client.get("/api/v1/home")).json()["slots"]
    assert [s["id"] for s in slots] == [live]
