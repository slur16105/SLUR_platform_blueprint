import hashlib
import logging
import secrets
import unicodedata
import uuid
from datetime import datetime, timedelta, timezone

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from sqlalchemy import delete as sa_delete
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.kakao import KakaoIdentity, fetch_identity, fetch_identity_from_token
from app.auth.models import AuthProvider, RefreshToken, User, UserRole
from app.core.config import get_settings
from app.core.errors import AppError
from app.core.security import CODE_UNAUTHORIZED, create_access_token

logger = logging.getLogger("slur.auth")

CODE_EMAIL_EXISTS = "email_already_exists"
CODE_INVALID_CREDENTIALS = "invalid_credentials"
CODE_INVALID_TOKEN = "invalid_token"
# 탈퇴 차단 — 세 가지를 다른 code로 가른다. 화면이 code로 분기하지 않더라도(지금은 message를
# 그대로 보여준다) 로그·지표에서 "왜 탈퇴가 막혔는지"가 구분되어야 한다.
CODE_WITHDRAWAL_BLOCKED_ORDERS = "withdrawal_blocked_orders"
CODE_WITHDRAWAL_BLOCKED_RETURNS = "withdrawal_blocked_returns"
CODE_WITHDRAWAL_BLOCKED_SELLER = "withdrawal_blocked_seller"
CODE_WITHDRAWAL_BLOCKED_ADMIN = "withdrawal_blocked_admin"

_hasher = PasswordHasher()  # 기본이 Argon2id
# 미존재 계정에도 동일한 해시 검증 비용을 지불해 타이밍 채널을 막는다
_DUMMY_HASH = _hasher.hash("timing-equalizer-dummy")

_VERIFY_ERRORS = (VerifyMismatchError, InvalidHashError, VerificationError)


def normalize_email(email: str) -> str:
    return unicodedata.normalize("NFC", email).strip().casefold()


