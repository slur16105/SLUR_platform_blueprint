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
from sqlalchemy.exc import IntegrityError  # noqa: E402

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
    _allow_item_cancel: bool = False,
):
    """3층 공통 전이 함수 — 전이표 검사, 가드, 상태 변경, order_events 기록까지. commit은 호출자 소유.

    모든 코드 경로(구매자 취소·관리자 입금확인·강제 변경·판매자 배송 처리·자동취소 배치)는 이 함수만 호출한다.
    shipping 전이의 carrier·tracking_number 기록도 여기가 소유한다 — 상태와 송장이 따로 노는 반쪽 전이 방지.
    라인 취소는 cancel_order_item()만 허용(_allow_item_cancel) — 재고 복원·cancellations 없는 반쪽 취소 방지.

    소유권(이 엔티티가 누구의 것인가) 검사는 하지 않는다 — actor_user_id는 감사 기록용이며,
    본인 확인·판매자 소유 확인은 호출자(각 스토리의 엔드포인트 서비스 함수) 책임이다.
    잠금 순서는 모든 경로에서 부모 우선(order → sub_order → item) — 역순 획득이 만드는 교착 방지.
    """
    if layer not in _LAYER_MODEL:
        raise AppError("invalid_transition", "허용되지 않은 상태 변경입니다.", status_code=422)
    if len(note) > 500:
        raise AppError("validation_error", "메모는 500자를 넘을 수 없습니다.", status_code=422)
    attr = _LAYER_STATUS_ATTR[layer]

    # 부모 우선 잠금 — 라인 취소도 order→sub_order→item 순 (paid 연쇄와 동일 순서, 교착 방지).
    # 부모 id는 불변 FK라 잠금 전 미리 읽어도 안전하다.
    order = sub_order = None
    if layer == t.LAYER_ORDER_ITEM:
        if to_status == t.ITEM_CANCELED and not _allow_item_cancel:
            raise AppError("invalid_transition", "라인 취소는 cancel_order_item 경로만 허용됩니다.", status_code=422)
        sub_order_id = await session.scalar(select(OrderItem.sub_order_id).where(OrderItem.id == entity_id))
        if sub_order_id is None:
            raise AppError("not_found", "대상을 찾을 수 없습니다.", status_code=404)
        order_id_probe = await session.scalar(select(SubOrder.order_id).where(SubOrder.id == sub_order_id))
        order = await _locked(session, Order, order_id_probe)
        sub_order = await _locked(session, SubOrder, sub_order_id)
    entity = await _locked(session, _LAYER_MODEL[layer], entity_id)
    from_status = getattr(entity, attr)

    allowed = t.TRANSITIONS.get((layer, from_status, to_status))
    if allowed is None:
        raise AppError("invalid_transition", "허용되지 않은 상태 변경입니다.", status_code=422)
    if actor_role not in allowed:
        raise AppError("forbidden", "이 상태 변경을 수행할 권한이 없습니다.", status_code=403)

    # 층 넘는 가드 + 층별 부가 기록
    if layer == t.LAYER_ORDER_ITEM:
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
        active_flags = []
        for sid in sub_ids:
            active_flags.append(await session.scalar(
                select(exists().where(OrderItem.sub_order_id == sid, OrderItem.status == t.ITEM_ORDERED))
            ))
        if not any(active_flags):  # 전 라인 취소된 주문 — 유령 paid 고착 방지 (order canceled 전이는 4.5·4.6 조합 몫)
            raise AppError("invalid_transition", "모든 상품이 취소된 주문은 입금 확인할 수 없습니다.", status_code=422)
        for sid, has_active in zip(sub_ids, active_flags):
            if not has_active:  # 전 라인 취소된 묶음 — 판매자에게 유령 '배송준비' 노출 방지
                continue
            await transition(
                session, layer=t.LAYER_SUB_ORDER, entity_id=sid, to_status=t.SUB_PREPARING,
                actor_role=actor_role, actor_user_id=actor_user_id,  # note는 order 이벤트의 것 — 연쇄에 복제하지 않음
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
    if len(reason) > 500:
        raise AppError("validation_error", "취소 사유는 500자를 넘을 수 없습니다.", status_code=422)
    item = await transition(
        session, layer=t.LAYER_ORDER_ITEM, entity_id=order_item_id, to_status=t.ITEM_CANCELED,
        actor_role=actor_role, actor_user_id=actor_user_id, note=note, _allow_item_cancel=True,
    )
    if item.variant_id is not None:  # 조합 삭제(SET NULL)면 복원 no-op — 4.2 결정 ②
        await products_service.restore_stock(session, item.variant_id, item.quantity)
    session.add(Cancellation(order_item_id=item.id, reason=reason, responsibility=responsibility, created_by=actor_user_id))
    try:
        await session.flush()
    except IntegrityError as exc:  # UNIQUE 이중 방어 발동 — 500 대신 봉투 (호출자가 rollback)
        raise AppError("invalid_transition", "이미 취소 처리된 상품입니다.", status_code=422) from exc
    return item


# ---------------------------------------------------------------------------
# 주문 생성 (Story 4.4) — 스냅샷 + 조건부 차감 한 트랜잭션
# ---------------------------------------------------------------------------

from datetime import datetime, timedelta, timezone  # noqa: E402

CODE_OUT_OF_STOCK = "out_of_stock"
CODE_PRICE_CHANGED = "price_changed"
CODE_DUPLICATE_REQUEST = "duplicate_request"


async def get_int_setting(session: AsyncSession, key: str, minimum: int = 1) -> int:
    """정수 설정 조회 — 오염된 값(비숫자·하한 미만)은 raw 500 대신 봉투로 (운영 오타 방어)."""
    raw = await get_setting(session, key)
    try:
        value = int(raw)
    except ValueError:
        raise AppError("internal_error", "서버 설정 오류입니다.", status_code=500) from None
    if value < minimum:
        raise AppError("internal_error", "서버 설정 오류입니다.", status_code=500)
    return value


def _fail_detail(entry: dict) -> dict:
    item, product, variant = entry["item"], entry["product"], entry["variant"]
    return {
        "cart_item_id": str(item.id),
        "product_name": product.name if product is not None else "판매 종료된 상품",
        "option_text": products_service.variant_option_text(variant) if variant is not None else "",
    }


async def create_order(session: AsyncSession, user_id: uuid.UUID, data) -> dict:
    """주문 생성 — 주문 대상은 클라이언트가 명시한 cart_item_ids (부분 주문 서프라이즈 방지).

    한 트랜잭션: 재검증 → quote 재계산(AD-11) → 전 항목 조건부 차감(AD-4, 최종 진실) → 스냅샷 INSERT →
    장바구니 삭제(AD-10) → 창생 이벤트. 실패 시 전체 rollback — 부분 차감분도 원자성으로 원복.
    주문 창생은 전이가 아니라 초기 상태다 (epics의 "전이 함수 경유" 문언은 4.3 확정 설계로 대체된 승인된 편차).
    """
    entries = await carts_service.get_entries_for_order(session, user_id, data.cart_item_ids)
    if not entries:
        raise AppError(CODE_EMPTY_CART, "주문할 수 있는 상품이 없습니다.", status_code=422)

    # 술어 재검증 — 미리보기~주문 사이 불가로 바뀐 항목 전부 수집, 1건이라도 있으면 전체 실패 (FR-35)
    bad = [
        e for e in entries
        if e["variant"] is None or not products_service.check_purchasable(e["product"], e["variant"], e["item"].quantity)
    ]
    if bad:
        raise AppError(
            CODE_OUT_OF_STOCK, "품절되었거나 구매할 수 없는 상품이 있습니다.",
            status_code=422, details=[_fail_detail(e) for e in bad],
        )

    q = await quote(session, entries, data.postal_code)
    if q["grand_total"] != data.expected_grand_total:  # 미리보기 후 가격·배송비 변경 — 조용한 금액 변경 방지
        raise AppError(
            CODE_PRICE_CHANGED, "주문 금액이 변경되었습니다. 다시 확인해 주세요.",
            status_code=409, details=[{"grand_total": q["grand_total"]}],
        )

    # settings는 차감(행 잠금) 전에 읽는다 — 잠금 유지 구간 최소화
    days = await get_int_setting(session, SETTING_UNPAID_CANCEL_DAYS)
    deposit_account = await get_setting(session, SETTING_DEPOSIT_ACCOUNT)

    # 조건부 차감 — rowcount가 최종 진실. variant_id 정렬로 잠금 획득 순서 고정 (교차 주문 교착 방지)
    deduct_failed = []
    for e in sorted(entries, key=lambda e: str(e["variant"].id)):
        ok = await products_service.deduct_stock(session, e["variant"].id, e["item"].quantity)
        if not ok:
            deduct_failed.append(e)
    if deduct_failed:  # 예외 → 호출자 rollback — 이미 차감된 항목도 원복
        raise AppError(
            CODE_OUT_OF_STOCK, "재고가 부족한 상품이 있습니다.",
            status_code=422, details=[_fail_detail(e) for e in deduct_failed],
        )
    order = Order(
        user_id=user_id,
        recipient_name=data.recipient_name, recipient_phone=data.recipient_phone,
        postal_code=data.postal_code, address1=data.address1, address2=data.address2,
        order_note=data.order_note,
        deposit_due_at=datetime.now(timezone.utc) + timedelta(days=days),
    )
    session.add(order)
    await session.flush()

    by_seller: dict[uuid.UUID, list[dict]] = {}
    for e in entries:
        by_seller.setdefault(e["product"].seller_id, []).append(e)
    for group in q["seller_groups"]:  # quote와 같은 그룹 구조 — 배송비 스냅샷 (AD-11)
        sub = SubOrder(
            order_id=order.id, seller_id=group["seller_id"],
            shipping_fee=group["shipping_fee"], remote_extra_fee=group["remote_extra_fee"],
        )
        session.add(sub)
        await session.flush()
        for e in by_seller[group["seller_id"]]:
            session.add(OrderItem(
                sub_order_id=sub.id, variant_id=e["variant"].id,
                product_name=e["product"].name,
                option_text=products_service.variant_option_text(e["variant"]),
                unit_price=e["product"].base_price,  # 분리 스냅샷 — quote의 final_price는 합산값
                extra_price=e["variant"].extra_price,
                quantity=e["item"].quantity,
            ))

    deleted = await carts_service.delete_items(session, user_id, [e["item"].id for e in entries])  # AD-10
    if deleted != len(entries):  # 동시 이중 제출 — 먼저 커밋된 트랜잭션이 이미 삭제함
        raise AppError(CODE_DUPLICATE_REQUEST, "이미 처리된 주문 요청입니다.", status_code=409)
    session.add(OrderEvent(  # 창생 기록 — from NULL = 주문 생성 (entity_type으로 구분)
        order_id=order.id, entity_type=t.LAYER_ORDER, entity_id=order.id,
        from_status=None, to_status=t.ORDER_PENDING_PAYMENT,
        actor_role=t.ROLE_BUYER, actor_user_id=user_id,
    ))
    await session.commit()
    return {
        "order_id": order.id,
        "grand_total": q["grand_total"],
        "deposit_account": deposit_account,
        "deposit_due_at": order.deposit_due_at,
    }


# ---------------------------------------------------------------------------
# 미입금 자동취소 (Story 4.5) — 엔진 조합 + 대상 선별만, 로직 재구현 금지 (AD-3·AD-4)
# ---------------------------------------------------------------------------

import logging  # noqa: E402

logger = logging.getLogger("slur.orders")


async def auto_cancel_expired_orders(session: AsyncSession) -> int:
    """기한 경과 pending_payment 주문을 system 역할로 자동취소. 취소한 주문 수 반환.

    기한 판정은 4.4가 스냅샷한 deposit_due_at < DB now()만 쓴다 — unpaid_cancel_days 재조회 금지
    (재계산하면 설정 변경이 기존 주문 기한을 소급 변경). 주문 1건 = 트랜잭션 1건: 한 주문의 실패가
    배치 전체를 막지 않도록 개별 commit, 예외 시 반드시 rollback 후 다음 주문 (세션 오염 방지). 멱등.
    """
    target_ids = list(await session.scalars(
        select(Order.id)
        .where(Order.payment_status == t.ORDER_PENDING_PAYMENT, Order.deposit_due_at < func.now())
        .order_by(Order.created_at, Order.id)
    ))
    canceled = 0
    for order_id in target_ids:
        try:
            item_ids = list(await session.scalars(
                select(OrderItem.id)
                .join(SubOrder, OrderItem.sub_order_id == SubOrder.id)
                .where(SubOrder.order_id == order_id, OrderItem.status == t.ITEM_ORDERED)
            ))
            for item_id in item_ids:  # 재고 복원·cancellations는 엔진 경로가 소유
                await cancel_order_item(
                    session, order_item_id=item_id, actor_role=t.ROLE_SYSTEM, actor_user_id=None,
                    reason="미입금 자동취소", responsibility=t.ROLE_SYSTEM,
                )
            await transition(
                session, layer=t.LAYER_ORDER, entity_id=order_id, to_status=t.ORDER_CANCELED,
                actor_role=t.ROLE_SYSTEM, actor_user_id=None,
            )
            await session.commit()
            canceled += 1
        except Exception:  # 개별 격리 — 오염된 주문 하나가 배치를 막지 않는다 (다음 주기 재시도)
            logger.exception("auto-cancel 실패 order=%s", order_id)
            await session.rollback()
    return canceled
