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


class Seller(Base):
    __tablename__ = "sellers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False  # 계정당 1프로필
    )
    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("seller_applications.id", ondelete="RESTRICT"), nullable=False  # 승인 근거 보존
    )
    # 살아있는 프로필 — 신청서에서 복사, 이후 수정 가능 (신청서는 불변 이력)
    brand_name: Mapped[str] = mapped_column(String(50), nullable=False)
    brand_intro: Mapped[str] = mapped_column(String(500), nullable=False)
    company_name: Mapped[str] = mapped_column(String(100), nullable=False)
    representative_name: Mapped[str] = mapped_column(String(50), nullable=False)
    business_registration_number: Mapped[str] = mapped_column(String(10), nullable=False)
    mail_order_number: Mapped[str] = mapped_column(String(50), nullable=False)
    business_address: Mapped[str] = mapped_column(String(255), nullable=False)
    contact_phone: Mapped[str] = mapped_column(String(20), nullable=False)
    # 배송비 (원 단위 정수, 0=무료) — 입력 UI는 Story 2.3
    base_shipping_fee: Mapped[int] = mapped_column(nullable=False, default=0, server_default="0")
    jeju_extra_fee: Mapped[int] = mapped_column(nullable=False, default=0, server_default="0")
    island_extra_fee: Mapped[int] = mapped_column(nullable=False, default=0, server_default="0")
    # 조건부 무료배송 — 이 판매자 상품 합계가 기준 이상이면 기본 배송비를 받지 않는다.
    # 0이면 미사용(항상 기본 배송비). 국내 커머스 사실상 표준이라 컬럼 하나로 연다.
    # 🚨 도서산간 추가비는 면제 대상이 아니다 — 실제 추가 운임이 발생하는 비용이다.
    free_shipping_threshold: Mapped[int] = mapped_column(nullable=False, default=0, server_default="0")
    # 정산 지급 계좌 — 중개 모델에서 대금을 받아 넘기려면 필수. 실제 지급은 PG·정산 도입 시점.
    payout_bank: Mapped[str] = mapped_column(String(50), nullable=False, default="", server_default="")
    payout_account_no: Mapped[str] = mapped_column(String(50), nullable=False, default="", server_default="")
    payout_holder: Mapped[str] = mapped_column(String(50), nullable=False, default="", server_default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
