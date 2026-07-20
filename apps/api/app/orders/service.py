import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.carts import service as carts_service
from app.core.errors import AppError
from app.orders.models import RemoteAreaZip, Setting
from app.products import service as products_service
from app.sellers import service as sellers_service

CODE_EMPTY_CART = "empty_cart"

# settings 시드 key (AD-13 — 수치는 DB에, 코드에는 key만)
SETTING_DEPOSIT_ACCOUNT = "deposit_account"
SETTING_UNPAID_CANCEL_DAYS = "unpaid_cancel_days"
SETTING_LOW_STOCK_THRESHOLD = "low_stock_threshold"


async def get_setting(session: AsyncSession, key: str) -> str:
    """settings 단건 조회 — 시드 누락은 배포 오류이므로 500으로 드러낸다."""
    value = await session.scalar(select(Setting.value).where(Setting.key == key))
    if value is None:
        raise AppError("internal_error", "서버 설정 오류입니다.", status_code=500)
    return value


async def get_remote_area_kind(session: AsyncSession, postal_code: str) -> str | None:
    """도서산간 판정 단일 소유 — 'jeju' | 'island' | None(일반). 목록에 없으면 일반 (과청구 방지)."""
    return await session.scalar(select(RemoteAreaZip.kind).where(RemoteAreaZip.zip_code == postal_code))


def _seller_shipping_fee(seller, remote_kind: str | None) -> tuple[int, int]:
    """판매자 1명의 (기본 배송비, 도서산간 추가비) — 설정은 sellers 데이터가 정답 소스."""
    if remote_kind == "jeju":
        return seller.base_shipping_fee, seller.jeju_extra_fee
    if remote_kind == "island":
        return seller.base_shipping_fee, seller.island_extra_fee
    return seller.base_shipping_fee, 0


async def quote(session: AsyncSession, entries: list[dict], postal_code: str) -> dict:
    """배송비·총액 계산의 유일한 소유자 (AD-11).

    entries는 carts.get_purchasable_entries 형식. 미리보기는 이 결과를 응답으로 내리고,
    4.4 주문 생성은 같은 결과를 sub_orders에 스냅샷한다 — 두 경로의 금액이 구조적으로 동일.
    """
    remote_kind = await get_remote_area_kind(session, postal_code)
    groups: dict[uuid.UUID, dict] = {}
    for e in entries:
        product, variant, item = e["product"], e["variant"], e["item"]
        line_total = (product.base_price + variant.extra_price) * item.quantity
        g = groups.setdefault(product.seller_id, {"brand_name": e["brand_name"], "items": [], "item_total": 0})
        g["items"].append({
            "cart_item_id": item.id,
            "variant_id": variant.id,
            "product_name": product.name,
            "option_text": products_service.variant_option_text(variant),
            "quantity": item.quantity,
            "final_price": product.base_price + variant.extra_price,
            "line_total": line_total,
        })
        g["item_total"] += line_total
    sellers = await sellers_service.get_sellers_by_ids(session, list(groups))
    seller_groups, item_total, shipping_total, remote_extra_total = [], 0, 0, 0
    for seller_id, g in groups.items():
        seller = sellers.get(seller_id)
        if seller is None:  # 조회 사이 판매자 삭제 레이스 — raw KeyError 500 대신 봉투로
            raise AppError("internal_error", "판매자 정보를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.", status_code=500)
        base_fee, extra_fee = _seller_shipping_fee(seller, remote_kind)
        seller_groups.append({
            "seller_id": seller_id, "brand_name": g["brand_name"], "items": g["items"],
            "item_total": g["item_total"], "shipping_fee": base_fee, "remote_extra_fee": extra_fee,
            "shipping_total": base_fee + extra_fee,  # 그룹 표시용 합산도 서버 소유 (AD-12)
        })
        item_total += g["item_total"]
        shipping_total += base_fee  # 기본 배송비 합 — 도서산간 추가비는 별도 필드 (요약 표시용 분리, AD-12)
        remote_extra_total += extra_fee
    return {
        "seller_groups": seller_groups,
        "item_total": item_total,
        "shipping_total": shipping_total,
        "remote_extra_total": remote_extra_total,
        "grand_total": item_total + shipping_total + remote_extra_total,
        "remote_area_kind": remote_kind,
    }


async def preview_order(session: AsyncSession, user_id: uuid.UUID, postal_code: str) -> dict:
    """주문서 미리보기 — 구매 가능 항목만 (AD-10), 전 금액 백엔드 계산 (AD-12). 읽기 전용."""
    entries = await carts_service.get_purchasable_entries(session, user_id)
    if not entries:
        raise AppError(CODE_EMPTY_CART, "주문할 수 있는 상품이 없습니다.", status_code=422)
    return await quote(session, entries, postal_code)


# ---------------------------------------------------------------------------
# 상태 전이 엔진 (Story 4.3, AD-3) — 상태를 바꾸는 유일한 통로
# ---------------------------------------------------------------------------

from sqlalchemy import exists  # noqa: E402 — 엔진 절 전용

from app.orders import transitions as t  # noqa: E402
from app.orders.models import Cancellation, Order, OrderEvent, OrderItem, SubOrder  # noqa: E402

