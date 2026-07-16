"""JWT 발급·검증과 인증 의존성.

core는 도메인을 모른다 (AD-2) — 여기서는 user_id(UUID)까지만 해석한다.
User 객체가 필요한 곳은 auth 도메인의 service를 쓴다.
"""

import uuid
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import get_settings
from app.core.errors import AppError

CODE_UNAUTHORIZED = "unauthorized"

# auto_error=False 필수: 기본값은 403을 던져 에러 봉투 code가 어긋난다
_bearer = HTTPBearer(auto_error=False)


def create_access_token(user_id: uuid.UUID) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {"sub": str(user_id), "iat": now, "exp": now + timedelta(minutes=settings.access_token_minutes)}
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_access_token(token: str) -> uuid.UUID:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"], options={"require": ["exp", "sub"]})
        return uuid.UUID(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError) as exc:
        raise AppError(CODE_UNAUTHORIZED, "로그인이 필요합니다.", status_code=401) from exc


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> uuid.UUID:
    if credentials is None:
        raise AppError(CODE_UNAUTHORIZED, "로그인이 필요합니다.", status_code=401)
    return decode_access_token(credentials.credentials)
