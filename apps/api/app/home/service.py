"""홈 편성 (시안 C · Epic 9) 서비스.

편성 품목의 공개 표현(brand_name·main_image_url·price_from·sold_out)은 products 서비스의
함수를 재사용한다 (AD-2: 타 도메인 모델을 직접 조립하지 않고 products의 공개 함수를 경유).
"""

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import AppError
from app.home.models import HomeFeature, HomeFeatureItem
from app.products import service as products_service
from app.products.models import Product, Variant
from app.sellers.models import Seller

logger = logging.getLogger("slur.home")


def _feature_image_url(image_path: str | None) -> str | None:
    """편성 지면 이미지 URL. 로컬(Storage 미연결) 검증에서는 Web이 제공하는 홈 전용 데모 히어로를 쓴다.
    products._image_url는 상품 데모 이미지를 돌려주므로 홈은 별도 자산으로 분리한다.
    production에서 Storage 설정 누락을 이미지 fallback으로 숨기지 않는다(local 한정)."""
    if not image_path:
        return None
    settings = get_settings()
    if not settings.supabase_url.rstrip("/"):
        return "/local-home-images/hero.jpg" if settings.environment == "local" else None
    return products_service._image_url(image_path)


# ── 공개 조회 ────────────────────────────────────────────────────────


async def _product_public_map(session: AsyncSession, product_ids: list[uuid.UUID]) -> dict[uuid.UUID, dict]:
    """상품 id별 공개 카드 표현 — 숨김 상품은 제외(품절은 sold_out=True로 포함).

    products.list_public_products의 카드 조립을 편성용으로 재사용한다.
    """
    if not product_ids:
        return {}
    rows = list(await session.scalars(
        select(Product).where(Product.id.in_(product_ids), Product.status != "hidden")
    ))
    if not rows:
        return {}
    ids = [p.id for p in rows]
    images = await products_service.get_product_images(session, ids)
    variants = await products_service.get_variants(session, ids)
    seller_rows = await session.scalars(select(Seller).where(Seller.id.in_({p.seller_id for p in rows})))
    sellers = {s.id: s for s in seller_rows}
    out: dict[uuid.UUID, dict] = {}
    for p in rows:
        imgs = images.get(p.id, [])
        out[p.id] = {
            "id": p.id,
            "name": p.name,
            "brand_name": sellers[p.seller_id].brand_name if p.seller_id in sellers else "",
            "main_image_url": products_service._image_url(imgs[0].path) if imgs else None,
            **products_service._public_fields(p, variants.get(p.id, [])),
        }
    return out


def _in_window(feature: HomeFeature, now: datetime) -> bool:
    if feature.starts_at is not None and now < feature.starts_at:
        return False
    if feature.ends_at is not None and now >= feature.ends_at:
        return False
    return True


async def _feature_items_map(session: AsyncSession, feature_ids: list[uuid.UUID]) -> dict[uuid.UUID, list[HomeFeatureItem]]:
    if not feature_ids:
        return {}
    rows = await session.scalars(
        select(HomeFeatureItem)
        .where(HomeFeatureItem.feature_id.in_(feature_ids))
        .order_by(HomeFeatureItem.sort_order, HomeFeatureItem.id)
    )
    grouped: dict[uuid.UUID, list[HomeFeatureItem]] = {}
    for it in rows:
        grouped.setdefault(it.feature_id, []).append(it)
    return grouped


async def get_home(session: AsyncSession) -> dict:
    """홈 1회 호출 — 활성·노출기간 유효한 hero 1건 + slot N건.

    hero: kind='hero'·is_active 중 노출기간 유효한 것 중 display_order 최소 1건 (없으면 null).
    slots: kind='slot'·is_active·노출기간 유효, display_order 순. 편성 품목 0인 슬롯은 제외.
    """
    now = datetime.now(timezone.utc)
    features = list(await session.scalars(
        select(HomeFeature).where(HomeFeature.is_active.is_(True)).order_by(HomeFeature.display_order, HomeFeature.id)
    ))
    features = [f for f in features if _in_window(f, now)]

    items_by_feature = await _feature_items_map(session, [f.id for f in features])
    all_product_ids = list({it.product_id for items in items_by_feature.values() for it in items})
    products = await _product_public_map(session, all_product_ids)

    def build(feature: HomeFeature) -> dict:
        cards = []
        for it in items_by_feature.get(feature.id, []):
            card = products.get(it.product_id)
            if card is not None:  # 숨김 상품은 표현 맵에서 빠져 자연 제외
                cards.append(card)
        return {
            "id": feature.id,
            "kind": feature.kind,
            "issue_no": feature.issue_no,
            "issue_label": feature.issue_label,
            "title": feature.title,
            "lead_text": feature.lead_text,
            "image_url": _feature_image_url(feature.image_path),
            "layout": feature.layout,
            "items": cards,
        }

    hero = None
    slots = []
    for f in features:  # display_order 오름차순 정렬 상태
        if f.kind == "hero" and hero is None:
            hero = build(f)
        elif f.kind == "slot":
            built = build(f)
            if built["items"]:  # 편성 품목 0인 슬롯 제외
                slots.append(built)
    return {"hero": hero, "slots": slots}


