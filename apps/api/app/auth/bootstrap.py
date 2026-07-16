"""최초 관리자 부트스트랩 — 유일한 admin 생성 경로.

사용: uv run python -m app.auth.bootstrap <email>
프로덕션: railway run uv run python -m app.auth.bootstrap <email>
"""

import asyncio
import sys

from sqlalchemy import select

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
        await session.commit()
        print(f"관리자 부여 완료: {email} — 다음 로그인/refresh부터 반영")
        return 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("사용법: python -m app.auth.bootstrap <email>")
        sys.exit(2)
    sys.exit(asyncio.run(grant_admin(sys.argv[1])))
