import logging
import uuid

from sqlalchemy import func, select

from app.core.config import get_settings
from sqlalchemy.ext.asyncio import AsyncSession

from app.carts import service as carts_service
from app.core.errors import AppError
from app.orders.models import RemoteAreaZip, Setting
from app.products import service as products_service
from app.sellers import service as sellers_service

logger = logging.getLogger("slur.orders")

CODE_EMPTY_CART = "empty_cart"

# settings 시드 key (AD-13 — 수치는 DB에, 코드에는 key만)
SETTING_DEPOSIT_ACCOUNT = "deposit_account"  # 조립 표시용(하위호환) — 쓰기는 아래 3키로 한다
SETTING_DEPOSIT_BANK = "deposit_bank"
SETTING_DEPOSIT_ACCOUNT_NO = "deposit_account_no"
SETTING_DEPOSIT_HOLDER = "deposit_holder"
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


def _seller_shipping_fee(seller, remote_kind: str | None, item_total: int = 0) -> tuple[int, int]:
    """판매자 1명의 (기본 배송비, 도서산간 추가비) — 설정은 sellers 데이터가 정답 소스.

    조건부 무료배송: 이 판매자 상품 합계가 기준 이상이면 **기본 배송비만** 면제한다.
    도서산간 추가비는 면제하지 않는다 — 실제로 추가 운임이 나가는 비용이라 면제하면 판매자가 손해다.
    기준 0은 미사용을 뜻한다.
    """
    threshold = getattr(seller, "free_shipping_threshold", 0) or 0
    base = 0 if (threshold > 0 and item_total >= threshold) else seller.base_shipping_fee
    if remote_kind == "jeju":
        return base, seller.jeju_extra_fee
    if remote_kind == "island":
        return base, seller.island_extra_fee
    return base, 0


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
        base_fee, extra_fee = _seller_shipping_fee(seller, remote_kind, g["item_total"])
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

from app.auth.models import User, uuid7  # noqa: E402 — 집계용 User · 주문번호 생성용 uuid7
from app.orders import transitions as t  # noqa: E402
from app.orders.models import Cancellation, Order, OrderEvent, OrderItem, SubOrder  # noqa: E402

_LAYER_MODEL = {t.LAYER_ORDER: Order, t.LAYER_SUB_ORDER: SubOrder, t.LAYER_ORDER_ITEM: OrderItem}
_LAYER_STATUS_ATTR = {t.LAYER_ORDER: "payment_status", t.LAYER_SUB_ORDER: "shipping_status", t.LAYER_ORDER_ITEM: "status"}


async def _locked(session: AsyncSession, model, entity_id: uuid.UUID):
    """FOR UPDATE 행 잠금 재조회 — 동시 전이의 check-then-act 레이스 방어 (이 엔진에서만 쓰는 신규 패턴).

    populate_existing: 같은 세션이 잠금 전에 로드한 엔티티가 identity map에 있어도
    잠금 시점의 DB 값으로 속성을 강제 갱신 — stale 스냅샷 판정(4.6 리뷰 F1) 방지.
    """
    row = await session.scalar(
        select(model).where(model.id == entity_id).with_for_update().execution_options(populate_existing=True)
    )
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
            has_active = await session.scalar(
                select(exists().where(OrderItem.sub_order_id == entity.id, OrderItem.status == t.ITEM_ORDERED))
            )
            if not has_active:  # 전 라인 취소된 묶음 — 유령 발송 방지 (5.3 리뷰)
                raise AppError("invalid_transition", "전체 취소된 주문 묶음은 배송을 시작할 수 없습니다.", status_code=422)
            entity.carrier = carrier.strip()  # 공백 패딩이 구매자 화면·송장 조회로 새지 않게
            entity.tracking_number = tracking_number.strip()
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
    deposit_account = (await get_deposit_account(session))["display"]

    # 주문 행을 먼저 만든다 — 재고 원장이 "어느 주문 때문에 줄었는지"를 가리키려면 order_id가 필요하다.
    # 차감이 실패하면 전체 트랜잭션이 롤백되므로 주문만 남는 일은 없다.
    # id를 먼저 확정해 주문번호를 같은 값에서 뽑는다 — 번호와 주문이 1:1로 묶인다.
    order_id = uuid7()
    order = Order(
        id=order_id,
        order_no=_order_no(order_id),
        user_id=user_id,
        recipient_name=data.recipient_name, recipient_phone=data.recipient_phone,
        postal_code=data.postal_code, address1=data.address1, address2=data.address2,
        order_note=data.order_note,
        deposit_due_at=datetime.now(timezone.utc) + timedelta(days=days),
    )
    session.add(order)
    try:
        await session.flush()
    except IntegrityError as exc:  # order_no 충돌(끝 8자 동일)
        if "order_no" not in str(exc.orig):
            raise
        await session.rollback()
        raise AppError("service_unavailable", "주문번호 생성에 실패했습니다. 다시 시도해 주세요.", status_code=503) from exc

    # 조건부 차감 — rowcount가 최종 진실. variant_id 정렬로 잠금 획득 순서 고정 (교차 주문 교착 방지)
    deduct_failed = []
    for e in sorted(entries, key=lambda e: str(e["variant"].id)):
        ok = await products_service.deduct_stock(session, e["variant"].id, e["item"].quantity, order_id=order_id)
        if not ok:
            deduct_failed.append(e)
    if deduct_failed:  # 예외 → 호출자 rollback — 이미 차감된 항목도 원복
        raise AppError(
            CODE_OUT_OF_STOCK, "재고가 부족한 상품이 있습니다.",
            status_code=422, details=[_fail_detail(e) for e in deduct_failed],
        )

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
            if await _auto_cancel_order(session, order_id):
                await session.commit()
                canceled += 1
            else:  # 대상 확정 후 입금확인·기한 연장 경합 — 정상 스킵 (장애 아님)
                await session.rollback()
                logger.info("auto-cancel 스킵 order=%s (상태·기한 변경 경합)", order_id)
        except AppError as exc:  # 전이표·가드 거부 등 예상된 거부 — warning으로 격하
            logger.warning("auto-cancel 스킵 order=%s code=%s", order_id, exc.code)
            await session.rollback()
        except Exception:  # 개별 격리 — 오염된 주문 하나가 배치를 막지 않는다 (다음 주기 재시도)
            logger.exception("auto-cancel 실패 order=%s", order_id)
            await session.rollback()
    return canceled


async def _auto_cancel_order(session: AsyncSession, order_id: uuid.UUID) -> bool:
    """주문 1건 자동취소 시도 — 잠금 후 상태·기한 재검증, 라인도 잠금 후 재확정 (경합 레이스 봉인)."""
    order = await _locked(session, Order, order_id)
    db_now = await session.scalar(select(func.now()))
    if order.payment_status != t.ORDER_PENDING_PAYMENT or order.deposit_due_at >= db_now:
        return False  # 입금확인됨 또는 기한 연장(DB 직접 수정)됨
    rows = (await session.execute(  # 잠금 후 재확정 — 4.6·5.5 경로가 먼저 취소한 라인 제외
        select(OrderItem.id, OrderItem.variant_id)
        .join(SubOrder, OrderItem.sub_order_id == SubOrder.id)
        .where(SubOrder.order_id == order_id, OrderItem.status == t.ITEM_ORDERED)
    )).all()
    item_ids = [iid for iid, _vid in sorted(rows, key=lambda r: str(r[1]))]  # variant 순 — 복원 잠금 순서 고정
    for item_id in item_ids:  # 재고 복원·cancellations는 엔진 경로가 소유
        await cancel_order_item(
            session, order_item_id=item_id, actor_role=t.ROLE_SYSTEM, actor_user_id=None,
            reason="미입금 자동취소", responsibility=t.ROLE_SYSTEM,
        )
    await transition(
        session, layer=t.LAYER_ORDER, entity_id=order_id, to_status=t.ORDER_CANCELED,
        actor_role=t.ROLE_SYSTEM, actor_user_id=None,
    )
    return True


