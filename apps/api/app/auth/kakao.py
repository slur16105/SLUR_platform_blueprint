"""카카오 OAuth 클라이언트 — 신원 확인 전용 (AD-5: 카카오 토큰은 즉시 폐기, 저장 금지)."""

import logging
from dataclasses import dataclass

import httpx

from app.core.config import get_settings
from app.core.errors import AppError

logger = logging.getLogger("slur.auth.kakao")

CODE_INVALID_KAKAO = "invalid_kakao_code"
CODE_KAKAO_UNAVAILABLE = "kakao_unavailable"
CODE_INVALID_KAKAO_TOKEN = "invalid_kakao_token"

_TOKEN_URL = "https://kauth.kakao.com/oauth/token"
_ME_URL = "https://kapi.kakao.com/v2/user/me"
_TOKEN_INFO_URL = "https://kapi.kakao.com/v1/user/access_token_info"
_TIMEOUT = 5.0  # 카카오 장애가 우리 API를 행 걸지 않게


@dataclass
class KakaoIdentity:
    provider_user_id: str
    nickname: str | None
    email: str | None  # verified + valid일 때만 채워짐


def _invalid() -> AppError:
    return AppError(CODE_INVALID_KAKAO, "카카오 로그인에 실패했습니다. 다시 시도해 주세요.", status_code=401)


def _unavailable() -> AppError:
    return AppError(CODE_KAKAO_UNAVAILABLE, "카카오 로그인이 일시적으로 불가합니다.", status_code=502)


async def fetch_identity(code: str, redirect_uri: str) -> KakaoIdentity:
    settings = get_settings()
    if not settings.kakao_rest_api_key or not settings.kakao_client_secret:
        logger.error("kakao keys not configured")
        raise _unavailable()
    if redirect_uri not in settings.kakao_redirect_uris:
        logger.info("kakao redirect_uri not in allowlist: %s", redirect_uri)
        raise _invalid()
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            token_res = await client.post(
                _TOKEN_URL,
                data={
                    "grant_type": "authorization_code",
                    "client_id": settings.kakao_rest_api_key,
                    "client_secret": settings.kakao_client_secret,
                    "redirect_uri": redirect_uri,
                    "code": code,
                },
            )
            if token_res.status_code >= 500 or token_res.status_code == 429:
                raise _unavailable()
            if token_res.status_code != 200:
                logger.info("kakao token exchange failed: %s", token_res.status_code)
                raise _invalid()
            try:
                access_token = token_res.json().get("access_token")
            except ValueError as exc:
                raise _unavailable() from exc
            if not access_token:
                raise _invalid()

            me_res = await client.get(_ME_URL, headers={"Authorization": f"Bearer {access_token}"})
            if me_res.status_code >= 500 or me_res.status_code == 429:
                raise _unavailable()
            if me_res.status_code != 200:
                raise _invalid()
    except httpx.HTTPError as exc:  # 타임아웃·네트워크
        logger.warning("kakao unreachable: %s", type(exc).__name__)
        raise _unavailable() from exc

    return _parse_me(me_res)


def _parse_me(me_res: httpx.Response) -> KakaoIdentity:
    try:
        body = me_res.json()
    except ValueError as exc:
        raise _unavailable() from exc
    kakao_id = body.get("id") if isinstance(body, dict) else None
    if not isinstance(kakao_id, int) or kakao_id <= 0:  # 0·음수·비정수 방어 (표기 차이로 인한 중복 계정 차단)
        raise _invalid()
    account = body.get("kakao_account")
    account = account if isinstance(account, dict) else {}
    email = account.get("email")
    # verified + valid일 때만 이메일을 신뢰한다 (+ DB 컬럼 한계 방어)
    if not (account.get("is_email_verified") and account.get("is_email_valid")):
        email = None
    if email is not None and (not isinstance(email, str) or len(email) > 255):
        email = None
    profile = account.get("profile")
    profile = profile if isinstance(profile, dict) else {}
    nickname = profile.get("nickname")
    if isinstance(nickname, str):
        nickname = nickname.strip()[:100] or None  # varchar(100)·공백-only 방어
    else:
        nickname = None
    return KakaoIdentity(provider_user_id=str(kakao_id), nickname=nickname, email=email)


async def fetch_identity_from_token(kakao_access_token: str) -> KakaoIdentity:
    """네이티브 SDK 경로 — 카카오 access token의 app_id 검증 후 신원 조회.

    app_id 검증은 타 앱에서 발급된 토큰 대입 공격을 막는 필수 단계.
    """
    settings = get_settings()
    if not settings.kakao_app_id:
        logger.error("kakao app id not configured")
        raise _unavailable()
    headers = {"Authorization": f"Bearer {kakao_access_token}"}
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            info_res = await client.get(_TOKEN_INFO_URL, headers=headers)
            if info_res.status_code >= 500 or info_res.status_code == 429:
                raise _unavailable()
            if info_res.status_code != 200:
                raise AppError(CODE_INVALID_KAKAO_TOKEN, "카카오 로그인에 실패했습니다. 다시 시도해 주세요.", status_code=401)
            try:
                info = info_res.json()
            except ValueError as exc:
                raise _unavailable() from exc
            if not isinstance(info, dict) or info.get("app_id") != settings.kakao_app_id:
                logger.info("kakao token app_id mismatch")
                raise AppError(CODE_INVALID_KAKAO_TOKEN, "카카오 로그인에 실패했습니다. 다시 시도해 주세요.", status_code=401)

            me_res = await client.get(_ME_URL, headers=headers)
            if me_res.status_code >= 500 or me_res.status_code == 429:
                raise _unavailable()
            if me_res.status_code != 200:
                raise AppError(CODE_INVALID_KAKAO_TOKEN, "카카오 로그인에 실패했습니다. 다시 시도해 주세요.", status_code=401)
    except httpx.HTTPError as exc:
        logger.warning("kakao unreachable: %s", type(exc).__name__)
        raise _unavailable() from exc
    return _parse_me(me_res)
