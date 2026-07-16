"""에러 봉투: 모든 에러 응답은 {code, message, details} 형식.

code는 문자열 enum(클라이언트 분기용), message는 한국어(그대로 표시 가능),
details는 필드별 오류 배열. 클라이언트는 code로만 분기한다.
"""

from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

CODE_NOT_FOUND = "not_found"
CODE_VALIDATION_ERROR = "validation_error"
CODE_INTERNAL_ERROR = "internal_error"


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
        if exc.status_code == 404:
            return JSONResponse(status_code=404, content=_envelope(CODE_NOT_FOUND, "요청한 리소스를 찾을 수 없습니다."))
        return JSONResponse(status_code=exc.status_code, content=_envelope(CODE_INTERNAL_ERROR, str(exc.detail)))

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        details = [
            {"field": ".".join(str(loc) for loc in err.get("loc", [])), "reason": err.get("msg", "")}
            for err in exc.errors()
        ]
        return JSONResponse(status_code=422, content=_envelope(CODE_VALIDATION_ERROR, "입력값이 올바르지 않습니다.", details))

    @app.exception_handler(Exception)
    async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
        return JSONResponse(status_code=500, content=_envelope(CODE_INTERNAL_ERROR, "서버 내부 오류가 발생했습니다."))