# ---------------------------------------------------------------------------
# 구매자 취소 (Story 4.6) — 묶음 단위, 엔진 조합만 (AD-6)
# ---------------------------------------------------------------------------


async def cancel_sub_order(session: AsyncSession, user_id: uuid.UUID, sub_order_id: uuid.UUID, reason: str | None) -> dict:
    """구매자의 판매자 묶음 취소 — 전 라인 취소 + (전 라인 canceled·pending_payment면) order 층 전이까지 한 트랜잭션.

    소유 검증(IDOR 방지)은 여기가 소유 — 엔진은 검사하지 않는다 (4.3 docstring 계약).
    타이밍 가드(preparing 진입 전)·재고 복원·cancellations는 엔진 소유.
    """
    reason = (reason or "").strip() or "구매자 취소"
    # 소유 검증은 컬럼만 비잠금 조회 — 엔티티를 미리 로드하면 잠금 후 판정이 stale해진다 (리뷰 F1)
    owner_row = (await session.execute(
        select(SubOrder.order_id, Order.user_id).join(Order, SubOrder.order_id == Order.id).where(SubOrder.id == sub_order_id)
    )).first()
    if owner_row is None or owner_row[1] != user_id:  # 미소유·미존재 구분 없이 404 (존재 노출 방지)
        raise AppError("not_found", "주문을 찾을 수 없습니다.", status_code=404)

    # 부모 우선 잠금을 먼저 걸고(order→sub) 그 아래에서 라인을 확정 — 스냅샷~잠금 사이 경합 제거 (F1·F5)
    order = await _locked(session, Order, owner_row[0])
    await _locked(session, SubOrder, sub_order_id)
    items = (await session.execute(
        select(OrderItem.id, OrderItem.variant_id)
        .where(OrderItem.sub_order_id == sub_order_id, OrderItem.status == t.ITEM_ORDERED)
    )).all()
    if not items:
        raise AppError("invalid_transition", "이미 취소된 주문 묶음입니다.", status_code=422)
    item_ids = [iid for iid, _vid in sorted(items, key=lambda r: str(r[1]))]  # variant 순 — 복원 잠금 순서 고정 (F2)
    for item_id in item_ids:  # 타이밍 가드·복원·기록은 엔진이 강제 (첫 라인에서 거부되면 전체 rollback)
        await cancel_order_item(
            session, order_item_id=item_id, actor_role=t.ROLE_BUYER, actor_user_id=user_id,
            reason=reason, responsibility=t.ROLE_BUYER,
        )

    # 잠금 이후의 order 행 기준으로 재확인 (_auto_cancel_order 패턴) — 전 라인 canceled + 미결제면 order도 취소
    order_canceled = False
    remaining = await session.scalar(
        select(exists().where(
            OrderItem.sub_order_id.in_(select(SubOrder.id).where(SubOrder.order_id == order.id)),
            OrderItem.status == t.ITEM_ORDERED,
        ))
    )
    if not remaining and order.payment_status == t.ORDER_PENDING_PAYMENT:
        await transition(
            session, layer=t.LAYER_ORDER, entity_id=order.id, to_status=t.ORDER_CANCELED,
            actor_role=t.ROLE_BUYER, actor_user_id=user_id,
        )
        order_canceled = True
    await session.commit()
    return {"canceled_items": len(item_ids), "order_canceled": order_canceled}


# ---------------------------------------------------------------------------
# 구매자 주문내역·상세 (Story 5.1) — 파생 값의 단일 소스 (AD-6·AD-12)
# ---------------------------------------------------------------------------

# 표시 전용 파생 상태 — transitions.py 상수·DB CHECK에 추가 금지, transition() 입력 사용 금지
DISPLAY_AWAITING_PAYMENT = "awaiting_payment"
DISPLAY_CANCELED = "canceled"


def derive_sub_status(order_payment: str, shipping_status: str | None, has_active_lines: bool) -> str:
    """묶음 표시 상태 — 5.1 파생 표가 단일 소스. 클라이언트 파생 금지 (AD-12)."""
    if not has_active_lines or order_payment == t.ORDER_CANCELED:
        return DISPLAY_CANCELED
    if order_payment == t.ORDER_PENDING_PAYMENT:
        return DISPLAY_AWAITING_PAYMENT
    if shipping_status is None:  # 구조상 불가 (4.3 paid 연쇄 보장) — canceled로 은폐하지 않는다
        logger.warning("paid 주문에 NULL 배송층 + 활성 라인 — 파생 표 위반 데이터")
        return t.SUB_PREPARING
    return shipping_status


def derive_order_status(order_payment: str, sub_statuses: list[str]) -> str:
    """주문 대표 상태 — 카드 1줄. active = canceled 아닌 묶음 표시 상태."""
    active = [s for s in sub_statuses if s != DISPLAY_CANCELED]
    if order_payment == t.ORDER_CANCELED or not active:
        return DISPLAY_CANCELED
    if order_payment == t.ORDER_PENDING_PAYMENT:
        return DISPLAY_AWAITING_PAYMENT
    done_states = {t.SUB_DELIVERED, t.SUB_CONFIRMED}  # confirmed(v1 미사용)도 완료 동급 — 역행 표시 방지
    known = {t.SUB_PREPARING, t.SUB_SHIPPING, *done_states, DISPLAY_AWAITING_PAYMENT}
    for st_ in active:
        if st_ not in known:
            logger.warning("derive_order_status: 미지 묶음 상태 %s — preparing으로 폴백", st_)
    if all(s in done_states for s in active):
        return t.SUB_DELIVERED
    if any(s == t.SUB_SHIPPING for s in active):
        return t.SUB_SHIPPING
    return t.SUB_PREPARING


def _order_no(order_id: uuid.UUID) -> str:
    """주문번호 후보 — UUID 끝 8자(대문자).

    **표시 형식을 바꾸지 않는다.** 이미 안내 메일·CS 응대·입금자 대조에서 쓰이는 값이라,
    컬럼화하면서 형식을 바꾸면 기존 주문의 번호가 달라져 대조가 끊긴다.
    고유성은 이제 형식이 아니라 `orders.order_no` UNIQUE 제약이 보장한다(충돌 시 재생성).
    """
    return str(order_id).replace("-", "")[-8:].upper()


async def _order_view_rows(session: AsyncSession, order_ids: list[uuid.UUID]) -> tuple[dict, dict, dict]:
    """주문들의 (sub_orders by order, items by sub, 브랜드명 by seller) 배치 조회 — N+1 회피."""
    subs = list(await session.scalars(
        select(SubOrder).where(SubOrder.order_id.in_(order_ids)).order_by(SubOrder.created_at, SubOrder.id)
    ))
    items = list(await session.scalars(
        select(OrderItem).where(OrderItem.sub_order_id.in_([s.id for s in subs])).order_by(OrderItem.created_at, OrderItem.id)
    ))
    sellers = await sellers_service.get_sellers_by_ids(session, list({s.seller_id for s in subs}))
    subs_by_order: dict = {}
    for s in subs:
        subs_by_order.setdefault(s.order_id, []).append(s)
    items_by_sub: dict = {}
    for i in items:
        items_by_sub.setdefault(i.sub_order_id, []).append(i)
    brand_by_seller = {sid: sel.brand_name for sid, sel in sellers.items()}
    return subs_by_order, items_by_sub, brand_by_seller


