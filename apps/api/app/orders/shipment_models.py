"""분할배송 (오픈 게이트 P1).

`sub_orders`에 `carrier`/`tracking_number`가 **1쌍**뿐이라, 한 판매자가 2박스로 나눠 보내면
송장을 덮어써야 했다(재고 일부만 먼저 보내는 흔한 운영). 표준은 shipments 1:N이다.

**기존 1쌍 컬럼은 남긴다.** 화면·API가 이미 쓰고 있고, 대표 송장(가장 최근)을 그대로 보여주는
쪽이 안전하다. shipments는 "여러 건일 때 전부 보여주는" 층이고, 단일 발송이면 두 값이 같다.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.auth.models import uuid7
from app.core.db import Base


class Shipment(Base):
    __tablename__ = "shipments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    sub_order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sub_orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    carrier: Mapped[str] = mapped_column(String(50), nullable=False)
    tracking_number: Mapped[str] = mapped_column(String(50), nullable=False)
    note: Mapped[str] = mapped_column(String(200), nullable=False, default="")  # "1/2박스" 등 판매자 메모
    shipped_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
