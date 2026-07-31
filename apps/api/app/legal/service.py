"""약관 버전 동기화와 동의 기록.

동의는 **가입 트랜잭션 안에서** 남긴다 — 계정만 만들어지고 동의 기록이 빠지는 상태가 생기면
그 계정은 나중에 소급할 방법이 없다(동의 이력이 P0인 이유).
"""

import logging
import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.legal.models import Agreement, UserAgreement
from app.legal.policy import POLICIES, REQUIRED_TYPES

logger = logging.getLogger("slur.legal")


async def sync_versions(session: AsyncSession) -> list[Agreement]:
    """코드가 선언한 약관 버전을 DB에 반영한다 (없으면 생성 · 있으면 그대로).

    기존 행을 수정하지 않는다 — 이미 그 버전에 동의한 사람이 있으므로 내용이 바뀌면 안 된다.
    문구 개정은 '새 버전 행 추가'로만 이루어진다.
    """
    created = []
    for type_, spec in POLICIES.items():
        row = await session.scalar(
            select(Agreement).where(Agreement.type == type_, Agreement.version == spec["version"])
        )
        if row is not None:
            continue
        row = Agreement(
            type=type_,
            version=spec["version"],
            effective_at=datetime.fromisoformat(spec["effective_at"]),
            content_hash=spec["content_hash"],
        )
        session.add(row)
        created.append(row)
    if created:
        await session.commit()
        logger.info("약관 버전 등록: %s", [(a.type, a.version) for a in created])
    return created


async def current_agreements(session: AsyncSession) -> dict[str, Agreement]:
    """지금 시행 중인 버전 — 종류별로 effective_at이 현재 이하인 것 중 가장 최신."""
    now = datetime.now().astimezone()
    out: dict[str, Agreement] = {}
    for type_ in POLICIES:
        row = await session.scalar(
            select(Agreement)
            .where(Agreement.type == type_, Agreement.effective_at <= now)
            .order_by(Agreement.effective_at.desc(), Agreement.version.desc())
            .limit(1)
        )
        if row is not None:
            out[type_] = row
    return out


async def record_signup_consent(session: AsyncSession, user_id: uuid.UUID) -> list[UserAgreement]:
    """가입 시 필수 약관 동의를 기록한다. commit은 호출자(가입 트랜잭션)와 함께.

    시행 중인 버전이 없으면 기록할 수 없다 — 이는 배포 설정 오류이므로 조용히 넘기지 않는다.
    """
    current = await current_agreements(session)
    if any(t not in current for t in REQUIRED_TYPES):
        # 앱 시작 훅을 타지 않은 환경(테스트·마이그레이션 직후)에서도 가입이 막히지 않게 즉시 동기화한다
        await sync_versions(session)
        current = await current_agreements(session)
    missing = [t for t in REQUIRED_TYPES if t not in current]
    if missing:
        raise AppError("server_error", "약관 정보가 준비되지 않았습니다. 잠시 후 다시 시도해 주세요.", status_code=500)
    rows = []
    for type_ in REQUIRED_TYPES:
        row = UserAgreement(user_id=user_id, agreement_id=current[type_].id)
        session.add(row)
        rows.append(row)
    return rows


async def list_user_agreements(session: AsyncSession, user_id: uuid.UUID) -> list[dict]:
    """회원의 동의 이력 — 관리자 회원 상세·본인 확인용."""
    rows = (await session.execute(
        select(UserAgreement, Agreement)
        .join(Agreement, UserAgreement.agreement_id == Agreement.id)
        .where(UserAgreement.user_id == user_id)
        .order_by(UserAgreement.agreed_at.desc())
    )).all()
    return [{
        "type": a.type,
        "label": POLICIES.get(a.type, {}).get("label", a.type),
        "version": a.version,
        "agreed_at": ua.agreed_at,
        "effective_at": a.effective_at,
    } for ua, a in rows]
