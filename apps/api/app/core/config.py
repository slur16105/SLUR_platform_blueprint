from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "slur-api"
    auto_cancel_interval_minutes: int = Field(default=10, ge=1)  # 자동취소 주기(분) — 0·음수 env 오타는 기동 시 거부
    environment: str = "local"  # local | production
    database_url: str  # postgresql+asyncpg://... — 환경변수 필수, 기본값 없음
    # CORS 허용 오리진 — 콤마 구분 환경변수 CORS_ORIGINS로 재정의 (web 도메인 추가용)
    cors_origins: list[str] = ["http://localhost:3000", "https://web-production-abfe1.up.railway.app"]
    # 인증 (JWT_SECRET은 환경변수 필수 — 기본값 없음, HS256 브루트포스 방지 최소 32자)
    jwt_secret: str = Field(min_length=32)
    access_token_minutes: int = 30
    refresh_token_days: int = 14
    max_shipping_fee: int = 100_000  # 배송비 오입력 방어 상한 (원)
    # Supabase Storage (이미지 업로드 사전서명 — 미설정이면 이미지 기능만 502)
    supabase_url: str = ""
    supabase_service_key: str = ""
    max_extra_images: int = 10  # 대표 1장 + 추가 상한 (FR-13)
    max_variants: int = 100  # 조합 상한 (리서치: 소규모 50~100 충분)
    page_size: int = 20
    # 카카오 OAuth — 미설정이어도 앱은 부팅되고, 카카오 로그인만 502 (전면 장애 방지)
    kakao_rest_api_key: str = ""
    kakao_client_secret: str = ""
    kakao_app_id: int = 0  # 콘솔 앱 ID — 네이티브 토큰 app_id 검증용
    # 챗봇 (로컬 검증 전용) — **기본 꺼짐**. Ollama는 개발 머신에만 있어서
    # 배포 환경(Hub맥)에서 켜면 전부 503이 된다. 켜는 것은 로컬 .env에서만 한다.
    chat_enabled: bool = False
    chat_model: str = "qwen3:14b"
    chat_think: bool = False  # 추론 모델의 '생각하기'. 실측상 끄는 편이 더 정확하고 4배 빨랐다
    chat_top_k: int = 5
    chat_min_score: float = 0.60  # 이보다 안 닮았으면 근거 없음으로 본다
    chat_ollama_url: str = "http://localhost:11434"
    # 서버측 redirect_uri allowlist — 콘솔 등록 목록에만 의존하지 않는다 (코드 주입 방어)
    kakao_redirect_uris: list[str] = ["http://localhost:3000/auth/kakao/callback"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
