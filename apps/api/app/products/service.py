import logging
import uuid

from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import AppError
from app.products.models import Category, Product, ProductImage, Variant
from app.sellers.models import Seller

logger = logging.getLogger("slur.products")

CODE_NAME_EXISTS = "category_name_exists"
CODE_CATEGORY_IN_USE = "category_in_use"


async def list_categories(session: AsyncSession) -> list[Category]:
    rows = await session.scalars(select(Category).order_by(Category.sort_order, Category.created_at))
    return list(rows)


MAX_CATEGORIES = 100  # reorder ids 상한과 대칭


async def create_category(session: AsyncSession, name: str) -> Category:
    count = await session.scalar(select(func.count()).select_from(Category))
    if count is not None and count >= MAX_CATEGORIES:
        raise AppError("validation_error", f"카테고리는 최대 {MAX_CATEGORIES}개까지 만들 수 있습니다.", status_code=422)
    max_order = await session.scalar(select(func.coalesce(func.max(Category.sort_order), -1)))
    category = Category(name=name, sort_order=max_order + 1)
    session.add(category)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise AppError(CODE_NAME_EXISTS, "이미 있는 카테고리 이름입니다.", status_code=409) from exc
    return category


async def rename_category(session: AsyncSession, category_id: uuid.UUID, name: str) -> Category:
    category = await session.get(Category, category_id)
    if category is None:
        raise AppError("not_found", "카테고리를 찾을 수 없습니다.", status_code=404)
    category.name = name
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise AppError(CODE_NAME_EXISTS, "이미 있는 카테고리 이름입니다.", status_code=409) from exc
    return category


async def reorder_categories(session: AsyncSession, ids: list[uuid.UUID]) -> list[Category]:
    existing = {c.id for c in await list_categories(session)}
    if len(ids) != len(existing) or set(ids) != existing:  # 중복 id·부분 목록 모두 거부
        raise AppError("validation_error", "카테고리 목록이 최신이 아닙니다. 새로고침해 주세요.", status_code=422)
    for order, cid in enumerate(ids):
        await session.execute(update(Category).where(Category.id == cid).values(sort_order=order))
    await session.commit()
    return await list_categories(session)


async def delete_category(session: AsyncSession, category_id: uuid.UUID) -> None:
    category = await session.get(Category, category_id)
    if category is None:
        raise AppError("not_found", "카테고리를 찾을 수 없습니다.", status_code=404)
    try:
        await session.delete(category)
        await session.commit()
    except IntegrityError as exc:  # 3.2에서 products FK RESTRICT — 소속 상품 존재
        await session.rollback()
        raise AppError(CODE_CATEGORY_IN_USE, "소속 상품이 있는 카테고리는 삭제할 수 없습니다.", status_code=409) from exc


CODE_INVALID_IMAGE_PATH = "invalid_image_path"


import re

_IMAGE_PATH_RE = re.compile(r"^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$")  # presign이 발급하는 형식만


def _validate_image_ownership(seller_id: uuid.UUID, paths: list[str]) -> None:
    prefix = f"{seller_id}/"
    for p in paths:
        # presign 형식 대조 — 타 판매자 도용·경로 탈출·임의 문자열(URL 오염) 일괄 차단
        if not _IMAGE_PATH_RE.fullmatch(p) or not p.startswith(prefix):
            raise AppError(CODE_INVALID_IMAGE_PATH, "올바르지 않은 이미지입니다.", status_code=403)


async def create_product(session: AsyncSession, seller_id: uuid.UUID, data) -> Product:
    _validate_image_ownership(seller_id, data.image_paths)
    category = await session.get(Category, data.category_id)
    if category is None:
        raise AppError("not_found", "카테고리를 찾을 수 없습니다.", status_code=404)
    product = Product(
        seller_id=seller_id,
        category_id=data.category_id,
        name=data.name,
        base_price=data.base_price,
        description=data.description,
    )
    session.add(product)
    await session.flush()
    # AC 2: 옵션 없는 상품도 조합 1개 (데이터 구조 통일)
    session.add(Variant(product_id=product.id, stock=data.stock))
    for order, path in enumerate(data.image_paths):
        session.add(ProductImage(product_id=product.id, path=path, sort_order=order))
    try:
        await session.commit()
    except IntegrityError as exc:  # 확인-커밋 사이 카테고리 삭제 레이스
        await session.rollback()
        raise AppError("not_found", "카테고리를 찾을 수 없습니다.", status_code=404) from exc
    logger.info("product %s created by seller %s", product.id, seller_id)
    return product


async def list_my_products(session: AsyncSession, seller_id: uuid.UUID) -> list[Product]:
    rows = await session.scalars(
        select(Product).where(Product.seller_id == seller_id).order_by(Product.created_at.desc(), Product.id.desc())
    )
    return list(rows)


async def get_product_images(session: AsyncSession, product_ids: list[uuid.UUID]) -> dict:
    if not product_ids:
        return {}
    rows = await session.scalars(
        select(ProductImage).where(ProductImage.product_id.in_(product_ids)).order_by(ProductImage.sort_order)
    )
    grouped: dict = {}
    for img in rows:
        grouped.setdefault(img.product_id, []).append(img)
    return grouped


