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
    from datetime import datetime, timezone

    # 기본값 암묵 의존 금지 — 중복 실행 방지·미스파이어 관용을 명시 (라이브러리 기본 변경에도 보장 유지)
    scheduler = AsyncIOScheduler(job_defaults={"max_instances": 1, "coalesce": True, "misfire_grace_time": 60})
    scheduler.add_job(
        _auto_cancel_job, "interval",
        minutes=get_settings().auto_cancel_interval_minutes,
        next_run_time=datetime.now(timezone.utc),  # 기동 직후 1회 즉시 — 잦은 재배포로 인한 배치 기아 방지
    )
    return scheduler
