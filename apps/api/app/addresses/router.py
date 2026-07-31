"""배송지 주소록 API — 전부 본인 것만 다룬다(관리자 경로 없음: 배송지는 개인정보다)."""

import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.addresses import service
from app.core.db import get_session
from app.core.security import get_current_user_id

router = APIRouter(prefix="/addresses")


class AddressWrite(BaseModel):
    """검증 규칙은 주문 생성(OrderCreateRequest)과 같아야 한다 — 저장은 됐는데 주문이 거부되면 안 된다."""

    label: str = Field(default="", max_length=30)
    recipient_name: str = Field(min_length=1, max_length=50)
    recipient_phone: str = Field(pattern=r"^\d{9,11}$")
    postal_code: str = Field(pattern=r"^\d{5}$")
    address1: str = Field(min_length=1, max_length=255)
    address2: str = Field(default="", max_length=255)
    is_default: bool = False

    @field_validator("recipient_name", "address1")
    @classmethod
    def not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("필수 입력입니다.")
        return v


class AddressView(BaseModel):
    id: uuid.UUID
    label: str
    recipient_name: str
    recipient_phone: str
    postal_code: str
    address1: str
    address2: str
    is_default: bool


@router.get("", response_model=list[AddressView])
async def list_addresses(
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
) -> list[AddressView]:
    return [AddressView(**r) for r in await service.list_mine(session, user_id)]


@router.post("", response_model=AddressView, status_code=201)
async def create_address(
    body: AddressWrite,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
) -> AddressView:
    return AddressView(**await service.create(session, user_id, body.model_dump()))


@router.put("/{address_id}", response_model=AddressView)
async def update_address(
    address_id: uuid.UUID,
    body: AddressWrite,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
) -> AddressView:
    return AddressView(**await service.update_address(session, user_id, address_id, body.model_dump()))


@router.post("/{address_id}/default", response_model=AddressView)
async def set_default(
    address_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
) -> AddressView:
    return AddressView(**await service.set_default(session, user_id, address_id))


@router.delete("/{address_id}", status_code=204)
async def delete_address(
    address_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
) -> None:
    await service.delete(session, user_id, address_id)
