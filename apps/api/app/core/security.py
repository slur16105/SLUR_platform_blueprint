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
CODE_FORBIDDEN = "forbidden"

# auto_error=False 필수: 기본값은 403을 던져 에러 봉투 code가 어긋난다
_bearer = HTTPBearer(auto_error=False)


def create_access_token(user_id: uuid.UUID, roles: list[str] | None = None) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "iss": "slur-api",  # 토큰 용도 격리 — 같은 키로 서명된 타 용도 토큰 차단
        "sub": str(user_id),
        "roles": roles or [],  # 구매자는 빈 배열 (암묵 기본)
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_access_token(token: str) -> dict:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"], issuer="slur-api", options={"require": ["exp", "sub", "iss"]})
        uuid.UUID(payload["sub"])  # sub 형식 검증
        return payload
    except (jwt.PyJWTError, KeyError, ValueError) as exc:
        raise AppError(CODE_UNAUTHORIZED, "로그인이 필요합니다.", status_code=401) from exc


async def get_token_payload(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict:
    if credentials is None:
        raise AppError(CODE_UNAUTHORIZED, "로그인이 필요합니다.", status_code=401)
    return decode_access_token(credentials.credentials)


async def get_current_user_id(payload: dict = Depends(get_token_payload)) -> uuid.UUID:
    return uuid.UUID(payload["sub"])


def require_role(role: str):
    """역할 검사 의존성 팩토리 — claims만 판독 (core는 도메인을 모른다, AD-2).

    역할 검사는 이 팩토리로만 한다 (엔드포인트별 자체 검사 금지).
    """

    async def checker(payload: dict = Depends(get_token_payload)) -> uuid.UUID:
        roles = payload.get("roles")
        if not isinstance(roles, list) or role not in roles:
            raise AppError(CODE_FORBIDDEN, "권한이 없습니다.", status_code=403)
        return uuid.UUID(payload["sub"])

    return checker
