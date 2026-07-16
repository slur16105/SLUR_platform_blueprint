import logging
import uuid

from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.products.models import Category, Product, ProductImage, Variant

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
    if product is None:  # 타인 상품·미존재 구분 없이 (존재 노출 방지)
        raise AppError("not_found", "상품을 찾을 수 없습니다.", status_code=404)
    from sqlalchemy import delete as sqldelete

    await session.execute(sqldelete(Variant).where(Variant.product_id == product_id))
    for item in items:
        session.add(Variant(
            product_id=product_id,
            option1_name=item.option1_name.strip(), option1_value=item.option1_value.strip(),
            option2_name=item.option2_name.strip(), option2_value=item.option2_value.strip(),
            extra_price=item.extra_price, stock=item.stock, is_active=item.is_active,
        ))
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise AppError(CODE_DUPLICATE_VARIANT, "중복된 옵션 조합이 있습니다.", status_code=422) from exc
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


def check_purchasable(product: Product, variant: Variant, qty: int) -> bool:
    """AD-10 단일 술어 — "이 조합을 지금 qty개 살 수 있는가". carts·orders는 이 함수만 쓴다."""
    return (
        product is not None
        and variant is not None
        and variant.product_id == product.id
        and product.status == "active"
        and variant.is_active
        and qty > 0
        and variant.stock >= qty
    )
