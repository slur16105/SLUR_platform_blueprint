"""최초 관리자 부트스트랩 — 유일한 admin 생성 경로.

사용: uv run python -m app.auth.bootstrap <email>
프로덕션: railway run uv run python -m app.auth.bootstrap <email>
"""

import asyncio
import getpass
import logging
import socket
import sys

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("slur.auth.bootstrap")

from app.auth.models import User, UserRole
from app.auth.service import normalize_email
from app.core.db import async_session_factory


async def grant_admin(email: str) -> int:
    email = normalize_email(email)
    async with async_session_factory() as session:
        user = await session.scalar(select(User).where(User.email == email))
        if user is None:
            print(f"오류: 계정을 찾을 수 없습니다 — {email} (먼저 가입 필요)")
            return 1
        existing = await session.scalar(
            select(UserRole).where(UserRole.user_id == user.id, UserRole.role == "admin")
        )
        if existing is not None:
            print(f"이미 관리자입니다: {email} (no-op)")
            return 0
        session.add(UserRole(user_id=user.id, role="admin"))
        try:
            await session.commit()
        except IntegrityError:  # 동시 실행 레이스 — UNIQUE가 보호, 멱등 유지
            await session.rollback()
            print(f"이미 관리자입니다: {email} (동시 실행 감지, no-op)")
            return 0
        # 감사 추적: 누가·어디서·누구에게 (앱 로그에 남는다)
        logger.warning("ADMIN GRANTED to %s by %s@%s", email, getpass.getuser(), socket.gethostname())
        print(f"관리자 부여 완료: {email} — 다음 로그인/refresh부터 반영")
        return 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("사용법: python -m app.auth.bootstrap <email>")
        sys.exit(2)
    try:
        sys.exit(asyncio.run(grant_admin(sys.argv[1])))
    except Exception as exc:  # DB 연결 실패 등 — 명확한 에러로 종료
        print(f"오류: {type(exc).__name__}: {exc}")
        sys.exit(1)
