from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "slur-api"
    environment: str = "local"  # local | production
    database_url: str  # postgresql+asyncpg://... — 환경변수 필수, 기본값 없음
    # CORS 허용 오리진 — 콤마 구분 환경변수 CORS_ORIGINS로 재정의 (web 도메인 추가용)
    cors_origins: list[str] = ["http://localhost:3000", "https://web-production-abfe1.up.railway.app"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