def _hash_refresh(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


async def get_roles(session: AsyncSession, user_id: uuid.UUID) -> list[str]:
    rows = await session.scalars(select(UserRole.role).where(UserRole.user_id == user_id))
    return sorted(rows)


async def _issue_tokens(session: AsyncSession, user_id: uuid.UUID) -> tuple[str, str]:
    roles = await get_roles(session, user_id)  # 발급 시점의 역할을 claim에 (반영은 다음 토큰부터)
    raw = secrets.token_urlsafe(48)
    session.add(
        RefreshToken(
            user_id=user_id,
            token_hash=_hash_refresh(raw),
            expires_at=datetime.now(timezone.utc) + timedelta(days=get_settings().refresh_token_days),
        )
    )
    try:
        await session.commit()
    except IntegrityError as exc:  # token_hash 충돌 등 극히 드문 경우 — 원인을 왜곡하지 않는다
        await session.rollback()
        raise AppError("internal_error", "잠시 후 다시 시도해 주세요.", status_code=500) from exc
    return create_access_token(user_id, roles), raw


async def signup(session: AsyncSession, email: str, password: str, name: str, phone: str | None) -> tuple[str, str]:
    email = normalize_email(email)
    existing = await session.scalar(select(User.id).where(User.email == email))
    if existing:
        raise AppError(CODE_EMAIL_EXISTS, "이미 가입된 이메일입니다.", status_code=409)
    user = User(email=email, password_hash=_hasher.hash(password), name=name, phone=phone)
    session.add(user)
    try:
        await session.flush()
    except IntegrityError as exc:  # 동시 가입 레이스 — UNIQUE 제약이 최종 방어
        await session.rollback()
        raise AppError(CODE_EMAIL_EXISTS, "이미 가입된 이메일입니다.", status_code=409) from exc
    # 필수 약관 동의를 같은 트랜잭션에서 남긴다 — 계정만 생기고 동의 기록이 빠지면 소급이 불가능하다
    from app.legal import service as legal_service  # 순환 임포트 회피 (legal → auth 모델 참조)

    await legal_service.record_signup_consent(session, user.id)
    return await _issue_tokens(session, user.id)


async def login(session: AsyncSession, email: str, password: str) -> tuple[str, str]:
    email = normalize_email(email)
    user = await session.scalar(select(User).where(User.email == email))
    # 이메일 부재와 비밀번호 불일치를 구분해 노출하지 않는다 (응답 시간 포함 — 더미 해시 검증)
    if user is None or user.password_hash is None:
        try:
            _hasher.verify(_DUMMY_HASH, password)
        except _VERIFY_ERRORS:
            pass
        logger.info("login failed (unknown account)")
        raise AppError(CODE_INVALID_CREDENTIALS, "이메일 또는 비밀번호가 올바르지 않습니다.", status_code=401)
    try:
        _hasher.verify(user.password_hash, password)
    except _VERIFY_ERRORS as exc:
        logger.info("login failed (bad credentials)")
        raise AppError(CODE_INVALID_CREDENTIALS, "이메일 또는 비밀번호가 올바르지 않습니다.", status_code=401) from exc
    if _hasher.check_needs_rehash(user.password_hash):
        user.password_hash = _hasher.hash(password)
        await session.commit()
    return await _issue_tokens(session, user.id)


async def _claim_token(session: AsyncSession, raw: str) -> RefreshToken | None:
    """활성 refresh 토큰을 원자적으로 폐기하며 가져온다.

    조건부 UPDATE라 같은 토큰의 동시 요청은 정확히 하나만 성공한다 (회전 레이스 방어).
    """
    now = datetime.now(timezone.utc)
    result = await session.execute(
        update(RefreshToken)
        .where(
            RefreshToken.token_hash == _hash_refresh(raw),
            RefreshToken.revoked_at.is_(None),
            RefreshToken.expires_at > now,
        )
        .values(revoked_at=now)
        .returning(RefreshToken)
    )
    return result.scalar_one_or_none()


async def refresh(session: AsyncSession, raw: str) -> tuple[str, str]:
    token = await _claim_token(session, raw)
    if token is None:
        logger.info("refresh rejected (invalid/revoked/expired token)")
        raise AppError(CODE_INVALID_TOKEN, "다시 로그인해 주세요.", status_code=401)
    return await _issue_tokens(session, token.user_id)


async def logout(session: AsyncSession, raw: str) -> None:
    # 멱등: 이미 폐기·만료·미존재여도 조용히 성공 (재시도·중복 클릭 안전, 토큰 유효성 비노출)
    await _claim_token(session, raw)
    await session.commit()


async def get_user(session: AsyncSession, user_id: uuid.UUID) -> User:
    user = await session.get(User, user_id)
    # 탈퇴 회원은 "없는 회원"과 같이 취급한다.
    # 🚨 access token은 30분짜리 **무상태 JWT**다 — 탈퇴한다고 이미 발급된 토큰의 서명이
    #    깨지지 않는다. 폐기 목록을 두지 않는 설계(AD-1)이므로, 무효화는 **DB를 보는 지점**에서
    #    일어나야 한다. refresh 토큰은 탈퇴 시 전부 삭제되므로 갱신 경로는 이미 닫혀 있고,
    #    남은 access token도 여기서 401이 되어 30분 창이 열려 있지 않다.
    if user is None or user.deleted_at is not None:
        raise AppError(CODE_UNAUTHORIZED, "로그인이 필요합니다.", status_code=401)
    return user


async def withdraw(session: AsyncSession, user_id: uuid.UUID) -> None:
    """회원 탈퇴 (Slur 승인 2026-08-04) — **행을 지우지 않고 개인정보 칸만 비운다**.

    orders·user_agreements·inquiries·returns의 user_id가 전부 ondelete=RESTRICT다.
    주문 이력이 있는 회원은 DB가 DELETE를 아예 거부하며, 그건 "거래·법정 기록은 보존한다"는
    판단이 스키마에 새겨진 결과다(전자상거래법상 계약·결제 기록 5년). 그래서 사람만 지운다.

    지운다: users의 이름·이메일·전화·비밀번호 + addresses·auth_providers·refresh_tokens
            ·cart_items·user_roles 행.
    남긴다: orders(수령인 스냅샷 포함)·sub_orders·order_items·payments·order_events
            ·cancellations·returns·inquiries·user_agreements — 손대지 않는다.

    유예기간도 복구 경로도 없다. deleted_at은 개인정보 파기 사실의 기록이라 되돌릴 수 없다.
    """
    user = await get_user(session, user_id)  # 이미 탈퇴한 회원이면 여기서 401

    # ── 차단 게이트 ────────────────────────────────────────────────
    # 역할부터 본다 — 가장 확정적이고, 주문·반품이 함께 걸려 있어도 안내할 행동은 하나다.
    # 셀프 탈퇴는 **구매자 전용**이다: 역할이 있는 계정은 사람이 개입해 정리한다 (Slur 승인 2026-08-04).
    roles = await get_roles(session, user_id)
    if "seller" in roles:
        # 판매자 해지는 정산·상품·입점 계약이 함께 걸린 일이라 v1 범위 밖이다(사람이 처리한다).
        raise AppError(
            CODE_WITHDRAWAL_BLOCKED_SELLER, "판매자 계정은 고객센터를 통해 해지해 주세요.", status_code=409
        )
    if "admin" in roles:
        # 관리자가 스스로 사라지면 입금확인·주문개입 기록의 주체를 되짚을 수 없게 된다.
        # 안내는 "고객센터"가 아니다 — 관리자에게 고객센터는 자기 자신이다.
        raise AppError(
            CODE_WITHDRAWAL_BLOCKED_ADMIN,
            "관리자 계정은 탈퇴할 수 없어요. 다른 관리자에게 관리자 권한 회수를 요청한 뒤 탈퇴해 주세요.",
            status_code=409,
        )

    # 타 도메인은 함수 안에서 import한다 — 모듈 최상단이면 orders/returns → auth 방향과
    # 맞물려 순환 참조가 된다 (AD-2, record_signup_consent 호출부와 같은 관례).
    from app.orders import service as orders_service

    if await orders_service.has_open_orders(session, user_id):
        raise AppError(
            CODE_WITHDRAWAL_BLOCKED_ORDERS,
            "배송 중이거나 입금 대기 중인 주문이 있어요. 주문이 마무리된 뒤 탈퇴하실 수 있어요.",
            status_code=409,
        )

    from app.returns import service as returns_service

    if await returns_service.has_open_returns(session, user_id):
        raise AppError(
            CODE_WITHDRAWAL_BLOCKED_RETURNS,
            "처리 중인 반품·교환이 있어요. 완료된 뒤 탈퇴하실 수 있어요.",
            status_code=409,
        )

    # ── 파기 ──────────────────────────────────────────────────────
    # 전부 한 트랜잭션이다. 중간에 끊겨 "주소는 지워졌는데 로그인은 되는" 상태가 남으면 안 된다.
    from app.addresses import service as addresses_service
    from app.carts import service as carts_service

    await addresses_service.purge_for_user(session, user_id)
    await carts_service.purge_for_user(session, user_id)
    await session.execute(sa_delete(AuthProvider).where(AuthProvider.user_id == user_id))  # 소셜 재로그인 차단
    await session.execute(sa_delete(RefreshToken).where(RefreshToken.user_id == user_id))  # 세션 즉시 종료
    # 지금은 항상 0행이다 — 위 게이트가 seller·admin을 다 막고 구매자는 행이 없다(암묵 기본).
    # 그럼에도 남기는 이유: 역할이 늘어나는데 게이트만 손보고 이 정리를 빠뜨리면
    # 탈퇴 계정에 권한이 남는다. 게이트와 정리는 같이 자라야 한다.
    await session.execute(sa_delete(UserRole).where(UserRole.user_id == user_id))

    user.name = ""  # NOT NULL이라 NULL이 아니라 빈 문자열이다
    user.email = None  # NULL이어야 같은 이메일로 재가입할 수 있다 (UNIQUE는 NULL 중복을 허용)
    user.phone = None
    user.password_hash = None  # 비밀번호 로그인 경로 차단 (login이 password_hash NULL을 이미 거른다)
    user.deleted_at = datetime.now(timezone.utc)
    await session.commit()
    logger.info("user %s withdrawn", user_id)


CODE_EMAIL_CONFLICT = "email_conflict"


async def kakao_login(session: AsyncSession, code: str, redirect_uri: str) -> tuple[str, str]:
    return await _kakao_login_with_identity(session, await fetch_identity(code, redirect_uri))


async def kakao_native_login(session: AsyncSession, kakao_access_token: str) -> tuple[str, str]:
    return await _kakao_login_with_identity(session, await fetch_identity_from_token(kakao_access_token))


async def _kakao_login_with_identity(session: AsyncSession, identity: KakaoIdentity) -> tuple[str, str]:
    link = await session.scalar(
        select(AuthProvider).where(
            AuthProvider.provider == "kakao", AuthProvider.provider_user_id == identity.provider_user_id
        )
    )
    if link is not None:  # 재로그인 — 기존 계정 (AC 2)
        return await _issue_tokens(session, link.user_id)

    email = normalize_email(identity.email) if identity.email else None
    if email is not None:
        existing = await session.scalar(select(User.id).where(User.email == email))
        if existing is not None:
            # 자동 링크 금지 (선점 계정 탈취 방어) — 이메일 로그인 안내
            raise AppError(CODE_EMAIL_CONFLICT, "이미 이메일로 가입된 계정입니다. 이메일 로그인을 이용해 주세요.", status_code=409)

    user = User(email=email, password_hash=None, name=identity.nickname or "카카오 사용자", phone=None)
    session.add(user)
    try:
        await session.flush()
        session.add(AuthProvider(user_id=user.id, provider="kakao", provider_user_id=identity.provider_user_id))
        await session.flush()
    except IntegrityError as exc:  # 동시 첫 로그인 레이스 — UNIQUE(provider, provider_user_id)가 최종 방어
        await session.rollback()
        retry = await session.scalar(
            select(AuthProvider).where(
                AuthProvider.provider == "kakao", AuthProvider.provider_user_id == identity.provider_user_id
            )
        )
        if retry is not None:
            return await _issue_tokens(session, retry.user_id)
        if email is None:  # 이메일 충돌일 수 없는 레이스 — 오도성 메시지 방지
            raise AppError("service_unavailable", "잠시 후 다시 시도해 주세요.", status_code=503) from exc
        raise AppError(CODE_EMAIL_CONFLICT, "이미 이메일로 가입된 계정입니다. 이메일 로그인을 이용해 주세요.", status_code=409) from exc
    # 소셜 가입도 신규 계정이다 — 이메일 가입과 같은 동의 이력을 남긴다(재로그인은 위에서 반환됨)
    from app.legal import service as legal_service

    await legal_service.record_signup_consent(session, user.id)
    return await _issue_tokens(session, user.id)


async def grant_role(session: AsyncSession, user_id: uuid.UUID, role: str) -> None:
    """역할 부여 (멱등). 반영은 다음 토큰 발급부터 — 호출부가 재로그인 안내 책임."""
    existing = await session.scalar(select(UserRole).where(UserRole.user_id == user_id, UserRole.role == role))
    if existing is not None:
        return
    try:
        async with session.begin_nested():  # savepoint — 실패해도 호출자 트랜잭션은 보존
            session.add(UserRole(user_id=user_id, role=role))
            await session.flush()
    except IntegrityError:  # 동시 부여 레이스 — 멱등 유지
        pass


async def get_users_by_ids(session: AsyncSession, user_ids: list[uuid.UUID]) -> dict[uuid.UUID, User]:
    """user id별 배치 조회 — admin 주문 화면(입금 확인 등)이 쓴다 (AD-2: 모델 직접 import 금지)."""
    if not user_ids:
        return {}
    rows = await session.scalars(select(User).where(User.id.in_(user_ids)))
    return {u.id: u for u in rows}


def display_name(user: User | None) -> str:
    """관리자 화면의 회원 표시명. **탈퇴와 결측을 가른다.**

    탈퇴 회원은 행이 남고 이름 칸만 비워진다(개인정보 파기). 그걸 "(알 수 없는 사용자)"로
    뭉개면 운영자가 데이터 유실로 오해한다 — 탈퇴는 정상 경로고, 결측은 조사가 필요한 이상이다.
    주문의 실제 수령인은 orders 스냅샷에 남아 있어 상세에서 확인할 수 있다.

    표시 문구가 auth에 있는 이유: "탈퇴하면 이름이 빈다"는 이 도메인의 성질이라, 화면마다
    각자 판정하면 주문 목록과 반품 목록이 같은 회원을 다르게 부르게 된다 (실제로 그랬다).
    """
    if user is None:
        return "(알 수 없는 사용자)"
    if user.deleted_at is not None:
        return "(탈퇴한 회원)"
    return user.name or "(알 수 없는 사용자)"


async def find_user_ids_by_name_or_email(session: AsyncSession, q: str) -> list[uuid.UUID]:
    """이름·이메일 부분 일치 user id — admin 주문 검색 선해결용 (AD-2)."""
    from app.core.search import ESCAPE, ilike_pattern

    pat = ilike_pattern(q)
    rows = await session.scalars(
        select(User.id).where((User.name.ilike(pat, escape=ESCAPE)) | (User.email.ilike(pat, escape=ESCAPE))).limit(200)
    )  # LIMIT: IN 폭발 상한 (초과 매칭은 검색어를 좁히도록)
    return list(rows)


async def list_users(
    session: AsyncSession, q: str | None, page: int, size: int, role: str | None = None,
    extra_user_ids: list[uuid.UUID] | None = None,
) -> dict:
    """관리자 회원 조회 (5.6, FR-30 읽기 전용) — 이메일·이름 검색, 역할 필터·포함.

    role: admin/seller = 해당 role 보유 회원, buyer(일반회원) = admin·seller 어느 것도 없는 회원, None = 전체.
    extra_user_ids: 다른 도메인이 선해결한 매칭(브랜드명 → 판매자 회원). 검색어 OR 축에 더한다 —
    auth가 sellers를 직접 import하지 않기 위해 admin 라우터가 풀어서 넘긴다 (AD-2).

    🚨 탈퇴 회원도 목록에 남는다. 주문 기록은 5년 보존되고, 관리자는 그 주문의 구매자를 찾아갈 수
       있어야 한다 — 목록에서 숨기면 "주문은 있는데 회원이 없다"가 되어 조회가 끊긴다.
       대신 `withdrawn`으로 상태를 드러낸다(이름·이메일이 비어 보이는 이유가 화면에 있어야 한다).
    """
    from app.core.search import ESCAPE, ilike_pattern

    base = select(User)
    if q:
        pat = ilike_pattern(q)
        match = (User.name.ilike(pat, escape=ESCAPE)) | (User.email.ilike(pat, escape=ESCAPE))
        if extra_user_ids:
            match = match | User.id.in_(extra_user_ids)
        base = base.where(match)
    if role in ("admin", "seller"):
        base = base.where(User.id.in_(select(UserRole.user_id).where(UserRole.role == role)))
    elif role == "buyer":
        base = base.where(User.id.not_in(select(UserRole.user_id).where(UserRole.role.in_(["admin", "seller"]))))
    total = await session.scalar(select(func.count()).select_from(base.subquery())) or 0
    users = list(await session.scalars(
        base.order_by(User.created_at.desc(), User.id.desc()).offset((page - 1) * size).limit(size)
    ))
    role_rows = [] if not users else (await session.execute(
        select(UserRole.user_id, UserRole.role).where(UserRole.user_id.in_([u.id for u in users]))
    )).all()
    roles_by_user: dict = {}
    for uid, role in role_rows:
        roles_by_user.setdefault(uid, []).append(role)
    return {
        "items": [{
            "id": u.id, "email": u.email or "", "name": u.name,
            "roles": sorted(roles_by_user.get(u.id, [])), "created_at": u.created_at,
            "withdrawn": u.deleted_at is not None,
        } for u in users],
        "total": total, "page": page, "size": size,
    }


async def get_user_basic(session: AsyncSession, user_id: uuid.UUID) -> dict | None:
    """회원 상세용 기본 정보 (id·email·name·roles·가입일·탈퇴여부). 없으면 None.

    판매자 프로필·상품 수 등 타 도메인 합성은 라우터 층이 붙인다 (AD-2: auth→sellers 엣지 금지).
    list_users와 같은 이유로 탈퇴 회원도 조회된다 — 값이 비어 있는 이유는 `withdrawn`이 말한다.
    """
    user = await session.scalar(select(User).where(User.id == user_id))
    if user is None:
        return None
    roles = list(await session.scalars(select(UserRole.role).where(UserRole.user_id == user_id)))
    return {
        "id": user.id, "email": user.email or "", "name": user.name,
        "roles": sorted(roles), "created_at": user.created_at,
        "withdrawn": user.deleted_at is not None,
    }
