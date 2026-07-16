import hashlib
import logging
import secrets
import unicodedata
import uuid
from datetime import datetime, timedelta, timezone

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.kakao import KakaoIdentity, fetch_identity, fetch_identity_from_token
from app.auth.models import AuthProvider, RefreshToken, User, UserRole
from app.core.config import get_settings
from app.core.errors import AppError
from app.core.security import CODE_UNAUTHORIZED, create_access_token

logger = logging.getLogger("slur.auth")

CODE_EMAIL_EXISTS = "email_already_exists"
CODE_INVALID_CREDENTIALS = "invalid_credentials"
CODE_INVALID_TOKEN = "invalid_token"

_hasher = PasswordHasher()  # 기본이 Argon2id
# 미존재 계정에도 동일한 해시 검증 비용을 지불해 타이밍 채널을 막는다
_DUMMY_HASH = _hasher.hash("timing-equalizer-dummy")

_VERIFY_ERRORS = (VerifyMismatchError, InvalidHashError, VerificationError)


def normalize_email(email: str) -> str:
    return unicodedata.normalize("NFC", email).strip().casefold()


def _hash_refresh(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


async def get_roles(session: AsyncSession, user_id: uuid.UUID) -> list[str]:
    rows = await session.scalars(select(UserRole.role).where(UserRole.user_id == user_id))
    return sorted(rows)


async def _issue_tokens(session: AsyncSession, user_id: uuid.UUID) -> tuple[str, str]:
    roles = await get_roles(session, user_id)  # 발급 시점의 역할을 claim에 (반영은 다음 토큰부터)
    raw = secrets.token_urlsafe(48)
    session.add(
        RefreshToken(
            user_id=user_id,
            token_hash=_hash_refresh(raw),
            expires_at=datetime.now(timezone.utc) + timedelta(days=get_settings().refresh_token_days),
        )
    )
    try:
        await session.commit()
    except IntegrityError as exc:  # token_hash 충돌 등 극히 드문 경우 — 원인을 왜곡하지 않는다
        await session.rollback()
        raise AppError("internal_error", "잠시 후 다시 시도해 주세요.", status_code=500) from exc
    return create_access_token(user_id, roles), raw


async def signup(session: AsyncSession, email: str, password: str, name: str, phone: str | None) -> tuple[str, str]:
    email = normalize_email(email)
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
    email = normalize_email(email)
    user = await session.scalar(select(User).where(User.email == email))
    # 이메일 부재와 비밀번호 불일치를 구분해 노출하지 않는다 (응답 시간 포함 — 더미 해시 검증)
    if user is None or user.password_hash is None:
        try:
            _hasher.verify(_DUMMY_HASH, password)
        except _VERIFY_ERRORS:
            pass
        logger.info("login failed (unknown account)")
        raise AppError(CODE_INVALID_CREDENTIALS, "이메일 또는 비밀번호가 올바르지 않습니다.", status_code=401)
    try:
        _hasher.verify(user.password_hash, password)
    except _VERIFY_ERRORS as exc:
        logger.info("login failed (bad credentials)")
        raise AppError(CODE_INVALID_CREDENTIALS, "이메일 또는 비밀번호가 올바르지 않습니다.", status_code=401) from exc
    if _hasher.check_needs_rehash(user.password_hash):
        user.password_hash = _hasher.hash(password)
        await session.commit()
    return await _issue_tokens(session, user.id)


async def _claim_token(session: AsyncSession, raw: str) -> RefreshToken | None:
    """활성 refresh 토큰을 원자적으로 폐기하며 가져온다.

    조건부 UPDATE라 같은 토큰의 동시 요청은 정확히 하나만 성공한다 (회전 레이스 방어).
    """
    now = datetime.now(timezone.utc)
    result = await session.execute(
        update(RefreshToken)
        .where(
            RefreshToken.token_hash == _hash_refresh(raw),
            RefreshToken.revoked_at.is_(None),
            RefreshToken.expires_at > now,
        )
        .values(revoked_at=now)
        .returning(RefreshToken)
    )
    return result.scalar_one_or_none()


async def refresh(session: AsyncSession, raw: str) -> tuple[str, str]:
    token = await _claim_token(session, raw)
    if token is None:
        logger.info("refresh rejected (invalid/revoked/expired token)")
        raise AppError(CODE_INVALID_TOKEN, "다시 로그인해 주세요.", status_code=401)
    return await _issue_tokens(session, token.user_id)


async def logout(session: AsyncSession, raw: str) -> None:
    # 멱등: 이미 폐기·만료·미존재여도 조용히 성공 (재시도·중복 클릭 안전, 토큰 유효성 비노출)
    await _claim_token(session, raw)
    await session.commit()


async def get_user(session: AsyncSession, user_id: uuid.UUID) -> User:
    user = await session.get(User, user_id)
    if user is None:
        raise AppError(CODE_UNAUTHORIZED, "로그인이 필요합니다.", status_code=401)
    return user


CODE_EMAIL_CONFLICT = "email_conflict"


async def kakao_login(session: AsyncSession, code: str, redirect_uri: str) -> tuple[str, str]:
    return await _kakao_login_with_identity(session, await fetch_identity(code, redirect_uri))


async def kakao_native_login(session: AsyncSession, kakao_access_token: str) -> tuple[str, str]:
    return await _kakao_login_with_identity(session, await fetch_identity_from_token(kakao_access_token))


async def _kakao_login_with_identity(session: AsyncSession, identity: KakaoIdentity) -> tuple[str, str]:
    link = await session.scalar(
        select(AuthProvider).where(
            AuthProvider.provider == "kakao", AuthProvider.provider_user_id == identity.provider_user_id
        )
    )
    if link is not None:  # 재로그인 — 기존 계정 (AC 2)
        return await _issue_tokens(session, link.user_id)

    email = normalize_email(identity.email) if identity.email else None
    if email is not None:
        existing = await session.scalar(select(User.id).where(User.email == email))
        if existing is not None:
            # 자동 링크 금지 (선점 계정 탈취 방어) — 이메일 로그인 안내
            raise AppError(CODE_EMAIL_CONFLICT, "이미 이메일로 가입된 계정입니다. 이메일 로그인을 이용해 주세요.", status_code=409)

    user = User(email=email, password_hash=None, name=identity.nickname or "카카오 사용자", phone=None)
    session.add(user)
    try:
        await session.flush()
        session.add(AuthProvider(user_id=user.id, provider="kakao", provider_user_id=identity.provider_user_id))
        await session.flush()
    except IntegrityError as exc:  # 동시 첫 로그인 레이스 — UNIQUE(provider, provider_user_id)가 최종 방어
        await session.rollback()
        retry = await session.scalar(
            select(AuthProvider).where(
                AuthProvider.provider == "kakao", AuthProvider.provider_user_id == identity.provider_user_id
            )
        )
        if retry is not None:
            return await _issue_tokens(session, retry.user_id)
        if email is None:  # 이메일 충돌일 수 없는 레이스 — 오도성 메시지 방지
            raise AppError("service_unavailable", "잠시 후 다시 시도해 주세요.", status_code=503) from exc
        raise AppError(CODE_EMAIL_CONFLICT, "이미 이메일로 가입된 계정입니다. 이메일 로그인을 이용해 주세요.", status_code=409) from exc
    return await _issue_tokens(session, user.id)
