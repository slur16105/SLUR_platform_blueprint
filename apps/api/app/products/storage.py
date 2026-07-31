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


async def delete_objects(paths: list[str]) -> int:
    """Storage 객체 삭제 — 상품에서 빠진 이미지를 실제로 지운다.

    지우지 않으면 화면에서 제거된 사진이 공개 URL로 계속 열린다(버킷이 public이라
    주소를 아는 사람은 누구나 접근). 판매자가 잘못 올린 사진을 "제거"했는데 실제로는
    살아 있는 상태가 되어선 안 된다.

    **실패해도 예외를 던지지 않는다** — DB 반영은 이미 끝났고, 여기서 막으면 판매자가
    상품을 수정할 수 없게 된다. 실패는 로그로 남겨 나중에 정리한다(고아 객체는 노출
    위험일 뿐 데이터 정합성 문제는 아니다).
    """
    if not paths:
        return 0
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_key:
        logger.info("storage 미설정 — 객체 삭제 건너뜀 (%d건)", len(paths))
        return 0
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            res = await client.request(
                "DELETE",
                f"{settings.supabase_url}/storage/v1/object/{BUCKET}",
                headers={
                    "Authorization": f"Bearer {settings.supabase_service_key}",
                    "Content-Type": "application/json",
                },
                json={"prefixes": paths},
            )
    except httpx.HTTPError as exc:
        logger.warning("storage 객체 삭제 실패(네트워크): %s — 고아 %d건", type(exc).__name__, len(paths))
        return 0
    if res.status_code >= 400:
        logger.warning("storage 객체 삭제 실패: %s — 고아 %d건", res.status_code, len(paths))
        return 0
    logger.info("storage 객체 %d건 삭제", len(paths))
    return len(paths)
