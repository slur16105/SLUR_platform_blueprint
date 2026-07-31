"""1:1 문의와 운영자 답변 (오픈 게이트 P0).

통신판매중개자는 전자상거래법 제20조의2에 따라 소비자 불만·분쟁 처리 기준을 마련·이행할
의무가 있고, **중개자 면책 주장의 전제도 이 창구다** — 푸터의 전화번호·이메일만으로는
"처리 절차를 갖췄다"고 보기 어렵다.

상품 Q&A(구매자↔판매자)는 여기 포함하지 않는다. 다만 `category`에 product를 두어,
나중에 상품 문의를 분리할 때 데이터가 섞이지 않게 한다.
"""

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.auth.models import uuid7
from app.core.db import Base

CATEGORIES = ("order", "product", "account", "etc")
STATUSES = ("open", "answered", "closed")


class Inquiry(Base):
    """문의 한 건. 주문 연결은 선택 — 주문과 무관한 문의(계정·기타)도 받는다."""

    __tablename__ = "inquiries"
    __table_args__ = (
        CheckConstraint("category IN ('order', 'product', 'account', 'etc')", name="ck_inquiries_category"),
        CheckConstraint("status IN ('open', 'answered', 'closed')", name="ck_inquiries_status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True  # 분쟁 기록
    )
    # 주문이 지워져도 문의 본문은 남는다 — 처리 이력이 사라지면 안 된다
    order_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orders.id", ondelete="SET NULL"), nullable=True, index=True
    )
    category: Mapped[str] = mapped_column(String(20), nullable=False, default="etc")
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="open", index=True)
    answered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class InquiryReply(Base):
    """운영자 답변. 여러 번 답변할 수 있어 별도 테이블이다(문의에 컬럼으로 붙이지 않는다)."""

    __tablename__ = "inquiry_replies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    inquiry_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inquiries.id", ondelete="CASCADE"), nullable=False, index=True
    )
    admin_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False  # 누가 답했는지 남긴다
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
