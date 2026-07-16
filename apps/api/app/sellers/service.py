import logging
import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.sellers.models import SellerApplication
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
