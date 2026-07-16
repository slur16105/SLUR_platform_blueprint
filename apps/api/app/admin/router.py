import uuid

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import require_role
from app.sellers import service as sellers_service
from app.sellers.schemas import ApplicationResponse

router = APIRouter(prefix="/admin")


class ApplicationAdminItem(ApplicationResponse):
    company_name: str
    representative_name: str
    business_registration_number: str
    mail_order_number: str
    business_address: str
    contact_phone: str
    brand_intro: str


class ApplicationListResponse(BaseModel):
    items: list[ApplicationAdminItem]
    total: int
    page: int


class RejectRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=500)

    @field_validator("reason")
    @classmethod
    def not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("반려 사유를 입력해 주세요.")
        return v


@router.get("/seller-applications", response_model=ApplicationListResponse)
async def list_applications(
    status: str = Query("pending", pattern="^(pending|approved|rejected)$"),
    page: int = Query(1, ge=1),
    _admin: uuid.UUID = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> ApplicationListResponse:
    rows, total = await sellers_service.list_applications(session, status, page)
    items = [ApplicationAdminItem.model_validate(r, from_attributes=True) for r in rows]
    return ApplicationListResponse(items=items, total=total, page=page)


@router.post("/seller-applications/{application_id}/approve", response_model=ApplicationAdminItem)
async def approve(
    application_id: uuid.UUID,
    admin_id: uuid.UUID = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> ApplicationAdminItem:
    await sellers_service.approve_application(session, application_id, admin_id)
    row = await session.get(sellers_service.SellerApplication, application_id)
    return ApplicationAdminItem.model_validate(row, from_attributes=True)


@router.post("/seller-applications/{application_id}/reject", response_model=ApplicationAdminItem)
async def reject(
    application_id: uuid.UUID,
    body: RejectRequest,
    admin_id: uuid.UUID = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> ApplicationAdminItem:
    row = await sellers_service.reject_application(session, application_id, admin_id, body.reason)
    return ApplicationAdminItem.model_validate(row, from_attributes=True)
