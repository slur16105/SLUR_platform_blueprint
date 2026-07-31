"""약관 조회·동의 이력 API.

문안은 웹이 소유하므로 여기서는 **버전과 시행일만** 준다. 화면은 "어떤 버전에 동의했는지"를
표시하고, 본문은 기존 약관 페이지(/terms·/privacy)가 그대로 렌더한다.
"""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import get_current_user_id
from app.legal import service
from app.legal.policy import POLICIES

router = APIRouter(prefix="/legal")


class AgreementItem(BaseModel):
    type: str
    label: str
    version: str
    effective_at: datetime


class UserAgreementItem(BaseModel):
    type: str
    label: str
    version: str
    agreed_at: datetime
    effective_at: datetime


@router.get("/agreements", response_model=list[AgreementItem])
async def current_agreements(session: AsyncSession = Depends(get_session)) -> list[AgreementItem]:
    """지금 시행 중인 약관 버전 — 가입 화면이 "무엇에 동의하는지"를 표기하는 데 쓴다."""
    rows = await service.current_agreements(session)
    if not rows:  # 앱 시작 훅을 타지 않은 환경(테스트 등) — 코드 선언 버전을 즉시 반영한다
        await service.sync_versions(session)
        rows = await service.current_agreements(session)
    return [
        AgreementItem(
            type=type_,
            label=POLICIES.get(type_, {}).get("label", type_),
            version=row.version,
            effective_at=row.effective_at,
        )
        for type_, row in rows.items()
    ]


@router.get("/agreements/me", response_model=list[UserAgreementItem])
async def my_agreements(
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
) -> list[UserAgreementItem]:
    """내 동의 이력 — 내 정보 화면에서 "언제 어떤 버전에 동의했는지" 확인용."""
    return [UserAgreementItem(**row) for row in await service.list_user_agreements(session, user_id)]
