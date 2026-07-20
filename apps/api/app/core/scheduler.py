"""프로세스 내 주기 작업 (APScheduler) — 단일 인스턴스 전제 (스파인 확정, 확장 시 재설계 항목).

start는 반드시 lifespan 내부(러닝 이벤트 루프 존재)에서 — 모듈 레벨 start 금지 (Py3.12+ 루프 규칙).
"""

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.core.config import get_settings

logger = logging.getLogger("slur.scheduler")


async def _auto_cancel_job() -> None:
    from app.core.db import async_session_factory
    from app.orders import service as orders_service

    try:
        async with async_session_factory() as session:
            count = await orders_service.auto_cancel_expired_orders(session)
        if count:
            logger.info("미입금 자동취소 %d건 처리", count)
    except Exception:  # 예외는 로깅만 — 프로세스·다음 주기 생존
        logger.exception("미입금 자동취소 작업 실패")


def create_scheduler() -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler()
    scheduler.add_job(_auto_cancel_job, "interval", minutes=get_settings().auto_cancel_interval_minutes)
    return scheduler
