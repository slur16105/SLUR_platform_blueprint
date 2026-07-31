"""공지사항 (오픈 게이트 P0).

약관 변경은 **시행 7일 전**(소비자에게 불리한 변경은 30일 전) 고지 의무가 있는데 고지할
지면이 없었다. 이 테이블이 그 지면이다.

`published_at`이 NULL이면 임시저장 — 운영자가 미리 써 두고 시점을 골라 게시한다.
공개 조회는 `published_at <= now()`만 보여주므로 예약 게시도 같은 컬럼으로 처리된다.
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.auth.models import uuid7
from app.core.db import Base


class Notice(Base):
    __tablename__ = "notices"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    is_pinned: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)  # 상단 고정
    # NULL = 임시저장(비공개), 미래 시각 = 예약 게시. 공개 목록은 now() 이하만 노출한다.
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False  # 누가 고지했는지 남긴다
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
