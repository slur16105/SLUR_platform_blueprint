"""약관 버전과 동의 이력 (오픈 게이트 P0).

**문안 자체는 DB에 두지 않는다.** 이용약관·개인정보처리방침 본문은 코드가 소유하며
(`apps/web/app/legal/policy-docs.tsx`), DB에는 "어떤 버전이 언제부터 시행됐고 누가 언제
동의했는가"만 남긴다. 문안을 DB로 옮기면 법률 검토를 통과한 문구가 검토 없이 바뀔 수 있는
경로가 생긴다(FR-33이 오픈 게이트에서 법률 검토를 요구하는 문서다).

`content_hash`는 코드 문안의 해시다 — 문구를 고쳤는데 버전을 올리지 않은 상태를 잡는
검증용이며, 이 해시로 원문을 복원하지는 않는다.
"""

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.auth.models import uuid7
from app.core.db import Base

AGREEMENT_TYPES = ("terms", "privacy")


class Agreement(Base):
    """약관 버전 — (종류, 버전) 하나가 한 행. 시행일 순으로 이력이 쌓인다."""

    __tablename__ = "agreements"
    __table_args__ = (
        CheckConstraint("type IN ('terms', 'privacy')", name="ck_agreements_type"),
        UniqueConstraint("type", "version", name="uq_agreements_type_version"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    type: Mapped[str] = mapped_column(String(20), nullable=False)  # terms | privacy
    version: Mapped[str] = mapped_column(String(20), nullable=False)  # 코드 상수와 같은 값 (예: "1.0")
    effective_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False)  # SHA-256 hex — 무결성 확인용
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class UserAgreement(Base):
    """동의 이력 — 분쟁 시 입증 자료라 삭제·수정하지 않는다(append only).

    IP·User-Agent는 저장하지 않는다 — NFR-5 최소 수집 원칙. 필요 판단이 서면 법률 검토 결과와
    함께 컬럼을 추가한다(수집 항목 추가는 개인정보처리방침 개정 사안).
    """

    __tablename__ = "user_agreements"
    __table_args__ = (
        UniqueConstraint("user_id", "agreement_id", name="uq_user_agreements_user_agreement"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid7)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True  # 법정 보존
    )
    agreement_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("agreements.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    agreed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
