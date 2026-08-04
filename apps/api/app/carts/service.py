import uuid

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import uuid7
from app.carts.models import CartItem
from app.core.errors import AppError
from app.products import service as products_service

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
    try:
        await session.commit()
    except IntegrityError as exc:  # 사전 검증 이후 판매자가 조합 삭제한 레이스 — FK 위반
        await session.rollback()
        raise AppError("not_found", "상품을 찾을 수 없습니다.", status_code=404) from exc
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
        option_text = products_service.variant_option_text(variant)
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


async def get_purchasable_entries(session: AsyncSession, user_id: uuid.UUID) -> list[dict]:
    """구매 가능 항목만 {item, variant, product, brand_name} — 주문서 미리보기·주문 생성용 (AD-10, FR-35)."""
    items = list(await session.scalars(  # 정렬은 get_cart와 동일 — 장바구니 화면 순서 = 주문서·스냅샷 순서 (4.4)
        select(CartItem).where(CartItem.user_id == user_id).order_by(CartItem.created_at.desc(), CartItem.id.desc())
    ))
    info = await products_service.get_variant_purchase_info(session, [i.variant_id for i in items if i.variant_id])
    out = []
    for item in items:
        meta = info.get(item.variant_id)
        if meta is None or not products_service.check_purchasable(meta["product"], meta["variant"], item.quantity):
            continue  # 구매 불가는 미리보기·주문 대상에서 제외 — 표시는 get_cart 몫
        out.append({"item": item, "variant": meta["variant"], "product": meta["product"], "brand_name": meta["brand_name"]})
    return out


async def get_entries_for_order(session: AsyncSession, user_id: uuid.UUID, item_ids: list[uuid.UUID]) -> list[dict]:
    """주문 요청 항목 전부 로드 — {item, variant|None, product|None, brand_name}. 판정은 호출자(orders) 몫.

    요청 id 중 본인 장바구니에 없는 것이 있으면 404 — 부분 주문 서프라이즈 방지의 첫 관문.
    """
    unique_ids = list(dict.fromkeys(item_ids))
    items = list(await session.scalars(
        select(CartItem).where(CartItem.user_id == user_id, CartItem.id.in_(unique_ids))
        .order_by(CartItem.created_at.desc(), CartItem.id.desc())
    ))
    if len(items) != len(unique_ids):
        raise AppError("not_found", "장바구니 항목을 찾을 수 없습니다.", status_code=404)
    info = await products_service.get_variant_purchase_info(session, [i.variant_id for i in items if i.variant_id])
    out = []
    for item in items:
        meta = info.get(item.variant_id) or {"variant": None, "product": None, "brand_name": ""}
        out.append({"item": item, **meta})
    return out


async def delete_items(session: AsyncSession, user_id: uuid.UUID, item_ids: list[uuid.UUID]) -> int:
    """주문 성공 항목 삭제 — 트랜잭션·commit은 orders가 소유 (AD-10). 삭제 행 수 반환.

    rowcount가 요청 수와 다르면 동시 트랜잭션이 이미 지운 것 — 호출자(orders)가 이중 제출로 판정한다.
    """
    from sqlalchemy import delete as sa_delete

    result = await session.execute(
        sa_delete(CartItem).where(CartItem.user_id == user_id, CartItem.id.in_(item_ids))
    )
    return result.rowcount


async def purge_for_user(session: AsyncSession, user_id: uuid.UUID) -> int:
    """회원의 장바구니 전부 삭제 — 회원 탈퇴가 호출한다. 삭제 행 수 반환.

    delete_items와 같은 규약: 트랜잭션·commit은 호출자가 소유한다 (AD-10).
    """
    from sqlalchemy import delete as sa_delete

    result = await session.execute(sa_delete(CartItem).where(CartItem.user_id == user_id))
    return result.rowcount
