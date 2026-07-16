import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import RefreshToken, User
from app.core.config import get_settings
from app.core.errors import AppError
from app.core.security import create_access_token

CODE_EMAIL_EXISTS = "email_already_exists"
CODE_INVALID_CREDENTIALS = "invalid_credentials"
CODE_INVALID_TOKEN = "invalid_token"

_hasher = PasswordHasher()  # 기본이 Argon2id


def _hash_refresh(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


async def _issue_tokens(session: AsyncSession, user_id: uuid.UUID) -> tuple[str, str]:
    raw = secrets.token_urlsafe(48)
    session.add(
        RefreshToken(
            user_id=user_id,
            token_hash=_hash_refresh(raw),
            expires_at=datetime.now(timezone.utc) + timedelta(days=get_settings().refresh_token_days),
        )
    )
    await session.commit()
    return create_access_token(user_id), raw


async def signup(session: AsyncSession, email: str, password: str, name: str, phone: str | None) -> tuple[str, str]:
    email = email.strip().lower()
    existing = await session.scalar(select(User.id).where(User.email == email))
    if existing:
        raise AppError(CODE_EMAIL_EXISTS, "이미 가입된 이메일입니다.", status_code=409)
    user = User(email=email, password_hash=_hasher.hash(password), name=name, phone=phone)
    session.add(user)
    try:
        await session.flush()
    except IntegrityError as exc:  # 동시 가입 레이스 — UNIQUE 제약이 최종 방어
        await session.rollback()
        raise AppError(CODE_EMAIL_EXISTS, "이미 가입된 이메일입니다.", status_code=409) from exc
    return await _issue_tokens(session, user.id)


async def login(session: AsyncSession, email: str, password: str) -> tuple[str, str]:
    email = email.strip().lower()
    user = await session.scalar(select(User).where(User.email == email))
    # 이메일 부재와 비밀번호 불일치를 구분해 노출하지 않는다
    if user is None or user.password_hash is None:
        raise AppError(CODE_INVALID_CREDENTIALS, "이메일 또는 비밀번호가 올바르지 않습니다.", status_code=401)
    try:
        _hasher.verify(user.password_hash, password)
    except VerifyMismatchError as exc:
        raise AppError(CODE_INVALID_CREDENTIALS, "이메일 또는 비밀번호가 올바르지 않습니다.", status_code=401) from exc
    return await _issue_tokens(session, user.id)


async def _get_active_token(session: AsyncSession, raw: str) -> RefreshToken:
    token = await session.scalar(select(RefreshToken).where(RefreshToken.token_hash == _hash_refresh(raw)))
    now = datetime.now(timezone.utc)
    if token is None or token.revoked_at is not None or token.expires_at <= now:
        raise AppError(CODE_INVALID_TOKEN, "다시 로그인해 주세요.", status_code=401)
    return token


async def refresh(session: AsyncSession, raw: str) -> tuple[str, str]:
    token = await _get_active_token(session, raw)
    token.revoked_at = datetime.now(timezone.utc)  # 회전: 이전 토큰 폐기
    return await _issue_tokens(session, token.user_id)


async def logout(session: AsyncSession, raw: str) -> None:
    token = await _get_active_token(session, raw)
    token.revoked_at = datetime.now(timezone.utc)
    await session.commit()


async def get_user(session: AsyncSession, user_id: uuid.UUID) -> User:
    user = await session.get(User, user_id)
    if user is None:
        raise AppError("unauthorized", "로그인이 필요합니다.", status_code=401)
    return user
