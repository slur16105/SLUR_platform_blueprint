import uuid
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.auth.models import uuid7
from app.core.db import Base


class HomeFeature(Base):
    """홈 편성 지면 (시안 C · Epic 9, AD-9) — 히어로 활성 1건 + 슬롯 N건."""

    __tablename__ = "home_features"
    __table_args__ = (
        CheckConstraint("kind IN ('hero', 'slot')", name="ck_home_features_kind"),
        CheckConstraint("layout IN ('feature', 'strip')", name="ck_home_features_layout"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    kind: Mapped[str] = mapped_column(String(20), nullable=False)  # 'hero' | 'slot'
    issue_no: Mapped[str | None] = mapped_column(String(20), nullable=True)  # 편성 호수 (표지 표기)
    issue_label: Mapped[str | None] = mapped_column(String(20), nullable=True)  # 호수 라벨
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    lead_text: Mapped[str | None] = mapped_column(Text, nullable=True)  # 서문·리드
    image_path: Mapped[str | None] = mapped_column(String(300), nullable=True)  # Storage 경로 — URL은 표현 계층에서 조립
    layout: Mapped[str] = mapped_column(String(20), nullable=False)  # 'feature' | 'strip'
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)  # 노출 시작
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)  # 노출 종료
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class HomeFeatureItem(Base):
    """편성 품목 묶음 — 편성 지면 1건에 붙는 상품 목록 (순서 보존)."""

    __tablename__ = "home_feature_items"
    __table_args__ = (
        UniqueConstraint("feature_id", "product_id"),  # 같은 편성에 같은 상품 중복 금지
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    feature_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("home_features.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True
    )
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