# ── 관리자 CRUD ──────────────────────────────────────────────────────


async def _validate_products(session: AsyncSession, product_ids: list[uuid.UUID]) -> None:
    if not product_ids:
        return
    rows = (await session.execute(
        select(Product.id, Product.status).where(Product.id.in_(product_ids))
    )).all()
    status_by_id = {pid: status for pid, status in rows}
    missing = [str(pid) for pid in product_ids if pid not in status_by_id]
    if missing:
        raise AppError(
            "validation_error", "존재하지 않는 상품이 포함되어 있습니다.", status_code=400,
            details=[{"field": "product_ids", "reason": f"존재하지 않는 상품: {', '.join(missing)}"}],
        )
    # 숨김 상품은 구매자 홈에서 조용히 제외돼 편성이 의도와 달라진다 — 추가 자체를 막는다 (AC 9.2).
    # UI는 이미 막지만 API 직접 호출로는 가능하므로 여기서 거부한다.
    hidden = [str(pid) for pid, status in status_by_id.items() if status == "hidden"]
    if hidden:
        raise AppError(
            "validation_error", "숨김 상태 상품은 편성에 추가할 수 없습니다.", status_code=400,
            details=[{"field": "product_ids", "reason": f"숨김 상품: {', '.join(hidden)}"}],
        )


async def _replace_items(session: AsyncSession, feature_id: uuid.UUID, product_ids: list[uuid.UUID]) -> None:
    """편성 품목 전량 교체 — 기존 삭제 후 순서대로 재삽입 (단순·안전)."""
    await session.execute(delete(HomeFeatureItem).where(HomeFeatureItem.feature_id == feature_id))
    for order, pid in enumerate(product_ids):
        session.add(HomeFeatureItem(feature_id=feature_id, product_id=pid, sort_order=order))


def _display_state(feature: HomeFeature, now: datetime) -> str:
    """관리자 목록의 실제 노출 상태 — 토글(is_active)만으로는 기간을 반영하지 못한다.

    구매자 홈은 is_active + 노출기간(_in_window)을 모두 만족하는 것만 내보낸다(list_home).
    관리자 화면이 토글만 보여주면 시작 전·종료된 항목도 "노출중"으로 읽혀 오해를 만든다.
    파생은 서버가 소유한다(AD-12) — 클라이언트 시계에 기대지 않는다.
    """
    if not feature.is_active:
        return "off"
    if feature.starts_at is not None and now < feature.starts_at:
        return "scheduled"  # 예약 — 시작 전
    if feature.ends_at is not None and now >= feature.ends_at:
        return "ended"  # 종료 — 기간 만료
    return "live"


async def list_features(session: AsyncSession) -> list[dict]:
    features = list(await session.scalars(
        select(HomeFeature).order_by(HomeFeature.kind, HomeFeature.display_order, HomeFeature.id)
    ))
    now = await session.scalar(select(func.now()))  # 기간 판정은 DB 시각 기준 (구매자 홈과 동일)
    # 공개 노출 가능한 품목(status != 'hidden')만 센다 — 구매자 홈 노출 수와 정합.
    # 숨김 품목을 포함해 세면 목록엔 "품목 3"인데 홈엔 더 적게 나온다.
    counts = dict((await session.execute(
        select(HomeFeatureItem.feature_id, func.count())
        .join(Product, Product.id == HomeFeatureItem.product_id)
        .where(Product.status != "hidden")
        .group_by(HomeFeatureItem.feature_id)
    )).all())
    return [{
        "id": f.id, "kind": f.kind, "title": f.title,
        "issue_no": f.issue_no, "issue_label": f.issue_label, "layout": f.layout,
        "display_order": f.display_order, "is_active": f.is_active,
        "starts_at": f.starts_at, "ends_at": f.ends_at,
        "display_state": _display_state(f, now),
        "item_count": int(counts.get(f.id, 0)), "updated_at": f.updated_at,
    } for f in features]


