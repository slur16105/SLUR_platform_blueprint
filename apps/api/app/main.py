import asyncio
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.admin.router import router as admin_router
from app.auth.router import router as auth_router
from app.carts.router import router as carts_router
from app.core.config import get_settings
from app.core.db import engine
from app.core.errors import AppError, CODE_SERVICE_UNAVAILABLE, register_error_handlers
from app.orders.router import router as orders_router
from app.products.router import router as products_router
from app.sellers.router import router as sellers_router

logging.basicConfig(level=logging.INFO)

app = FastAPI(title=get_settings().app_name)
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