def _amounts(subs: list, items_by_sub: dict, *, only_active: bool = True) -> tuple[int, int, int]:
    """활성(ordered) 라인만 합산 — 부분 취소 후 과입금 방지 (5.1 금액 파생 규칙).

    전-취소 주문의 '표시' 금액은 only_active=False로 원 주문 금액을 쓴다 (0원 카드 방지) —
    입금 안내(deposit_info)는 항상 활성 기준이며 전-취소 주문은 pending이 아니라 안내 자체가 없다.
    """
    item_total = shipping_total = 0
    for sub in subs:
        lines = items_by_sub.get(sub.id, [])
        picked = [i for i in lines if i.status == t.ITEM_ORDERED] if only_active else lines
        if not picked:
            continue  # (활성 기준) 전-취소 묶음은 배송비도 제외
        item_total += sum((i.unit_price + i.extra_price) * i.quantity for i in picked)
        shipping_total += sub.shipping_fee + sub.remote_extra_fee
    return item_total, shipping_total, item_total + shipping_total


def _display_only_active(subs: list, items_by_sub: dict) -> bool:
    """표시용 합산이 활성 기준인지 — 전-취소 주문(활성 0)만 원 주문 기준으로 폴백한다.

    폴백 판정을 여기 한 곳에만 두어, 같은 금액을 쪼개 보여주는 쪽(_remote_total)이
    다른 기준으로 계산해 합이 어긋나는 일을 막는다.
    """
    _, _, grand = _amounts(subs, items_by_sub)
    return not (grand == 0 and any(items_by_sub.get(s.id) for s in subs))


def _display_amounts(subs: list, items_by_sub: dict) -> tuple[int, int, int]:
    """표시용 금액 — 활성 기준, 전-취소 주문(활성 0)은 원 주문 금액으로 폴백."""
    return _amounts(subs, items_by_sub, only_active=_display_only_active(subs, items_by_sub))


def _remote_total(subs: list, items_by_sub: dict, *, only_active: bool) -> int:
    """도서산간 추가비 합 — shipping_total에 포함된 몫을 같은 픽 규칙으로 떼어낸다."""
    total = 0
    for sub in subs:
        lines = items_by_sub.get(sub.id, [])
        picked = [i for i in lines if i.status == t.ITEM_ORDERED] if only_active else lines
        if picked:
            total += sub.remote_extra_fee
    return total


async def list_my_orders(session: AsyncSession, user_id: uuid.UUID, page: int) -> dict:
    size = get_settings().page_size
    total = await session.scalar(select(func.count()).select_from(Order).where(Order.user_id == user_id)) or 0
    orders = list(await session.scalars(
        select(Order).where(Order.user_id == user_id)
        .order_by(Order.created_at.desc(), Order.id.desc()).offset((page - 1) * size).limit(size)
    ))
    subs_by_order, items_by_sub, brand = await _order_view_rows(session, [o.id for o in orders])
    out = []
    for order in orders:
        subs = subs_by_order.get(order.id, [])
        sub_views = []
        all_lines, active_lines = [], []
        for sub in subs:
            lines = items_by_sub.get(sub.id, [])
            all_lines += lines
            active = [i for i in lines if i.status == t.ITEM_ORDERED]
            active_lines += active
            sub_views.append({
                "brand_name": brand.get(sub.seller_id, ""),
                "display_status": derive_sub_status(order.payment_status, sub.shipping_status, bool(active)),
            })
        _, _, grand = _display_amounts(subs, items_by_sub)
        # title·건수·금액은 같은 기준 — 활성 라인이 있으면 활성만, 전-취소 주문은 전체 라인 (원 주문 표시)
        basis = active_lines or all_lines
        title = basis[0].product_name if basis else "주문 상품"
        if len(basis) > 1:
            title = f"{title} 외 {len(basis) - 1}건"
        out.append({
            "order_id": order.id, "order_no": order.order_no, "created_at": order.created_at,
            "display_status": derive_order_status(order.payment_status, [v["display_status"] for v in sub_views]),
            "grand_total": grand, "title": title, "sub_orders": sub_views,
        })
    return {"items": out, "total": total, "page": page}


async def get_my_order(session: AsyncSession, user_id: uuid.UUID, order_id: uuid.UUID) -> dict:
    order = await session.scalar(select(Order).where(Order.id == order_id, Order.user_id == user_id))
    if order is None:  # 타인·미존재 구분 없이 404
        raise AppError("not_found", "주문을 찾을 수 없습니다.", status_code=404)
    return await _order_detail_view(session, order)


async def _order_detail_view(session: AsyncSession, order, *, admin: bool = False) -> dict:
    """주문 상세 뷰 조립 — 5.1 구매자·5.5 관리자 공용. admin이면 라인 id·취소 기록 포함."""
    subs_by_order, items_by_sub, brand = await _order_view_rows(session, [order.id])
    subs = subs_by_order.get(order.id, [])
    sub_views = []
    for sub in subs:
        lines = items_by_sub.get(sub.id, [])
        active = [i for i in lines if i.status == t.ITEM_ORDERED]
        sub_views.append({
            "sub_order_id": sub.id,
            "brand_name": brand.get(sub.seller_id, ""),
            "display_status": derive_sub_status(order.payment_status, sub.shipping_status, bool(active)),
            "carrier": sub.carrier, "tracking_number": sub.tracking_number,
            "shipping_fee": sub.shipping_fee, "remote_extra_fee": sub.remote_extra_fee,
            "cancellable": bool(active) and sub.shipping_status is None,  # 4.6 가드와 동치 — 서버 파생 (AD-12)
            "items": [{
                # 구매자 화면도 반품 신청에서 품목을 지목해야 해서 항상 내려준다(2026-07-31)
                "order_item_id": i.id,
                "product_name": i.product_name, "option_text": i.option_text,
                "unit_price": i.unit_price, "extra_price": i.extra_price, "quantity": i.quantity,
                "line_total": (i.unit_price + i.extra_price) * i.quantity, "status": i.status,
            } for i in lines],
        })
    item_total, shipping_total, grand = _display_amounts(subs, items_by_sub)
    deposit_info = None
    if order.payment_status == t.ORDER_PENDING_PAYMENT:
        _, _, active_grand = _amounts(subs, items_by_sub)  # 입금 안내는 항상 활성 기준 (과입금 방지)
        db_now = await session.scalar(select(func.now()))
        account = await get_deposit_account(session)
        deposit_info = {
            "grand_total": active_grand,
            "deposit_account": account["display"],
            "deposit_bank": account["bank"],
            "deposit_account_no": account["account_no"],
            "deposit_holder": account["holder"],
            "deposit_due_at": order.deposit_due_at,
            "expired": order.deposit_due_at < db_now,  # 자동취소 배치 전 창 — 만료 표시 (리뷰 반영)
        }
    return {
        "order_id": order.id, "order_no": order.order_no, "created_at": order.created_at,
        "display_status": derive_order_status(order.payment_status, [v["display_status"] for v in sub_views]),
        "recipient_name": order.recipient_name, "recipient_phone": order.recipient_phone,
        "postal_code": order.postal_code, "address1": order.address1, "address2": order.address2,
        "order_note": order.order_note,
        "sub_orders": sub_views,
        "item_total": item_total, "shipping_total": shipping_total, "grand_total": grand,
        # 배송비 안에 든 도서산간 몫 — 상세 화면이 "배송비 / 도서산간 추가"로 쪼개 보여준다.
        # 클라이언트가 재계산하면 활성·폴백 규칙과 어긋날 수 있어 서버가 같은 기준으로 내려준다.
        "remote_total": _remote_total(subs, items_by_sub, only_active=_display_only_active(subs, items_by_sub)),
        "deposit_info": deposit_info,
    }


