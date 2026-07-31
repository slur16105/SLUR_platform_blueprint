"""반품·교환 (오픈 게이트 P0 — 법정 의무).

`cancellations`는 **배송 전 취소 전용**이다(라인당 UNIQUE 1회 + 재고 복원과 한 트랜잭션).
전자상거래법 제17조 청약철회의 본체는 **배송 완료 후 7일**인데, 그 요청을 담을 자리가 없었다.

표준은 `returns` + `return_items` + 반송 귀책·반송비까지 4테이블이지만, 여기서는 **요청·승인·
환불 3상태의 최소형**으로 간다 — 중개 모델에서 반송비 정산은 PG·정산 설계와 함께 정해질 사안이고,
지금 4테이블을 만들면 쓰이지 않는 컬럼이 먼저 굳는다.

교환(exchange)을 같은 테이블로 받는다: 처리 흐름(요청→승인→완료)이 같고, 다른 점은
"환불하느냐 재발송하느냐"뿐이라 `kind`로 가른다.
"""

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.auth.models import uuid7
from app.core.db import Base

KINDS = ("return", "exchange")
# requested: 구매자 요청 / approved: 운영자 수락(회수 진행) / rejected: 거부
# completed: 환불(또는 재발송) 완료 — 종결 상태
STATUSES = ("requested", "approved", "rejected", "completed")
REASONS = ("change_of_mind", "defect", "wrong_delivery", "etc")


class ReturnRequest(Base):
    """반품·교환 요청 한 건. 판매자 묶음(sub_order) 단위로 받는다 — 회수는 판매자별로 일어난다."""

    __tablename__ = "returns"
    __table_args__ = (
        CheckConstraint("kind IN ('return', 'exchange')", name="ck_returns_kind"),
        CheckConstraint(
            "status IN ('requested', 'approved', 'rejected', 'completed')", name="ck_returns_status"
        ),
        CheckConstraint(
            "reason IN ('change_of_mind', 'defect', 'wrong_delivery', 'etc')", name="ck_returns_reason"
        ),
        CheckConstraint("refund_amount >= 0", name="ck_returns_refund_amount"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    sub_order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sub_orders.id", ondelete="RESTRICT"), nullable=False, index=True  # 분쟁 기록
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    kind: Mapped[str] = mapped_column(String(20), nullable=False, default="return")
    reason: Mapped[str] = mapped_column(String(30), nullable=False)
    # 귀책은 반송비 부담 주체를 가르는 값이다 — 단순 변심이면 구매자, 하자·오배송이면 판매자.
    # 금액 계산은 PG·정산 도입 시점에 붙는다(지금은 기록만).
    detail: Mapped[str] = mapped_column(Text, nullable=False, default="")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="requested", index=True)
    admin_note: Mapped[str] = mapped_column(Text, nullable=False, default="")  # 승인·거부 사유
    refund_amount: Mapped[int] = mapped_column(nullable=False, default=0)  # 완료 시 확정 환불액
    requested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)  # 승인·거부 시각
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class ReturnItem(Base):
    """반품 대상 품목·수량. 부분 반품(3개 중 1개)을 표현하려면 라인별 수량이 필요하다."""

    __tablename__ = "return_items"
    __table_args__ = (
        CheckConstraint("quantity >= 1", name="ck_return_items_quantity"),
        # 한 요청 안에서 같은 품목이 두 줄로 들어오지 않게 (수량은 한 줄에 합산)
        UniqueConstraint("return_id", "order_item_id", name="uq_return_items_return_order_item"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    return_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("returns.id", ondelete="CASCADE"), nullable=False, index=True
    )
    order_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("order_items.id", ondelete="RESTRICT"), nullable=False
    )
    quantity: Mapped[int] = mapped_column(nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
