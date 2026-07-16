import logging
import uuid

from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.sellers.models import Seller, SellerApplication
from app.sellers.schemas import ApplicationRequest

logger = logging.getLogger("slur.sellers")

CODE_ALREADY_PENDING = "application_already_pending"


async def submit_application(session: AsyncSession, user_id: uuid.UUID, data: ApplicationRequest) -> SellerApplication:
    pending = await session.scalar(
        select(SellerApplication.id).where(
            SellerApplication.user_id == user_id, SellerApplication.status == "pending"
        )
    )
    if pending is not None:
        raise AppError(CODE_ALREADY_PENDING, "이미 심사 중인 신청이 있습니다.", status_code=409)
    application = SellerApplication(user_id=user_id, **data.model_dump())
    session.add(application)
    try:
        await session.commit()
    except IntegrityError as exc:  # 동시 제출 레이스 — 부분 유니크 인덱스가 최종 방어
        await session.rollback()
        if "uq_seller_applications_pending" not in str(exc.orig):  # 다른 무결성 오류를 409로 위장하지 않는다
            raise
        logger.info("duplicate pending application race for user %s", user_id)
        raise AppError(CODE_ALREADY_PENDING, "이미 심사 중인 신청이 있습니다.", status_code=409) from exc
    return application


async def my_latest_application(session: AsyncSession, user_id: uuid.UUID) -> SellerApplication | None:
    return await session.scalar(
        select(SellerApplication)
        .where(SellerApplication.user_id == user_id)
        .order_by(SellerApplication.created_at.desc(), SellerApplication.id.desc())  # 동률 타이브레이커 (uuid7 시간순)
        .limit(1)
    )


CODE_NOT_PENDING = "application_not_pending"


async def list_applications(session: AsyncSession, status: str, page: int, size: int = 20):
    base = select(SellerApplication).where(SellerApplication.status == status)
    total = await session.scalar(select(func.count()).select_from(base.subquery()))
    rows = await session.scalars(
        base.order_by(SellerApplication.created_at.desc()).offset((page - 1) * size).limit(size)
    )
    return list(rows), total or 0


async def _claim_pending(session: AsyncSession, application_id: uuid.UUID, admin_id: uuid.UUID, new_status: str, reason: str | None):
    """pending → 처리 상태 전이를 조건부 UPDATE로 원자 수행 (이중 처리 레이스 방어)."""
    from datetime import datetime, timezone

    result = await session.execute(
        update(SellerApplication)
        .where(SellerApplication.id == application_id, SellerApplication.status == "pending")
        .values(status=new_status, rejection_reason=reason, decided_at=datetime.now(timezone.utc), decided_by=admin_id)
        .returning(SellerApplication)
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise AppError(CODE_NOT_PENDING, "이미 처리됐거나 존재하지 않는 신청입니다.", status_code=409)
    return row


async def approve_application(session: AsyncSession, application_id: uuid.UUID, admin_id: uuid.UUID) -> Seller:
    from app.auth.service import grant_role  # 순환 회피를 위한 지연 import (admin→sellers→auth 방향 유지)

    application = await _claim_pending(session, application_id, admin_id, "approved", None)
    seller = Seller(
        user_id=application.user_id,
        application_id=application.id,
        brand_name=application.brand_name,
        brand_intro=application.brand_intro,
        company_name=application.company_name,
        representative_name=application.representative_name,
        business_registration_number=application.business_registration_number,
        mail_order_number=application.mail_order_number,
        business_address=application.business_address,
        contact_phone=application.contact_phone,
    )
    session.add(seller)
    await grant_role(session, application.user_id, "seller")
    try:
        await session.commit()  # 승인·프로필·역할이 한 트랜잭션
    except IntegrityError as exc:  # sellers.user_id UNIQUE — 이미 판매자인 계정의 신청
        await session.rollback()
        raise AppError(CODE_NOT_PENDING, "이미 판매자인 계정입니다.", status_code=409) from exc
    logger.info("application %s approved by %s", application_id, admin_id)
    return seller


async def reject_application(session: AsyncSession, application_id: uuid.UUID, admin_id: uuid.UUID, reason: str):
    application = await _claim_pending(session, application_id, admin_id, "rejected", reason)
    await session.commit()
    logger.info("application %s rejected by %s", application_id, admin_id)
    return application


CODE_NOT_SELLER = "forbidden"


async def get_my_seller(session: AsyncSession, user_id: uuid.UUID) -> Seller:
    seller = await session.scalar(select(Seller).where(Seller.user_id == user_id))
    if seller is None:  # 역할은 있는데 프로필이 없는 비정상 상태 방어
        raise AppError(CODE_NOT_SELLER, "판매자 정보를 찾을 수 없습니다.", status_code=403)
    return seller


async def update_shipping_fees(session: AsyncSession, user_id: uuid.UUID, base: int, jeju: int, island: int) -> Seller:
    seller = await get_my_seller(session, user_id)
    seller.base_shipping_fee = base
    seller.jeju_extra_fee = jeju
    seller.island_extra_fee = island
    await session.commit()
    logger.info("shipping fees updated for seller %s", seller.id)
    return seller
