from fastapi import FastAPI
from sqlalchemy import text

from app.admin.router import router as admin_router
from app.auth.router import router as auth_router
from app.carts.router import router as carts_router
from app.core.config import get_settings
from app.core.db import engine
from app.core.errors import register_error_handlers
from app.orders.router import router as orders_router
from app.products.router import router as products_router
from app.sellers.router import router as sellers_router

app = FastAPI(title=get_settings().app_name)
register_error_handlers(app)

API_V1 = "/api/v1"


@app.get(f"{API_V1}/health")
async def health() -> dict[str, str]:
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))
    return {"status": "ok"}


# 리소스 경로 관례: /api/v1/{복수형-리소스}, 필드 snake_case, page 기반 페이지네이션
app.include_router(auth_router, prefix=API_V1)
app.include_router(sellers_router, prefix=API_V1)
app.include_router(products_router, prefix=API_V1)
app.include_router(carts_router, prefix=API_V1)
app.include_router(orders_router, prefix=API_V1)
app.include_router(admin_router, prefix=API_V1)
