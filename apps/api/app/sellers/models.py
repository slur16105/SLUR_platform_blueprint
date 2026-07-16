import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, Text, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.auth.models import uuid7
from app.core.db import Base


class SellerApplication(Base):
    __tablename__ = "seller_applications"
    __table_args__ = (
        CheckConstraint("status IN ('pending', 'approved', 'rejected')", name="ck_seller_applications_status"),
        # 심사 중 신청은 계정당 1건 — 동시 제출 레이스의 DB 수준 방어 (부분 유니크 인덱스)
        Index("uq_seller_applications_pending", "user_id", unique=True, postgresql_where=text("status = 'pending'")),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # 법정 필수 (전자상거래법 — 판매자 신원정보)
    company_name: Mapped[str] = mapped_column(String(100), nullable=False)
    representative_name: Mapped[str] = mapped_column(String(50), nullable=False)
    business_registration_number: Mapped[str] = mapped_column(String(10), nullable=False)  # 숫자 10자리
    mail_order_number: Mapped[str] = mapped_column(String(50), nullable=False)
    business_address: Mapped[str] = mapped_column(String(255), nullable=False)
    contact_phone: Mapped[str] = mapped_column(String(20), nullable=False)
    # 운영 필수
    brand_name: Mapped[str] = mapped_column(String(50), nullable=False)
    brand_intro: Mapped[str] = mapped_column(String(500), nullable=False)
    # 심사 — 반려 이력은 행으로 보존 (users 1:N), 재신청은 새 행
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    decided_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True  # 관리자 이력 보존
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
