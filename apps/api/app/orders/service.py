import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.carts import service as carts_service
from app.core.errors import AppError
from app.orders.models import RemoteAreaZip, Setting
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
            "option_text": _option_text(variant),
            "quantity": item.quantity,
            "final_price": product.base_price + variant.extra_price,
            "line_total": line_total,
        })
        g["item_total"] += line_total
    sellers = await sellers_service.get_sellers_by_ids(session, list(groups))
    seller_groups, item_total, shipping_total, remote_extra_total = [], 0, 0, 0
    for seller_id, g in groups.items():
        base_fee, extra_fee = _seller_shipping_fee(sellers[seller_id], remote_kind)
        seller_groups.append({
            "seller_id": seller_id, "brand_name": g["brand_name"], "items": g["items"],
            "item_total": g["item_total"], "shipping_fee": base_fee, "remote_extra_fee": extra_fee,
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


def _option_text(variant) -> str:
    # carts.get_cart의 표시 포맷과 동일 — 4.4 스냅샷 option_text도 이 포맷을 쓴다
    return " / ".join(
        f"{name}: {value}"
        for name, value in ((variant.option1_name, variant.option1_value), (variant.option2_name, variant.option2_value))
        if value
    )


async def preview_order(session: AsyncSession, user_id: uuid.UUID, postal_code: str) -> dict:
    """주문서 미리보기 — 구매 가능 항목만 (AD-10), 전 금액 백엔드 계산 (AD-12). 읽기 전용."""
    entries = await carts_service.get_purchasable_entries(session, user_id)
    if not entries:
        raise AppError(CODE_EMPTY_CART, "주문할 수 있는 상품이 없습니다.", status_code=422)
    return await quote(session, entries, postal_code)
