import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.products import service
from app.products.schemas import CategoryResponse, PublicProductDetail, PublicProductList

router = APIRouter(prefix="/products")


@router.get("/categories", response_model=list[CategoryResponse])
async def list_categories(session: AsyncSession = Depends(get_session)) -> list[CategoryResponse]:
    rows = await service.list_categories(session)
    return [CategoryResponse.model_validate(c, from_attributes=True) for c in rows]


@router.get("", response_model=PublicProductList)
async def list_products(
    category: uuid.UUID | None = Query(default=None),
    page: int = Query(1, ge=1),
    session: AsyncSession = Depends(get_session),
) -> PublicProductList:
    items, total = await service.list_public_products(session, category, page)
    return PublicProductList(items=items, total=total, page=page)


@router.get("/{product_id}", response_model=PublicProductDetail)
async def product_detail(product_id: uuid.UUID, session: AsyncSession = Depends(get_session)) -> PublicProductDetail:
    return PublicProductDetail(**(await service.get_public_product(session, product_id)))
