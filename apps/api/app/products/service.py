import logging
import uuid

from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.products.models import Category

logger = logging.getLogger("slur.products")

CODE_NAME_EXISTS = "category_name_exists"
CODE_CATEGORY_IN_USE = "category_in_use"


async def list_categories(session: AsyncSession) -> list[Category]:
    rows = await session.scalars(select(Category).order_by(Category.sort_order, Category.created_at))
    return list(rows)


async def create_category(session: AsyncSession, name: str) -> Category:
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
    if set(ids) != existing:  # 전체 목록과 정확히 일치해야 순서가 모호하지 않다
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