CODE_DUPLICATE_VARIANT = "duplicate_variant"


async def replace_variants(session: AsyncSession, seller_id: uuid.UUID, product_id: uuid.UUID, items) -> Product:
    product = await session.scalar(
        select(Product).where(Product.id == product_id, Product.seller_id == seller_id)
    )
    if product is None:  # 타인 상품·미존재 구분 없이 404 (존재 노출 방지 — 스펙의 403에서 의도적 변경)
        raise AppError("not_found", "상품을 찾을 수 없습니다.", status_code=404)
    for item in items:  # 음수 실판매가 방지 (base + extra >= 0)
        if product.base_price + item.extra_price < 0:
            raise AppError("validation_error", "추가금액이 상품 가격보다 낮을 수 없습니다.", status_code=422)
    # upsert: 동일 조합(option1_value, option2_value)은 id 보존 — cart_items FK 생존 (4.1, 3.3 보류 해소)
    existing = {
        (v.option1_value, v.option2_value): v
        for v in await session.scalars(select(Variant).where(Variant.product_id == product_id))
    }
    incoming_keys = set()
    for item in items:
        key = (item.option1_value.strip(), item.option2_value.strip())
        incoming_keys.add(key)
        if key in existing:
            v = existing[key]
            v.option1_name = item.option1_name.strip()
            v.option2_name = item.option2_name.strip()
            v.extra_price, v.stock, v.is_active = item.extra_price, item.stock, item.is_active
        else:
            session.add(Variant(
                product_id=product_id,
                option1_name=item.option1_name.strip(), option1_value=key[0],
                option2_name=item.option2_name.strip(), option2_value=key[1],
                extra_price=item.extra_price, stock=item.stock, is_active=item.is_active,
            ))
    for key, v in existing.items():  # 판매자가 실제로 지운 조합만 삭제 → cart_items는 SET NULL
        if key not in incoming_keys:
            await session.delete(v)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        if "variants" in str(exc.orig) and "unique" in str(exc.orig).lower():
            raise AppError(CODE_DUPLICATE_VARIANT, "중복된 옵션 조합이 있습니다.", status_code=422) from exc
        raise AppError("not_found", "상품을 찾을 수 없습니다.", status_code=404) from exc  # 동시 상품 삭제 등
    return product


async def get_variants(session: AsyncSession, product_ids: list[uuid.UUID]) -> dict:
    if not product_ids:
        return {}
    rows = await session.scalars(
        select(Variant).where(Variant.product_id.in_(product_ids)).order_by(Variant.created_at, Variant.id)
    )
    grouped: dict = {}
    for v in rows:
        grouped.setdefault(v.product_id, []).append(v)
    return grouped


async def get_variant_purchase_info(session: AsyncSession, variant_ids: list[uuid.UUID]) -> dict:
    """variant id별 variant·product·브랜드명·대표 이미지 URL 배치 조회.

    carts·orders가 variant를 볼 때는 이 함수만 쓴다 (AD-2: 타 도메인의 모델 직접 import 금지).
    """
    if not variant_ids:
        return {}
    rows = (await session.execute(
        select(Variant, Product).join(Product, Variant.product_id == Product.id).where(Variant.id.in_(variant_ids))
    )).all()
    images = await get_product_images(session, list({p.id for _, p in rows}))
    sellers = {}
    if rows:
        seller_rows = await session.scalars(select(Seller).where(Seller.id.in_({p.seller_id for _, p in rows})))
        sellers = {s.id: s for s in seller_rows}
    out = {}
    for v, p in rows:
        imgs = images.get(p.id, [])
        out[v.id] = {
            "variant": v,
            "product": p,
            "brand_name": sellers[p.seller_id].brand_name if p.seller_id in sellers else "",
            "image_url": _image_url(imgs[0].path) if imgs else None,
        }
    return out


def check_purchasable(product: Product, variant: Variant, qty: int) -> bool:
    """AD-10 단일 술어 — "이 조합을 지금 qty개 살 수 있는가". carts·orders는 이 함수만 쓴다.

    주의: 표시·사전 검증용 bool이다. 실제 재고 차감은 반드시 조건부 UPDATE(stock >= qty)로 —
    이 술어 통과 후 차감하는 check-then-act는 oversell 레이스 (AD-4).
    """
    return (
        product is not None
        and variant is not None
        and variant.product_id == product.id
        and product.status == "active"
        and variant.is_active
        and qty > 0
        and variant.stock >= qty
    )


