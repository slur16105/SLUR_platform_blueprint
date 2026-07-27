import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import require_role
from app.home import service
from app.home.schemas import (
    AdminFeatureList,
    AdminFeatureResponse,
    FeatureCreate,
    FeatureUpdate,
    HomeResponse,
)

# 공개 홈 편성 조회 (인증 불요)
router = APIRouter(prefix="/home")


@router.get("", response_model=HomeResponse)
async def get_home(session: AsyncSession = Depends(get_session)) -> HomeResponse:
    return HomeResponse(**(await service.get_home(session)))


# 관리자 편성 CRUD (admin 역할 필수)
admin_router = APIRouter(prefix="/admin/home")


@admin_router.get("/features", response_model=AdminFeatureList)
async def list_features(
    _admin: uuid.UUID = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> AdminFeatureList:
    return AdminFeatureList(items=await service.list_features(session))


@admin_router.post("/features", response_model=AdminFeatureResponse, status_code=201)
async def create_feature(
    body: FeatureCreate,
    _admin: uuid.UUID = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> AdminFeatureResponse:
    return AdminFeatureResponse(**(await service.create_feature(session, body)))


@admin_router.get("/features/{feature_id}", response_model=AdminFeatureResponse)
async def get_feature(
    feature_id: uuid.UUID,
    _admin: uuid.UUID = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> AdminFeatureResponse:
    return AdminFeatureResponse(**(await service.get_feature(session, feature_id)))


@admin_router.patch("/features/{feature_id}", response_model=AdminFeatureResponse)
async def update_feature(
    feature_id: uuid.UUID,
    body: FeatureUpdate,
    _admin: uuid.UUID = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> AdminFeatureResponse:
    return AdminFeatureResponse(**(await service.update_feature(session, feature_id, body)))


@admin_router.delete("/features/{feature_id}", status_code=204)
async def delete_feature(
    feature_id: uuid.UUID,
    _admin: uuid.UUID = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> None:
    await service.delete_feature(session, feature_id)
