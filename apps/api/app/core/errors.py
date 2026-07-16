"""에러 봉투: 모든 에러 응답은 {code, message, details} 형식.

code는 문자열 enum(클라이언트 분기용), message는 한국어(그대로 표시 가능),
details는 필드별 오류 배열. 클라이언트는 code로만 분기한다.
"""

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("slur.errors")

CODE_NOT_FOUND = "not_found"
CODE_METHOD_NOT_ALLOWED = "method_not_allowed"
CODE_VALIDATION_ERROR = "validation_error"
CODE_HTTP_ERROR = "http_error"
CODE_SERVICE_UNAVAILABLE = "service_unavailable"
CODE_INTERNAL_ERROR = "internal_error"

# 상태 코드별 기본 code/한국어 message — 여기 없는 코드는 http_error로 수렴
_HTTP_DEFAULTS: dict[int, tuple[str, str]] = {
    404: (CODE_NOT_FOUND, "요청한 리소스를 찾을 수 없습니다."),
    405: (CODE_METHOD_NOT_ALLOWED, "허용되지 않은 요청 방식입니다."),
    503: (CODE_SERVICE_UNAVAILABLE, "일시적으로 서비스를 사용할 수 없습니다."),
}


class AppError(Exception):
    """도메인 서비스가 던지는 공통 예외. 라우터는 잡지 않는다 — 전역 핸들러가 봉투로 변환."""

    def __init__(self, code: str, message: str, status_code: int = 400, details: list[Any] | None = None):
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or []


def _envelope(code: str, message: str, details: list[Any] | None = None) -> dict[str, Any]:
    return {"code": code, "message": message, "details": details or []}


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content=_envelope(exc.code, exc.message, exc.details))

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        code, message = _HTTP_DEFAULTS.get(exc.status_code, (CODE_HTTP_ERROR, "요청을 처리할 수 없습니다."))
        return JSONResponse(status_code=exc.status_code, content=_envelope(code, message))

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        def _reason(err: dict) -> str:
            msg = err.get("msg", "")
            if msg.startswith("Value error, "):
                return msg[len("Value error, "):]  # 우리 validator의 한국어 메시지
            if msg == "Field required":
                return "필수 입력입니다."
            return msg

        details = [
            {"field": ".".join(str(loc) for loc in err.get("loc", [])), "reason": _reason(err)}
            for err in exc.errors()
        ]
        return JSONResponse(status_code=422, content=_envelope(CODE_VALIDATION_ERROR, "입력값이 올바르지 않습니다.", details))

    @app.exception_handler(Exception)
    async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("unhandled error: %s %s", request.method, request.url.path)
        return JSONResponse(status_code=500, content=_envelope(CODE_INTERNAL_ERROR, "서버 내부 오류가 발생했습니다."))
