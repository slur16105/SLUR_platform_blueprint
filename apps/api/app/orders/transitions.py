"""3층 주문 상태 전이표 — 데이터 선언 (AD-3, FR-18·19).

상태를 바꾸는 유일한 통로는 service.transition() 하나다. 이 모듈은 순수 데이터와
층 넘는 가드 함수만 갖는다 — DB 접근 없음.
"""

from types import MappingProxyType

from app.core.errors import AppError

# 층
LAYER_ORDER = "order"
LAYER_SUB_ORDER = "sub_order"
LAYER_ORDER_ITEM = "order_item"

# 역할
ROLE_BUYER = "buyer"
ROLE_SELLER = "seller"
ROLE_ADMIN = "admin"
ROLE_SYSTEM = "system"

# 상태 값 — orders 결제 층
ORDER_PENDING_PAYMENT = "pending_payment"
ORDER_PAID = "paid"
ORDER_CANCELED = "canceled"
# sub_orders 배송 층 (결제 전은 NULL)
SUB_PREPARING = "preparing"
SUB_SHIPPING = "shipping"
SUB_DELIVERED = "delivered"
SUB_CONFIRMED = "confirmed"  # 값만 정의, 전이표 미등록 — v1 미사용 (FR-20, PG·정산 도입 시 활성화)
# order_items 취소 층
ITEM_ORDERED = "ordered"
ITEM_CANCELED = "canceled"

# 전이표: (층, from, to) → 허용 역할. 여기 없는 조합은 어떤 코드 경로에서도 불가 (FR-19)
# MappingProxyType — 런타임 변조로 전이표가 확장되는 것을 차단 (읽기 전용 뷰)
TRANSITIONS: MappingProxyType = MappingProxyType({
    (LAYER_ORDER, ORDER_PENDING_PAYMENT, ORDER_PAID): frozenset({ROLE_ADMIN, ROLE_SYSTEM}),  # system은 PG 자동 승인 대비
    (LAYER_ORDER, ORDER_PENDING_PAYMENT, ORDER_CANCELED): frozenset({ROLE_BUYER, ROLE_ADMIN, ROLE_SYSTEM}),
    (LAYER_SUB_ORDER, None, SUB_PREPARING): frozenset({ROLE_ADMIN, ROLE_SYSTEM}),  # paid 연쇄 전용
    (LAYER_SUB_ORDER, SUB_PREPARING, SUB_SHIPPING): frozenset({ROLE_SELLER, ROLE_ADMIN}),  # 송장 필수 가드
    (LAYER_SUB_ORDER, SUB_SHIPPING, SUB_DELIVERED): frozenset({ROLE_SELLER, ROLE_ADMIN}),
    (LAYER_ORDER_ITEM, ITEM_ORDERED, ITEM_CANCELED): frozenset({ROLE_BUYER, ROLE_ADMIN, ROLE_SYSTEM}),
})


def guard_shipping_info(carrier: str | None, tracking_number: str | None) -> None:
    """shipping 진입 가드 — 송장은 구매자 표시 데이터(FR-21)라 admin에게도 예외 없음."""
    if not (carrier or "").strip() or not (tracking_number or "").strip():
        raise AppError("invalid_transition", "택배사와 송장번호를 입력해야 배송중 처리할 수 있습니다.", status_code=422)


def guard_item_cancel(actor_role: str, sub_order_shipping_status: str | None, order_payment_status: str) -> None:
    """라인 취소의 층 넘는 가드. admin은 타이밍 가드 예외 (FR-29 강제 개입)."""
    if actor_role == ROLE_BUYER and sub_order_shipping_status is not None:
        raise AppError(
            "invalid_transition", "배송준비가 시작된 주문은 직접 취소할 수 없습니다. 관리자에게 문의해 주세요.", status_code=422
        )
    if actor_role == ROLE_SYSTEM and order_payment_status != ORDER_PENDING_PAYMENT:
        raise AppError("invalid_transition", "입금대기 상태의 주문만 자동취소 대상입니다.", status_code=422)