# ---------------------------------------------------------------------------
# 관리자 입금 확인 (Story 5.2) — 목록 파생 + 엔진 호출만
# ---------------------------------------------------------------------------

async def list_pending_orders(session: AsyncSession, page: int) -> dict:
    """입금대기 목록 — 입금 대조용. 금액은 활성 기준(잔여 입금액), 전체 UUID·8자 병기 (order_no 충돌 대응)."""
    size = get_settings().page_size
    base = select(Order).where(Order.payment_status == t.ORDER_PENDING_PAYMENT)
    total = await session.scalar(select(func.count()).select_from(base.subquery())) or 0
    orders = list(await session.scalars(
        base.order_by(Order.created_at.desc(), Order.id.desc()).offset((page - 1) * size).limit(size)
    ))
    subs_by_order, items_by_sub, _brand = await _order_view_rows(session, [o.id for o in orders])
    db_now = await session.scalar(select(func.now()))
    out = []
    for order in orders:
        subs = subs_by_order.get(order.id, [])
        _, _, active_grand = _amounts(subs, items_by_sub)  # 입금 대조 금액 = 잔여 활성분
        lines = [i for s in subs for i in items_by_sub.get(s.id, [])]
        active = [i for i in lines if i.status == t.ITEM_ORDERED]
        basis = active or lines
        title = basis[0].product_name if basis else "주문 상품"
        if len(basis) > 1:
            title = f"{title} 외 {len(basis) - 1}건"
        out.append({
            "order_id": order.id, "order_no": order.order_no,
            "created_at": order.created_at, "deposit_due_at": order.deposit_due_at,
            "expired": order.deposit_due_at < db_now,
            "user_id": order.user_id,  # buyer 표시 정보는 admin 층이 붙인다 (AD-2: orders→auth 엣지 금지)
            "grand_total": active_grand, "title": title,
        })
    return {"items": out, "total": total, "page": page, "size": size}


async def confirm_payment(
    session: AsyncSession, admin_id: uuid.UUID, order_id: uuid.UUID, note: str, expected_grand_total: int
) -> None:
    """입금 확인 — 금액 대조 후 paid 전이. 연쇄 preparing·paid_at·이벤트는 엔진 소유 (AD-3).

    expected_grand_total: 관리자가 화면에서 본 금액 — 부분 취소 등으로 잔여 활성 금액이 달라졌으면
    409 price_changed로 재확인시킨다 (stale 금액으로 과입금 확정 방지, 4.4 패턴).
    """
    order = await session.scalar(select(Order).where(Order.id == order_id))
    if order is None:
        raise AppError("not_found", "주문을 찾을 수 없습니다.", status_code=404)
    subs_by_order, items_by_sub, _ = await _order_view_rows(session, [order.id])
    _, _, active_grand = _amounts(subs_by_order.get(order.id, []), items_by_sub)
    if active_grand != expected_grand_total:
        raise AppError(
            CODE_PRICE_CHANGED, "주문 금액이 변경되었습니다. 목록을 확인해 주세요.",
            status_code=409, details=[{"grand_total": active_grand}],
        )
    await transition(
        session, layer=t.LAYER_ORDER, entity_id=order_id, to_status=t.ORDER_PAID,
        actor_role=t.ROLE_ADMIN, actor_user_id=admin_id, note=note,
    )
    # 거래 원장에 결제 1건 기록 — 같은 트랜잭션이라 상태와 원장이 어긋나지 않는다.
    # 지금은 무통장이라 provider가 비어 있고, PG 연동 시 이 호출부에 승인번호만 채우면 된다.
    from app.payments import service as payments_service

    await payments_service.record_payment(
        session, order_id, amount=active_grand, method=payments_service.METHOD_BANK,
        # 관리자 확인 1건당 하나 — 같은 주문을 두 번 확인해도 원장이 두 줄로 늘지 않는다
        idempotency_key=f"bank:{order_id}",
    )
    await session.commit()


# ---------------------------------------------------------------------------
# 판매자 주문관리·배송 처리 (Story 5.3) — 소유 검증 + 엔진 호출
# ---------------------------------------------------------------------------


async def list_seller_sub_orders(session: AsyncSession, seller_id: uuid.UUID, status: str, page: int) -> dict:
    """판매자 자신의 sub_orders 목록 — 상태 필터(NULL 미결제는 자연 배제), 배송지·전 라인(취소 구분) 포함."""
    size = get_settings().page_size
    base = select(SubOrder).where(SubOrder.seller_id == seller_id, SubOrder.shipping_status == status)
    total = await session.scalar(select(func.count()).select_from(base.subquery())) or 0
    subs = list(await session.scalars(
        base.order_by(SubOrder.created_at.desc(), SubOrder.id.desc()).offset((page - 1) * size).limit(size)
    ))
    orders = {o.id: o for o in await session.scalars(select(Order).where(Order.id.in_({s.order_id for s in subs})))}
    items = list(await session.scalars(
        select(OrderItem).where(OrderItem.sub_order_id.in_([s.id for s in subs])).order_by(OrderItem.created_at, OrderItem.id)
    ))
    items_by_sub: dict = {}
    for i in items:
        items_by_sub.setdefault(i.sub_order_id, []).append(i)
    out = []
    for sub in subs:
        order = orders[sub.order_id]
        out.append({
            "sub_order_id": sub.id, "order_id": order.id, "order_no": order.order_no,
            "created_at": order.created_at,
            "recipient_name": order.recipient_name, "recipient_phone": order.recipient_phone,
            "postal_code": order.postal_code, "address1": order.address1, "address2": order.address2,
            "order_note": order.order_note,
            "items": [{
                "product_name": i.product_name, "option_text": i.option_text,
                "quantity": i.quantity, "status": i.status,  # canceled는 취소 구분 표시 (전 라인 포함)
            } for i in items_by_sub.get(sub.id, [])],
            "shipping_fee": sub.shipping_fee, "remote_extra_fee": sub.remote_extra_fee,
            "shipping_status": sub.shipping_status, "carrier": sub.carrier, "tracking_number": sub.tracking_number,
            "all_canceled": not any(i.status == t.ITEM_ORDERED for i in items_by_sub.get(sub.id, [])),  # UI 버튼 억제용
        })
    return {"items": out, "total": total, "page": page, "size": size}


async def _owned_sub_order(session: AsyncSession, seller_id: uuid.UUID, sub_order_id: uuid.UUID) -> SubOrder:
    sub = await session.scalar(select(SubOrder).where(SubOrder.id == sub_order_id))
    if sub is None:
        raise AppError("not_found", "주문 묶음을 찾을 수 없습니다.", status_code=404)
    if sub.seller_id != seller_id:  # epics 5.3 명시 — seller 간에는 403 (404 관례의 문언 예외)
        raise AppError("forbidden", "다른 판매자의 주문입니다.", status_code=403)
    return sub


