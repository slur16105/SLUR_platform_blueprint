from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "slur-api"
    environment: str = "local"  # local | production
    database_url: str  # postgresql+asyncpg://... — 환경변수 필수, 기본값 없음
    # CORS 허용 오리진 — 콤마 구분 환경변수 CORS_ORIGINS로 재정의 (web 도메인 추가용)
    cors_origins: list[str] = ["http://localhost:3000", "https://web-production-abfe1.up.railway.app"]
    # 인증 (JWT_SECRET은 환경변수 필수 — 기본값 없음, HS256 브루트포스 방지 최소 32자)
    jwt_secret: str = Field(min_length=32)
    access_token_minutes: int = 30
    refresh_token_days: int = 14
    # 카카오 OAuth — 미설정이어도 앱은 부팅되고, 카카오 로그인만 502 (전면 장애 방지)
    kakao_rest_api_key: str = ""
    kakao_client_secret: str = ""
    # 서버측 redirect_uri allowlist — 콘솔 등록 목록에만 의존하지 않는다 (코드 주입 방어)
    kakao_redirect_uris: list[str] = ["http://localhost:3000/auth/kakao/callback"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