_LAYER_MODEL = {t.LAYER_ORDER: Order, t.LAYER_SUB_ORDER: SubOrder, t.LAYER_ORDER_ITEM: OrderItem}
_LAYER_STATUS_ATTR = {t.LAYER_ORDER: "payment_status", t.LAYER_SUB_ORDER: "shipping_status", t.LAYER_ORDER_ITEM: "status"}


async def _locked(session: AsyncSession, model, entity_id: uuid.UUID):
    """FOR UPDATE 행 잠금 재조회 — 동시 전이의 check-then-act 레이스 방어 (이 엔진에서만 쓰는 신규 패턴)."""
    row = await session.scalar(select(model).where(model.id == entity_id).with_for_update())
    if row is None:
        raise AppError("not_found", "대상을 찾을 수 없습니다.", status_code=404)
    return row


async def transition(
    session: AsyncSession,
    *,
    layer: str,
    entity_id: uuid.UUID,
    to_status: str,
    actor_role: str,
    actor_user_id: uuid.UUID | None,
    note: str = "",
    carrier: str | None = None,
    tracking_number: str | None = None,
):
    """3층 공통 전이 함수 — 전이표 검사, 가드, 상태 변경, order_events 기록까지. commit은 호출자 소유.

    모든 코드 경로(구매자 취소·관리자 입금확인·강제 변경·판매자 배송 처리·자동취소 배치)는 이 함수만 호출한다.
    shipping 전이의 carrier·tracking_number 기록도 여기가 소유한다 — 상태와 송장이 따로 노는 반쪽 전이 방지.
    """
    model = _LAYER_MODEL[layer]
    attr = _LAYER_STATUS_ATTR[layer]
    entity = await _locked(session, model, entity_id)
    from_status = getattr(entity, attr)

    allowed = t.TRANSITIONS.get((layer, from_status, to_status))
    if allowed is None:
        raise AppError("invalid_transition", "허용되지 않은 상태 변경입니다.", status_code=422)
    if actor_role not in allowed:
        raise AppError("forbidden", "이 상태 변경을 수행할 권한이 없습니다.", status_code=403)

    # 층 넘는 가드 + 층별 부가 기록
    if layer == t.LAYER_ORDER_ITEM:
        sub_order = await _locked(session, SubOrder, entity.sub_order_id)  # paid 연쇄와 직렬화
        order = await _locked(session, Order, sub_order.order_id)
        t.guard_item_cancel(actor_role, sub_order.shipping_status, order.payment_status)
        order_id = order.id
    elif layer == t.LAYER_SUB_ORDER:
        if to_status == t.SUB_SHIPPING:
            t.guard_shipping_info(carrier, tracking_number)
            entity.carrier = carrier
            entity.tracking_number = tracking_number
        order_id = entity.order_id
    else:
        order_id = entity.id

    setattr(entity, attr, to_status)
    session.add(OrderEvent(
        order_id=order_id, entity_type=layer, entity_id=entity.id,
        from_status=from_status, to_status=to_status,
        actor_role=actor_role, actor_user_id=actor_user_id, note=note,
    ))

    # paid 연쇄: 같은 트랜잭션에서 활성 라인이 있는 sub_orders만 preparing 진입
    if layer == t.LAYER_ORDER and to_status == t.ORDER_PAID:
        entity.paid_at = func.now()
        sub_ids = list(await session.scalars(
            select(SubOrder.id).where(SubOrder.order_id == entity.id).order_by(SubOrder.created_at, SubOrder.id)
        ))
        for sid in sub_ids:
            has_active = await session.scalar(
                select(exists().where(OrderItem.sub_order_id == sid, OrderItem.status == t.ITEM_ORDERED))
            )
            if not has_active:  # 전 라인 취소된 묶음 — 판매자에게 유령 '배송준비' 노출 방지
                continue
            await transition(
                session, layer=t.LAYER_SUB_ORDER, entity_id=sid, to_status=t.SUB_PREPARING,
                actor_role=actor_role, actor_user_id=actor_user_id, note=note,
            )

    await session.flush()
    return entity


async def cancel_order_item(
    session: AsyncSession,
    *,
    order_item_id: uuid.UUID,
    actor_role: str,
    actor_user_id: uuid.UUID | None,
    reason: str,
    responsibility: str,
    note: str = "",
) -> OrderItem:
    """라인 취소 확정 경로 — 전이 + 재고 복원(정확히 1회) + cancellations 기록을 한 트랜잭션에서 (AC 5).

    4.5(자동취소)·4.6(구매자 취소)·5.5(관리자 개입)는 이 함수만 호출한다. 재취소는 전이표가
    거부(canceled→canceled 미정의)하고, cancellations UNIQUE(order_item_id)가 DB 수준 이중 방어.
    """
    item = await transition(
        session, layer=t.LAYER_ORDER_ITEM, entity_id=order_item_id, to_status=t.ITEM_CANCELED,
        actor_role=actor_role, actor_user_id=actor_user_id, note=note,
    )
    if item.variant_id is not None:  # 조합 삭제(SET NULL)면 복원 no-op — 4.2 결정 ②
        await products_service.restore_stock(session, item.variant_id, item.quantity)
    session.add(Cancellation(order_item_id=item.id, reason=reason, responsibility=responsibility, created_by=actor_user_id))
    await session.flush()
    return item
