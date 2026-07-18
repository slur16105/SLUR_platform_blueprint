import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.carts import service
from app.carts.schemas import CartItemAdd, CartItemBrief, CartItemQuantity, CartResponse
from app.core.db import get_session
from app.core.security import get_current_user_id

router = APIRouter(prefix="/carts")


@router.post("/items", response_model=CartItemBrief, status_code=201)
async def add_item(
    body: CartItemAdd,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
):
    return await service.add_item(session, user_id, body.variant_id, body.quantity)


@router.get("", response_model=CartResponse)
async def get_cart(
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
):
    return await service.get_cart(session, user_id)


@router.patch("/items/{item_id}", response_model=CartItemBrief)
async def update_quantity(
    item_id: uuid.UUID,
    body: CartItemQuantity,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
):
    return await service.update_quantity(session, user_id, item_id, body.quantity)


@router.delete("/items/{item_id}", status_code=204)
async def delete_item(
    item_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
):
    await service.delete_item(session, user_id, item_id)
