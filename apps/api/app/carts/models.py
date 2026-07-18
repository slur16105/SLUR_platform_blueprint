import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.auth.models import uuid7
from app.core.db import Base


class CartItem(Base):
    """장바구니 항목 — (user, variant) 단위, 재담기는 수량 합산 (FR-35).

    variant_id SET NULL: 조합이 삭제돼도 행이 살아남아 "판매 종료"로 표시된다 (FR-35, Slur 승인 2026-07-18).
    담기 시점에는 재고를 절대 만지지 않는다 (FR-11·AD-4).
    """

    __tablename__ = "cart_items"
    __table_args__ = (
        UniqueConstraint("user_id", "variant_id"),  # PG는 NULL 중복 허용 — SET NULL 후에도 안전
        CheckConstraint("quantity >= 1 AND quantity <= 999", name="ck_cart_items_quantity"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    variant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("variants.id", ondelete="SET NULL"), nullable=True
    )
    quantity: Mapped[int] = mapped_column(nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
