import logging
import uuid

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import uuid7
from app.carts.models import CartItem
from app.core.errors import AppError
from app.products import service as products_service

logger = logging.getLogger("slur.carts")

CODE_NOT_PURCHASABLE = "not_purchasable"
MAX_CART_QTY = 999  # ck_cart_items_quantity와 대칭


async def _purchase_info(session: AsyncSession, variant_id: uuid.UUID | None) -> dict | None:
    if variant_id is None:
        return None
    return (await products_service.get_variant_purchase_info(session, [variant_id])).get(variant_id)


async def add_item(session: AsyncSession, user_id: uuid.UUID, variant_id: uuid.UUID, quantity: int) -> CartItem:
    info = await _purchase_info(session, variant_id)
    if info is None:
        raise AppError("not_found", "상품을 찾을 수 없습니다.", status_code=404)
    if not products_service.check_purchasable(info["product"], info["variant"], quantity):
        raise AppError(CODE_NOT_PURCHASABLE, "지금은 구매할 수 없는 상품입니다.", status_code=422)
    # 재담기 합산은 원자적 upsert — 동시 담기 레이스에도 행이 중복되지 않는다 (합산은 999 캡)
    stmt = (
        pg_insert(CartItem)
        .values(id=uuid7(), user_id=user_id, variant_id=variant_id, quantity=quantity)
        .on_conflict_do_update(
            index_elements=["user_id", "variant_id"],
            set_={
                "quantity": func.least(CartItem.quantity + quantity, MAX_CART_QTY),
                "updated_at": func.now(),
            },
        )
        .returning(CartItem)
    )
    item = (await session.execute(stmt)).scalar_one()
    await session.commit()
    return item


async def get_cart(session: AsyncSession, user_id: uuid.UUID) -> dict:
    items = list(await session.scalars(
        select(CartItem).where(CartItem.user_id == user_id).order_by(CartItem.created_at.desc(), CartItem.id.desc())
    ))
    vids = [i.variant_id for i in items if i.variant_id is not None]
    info = await products_service.get_variant_purchase_info(session, vids)
    out, total = [], 0
    for item in items:
        meta = info.get(item.variant_id)
        if meta is None:  # 조합 삭제(SET NULL) — 조용히 사라지지 않고 판매 종료로 표시 (FR-35)
            out.append({
                "id": item.id, "variant_id": None, "quantity": item.quantity,
                "product_id": None, "product_name": "판매 종료된 상품", "brand_name": "",
                "option_text": "", "final_price": None, "image_url": None, "purchasable": False,
            })
            continue
        product, variant = meta["product"], meta["variant"]
        purchasable = products_service.check_purchasable(product, variant, item.quantity)
        final_price = product.base_price + variant.extra_price
        if purchasable:
            total += final_price * item.quantity  # 구매 가능 항목만 합산 — 주문서 진입 대상 (FR-35)
        option_text = " / ".join(
            f"{name}: {value}"
            for name, value in ((variant.option1_name, variant.option1_value), (variant.option2_name, variant.option2_value))
            if value
        )
        out.append({
            "id": item.id, "variant_id": variant.id, "quantity": item.quantity,
            "product_id": product.id, "product_name": product.name, "brand_name": meta["brand_name"],
            "option_text": option_text, "final_price": final_price, "image_url": meta["image_url"],
            "purchasable": purchasable,
        })
    return {"items": out, "purchasable_total": total}


async def _own_item(session: AsyncSession, user_id: uuid.UUID, item_id: uuid.UUID) -> CartItem:
    item = await session.scalar(select(CartItem).where(CartItem.id == item_id, CartItem.user_id == user_id))
    if item is None:  # 타인 항목·미존재 구분 없이 404 (존재 노출 방지)
        raise AppError("not_found", "장바구니 항목을 찾을 수 없습니다.", status_code=404)
    return item


async def update_quantity(session: AsyncSession, user_id: uuid.UUID, item_id: uuid.UUID, quantity: int) -> CartItem:
    item = await _own_item(session, user_id, item_id)
    info = await _purchase_info(session, item.variant_id)
    if info is None or not products_service.check_purchasable(info["product"], info["variant"], quantity):
        raise AppError(CODE_NOT_PURCHASABLE, "지금은 구매할 수 없는 상품입니다.", status_code=422)
    item.quantity = quantity
    await session.commit()
    return item


async def delete_item(session: AsyncSession, user_id: uuid.UUID, item_id: uuid.UUID) -> None:
    item = await _own_item(session, user_id, item_id)
    await session.delete(item)
    await session.commit()