async def ship_sub_order(
    session: AsyncSession, seller_id: uuid.UUID, user_id: uuid.UUID,
    sub_order_id: uuid.UUID, carrier: str, tracking_number: str,
) -> None:
    """배송 시작 — 송장 가드·기록·이벤트는 엔진 소유 (AD-3).

    송장은 shipments에도 남긴다(분할배송). sub_orders의 1쌍 컬럼은 **대표 송장**으로 유지한다 —
    화면·API가 이미 쓰고 있고, 여러 건일 때는 마지막 것이 대표가 된다.
    """
    from app.orders.shipment_models import Shipment

    await _owned_sub_order(session, seller_id, sub_order_id)
    await transition(
        session, layer=t.LAYER_SUB_ORDER, entity_id=sub_order_id, to_status=t.SUB_SHIPPING,
        actor_role=t.ROLE_SELLER, actor_user_id=user_id, carrier=carrier, tracking_number=tracking_number,
    )
    session.add(Shipment(sub_order_id=sub_order_id, carrier=carrier, tracking_number=tracking_number))
    await session.commit()


async def add_shipment(
    session: AsyncSession, seller_id: uuid.UUID, sub_order_id: uuid.UUID,
    carrier: str, tracking_number: str, note: str = "",
) -> dict:
    """송장 추가 — 이미 배송중인 묶음을 나눠 보낼 때(2박스 이상).

    상태 전이는 없다(이미 shipping). 대표 송장은 최신으로 갱신해 기존 화면이 최근 것을 보이게 한다.
    """
    sub = await _owned_sub_order(session, seller_id, sub_order_id)
    if sub.shipping_status != t.SUB_SHIPPING:
        raise AppError("invalid_transition", "배송중인 주문에만 송장을 추가할 수 있습니다.", status_code=422)
    from app.orders.shipment_models import Shipment

    row = Shipment(
        sub_order_id=sub_order_id, carrier=carrier.strip(),
        tracking_number=tracking_number.strip(), note=note.strip(),
    )
    session.add(row)
    sub.carrier, sub.tracking_number = row.carrier, row.tracking_number
    await session.commit()
    return {"id": row.id, "carrier": row.carrier, "tracking_number": row.tracking_number, "note": row.note}


async def list_shipments(session: AsyncSession, sub_order_id: uuid.UUID) -> list[dict]:
    """묶음의 송장 목록 — 1건이면 대표 송장과 같은 값이다."""
    from app.orders.shipment_models import Shipment

    rows = await session.scalars(
        select(Shipment).where(Shipment.sub_order_id == sub_order_id).order_by(Shipment.shipped_at)
    )
    return [{
        "id": r.id, "carrier": r.carrier, "tracking_number": r.tracking_number,
        "note": r.note, "shipped_at": r.shipped_at,
    } for r in rows]


async def deliver_sub_order(session: AsyncSession, seller_id: uuid.UUID, user_id: uuid.UUID, sub_order_id: uuid.UUID) -> None:
    """배송 완료 — shipping→delivered. 완료 시각을 남긴다(청약철회 기한 기준점)."""
    sub = await _owned_sub_order(session, seller_id, sub_order_id)
    await transition(
        session, layer=t.LAYER_SUB_ORDER, entity_id=sub_order_id, to_status=t.SUB_DELIVERED,
        actor_role=t.ROLE_SELLER, actor_user_id=user_id,
    )
    sub.delivered_at = await session.scalar(select(func.now()))  # DB 시각 — 앱 서버 시계 편차 배제
    await session.commit()


async def seller_shipping_counts(session: AsyncSession, seller_id: uuid.UUID) -> dict:
    """판매자 대시보드 카운트 — preparing(신규·배송 대기)·shipping (5.4, AD-12 서버 계산).

    전 라인 취소된 묶음은 제외 — 5.3 all_canceled(발송 버튼 억제)와 정합: 처리할 일이 아닌 유령 카운트 방지.
    """
    active_line = exists().where(OrderItem.sub_order_id == SubOrder.id, OrderItem.status == t.ITEM_ORDERED)
    rows = (await session.execute(
        select(SubOrder.shipping_status, func.count())
        .where(SubOrder.seller_id == seller_id, SubOrder.shipping_status.in_([t.SUB_PREPARING, t.SUB_SHIPPING]), active_line)
        .group_by(SubOrder.shipping_status)
    )).all()
    counts = dict(rows)
    return {"preparing_count": counts.get(t.SUB_PREPARING, 0), "shipping_count": counts.get(t.SUB_SHIPPING, 0)}


# ---------------------------------------------------------------------------
# 관리자 주문 개입 (Story 5.5) — 검색·상세·개입 전부 엔진 조합
# ---------------------------------------------------------------------------

_STATUS_KEYS = ("awaiting_payment", "preparing", "shipping", "delivered", "canceled")


def _has_ordered_sq(order_col):
    """주문 전체에 ordered 라인 존재 (5.5 매핑 표 has_ordered)."""
    return exists().where(
        SubOrder.order_id == order_col,
        OrderItem.sub_order_id == SubOrder.id,
        OrderItem.status == t.ITEM_ORDERED,
    )


def _active_sub_sq(order_col, *shipping_conds):
    """활성 라인이 있는 sub 중 조건 일치 존재 (5.5 매핑 표 active_sub)."""
    return exists().where(
        SubOrder.order_id == order_col,
        exists().where(OrderItem.sub_order_id == SubOrder.id, OrderItem.status == t.ITEM_ORDERED),
        *shipping_conds,
    )


async def search_orders(
    session: AsyncSession, *, q: str | None, status: str | None, page: int,
    user_ids: list[uuid.UUID] | None, seller_ids: list[uuid.UUID] | None,
    created_from: datetime | None = None,
) -> dict:
    """관리자 전체 주문 검색 — 파생 status는 SQL 동치 매핑 (5.1 파생 표 대조 테스트로 봉인).

    구매자(user_ids)·브랜드(seller_ids) 매칭은 admin 라우터가 auth·sellers service로 선해결 (AD-2 — 모델 직접 import 금지).
    """
    from sqlalchemy import String as SaString, cast, or_

    size = get_settings().page_size
    base = select(Order)
    if created_from is not None:  # 기간 필터 — 경계 계산(KST 자정)은 admin 라우터 소유
        base = base.where(Order.created_at >= created_from)
    if q:
        conds = []
        try:
            conds.append(Order.id == uuid.UUID(q))
        except ValueError:
            import re as _re

            # 주문번호는 이제 컬럼이다 — id를 캐스팅해 자르지 않는다(UNIQUE 인덱스를 그대로 탄다).
            # 접미사가 붙은 값(끝 8자 충돌 해소분)도 그대로 검색된다.
            conds.append(Order.order_no == q.upper())
        if user_ids:
            conds.append(Order.user_id.in_(user_ids))
        if seller_ids:
            conds.append(exists().where(SubOrder.order_id == Order.id, SubOrder.seller_id.in_(seller_ids)))
        if not conds:  # 어떤 축에도 매칭 없음 — 빈 or_()는 무필터가 되므로 명시적 공집합
            return {"items": [], "total": 0, "page": page, "size": get_settings().page_size}
        base = base.where(or_(*conds))
    if status:
        has_ordered = _has_ordered_sq(Order.id)
        if status == "canceled":
            base = base.where(or_(Order.payment_status == t.ORDER_CANCELED, ~has_ordered))
        elif status == "awaiting_payment":
            base = base.where(Order.payment_status == t.ORDER_PENDING_PAYMENT, has_ordered)
        elif status == "shipping":
            base = base.where(
                Order.payment_status == t.ORDER_PAID, has_ordered,
                _active_sub_sq(Order.id, SubOrder.shipping_status == t.SUB_SHIPPING),
            )
        elif status == "delivered":
            base = base.where(
                Order.payment_status == t.ORDER_PAID, has_ordered,
                ~_active_sub_sq(Order.id, or_(
                    SubOrder.shipping_status.is_(None),
                    SubOrder.shipping_status.notin_([t.SUB_DELIVERED, t.SUB_CONFIRMED]),
                )),
            )
        elif status == "preparing":
            not_done = or_(  # NULL 방어 — 3치 논리에서 NULL notin은 매칭 안 됨 (매핑 표 명시)
                SubOrder.shipping_status.is_(None),
                SubOrder.shipping_status.notin_([t.SUB_DELIVERED, t.SUB_CONFIRMED, t.SUB_SHIPPING]),
            )
            base = base.where(
                Order.payment_status == t.ORDER_PAID, has_ordered,
                ~_active_sub_sq(Order.id, SubOrder.shipping_status == t.SUB_SHIPPING),
                _active_sub_sq(Order.id, not_done),
            )
    total = await session.scalar(select(func.count()).select_from(base.subquery())) or 0
    orders = list(await session.scalars(
        base.order_by(Order.created_at.desc(), Order.id.desc()).offset((page - 1) * size).limit(size)
    ))
    subs_by_order, items_by_sub, brand = await _order_view_rows(session, [o.id for o in orders])
    out = []
    for order in orders:
        subs = subs_by_order.get(order.id, [])
        sub_views = [{
            "brand_name": brand.get(sub.seller_id, ""),
            "display_status": derive_sub_status(
                order.payment_status, sub.shipping_status,
                any(i.status == t.ITEM_ORDERED for i in items_by_sub.get(sub.id, [])),
            ),
        } for sub in subs]
        _, _, grand = _display_amounts(subs, items_by_sub)
        out.append({
            "order_id": order.id, "order_no": order.order_no, "created_at": order.created_at,
            "user_id": order.user_id,  # buyer enrich는 라우터 층
            "display_status": derive_order_status(order.payment_status, [v["display_status"] for v in sub_views]),
            "grand_total": grand, "sub_orders": sub_views,
        })
    return {"items": out, "total": total, "page": page, "size": size}