async def update_product(session: AsyncSession, seller_id: uuid.UUID, product_id: uuid.UUID, data) -> Product:
    product = await session.scalar(select(Product).where(Product.id == product_id, Product.seller_id == seller_id))
    if product is None:
        raise AppError("not_found", "상품을 찾을 수 없습니다.", status_code=404)
    fields = data.model_dump(exclude_none=True)
    if "base_price" in fields:  # 할인 조합(extra 음수)과의 불변식: base + extra >= 0 (3.3 가드의 대칭)
        min_extra = await session.scalar(
            select(func.coalesce(func.min(Variant.extra_price), 0)).where(Variant.product_id == product_id)
        )
        if fields["base_price"] + (min_extra or 0) < 0:
            raise AppError("validation_error", "옵션 추가금액보다 낮은 가격으로 변경할 수 없습니다.", status_code=422)
    if "category_id" in fields:
        if await session.get(Category, fields["category_id"]) is None:
            raise AppError("not_found", "카테고리를 찾을 수 없습니다.", status_code=404)
    for key, value in fields.items():
        setattr(product, key, value)
    try:
        await session.commit()
    except IntegrityError as exc:  # 카테고리 동시 삭제 레이스
        await session.rollback()
        raise AppError("not_found", "카테고리를 찾을 수 없습니다.", status_code=404) from exc
    return product


def _image_url(path: str) -> str:
    base = get_settings().supabase_url
    return f"{base}/storage/v1/object/public/product-images/{path}"


def _public_fields(product: Product, variants: list[Variant]) -> dict:
    prices = [product.base_price + v.extra_price for v in variants if v.is_active]
    purchasable_any = any(check_purchasable(product, v, 1) for v in variants)
    return {
        "price_from": min(prices) if prices else product.base_price,  # 조합 0개(비정상)는 base 폴백
        "sold_out": not purchasable_any,
    }


async def list_public_products(session: AsyncSession, category_id: uuid.UUID | None, page: int):
    size = get_settings().page_size
    base = select(Product).where(Product.status != "hidden")  # 숨김 제외, 품절은 노출 (PRD)
    if category_id is not None:
        base = base.where(Product.category_id == category_id)
    total = await session.scalar(select(func.count()).select_from(base.subquery()))
    rows = list(await session.scalars(
        base.order_by(Product.created_at.desc(), Product.id.desc()).offset((page - 1) * size).limit(size)
    ))
    ids = [p.id for p in rows]
    images = await get_product_images(session, ids)
    variants = await get_variants(session, ids)
    sellers = {}
    if rows:
        seller_rows = await session.scalars(select(Seller).where(Seller.id.in_({p.seller_id for p in rows})))
        sellers = {sl.id: sl for sl in seller_rows}
    items = []
    for p in rows:
        imgs = images.get(p.id, [])
        items.append({
            "id": p.id, "name": p.name, "category_id": p.category_id,
            "brand_name": sellers[p.seller_id].brand_name if p.seller_id in sellers else "",
            "main_image_url": _image_url(imgs[0].path) if imgs else None,
            **_public_fields(p, variants.get(p.id, [])),
        })
    return items, total or 0


async def get_public_product(session: AsyncSession, product_id: uuid.UUID) -> dict:
    product = await session.scalar(select(Product).where(Product.id == product_id, Product.status != "hidden"))
    if product is None:
        raise AppError("not_found", "상품을 찾을 수 없습니다.", status_code=404)
    images = (await get_product_images(session, [product.id])).get(product.id, [])
    variants = (await get_variants(session, [product.id])).get(product.id, [])
    seller = await session.get(Seller, product.seller_id)
    return {
        "id": product.id, "name": product.name, "category_id": product.category_id,
        "brand_name": seller.brand_name if seller else "",
        "description": product.description,
        "main_image_url": _image_url(images[0].path) if images else None,
        "image_urls": [_image_url(i.path) for i in images],
        "variants": [{
            "id": v.id,
            "option1_name": v.option1_name, "option1_value": v.option1_value,
            "option2_name": v.option2_name, "option2_value": v.option2_value,
            "final_price": product.base_price + v.extra_price,
            "purchasable": check_purchasable(product, v, 1),
        } for v in variants],
        **_public_fields(product, variants),
    }


def variant_option_text(variant: Variant) -> str:
    """옵션 표시 문자열의 단일 소유 — 장바구니·주문서·주문 스냅샷(4.4)이 같은 포맷을 쓴다."""
    return " / ".join(
        f"{name}: {value}"
        for name, value in ((variant.option1_name, variant.option1_value), (variant.option2_name, variant.option2_value))
        if value
    )


async def restore_stock(session: AsyncSession, variant_id: uuid.UUID, qty: int) -> None:
    """취소 확정 트랜잭션 안에서 orders 전이 경로만 호출한다 (AD-4 — 재고 증감의 유일한 소유자).

    복원은 증가라 조건절이 불필요한 원자적 UPDATE. 차감(주문 생성)은 stock >= n 조건부 UPDATE — 4.4.
    """
    if qty <= 0:  # 음수 복원 = 차감 — 호출 버그를 무음 통과시키지 않는다
        raise AppError("internal_error", "재고 복원 수량 오류입니다.", status_code=500)
    result = await session.execute(update(Variant).where(Variant.id == variant_id).values(stock=Variant.stock + qty))
    if result.rowcount == 0:  # variant_id 확인과 UPDATE 사이 조합 삭제 레이스 — 복원 소실 흔적을 남긴다
        logger.warning("restore_stock: variant %s 없음 — 취소 복원 %d개 소실 (조합 삭제 레이스)", variant_id, qty)
