"""재고 증감 원장 (오픈 게이트 P1).

`variants.stock` 스칼라만 있고 증감 이력이 없어 **"이 상품 재고가 왜 3인가"에 답할 수 없었다.**
`order_events`는 상태 전이만 기록한다 — AD-4의 조건부 UPDATE는 정확성은 보장하지만
감사 가능성은 보장하지 않는다.

기록은 **사실을 남기는 것이지 재고의 진실이 아니다.** 재고의 진실은 여전히 `variants.stock`이며,
원장은 사후 추적·실사 대조용이다(원장 합계로 재고를 계산하지 않는다 — 그렇게 하면 AD-4의
조건부 UPDATE 원자성을 잃는다).
"""

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.auth.models import uuid7
from app.core.db import Base

# order: 주문 차감 / cancel: 취소 복원 / return: 반품 복원 / adjust: 판매자·운영자 수동 조정
REASONS = ("order", "cancel", "return", "adjust")


class InventoryTransaction(Base):
    __tablename__ = "inventory_transactions"
    __table_args__ = (
        CheckConstraint("reason IN ('order', 'cancel', 'return', 'adjust')", name="ck_inventory_tx_reason"),
        CheckConstraint("delta <> 0", name="ck_inventory_tx_delta"),  # 0 변동은 기록할 이유가 없다
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    variant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("variants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    delta: Mapped[int] = mapped_column(nullable=False)  # 음수=차감, 양수=복원·입고
    stock_after: Mapped[int] = mapped_column(nullable=False)  # 기록 시점 재고 — 실사 대조의 기준
    reason: Mapped[str] = mapped_column(String(20), nullable=False)
    # 어떤 주문 때문인지 — 주문이 지워져도 이력은 남는다(감사 목적)
    order_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orders.id", ondelete="SET NULL"), nullable=True, index=True
    )
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    note: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