async def admin_get_order(session: AsyncSession, order_id: uuid.UUID) -> dict:
    """관리자 상세 — 소유 검증 없음 + 라인 id·취소 기록·이벤트 타임라인."""
    order = await session.scalar(select(Order).where(Order.id == order_id))
    if order is None:
        raise AppError("not_found", "주문을 찾을 수 없습니다.", status_code=404)
    view = await _order_detail_view(session, order, admin=True)
    view["user_id"] = order.user_id  # buyer enrich는 라우터 층

    item_ids = [i["order_item_id"] for sv in view["sub_orders"] for i in sv["items"]]
    cans = {c.order_item_id: c for c in await session.scalars(
        select(Cancellation).where(Cancellation.order_item_id.in_(item_ids))
    )}
    for sv in view["sub_orders"]:
        for i in sv["items"]:
            c = cans.get(i["order_item_id"])
            i["cancellation"] = None if c is None else {
                "cancellation_id": c.id, "reason": c.reason, "responsibility": c.responsibility,
                "canceled_at": c.canceled_at, "refunded_at": c.refunded_at,
            }
    view["events"] = [{
        "created_at": e.created_at, "entity_type": e.entity_type,
        "from_status": e.from_status, "to_status": e.to_status,
        "actor_role": e.actor_role, "note": e.note,
    } for e in await session.scalars(
        select(OrderEvent).where(OrderEvent.order_id == order_id).order_by(OrderEvent.created_at, OrderEvent.id)
    )]
    return view


async def _cancel_order_lines_then_order(
    session: AsyncSession, order_id: uuid.UUID, *, actor_role: str, actor_user_id: uuid.UUID | None,
    reason: str, responsibility: str, note: str,
) -> int:
    """전 ordered 라인 취소 + (pending이면) order 전이 — 4.5 패턴의 admin 변형. commit은 호출자."""
    order = await _locked(session, Order, order_id)
    if order.payment_status != t.ORDER_PENDING_PAYMENT:
        raise AppError("invalid_transition", "입금대기 주문만 전체 취소할 수 있습니다.", status_code=422)
    rows = (await session.execute(
        select(OrderItem.id, OrderItem.variant_id)
        .join(SubOrder, OrderItem.sub_order_id == SubOrder.id)
        .where(SubOrder.order_id == order_id, OrderItem.status == t.ITEM_ORDERED)
    )).all()
    if not rows:
        raise AppError("invalid_transition", "이미 취소된 주문입니다.", status_code=422)
    for item_id in [iid for iid, _v in sorted(rows, key=lambda r: str(r[1]))]:
        await cancel_order_item(
            session, order_item_id=item_id, actor_role=actor_role, actor_user_id=actor_user_id,
            reason=reason, responsibility=responsibility, note=note,
        )
    await transition(
        session, layer=t.LAYER_ORDER, entity_id=order_id, to_status=t.ORDER_CANCELED,
        actor_role=actor_role, actor_user_id=actor_user_id, note=note,
    )
    return len(rows)


async def admin_cancel_order(
    session: AsyncSession, admin_id: uuid.UUID, order_id: uuid.UUID, reason: str, responsibility: str, note: str,
) -> int:
    n = await _cancel_order_lines_then_order(
        session, order_id, actor_role=t.ROLE_ADMIN, actor_user_id=admin_id,
        reason=reason, responsibility=responsibility, note=note,
    )
    await session.commit()
    return n


async def admin_cancel_item(
    session: AsyncSession, admin_id: uuid.UUID, order_item_id: uuid.UUID,
    reason: str, responsibility: str, note: str,
) -> dict:
    """라인 취소 (admin — 배송 후에도 가능) + 4.6 후속 정합: 전-취소 pending 주문은 order도 canceled."""
    item = await cancel_order_item(
        session, order_item_id=order_item_id, actor_role=t.ROLE_ADMIN, actor_user_id=admin_id,
        reason=reason, responsibility=responsibility, note=note,
    )
    sub = await session.get(SubOrder, item.sub_order_id)
    order = await session.get(Order, sub.order_id)
    order_canceled = False
    remaining = await session.scalar(select(_has_ordered_sq(order.id)))
    if not remaining and order.payment_status == t.ORDER_PENDING_PAYMENT:  # 5.2 유령 방지
        await transition(
            session, layer=t.LAYER_ORDER, entity_id=order.id, to_status=t.ORDER_CANCELED,
            actor_role=t.ROLE_ADMIN, actor_user_id=admin_id, note=note,
        )
        order_canceled = True
    await session.commit()
    return {"order_canceled": order_canceled}


async def admin_transition_sub_order(
    session: AsyncSession, admin_id: uuid.UUID, sub_order_id: uuid.UUID, to_status: str,
    carrier: str | None, tracking_number: str | None, note: str,
) -> None:
    """관리자 강제 배송 전이 — 전이표 내에서만 (송장·전-취소 가드는 엔진, admin 예외 없음)."""
    await transition(
        session, layer=t.LAYER_SUB_ORDER, entity_id=sub_order_id, to_status=to_status,
        actor_role=t.ROLE_ADMIN, actor_user_id=admin_id, note=note,
        carrier=carrier, tracking_number=tracking_number,
    )
    await session.commit()


