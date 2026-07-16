from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.products import service
from app.products.schemas import CategoryResponse

router = APIRouter(prefix="/products")


@router.get("/categories", response_model=list[CategoryResponse])
async def list_categories(session: AsyncSession = Depends(get_session)) -> list[CategoryResponse]:
    rows = await service.list_categories(session)
    return [CategoryResponse.model_validate(c, from_attributes=True) for c in rows]
