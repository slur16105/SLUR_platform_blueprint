import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, Text, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.auth.models import uuid7
from app.core.db import Base


def new_order_no() -> str:
    """주문번호 기본값 — UUID 끝 8자(대문자). 표시 형식은 컬럼화 전과 동일하다.

    서비스(create_order)는 주문 id에서 뽑은 값을 명시적으로 넣지만, 시더·테스트처럼 Order를
    직접 만드는 경로도 있어 모델 기본값을 둔다. 고유성은 UNIQUE 제약이 보장한다.
    """
    return str(uuid7()).replace("-", "")[-8:].upper()


class Order(Base):
    """결제 상태 층 (AD-3). 대표 상태·총액 컬럼 없음 — 라인·배송비 스냅샷에서 파생 (AD-12)."""

    __tablename__ = "orders"
    __table_args__ = (
        CheckConstraint("payment_status IN ('pending_payment', 'paid', 'canceled')", name="ck_orders_payment_status"),
        # 입금대기 partial index — 5.2 목록·4.5 배치 공용 (Slur 승인 2026-07-20)
        Index("ix_orders_pending", "deposit_due_at", postgresql_where=text("payment_status = 'pending_payment'")),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True  # 주문 이력은 법정 보존
    )
    # 사람이 읽는 주문번호 — CS 응대·입금자 대조·PG 가맹점 주문번호로 쓴다.
    # 이전에는 UUID 앞 8자를 런타임에 잘라 썼는데 UNIQUE 보장이 없었다(충돌 시 대조 불가).
    # PG는 가맹점 주문번호를 고유·불변·재사용 금지로 요구하므로 연동 전에 컬럼으로 못박는다.
    order_no: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, default=new_order_no)
    payment_status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending_payment")
    # 배송지 스냅샷 — 4.4가 채운다 (스키마만 선행)
    recipient_name: Mapped[str] = mapped_column(String(50), nullable=False)
    recipient_phone: Mapped[str] = mapped_column(String(20), nullable=False)
    postal_code: Mapped[str] = mapped_column(String(5), nullable=False)
    address1: Mapped[str] = mapped_column(String(255), nullable=False)
    address2: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    order_note: Mapped[str] = mapped_column(String(500), nullable=False, default="")  # 배송 요청사항
    deposit_due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)  # 생성 시각 + settings 기한
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class SubOrder(Base):
    """판매자별 배송 상태 층 (AD-3) + 배송비 스냅샷 (AD-11). 결제 전 shipping_status는 NULL (Slur 승인 2026-07-20)."""

    __tablename__ = "sub_orders"
    __table_args__ = (
        CheckConstraint(
            "shipping_status IS NULL OR shipping_status IN ('preparing', 'shipping', 'delivered')",
            name="ck_sub_orders_shipping_status",
        ),
        CheckConstraint("shipping_fee >= 0", name="ck_sub_orders_shipping_fee"),
        CheckConstraint("remote_extra_fee >= 0", name="ck_sub_orders_remote_extra_fee"),
        UniqueConstraint("order_id", "seller_id"),  # 주문 내 판매자 묶음 1개
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False  # 인덱스는 UNIQUE(order_id, seller_id) 선행 컬럼으로 충분
    )
    seller_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sellers.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    shipping_status: Mapped[str | None] = mapped_column(String(20), nullable=True)  # paid 전이 시 preparing 진입 (4.3)
    shipping_fee: Mapped[int] = mapped_column(nullable=False)  # 기본 배송비 스냅샷
    remote_extra_fee: Mapped[int] = mapped_column(nullable=False, default=0)  # 도서산간 추가비 스냅샷
    # 배송 완료 시각 — 청약철회 기한(배송 후 7일) 판정의 기준점.
    # order_events에도 전이 기록이 남지만, 반품 가능 여부는 목록·화면마다 물어야 해서 컬럼으로 둔다.
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    carrier: Mapped[str | None] = mapped_column(String(50), nullable=True)  # 5.3 배송 처리용 선행 확보
    tracking_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class OrderItem(Base):
    """주문 시점 스냅샷 (AD-7) + 라인 취소 상태 (AD-6). variant_id SET NULL — 조합 삭제 시 복원만 no-op."""

    __tablename__ = "order_items"
    __table_args__ = (
        CheckConstraint("status IN ('ordered', 'canceled')", name="ck_order_items_status"),
        CheckConstraint("unit_price >= 0", name="ck_order_items_unit_price"),
        CheckConstraint("quantity >= 1 AND quantity <= 999", name="ck_order_items_quantity"),  # carts 대칭
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    sub_order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sub_orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    variant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("variants.id", ondelete="SET NULL"), nullable=True  # 재고 복원·연결용
    )
    product_name: Mapped[str] = mapped_column(String(100), nullable=False)
    option_text: Mapped[str] = mapped_column(String(120), nullable=False, default="")  # carts 표시 포맷과 동일
    unit_price: Mapped[int] = mapped_column(nullable=False)  # base_price 스냅샷
    extra_price: Mapped[int] = mapped_column(nullable=False, default=0)  # 조합 추가금액 스냅샷 (음수 허용)
    quantity: Mapped[int] = mapped_column(nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="ordered")  # 취소 전이는 4.3
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class RemoteAreaZip(Base):
    """도서산간 판정 참조 테이블 — 우체국/택배사 공개 목록 시드. 없는 우편번호 = 일반 지역."""

    __tablename__ = "remote_area_zips"
    __table_args__ = (CheckConstraint("kind IN ('jeju', 'island')", name="ck_remote_area_zips_kind"),)

    zip_code: Mapped[str] = mapped_column(String(5), primary_key=True)  # 우편번호 자체가 자연키
    kind: Mapped[str] = mapped_column(String(10), nullable=False)  # sellers의 제주/도서 이원 추가비와 1:1
    region_name: Mapped[str] = mapped_column(String(100), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class Setting(Base):
    """key-value 설정 (AD-13) — v1 값 변경은 DB로, 관리자 화면은 v1 제외."""

    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(String(50), primary_key=True)
    value: Mapped[str] = mapped_column(Text, nullable=False)  # 타입 해석은 읽는 쪽 몫
    description: Mapped[str] = mapped_column(String(200), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class OrderEvent(Base):
    """전이 감사 로그 (AD-3: 세 층 모든 전이 성공 기록). Slur 승인 2026-07-20."""

    __tablename__ = "order_events"
    __table_args__ = (
        CheckConstraint("entity_type IN ('order', 'sub_order', 'order_item')", name="ck_order_events_entity_type"),
        CheckConstraint("actor_role IN ('buyer', 'seller', 'admin', 'system')", name="ck_order_events_actor_role"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True  # 주문 타임라인 조회
    )
    entity_type: Mapped[str] = mapped_column(String(20), nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)  # 3층 폴리모픽 — 층별 FK 분리는 과설계
    from_status: Mapped[str | None] = mapped_column(String(20), nullable=True)  # NULL = sub_order 배송 진입 또는 주문 창생 (entity_type으로 구분)
    to_status: Mapped[str] = mapped_column(String(20), nullable=False)
    actor_role: Mapped[str] = mapped_column(String(10), nullable=False)
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True  # system은 NULL, 탈퇴 이력 보존
    )
    note: Mapped[str] = mapped_column(String(500), nullable=False, default="")  # 관리자 메모 (FR-29)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Cancellation(Base):
    """취소 기록 (AD-6: 사유·귀책·취소 시각·환불 완료 시각 분리). 라인당 1회는 UNIQUE가 강제 — 재고 복원 중복의 DB 방어."""

    __tablename__ = "cancellations"
    __table_args__ = (
        CheckConstraint("responsibility IN ('buyer', 'seller', 'admin', 'system')", name="ck_cancellations_responsibility"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    order_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("order_items.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    reason: Mapped[str] = mapped_column(String(500), nullable=False)
    responsibility: Mapped[str] = mapped_column(String(10), nullable=False)  # 귀책
    canceled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    refunded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)  # 환불 완료는 5.5 기록
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