async def mark_refunded(session: AsyncSession, cancellation_id: uuid.UUID) -> None:
    """환불 완료 시각 기록 — 조건부 UPDATE (동시 중복 안전). AD-6 분리 기록의 이행."""
    from sqlalchemy import update as sa_update

    exists_row = await session.scalar(select(func.count()).select_from(Cancellation).where(Cancellation.id == cancellation_id))
    if not exists_row:
        raise AppError("not_found", "취소 기록을 찾을 수 없습니다.", status_code=404)
    result = await session.execute(
        sa_update(Cancellation)
        .where(Cancellation.id == cancellation_id, Cancellation.refunded_at.is_(None))
        .values(refunded_at=func.now())
    )
    if result.rowcount == 0:
        raise AppError("duplicate_request", "이미 환불 완료로 기록된 건입니다.", status_code=409)
    await session.commit()


# ---------------------------------------------------------------------------
# 관리자 설정 (Story 5.7) — 입금 계좌만 수정 가능 (승인 범위)
# ---------------------------------------------------------------------------


async def list_settings(session: AsyncSession) -> list[dict]:
    rows = await session.scalars(select(Setting).order_by(Setting.key))
    return [{"key": r.key, "value": r.value, "description": r.description, "updated_at": r.updated_at} for r in rows]


DEPOSIT_FIELDS = (
    (SETTING_DEPOSIT_BANK, "은행"),
    (SETTING_DEPOSIT_ACCOUNT_NO, "계좌번호"),
    (SETTING_DEPOSIT_HOLDER, "예금주"),
)


async def get_deposit_account(session: AsyncSession) -> dict:
    """입금 계좌 — 은행·계좌번호·예금주 3필드와 한 줄 표시 문자열.

    구매자 주문서·입금 안내가 "예금주" 줄을 따로 보여줄 수 있어야 해서 필드를 나눴다.
    `display`는 하위호환(기존 응답 필드 deposit_account)과 한 줄 표기 자리를 위해 서버가 조립한다 —
    화면마다 조립하면 표기가 갈린다.
    """
    rows = {s.key: s.value for s in await session.scalars(
        select(Setting).where(Setting.key.in_([k for k, _ in DEPOSIT_FIELDS]))
    )}
    bank = (rows.get(SETTING_DEPOSIT_BANK) or "").strip()
    number = (rows.get(SETTING_DEPOSIT_ACCOUNT_NO) or "").strip()
    holder = (rows.get(SETTING_DEPOSIT_HOLDER) or "").strip()
    if bank and number:
        display = f"{bank} {number}" + (f" ({holder})" if holder else "")
    else:
        # 3필드가 아직 안 채워진 환경 — 옛 단일 문자열을 그대로 쓴다(마이그레이션 전/미설정)
        display = await get_setting(session, SETTING_DEPOSIT_ACCOUNT)
    return {"bank": bank, "account_no": number, "holder": holder, "display": display}


async def update_deposit_account(session: AsyncSession, admin_id: uuid.UUID, value: str) -> None:
    """입금 계좌 갱신 — 이전 값을 감사 로그로 남긴다 (설정 이력 테이블은 과설계 — 5.7 결정)."""
    value = value.strip()
    if not value or len(value) > 200:
        raise AppError("validation_error", "계좌 정보는 1~200자입니다.", status_code=422)
    import re as _re

    if _re.search(r"[\x00-\x1f\x7f\u200b-\u200f\u202a-\u202e]", value):  # 제어·개행·bidi·zero-width 차단
        raise AppError("validation_error", "계좌 정보에 사용할 수 없는 문자가 있습니다.", status_code=422)
    # FOR UPDATE 직렬화 — 동시 갱신에도 감사 로그 체인(A→B→C)이 실제 전이와 일치
    setting = await session.scalar(
        select(Setting).where(Setting.key == SETTING_DEPOSIT_ACCOUNT).with_for_update()
    )
    if setting is None:  # 시드 누락 — 배포 오류
        raise AppError("internal_error", "서버 설정 오류입니다.", status_code=500)
    if setting.value == value:  # 무변경 — 감사 노이즈 방지
        await session.rollback()
        return
    logger.info("deposit_account 변경 by admin=%s: %r -> %r", admin_id, setting.value, value)
    setting.value = value
    # 옛 단일 문자열 경로로 바꾸면 3필드를 비운다 — 안 비우면 3필드가 우선되어(get_deposit_account)
    # 방금 저장한 값이 구매자 화면에 반영되지 않는다. 어느 시점이든 정본은 하나여야 한다.
    for row in await session.scalars(
        select(Setting).where(Setting.key.in_([k for k, _ in DEPOSIT_FIELDS])).with_for_update()
    ):
        row.value = ""
    await session.commit()


# ---------------------------------------------------------------------------
# 관리자 집계 (콘솔 통계 타일) — 여러 화면이 "집계 API 부재"로 막혀 있던 지점
# ---------------------------------------------------------------------------

def _line_amount_sq():
    """취소되지 않은 품목의 금액 합 — (단가 + 옵션 추가금) × 수량. AD-12: 총액 컬럼이 없어 매번 파생한다."""
    return func.coalesce(func.sum((OrderItem.unit_price + OrderItem.extra_price) * OrderItem.quantity), 0)


async def _revenue_between(session: AsyncSession, start) -> int:
    """확정 금액 합 = 살아있는 품목 금액 + 그 품목이 남아있는 묶음의 배송비.

    입금 확인된 주문만, 기준 시각은 paid_at이다 — 운영자가 "오늘 얼마 들어왔나"로 읽는 값.
    전 품목이 취소된 묶음의 배송비는 빼는 것이 판매자 주문 목록(all_canceled → 배송비 '-')과
    같은 규칙이다. 취소 주문이 매출로 잡히지 않게 한다.
    """
    where_order = [Order.payment_status == t.ORDER_PAID, Order.paid_at >= start]

    items = await session.scalar(
        select(_line_amount_sq())
        .select_from(OrderItem)
        .join(SubOrder, OrderItem.sub_order_id == SubOrder.id)
        .join(Order, SubOrder.order_id == Order.id)
        .where(OrderItem.status == t.ITEM_ORDERED, *where_order)
    )
    shipping = await session.scalar(
        select(func.coalesce(func.sum(SubOrder.shipping_fee + SubOrder.remote_extra_fee), 0))
        .select_from(SubOrder)
        .join(Order, SubOrder.order_id == Order.id)
        .where(
            exists().where(OrderItem.sub_order_id == SubOrder.id, OrderItem.status == t.ITEM_ORDERED),
            *where_order,
        )
    )
    return int(items or 0) + int(shipping or 0)


