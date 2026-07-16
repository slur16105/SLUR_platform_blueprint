"""Supabase Storage 사전서명 — 서버만 service key 보유 (AD-1 연장)."""

import logging
import uuid

import httpx

from app.core.config import get_settings
from app.core.errors import AppError

logger = logging.getLogger("slur.products.storage")

BUCKET = "product-images"
_TIMEOUT = 5.0
_ALLOWED = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}

CODE_UNSUPPORTED_TYPE = "unsupported_image_type"
CODE_STORAGE_UNAVAILABLE = "storage_unavailable"


async def create_signed_upload(seller_id: uuid.UUID, content_type: str) -> dict:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_key:
        logger.error("supabase storage not configured")
        raise AppError(CODE_STORAGE_UNAVAILABLE, "이미지 업로드가 일시적으로 불가합니다.", status_code=502)
    ext = _ALLOWED.get(content_type)
    if ext is None:
        raise AppError(CODE_UNSUPPORTED_TYPE, "jpg·png·webp 이미지만 업로드할 수 있습니다.", status_code=422)
    path = f"{seller_id}/{uuid.uuid7()}.{ext}"
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            res = await client.post(
                f"{settings.supabase_url}/storage/v1/object/upload/sign/{BUCKET}/{path}",
                headers={"Authorization": f"Bearer {settings.supabase_service_key}"},
            )
    except httpx.HTTPError as exc:
        logger.warning("storage unreachable: %s", type(exc).__name__)
        raise AppError(CODE_STORAGE_UNAVAILABLE, "이미지 업로드가 일시적으로 불가합니다.", status_code=502) from exc
    if res.status_code != 200:
        logger.warning("storage presign failed: %s", res.status_code)
        raise AppError(CODE_STORAGE_UNAVAILABLE, "이미지 업로드가 일시적으로 불가합니다.", status_code=502)
    try:
        body = res.json()
    except ValueError as exc:
        raise AppError(CODE_STORAGE_UNAVAILABLE, "이미지 업로드가 일시적으로 불가합니다.", status_code=502) from exc
    url = body.get("url") if isinstance(body, dict) else None
    if not url:
        raise AppError(CODE_STORAGE_UNAVAILABLE, "이미지 업로드가 일시적으로 불가합니다.", status_code=502)
    # 클라이언트는 upload_url로 PUT (token이 url에 포함). 토큰 수명은 Supabase 고정(2시간)
    return {"path": path, "upload_url": f"{settings.supabase_url}/storage/v1{url}"}
