"""결제·환불 거래 레코드 (오픈 게이트 P0 — PG 연동 선결).

지금까지 결제 정보는 `orders.payment_status` + `paid_at` **두 컬럼뿐**이었다. 전이는 대비돼
있었지만 거래 레코드는 대비되지 않아, 결제 시도 N건(실패·재시도)·PG 승인번호(TID)·결제수단·
가상계좌 발급 정보·웹훅 멱등키를 담을 자리가 없었다. **환불 금액 컬럼도 아예 없었다** —
`cancellations.refunded_at`(시각)만 있어 "얼마를 환불했는지"에 답할 데이터가 없었다.

지금은 무통장입금뿐이라 실제로 쓰이는 건 `method='bank_transfer'` 한 갈래다. 그래도 지금
만들어 두는 이유는, PG를 붙일 때 **스키마 변경 없이 행만 늘어나게** 하기 위해서다.
PG 연동 시 추가되는 것은 provider·tid·raw 응답 저장이며 구조는 그대로다.

멱등키(`idempotency_key`)는 PG 웹훅이 같은 승인을 여러 번 보낼 때 중복 반영을 막는 자리다.
무통장 단계에서는 관리자 입금 확인 1건당 하나를 넣어 같은 구조를 미리 쓴다.
"""

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.auth.models import uuid7
from app.core.db import Base

METHODS = ("bank_transfer", "card", "virtual_account", "easy_pay")
# pending: 승인 대기(가상계좌 발급 등) / paid: 승인 완료 / failed: 승인 실패 / canceled: 승인 취소
PAYMENT_STATUSES = ("pending", "paid", "failed", "canceled")
REFUND_STATUSES = ("requested", "done", "failed")
REFUND_REASONS = ("order_cancel", "item_cancel", "return", "etc")


class Payment(Base):
    """결제 시도 1건. 주문 1 : 결제 N — 실패·재시도가 각각 행으로 남아야 대사가 가능하다."""

    __tablename__ = "payments"
    __table_args__ = (
        CheckConstraint(
            "method IN ('bank_transfer', 'card', 'virtual_account', 'easy_pay')", name="ck_payments_method"
        ),
        CheckConstraint(
            "status IN ('pending', 'paid', 'failed', 'canceled')", name="ck_payments_status"
        ),
        CheckConstraint("amount >= 0", name="ck_payments_amount"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orders.id", ondelete="RESTRICT"), nullable=False, index=True  # 거래 기록 보존
    )
    method: Mapped[str] = mapped_column(String(20), nullable=False, default="bank_transfer")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending", index=True)
    amount: Mapped[int] = mapped_column(nullable=False)
    # PG 연동 시 채워지는 자리 — 지금은 비어 있다(무통장). 구조를 미리 두어 나중에 마이그레이션이 없다.
    provider: Mapped[str] = mapped_column(String(30), nullable=False, default="")  # toss·kakaopay 등
    provider_tid: Mapped[str] = mapped_column(String(100), nullable=False, default="")  # PG 승인번호
    # 웹훅 중복 수신 방어 — 같은 키는 한 번만 반영된다. 무통장 단계에서도 같은 구조를 쓴다.
    idempotency_key: Mapped[str | None] = mapped_column(String(100), unique=True, nullable=True)
    raw_response: Mapped[str] = mapped_column(Text, nullable=False, default="")  # PG 원문(감사·분쟁 대비)
    failure_reason: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class Refund(Base):
    """환불 1건. 결제 1 : 환불 N — 부분 환불이 여러 번 일어날 수 있다.

    **금액이 여기 있다.** 이전에는 환불 금액을 저장할 곳이 없어 "부분 취소 시 배송비를 환불했는가"
    같은 질문에 답할 수 없었다.
    """

    __tablename__ = "refunds"
    __table_args__ = (
        CheckConstraint("status IN ('requested', 'done', 'failed')", name="ck_refunds_status"),
        CheckConstraint(
            "reason IN ('order_cancel', 'item_cancel', 'return', 'etc')", name="ck_refunds_reason"
        ),
        CheckConstraint("amount >= 0", name="ck_refunds_amount"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    payment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("payments.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    amount: Mapped[int] = mapped_column(nullable=False)
    reason: Mapped[str] = mapped_column(String(20), nullable=False, default="etc")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="requested", index=True)
    # 반품에서 시작된 환불이면 연결 — 어느 신청이 어떤 환불로 끝났는지 추적한다
    return_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("returns.id", ondelete="SET NULL"), nullable=True
    )
    provider_tid: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    idempotency_key: Mapped[str | None] = mapped_column(String(100), unique=True, nullable=True)
    note: Mapped[str] = mapped_column(Text, nullable=False, default="")
    refunded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
