import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID

from app.auth.models import uuid7
from app.core.db import Base


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    name: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)  # 카테고리 이름 = 큐레이션
    sort_order: Mapped[int] = mapped_column(nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (
        CheckConstraint("status IN ('active', 'soldout', 'hidden')", name="ck_products_status"),
        CheckConstraint("base_price >= 0", name="ck_products_price"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    seller_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sellers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    category_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("categories.id", ondelete="RESTRICT"), nullable=False, index=True
        # RESTRICT: 소속 상품이 있는 카테고리 삭제 거부 (3.1 AC 2의 DB 강제)
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    base_price: Mapped[int] = mapped_column(nullable=False)  # 원 단위 정수 (AD-8)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")  # 등록 즉시 노출 (FR-8)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class ProductImage(Base):
    __tablename__ = "product_images"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True
    )
    path: Mapped[str] = mapped_column(String(300), nullable=False)  # Storage 경로 — URL은 표현 계층에서 조립
    sort_order: Mapped[int] = mapped_column(nullable=False, default=0)  # 0 = 대표 이미지


class Variant(Base):
    __tablename__ = "variants"
    __table_args__ = (
        UniqueConstraint("product_id", "option1_value", "option2_value"),  # 중복 조합 방지
        CheckConstraint("stock >= 0", name="ck_variants_stock"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # 옵션 없음 = 빈 문자열 (UNIQUE 동작 위해 NULL 금지)
    option1_name: Mapped[str] = mapped_column(String(20), nullable=False, default="")
    option1_value: Mapped[str] = mapped_column(String(30), nullable=False, default="")
    option2_name: Mapped[str] = mapped_column(String(20), nullable=False, default="")
    option2_value: Mapped[str] = mapped_column(String(30), nullable=False, default="")
    extra_price: Mapped[int] = mapped_column(nullable=False, default=0)  # 원 단위 정수, 음수 허용(할인 조합)
    stock: Mapped[int] = mapped_column(nullable=False, default=0)
    # 판매자 관리코드 — 택배사 연동·정산 대조·재고 실사의 공통 키. 빈 문자열은 미사용.
    # 판매자 안에서만 유일하면 되므로 전역 UNIQUE는 걸지 않는다(다른 판매자와 겹칠 수 있다).
    sku: Mapped[str] = mapped_column(String(50), nullable=False, default="", server_default="")
    is_active: Mapped[bool] = mapped_column(nullable=False, default=True)  # 수동 품절 토글
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
