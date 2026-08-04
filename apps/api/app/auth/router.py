import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import service
from app.auth.schemas import KakaoLoginRequest, KakaoNativeLoginRequest, LoginRequest, MeResponse, RefreshRequest, SignupRequest, TokenResponse
from app.core.db import get_session
from app.core.security import get_current_user_id, get_token_payload

router = APIRouter(prefix="/auth")


@router.post("/signup", response_model=TokenResponse, status_code=201)
async def signup(body: SignupRequest, session: AsyncSession = Depends(get_session)) -> TokenResponse:
    access, refresh = await service.signup(session, body.email, body.password, body.name, body.phone)
    return TokenResponse(access_token=access, refresh_token=refresh)


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, session: AsyncSession = Depends(get_session)) -> TokenResponse:
    access, refresh = await service.login(session, body.email, body.password)
    return TokenResponse(access_token=access, refresh_token=refresh)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshRequest, session: AsyncSession = Depends(get_session)) -> TokenResponse:
    access, new_refresh = await service.refresh(session, body.refresh_token)
    return TokenResponse(access_token=access, refresh_token=new_refresh)


@router.post("/logout", status_code=204)
async def logout(body: RefreshRequest, session: AsyncSession = Depends(get_session)) -> None:
    await service.logout(session, body.refresh_token)


@router.post("/kakao", response_model=TokenResponse)
async def kakao_login(body: KakaoLoginRequest, session: AsyncSession = Depends(get_session)) -> TokenResponse:
    access, refresh = await service.kakao_login(session, body.code, body.redirect_uri)
    return TokenResponse(access_token=access, refresh_token=refresh)


@router.post("/kakao/native", response_model=TokenResponse)
async def kakao_native(body: KakaoNativeLoginRequest, session: AsyncSession = Depends(get_session)) -> TokenResponse:
    access, refresh = await service.kakao_native_login(session, body.kakao_access_token)
    return TokenResponse(access_token=access, refresh_token=refresh)


@router.get("/roles")
async def roles(payload: dict = Depends(get_token_payload)) -> dict:
    r = payload.get("roles")
    return {"roles": r if isinstance(r, list) else []}  # 빈 배열 = 구매자 (암묵 기본)


@router.get("/me", response_model=MeResponse)
async def me(
    user_id: uuid.UUID = Depends(get_current_user_id), session: AsyncSession = Depends(get_session)
) -> MeResponse:
    user = await service.get_user(session, user_id)
    return MeResponse(id=user.id, email=user.email, name=user.name, phone=user.phone)


@router.delete("/me", status_code=204)
async def withdraw(
    user_id: uuid.UUID = Depends(get_current_user_id), session: AsyncSession = Depends(get_session)
) -> None:
    """회원 탈퇴 — 개인정보 파기(주문 기록은 법정 보존 기간 동안 남는다).

    본문이 없다. 무엇을 지울지 고를 수 없는 동작이라 옵션이 없고, 확인 절차는 화면의 책임이다.
    차단(진행 중 주문·반품, 판매자 계정)은 409로 나가며 message가 그대로 사용자에게 보일 문구다.
    """
    await service.withdraw(session, user_id)
