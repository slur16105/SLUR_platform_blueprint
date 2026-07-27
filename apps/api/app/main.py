import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.admin.router import router as admin_router
from app.auth.router import router as auth_router
from app.carts.router import router as carts_router
from app.core.config import get_settings
from app.core.db import engine
from app.core.errors import AppError, CODE_SERVICE_UNAVAILABLE, register_error_handlers
from app.home.router import admin_router as home_admin_router
from app.home.router import router as home_router
from app.orders.router import router as orders_router
from app.products.router import router as products_router
from app.sellers.router import router as sellers_router

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # 스케줄러는 러닝 루프가 있는 여기서만 start (테스트 ASGITransport는 lifespan 미실행 → 자연 미기동)
    scheduler = None
    try:
        from app.core.scheduler import create_scheduler

        scheduler = create_scheduler()
        scheduler.start()
        logging.getLogger("slur.scheduler").info(
            "scheduler started (auto-cancel every %d min)", get_settings().auto_cancel_interval_minutes
        )
    except Exception:  # 배치 배선 실패가 핵심 API 가용성을 물고 가지 않게 — 앱은 기동한다
        logging.getLogger("slur.scheduler").exception("scheduler 기동 실패 — API는 계속 서비스")
    yield
    if scheduler is not None:
        scheduler.shutdown(wait=False)
    await engine.dispose()  # 커넥션 풀 정상 정리


app = FastAPI(title=get_settings().app_name, lifespan=lifespan)
register_error_handlers(app)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_V1 = "/api/v1"


@app.get(f"{API_V1}/health")
async def health() -> dict[str, str]:
    try:
        async with asyncio.timeout(5):
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
    except Exception as exc:  # DB 불능은 503으로 구분 (앱 자체는 살아있음을 의미)
        raise AppError(CODE_SERVICE_UNAVAILABLE, "데이터베이스에 연결할 수 없습니다.", status_code=503) from exc
    return {"status": "ok"}


# 리소스 경로 관례: /api/v1/{복수형-리소스}, 필드 snake_case, page 기반 페이지네이션
app.include_router(auth_router, prefix=API_V1)
app.include_router(sellers_router, prefix=API_V1)
app.include_router(products_router, prefix=API_V1)
app.include_router(carts_router, prefix=API_V1)
app.include_router(orders_router, prefix=API_V1)
app.include_router(admin_router, prefix=API_V1)
app.include_router(home_router, prefix=API_V1)
app.include_router(home_admin_router, prefix=API_V1)
