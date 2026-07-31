"""배송지 주소록 (오픈 게이트 P1).

지금까지 배송지는 `orders`의 스냅샷으로만 존재했다. 국내 커머스가 예외 없이 갖는 기능이 없어
**재주문마다 이름·전화·우편번호·주소를 전부 다시 입력**해야 했다(모바일 이탈률에 직결).

주소록은 **입력을 채워주는 편의 장치일 뿐**이다. 주문의 진실은 여전히 `orders`의 스냅샷이다 —
주소록을 고쳐도 이미 만들어진 주문의 배송지는 바뀌지 않아야 한다(AD-7 스냅샷 원칙).
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.auth.models import uuid7
from app.core.db import Base

MAX_PER_USER = 20  # 흔한 상한. 무제한이면 목록·선택 UI가 무너진다


class Address(Base):
    __tablename__ = "addresses"
    __table_args__ = (
        Index("ix_addresses_user_id", "user_id"),
        # 기본 배송지는 회원당 하나 — 부분 유니크 인덱스로 DB가 강제한다.
        # 앱에서 "기존 기본을 끄고 새로 켠다"만 하면 동시 요청에서 둘 다 기본이 될 수 있다.
        Index(
            "uq_addresses_default_per_user", "user_id",
            unique=True, postgresql_where=text("is_default"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False  # 회원이 지워지면 주소록도 간다
    )
    label: Mapped[str] = mapped_column(String(30), nullable=False, default="")  # "집", "회사" 등 사용자 메모
    recipient_name: Mapped[str] = mapped_column(String(50), nullable=False)
    recipient_phone: Mapped[str] = mapped_column(String(20), nullable=False)
    postal_code: Mapped[str] = mapped_column(String(5), nullable=False)
    address1: Mapped[str] = mapped_column(String(255), nullable=False)
    address2: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
