import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.errors import AppError
from app.core.security import get_current_user_id, require_role
from app.sellers import service
from app.sellers.schemas import ApplicationRequest, ApplicationResponse, SellerMeResponse, ShippingFees

router = APIRouter(prefix="/sellers")


@router.post("/applications", response_model=ApplicationResponse, status_code=201)
async def submit_application(
    body: ApplicationRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
) -> ApplicationResponse:
    app_row = await service.submit_application(session, user_id, body)
    return ApplicationResponse.model_validate(app_row, from_attributes=True)


@router.get("/applications/me", response_model=ApplicationResponse)
async def my_application(
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
) -> ApplicationResponse:
    app_row = await service.my_latest_application(session, user_id)
    if app_row is None:
        raise AppError("not_found", "신청 내역이 없습니다.", status_code=404)
    return ApplicationResponse.model_validate(app_row, from_attributes=True)


@router.get("/me", response_model=SellerMeResponse)
async def my_profile(
    user_id: uuid.UUID = Depends(require_role("seller")),
    session: AsyncSession = Depends(get_session),
) -> SellerMeResponse:
    seller = await service.get_my_seller(session, user_id)
    return SellerMeResponse.model_validate(seller, from_attributes=True)


@router.put("/me/shipping-fees", response_model=SellerMeResponse)
async def update_shipping_fees(
    body: ShippingFees,
    user_id: uuid.UUID = Depends(require_role("seller")),
    session: AsyncSession = Depends(get_session),
) -> SellerMeResponse:
    seller = await service.update_shipping_fees(
        session, user_id, body.base_shipping_fee, body.jeju_extra_fee, body.island_extra_fee
    )
    return SellerMeResponse.model_validate(seller, from_attributes=True)