async def _detail(session: AsyncSession, feature: HomeFeature) -> dict:
    items = (await _feature_items_map(session, [feature.id])).get(feature.id, [])
    products = await _product_public_map(session, [it.product_id for it in items])
    item_out = []
    for it in items:
        card = products.get(it.product_id)  # 숨김 상품은 None — 관리자 화면엔 최소 정보로 노출
        item_out.append({
            "id": it.id, "product_id": it.product_id, "sort_order": it.sort_order,
            "name": card["name"] if card else "(노출 불가 상품)",
            "brand_name": card["brand_name"] if card else "",
            "price_from": card["price_from"] if card else 0,
            "main_image_url": card["main_image_url"] if card else None,
            "sold_out": card["sold_out"] if card else True,
        })
    return {
        "id": feature.id, "kind": feature.kind, "issue_no": feature.issue_no, "issue_label": feature.issue_label,
        "title": feature.title, "lead_text": feature.lead_text, "image_path": feature.image_path,
        "image_url": products_service._image_url(feature.image_path) if feature.image_path else None,
        "layout": feature.layout, "display_order": feature.display_order,
        "starts_at": feature.starts_at, "ends_at": feature.ends_at, "is_active": feature.is_active,
        "created_at": feature.created_at, "updated_at": feature.updated_at,
        "items": item_out,
    }


async def get_feature(session: AsyncSession, feature_id: uuid.UUID) -> dict:
    feature = await session.get(HomeFeature, feature_id)
    if feature is None:
        raise AppError("not_found", "편성을 찾을 수 없습니다.", status_code=404)
    return await _detail(session, feature)


async def create_feature(session: AsyncSession, data) -> dict:
    await _validate_products(session, data.product_ids)
    # display_order 미지정(기본 0) 또는 0이면 같은 kind 내 max+1을 배정한다 —
    # 모든 신규 편성이 0이 되면 관리자 ↑↓ 스왑이 0↔0 무효가 된다. 명시적 양수는 존중한다.
    display_order = data.display_order
    if not display_order:
        current_max = await session.scalar(
            select(func.max(HomeFeature.display_order)).where(HomeFeature.kind == data.kind)
        )
        display_order = (current_max or 0) + 1
    feature = HomeFeature(
        kind=data.kind, layout=data.layout, title=data.title,
        issue_no=data.issue_no, issue_label=data.issue_label, lead_text=data.lead_text,
        image_path=data.image_path, display_order=display_order,
        starts_at=data.starts_at, ends_at=data.ends_at, is_active=data.is_active,
    )
    session.add(feature)
    await session.flush()
    await _replace_items(session, feature.id, data.product_ids)
    await session.commit()
    await session.refresh(feature)  # server_default/onupdate 값 채우기 (지연 로드 회피)
    logger.info("home feature %s created (kind=%s)", feature.id, feature.kind)
    return await _detail(session, feature)


async def update_feature(session: AsyncSession, feature_id: uuid.UUID, data) -> dict:
    feature = await session.get(HomeFeature, feature_id)
    if feature is None:
        raise AppError("not_found", "편성을 찾을 수 없습니다.", status_code=404)
    fields = data.model_dump(exclude_unset=True)
    product_ids = fields.pop("product_ids", None)
    if product_ids is not None:
        await _validate_products(session, product_ids)
    for key, value in fields.items():
        setattr(feature, key, value)
    if product_ids is not None:
        await _replace_items(session, feature.id, product_ids)
    await session.commit()
    await session.refresh(feature)  # onupdate로 갱신된 updated_at 반영 (지연 로드 회피)
    return await _detail(session, feature)


async def delete_feature(session: AsyncSession, feature_id: uuid.UUID) -> None:
    feature = await session.get(HomeFeature, feature_id)
    if feature is None:
        raise AppError("not_found", "편성을 찾을 수 없습니다.", status_code=404)
    await session.delete(feature)  # home_feature_items는 FK CASCADE
    await session.commit()