async def admin_stats(session: AsyncSession, start) -> dict:
    """관리자 대시보드 통계 — 기간 경계(KST 자정)는 호출자(admin 라우터)가 계산해 넘긴다.

    기간 기준이 지표마다 다르다는 점이 중요하다:
      - 신규 주문 = 주문 생성 시각(created_at)
      - 매출·결제 확인 = 입금 확인 시각(paid_at) — 운영자가 "오늘 얼마 들어왔나"로 읽는 값
    입금 대기는 기간과 무관한 현재 상태 스냅샷이다(지금 처리해야 할 일).
    """
    new_orders = await session.scalar(
        select(func.count()).select_from(Order).where(Order.created_at >= start)
    )
    paid_orders = await session.scalar(
        select(func.count()).select_from(Order)
        .where(Order.payment_status == t.ORDER_PAID, Order.paid_at >= start)
    )
    new_users = await session.scalar(
        select(func.count()).select_from(User).where(User.created_at >= start)
    )
    revenue = await _revenue_between(session, start)

    # 현재 입금 대기 — 건수와 합계 금액 (기간 무관)
    pending_count = await session.scalar(
        select(func.count()).select_from(Order).where(Order.payment_status == t.ORDER_PENDING_PAYMENT)
    )
    pending_items = await session.scalar(
        select(_line_amount_sq())
        .select_from(OrderItem)
        .join(SubOrder, OrderItem.sub_order_id == SubOrder.id)
        .join(Order, SubOrder.order_id == Order.id)
        .where(OrderItem.status == t.ITEM_ORDERED, Order.payment_status == t.ORDER_PENDING_PAYMENT)
    )
    pending_shipping = await session.scalar(
        select(func.coalesce(func.sum(SubOrder.shipping_fee + SubOrder.remote_extra_fee), 0))
        .select_from(SubOrder)
        .join(Order, SubOrder.order_id == Order.id)
        .where(
            exists().where(OrderItem.sub_order_id == SubOrder.id, OrderItem.status == t.ITEM_ORDERED),
            Order.payment_status == t.ORDER_PENDING_PAYMENT,
        )
    )
    return {
        "new_orders": int(new_orders or 0),
        "paid_orders": int(paid_orders or 0),
        "revenue": revenue,
        "new_users": int(new_users or 0),
        "pending_payment_count": int(pending_count or 0),
        "pending_payment_amount": int(pending_items or 0) + int(pending_shipping or 0),
    }


async def order_owner_id(session: AsyncSession, order_id: uuid.UUID) -> uuid.UUID | None:
    """주문 소유자 — 다른 도메인이 "이 주문이 이 사람 것인가"만 확인할 때 쓴다(AD-2 서비스 경유).

    타 도메인이 Order 모델을 직접 임포트하면 주문 상태 가드(test_no_status_writes_outside_engine)가
    그 파일의 무관한 `.status` 대입까지 위반으로 잡는다.
    """
    return await session.scalar(select(Order.user_id).where(Order.id == order_id))


async def update_deposit_fields(session: AsyncSession, admin_id: uuid.UUID, values: dict[str, str]) -> dict:
    """입금 계좌 3필드 갱신 — 은행·계좌번호·예금주.

    한 문자열이던 것을 나눈 이유는 구매자 안내가 "예금주"를 따로 보여줘야 하기 때문이다.
    감사 로그는 기존과 같이 이전값→새값을 남긴다(설정 이력 테이블은 과설계 — 5.7 결정).
    """
    import re as _re

    cleaned: dict[str, str] = {}
    for key, label in DEPOSIT_FIELDS:
        v = (values.get(key) or "").strip()
        if not v:
            raise AppError("validation_error", f"{label}을(를) 입력해 주세요.", status_code=422)
        if len(v) > 100:
            raise AppError("validation_error", f"{label}은(는) 100자 이내로 입력해 주세요.", status_code=422)
        if _re.search(r"[\x00-\x1f\x7f​-‏‪-‮]", v):  # 제어·개행·bidi·zero-width 차단
            raise AppError("validation_error", f"{label}에 사용할 수 없는 문자가 있습니다.", status_code=422)
        cleaned[key] = v

    rows = {s.key: s for s in await session.scalars(
        select(Setting).where(Setting.key.in_(list(cleaned))).with_for_update()
    )}
    changed = False
    for key, value in cleaned.items():
        row = rows.get(key)
        if row is None:  # 시드 누락 — 배포 오류지만 여기서 만들어 복구한다
            session.add(Setting(key=key, value=value, description="무통장입금 안내 계좌"))
            changed = True
            continue
        if row.value != value:
            logger.info("%s 변경 by admin=%s: %r -> %r", key, admin_id, row.value, value)
            row.value = value
            changed = True

    # 하위호환 단일 문자열도 같은 값으로 맞춘다 — 옛 경로가 읽어도 어긋나지 않게
    display = f"{cleaned[SETTING_DEPOSIT_BANK]} {cleaned[SETTING_DEPOSIT_ACCOUNT_NO]} ({cleaned[SETTING_DEPOSIT_HOLDER]})"
    legacy = await session.scalar(select(Setting).where(Setting.key == SETTING_DEPOSIT_ACCOUNT).with_for_update())
    if legacy is not None and legacy.value != display:
        legacy.value = display
        changed = True

    if not changed:
        await session.rollback()
    else:
        await session.commit()
    return await get_deposit_account(session)


async def sub_order_snapshot(session: AsyncSession, sub_order_id: uuid.UUID) -> dict | None:
    """다른 도메인이 쓰는 묶음 요약 — 소유자·배송 상태·배송 완료 시각 (AD-2 서비스 경유).

    타 도메인이 SubOrder/Order 모델을 직접 임포트하면 주문 상태 가드
    (test_no_status_writes_outside_engine)가 그 파일의 무관한 `.status` 대입까지 위반으로 잡는다.
    """
    row = (await session.execute(
        select(SubOrder.id, SubOrder.order_id, SubOrder.shipping_status, SubOrder.delivered_at, Order.user_id)
        .join(Order, SubOrder.order_id == Order.id)
        .where(SubOrder.id == sub_order_id)
    )).first()
    if row is None:
        return None
    return {
        "sub_order_id": row.id, "order_id": row.order_id, "user_id": row.user_id,
        "shipping_status": row.shipping_status, "delivered_at": row.delivered_at,
    }


async def active_items_of_sub(session: AsyncSession, sub_order_id: uuid.UUID) -> list[dict]:
    """묶음의 살아있는(취소되지 않은) 품목 — 반품 신청 대상 목록."""
    rows = await session.scalars(
        select(OrderItem)
        .where(OrderItem.sub_order_id == sub_order_id, OrderItem.status == t.ITEM_ORDERED)
        .order_by(OrderItem.created_at, OrderItem.id)
    )
    return [{
        "order_item_id": i.id, "product_name": i.product_name,
        "option_text": i.option_text, "quantity": i.quantity,
    } for i in rows]


async def order_items_by_ids(session: AsyncSession, item_ids: list[uuid.UUID]) -> dict:
    """품목 표시 정보 배치 조회 — 반품 내역이 상품명을 보여줄 때 쓴다."""
    if not item_ids:
        return {}
    rows = await session.scalars(select(OrderItem).where(OrderItem.id.in_(item_ids)))
    return {i.id: {"product_name": i.product_name, "option_text": i.option_text} for i in rows}


async def is_delivered(shipping_status: str | None) -> bool:
    """배송 완료 여부 — 상태 문자열을 타 도메인이 직접 비교하지 않게 한다."""
    return shipping_status == t.SUB_DELIVERED


async def has_open_orders(session: AsyncSession, user_id: uuid.UUID) -> bool:
    """탈퇴를 막아야 하는 진행 중 주문이 있는가 (회원 탈퇴 게이트).

    막는 것은 **아직 오갈 것이 남은** 주문뿐이다:
      - 입금 대기 — 돈이 들어올 수 있다
      - 활성 라인이 있는 묶음의 배송이 preparing·shipping — 물건이 가는 중이다

    배송완료·전체취소는 끝난 거래라 막지 않는다. 기록은 어차피 보존되고,
    끝난 주문까지 막으면 5년 동안 아무도 탈퇴할 수 없다.
    """
    return bool(await session.scalar(
        select(
            exists().where(
                Order.user_id == user_id,
                (Order.payment_status == t.ORDER_PENDING_PAYMENT)
                | (
                    (Order.payment_status == t.ORDER_PAID)
                    & _active_sub_sq(Order.id, SubOrder.shipping_status.in_([t.SUB_PREPARING, t.SUB_SHIPPING]))
                ),
            )
        )
    ))
