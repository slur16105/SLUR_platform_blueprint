---
baseline_commit: 849e3b9fe78e12b677d2702166b11ede8d53895e
---

# Story 1.3: 카카오 로그인

Status: done

## Story

As a 구매자,
I want 카카오로 빠르게 가입·로그인하는 것,
so that 비밀번호 없이 바로 쇼핑을 시작할 수 있다.

## Acceptance Criteria

1. **Given** 유효한 카카오 인가 코드 **When** 소셜 로그인 요청 **Then** 카카오는 신원 확인에만 쓰이고 FastAPI 자체 JWT가 발급된다 (`auth_providers`는 provider 컬럼 기반 범용 구조 — 제공자 추가 시 스키마 변경 불필요)
2. **Given** 같은 카카오 계정의 재로그인 **When** 소셜 로그인 요청 **Then** 기존 계정으로 로그인된다 (중복 계정 미생성)

## Tasks / Subtasks

- [x] Task 1: 스키마 승인과 마이그레이션 (AC: 1, 2) — **AD-9 게이트: 아래 초안 Slur 승인 후 작성**
  - [x] `auth_providers` Alembic 리비전
- [x] Task 2: 카카오 OAuth 연동 (AC: 1)
  - [x] 의존성: `httpx`를 런타임 의존성으로 승격 (현재 dev 전용)
  - [x] `core/config.py`: `kakao_rest_api_key`·`kakao_client_secret` (신규 카카오 앱은 client_secret **필수** — 토큰 요청에 포함, 누락 시 KOE010)
  - [x] `auth/service.py`: 인가 코드 → kauth.kakao.com 토큰 교환 → kapi.kakao.com/v2/user/me 사용자 조회. **카카오 access token은 신원 확인 즉시 폐기 — 저장 금지 (AD-5)**
  - [x] 오류 구분: 카카오 4xx(KOE320 무효 코드 등) → 401 `invalid_kakao_code` / 카카오 5xx·타임아웃 → 502 `kakao_unavailable`
- [x] Task 3: 계정 생성·연결 로직 (AC: 1, 2)
  - [x] `POST /api/v1/auth/kakao` — 요청 `{"code": str, "redirect_uri": str}`, 응답은 기존 TokenResponse (1.2와 동일 계약)
  - [x] (provider='kakao', provider_user_id=카카오 id) 존재 → 기존 계정 로그인
  - [x] 미존재 + 카카오 이메일(verified·valid)이 기존 계정과 충돌 → **409 `email_conflict`** "이미 이메일로 가입된 계정입니다. 이메일 로그인을 이용해 주세요." (자동 링크 금지 — 아래 보안 근거)
  - [x] 그 외 → 새 계정 생성 — email은 카카오가 verified+valid로 제공하고 충돌 없을 때만 저장(아니면 NULL), name은 카카오 닉네임(미동의 시 "카카오 사용자" 폴백), password_hash NULL
  - [x] 트랜잭션: 연결·생성과 refresh 발급이 한 트랜잭션
- [x] Task 4: 테스트 (AC: 전체)
  - [x] `respx`를 dev 의존성 추가. 모킹 시나리오 — 신규 가입 / 재로그인(계정 1개 유지) / 이메일 충돌 409 / unverified 이메일은 email NULL 새 계정 / 닉네임 미동의 폴백 / 무효 코드 401 / 카카오 타임아웃 502
- [x] Task 5: 배포·검증
  - [x] KAKAO_REST_API_KEY Railway 변수 + railway.ts preserve() (**Slur 제공 필요 — 카카오 개발자 앱**)
  - [x] 프로덕션 검증은 실 인가 코드가 필요하므로 Story 1.5(Flutter 로그인 화면)에서 E2E로 수행 — 이 스토리는 배포+모킹 테스트까지

## Dev Notes

### 스키마 초안 (Task 1 승인 대상 — AD-9)

**auth_providers**
| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | UUID | PK | UUIDv7 앱 생성 |
| user_id | UUID | FK→users, NOT NULL, index | |
| provider | varchar(20) | NOT NULL | 'kakao' — 네이버·구글 추가 시 값만 늘어남 (스키마 불변, AD-5) |
| provider_user_id | varchar(255) | NOT NULL | 카카오 회원번호 (문자열화) |
| created_at | timestamptz | NOT NULL | |
| | | **UNIQUE(provider, provider_user_id)** | 같은 소셜 계정의 중복 연결 방지 (AC 2의 DB 수준 보장) |

### 카카오 OAuth 요점 (2026 현행 — 구현 시 developers.kakao.com 문서로 재확인)

- 토큰 교환: `POST https://kauth.kakao.com/oauth/token` (grant_type=authorization_code, client_id=REST API 키, redirect_uri, code)
- 사용자 조회: `GET https://kapi.kakao.com/v2/user/me` (Bearer) → `id`(회원번호), `kakao_account.email` + `is_email_verified`, `profile.nickname`
- 이메일은 동의 항목 — 미동의 시 없음 (users.email NULL 허용이 이 대비). `is_email_verified`와 `is_email_valid` 둘 다 true일 때만 이메일을 신뢰
- **카카오 앱 설정 요건 (Slur)**: 동의항목에서 닉네임(profile_nickname)·이메일(account_email) 활성화 필요. 이메일 동의항목은 앱 유형에 따라 추가 신청(영업일 3~5일)이 필요할 수 있음 — 이메일 없이도 로그인은 동작하므로 차단 요소는 아님
- redirect_uri는 카카오 앱 설정에 등록된 것과 일치해야 함 — Flutter/웹 각각 등록 필요 (1.5·1.6에서)

### 자동 링크 금지 (보안 근거 — 검증 리뷰에서 확정)

v1은 이메일이 같아도 계정을 **자동 연결하지 않는다**. 우리 이메일 가입은 본인 확인이 없으므로(이메일 인증 생략, FR-4), 공격자가 피해자 이메일로 먼저 가입해두면 피해자의 카카오 로그인이 공격자 계정에 연결되는 선점 탈취(pre-account-takeover)가 성립하기 때문. 충돌 시 409로 이메일 로그인을 안내하고, 계정 연결 기능은 필요 확인 시 별도 스토리로 (본인 확인 절차와 함께).

### 아키텍처·승계

- AD-5: 카카오는 신원 확인만, JWT는 FastAPI. AD-2: 로직은 auth/service.py. AD-8: UUIDv7 앱 생성.
- 1.2 계약 재사용: TokenResponse, `_issue_tokens`, AppError, 에러 봉투. 신규 에러 code: `invalid_kakao_code`(401), `kakao_unavailable`(502)
- 1.2 학습: Railway 변수는 railway.ts에 preserve() 선언, 테스트 루프 스코프 session, uv 핀 스타일
- 외부 HTTP 호출은 5초 타임아웃 (헬스체크와 동일 원칙 — 카카오 장애가 우리 API를 행 걸지 않게)

### References

- [Source: epics.md#Story 1.3], [Source: ARCHITECTURE-SPINE.md AD-5], [Source: 1-2-email-auth-api.md Dev Agent Record]

## Dev Agent Record

### Agent Model Used

Claude Fable 5 (claude-fable-5)

### Debug Log References

- 프로덕션 검증: 가짜 코드 → 실 카카오 API 도달 → 401 invalid_kakao_code (키·시크릿 정상)

### Completion Notes List

- auth_providers 마이그레이션(승인 스키마), 카카오 토큰 미저장, 자동 링크 금지(409)
- 리뷰 반영: redirect_uri 서버측 allowlist(KAKAO_REDIRECT_URIS), 카카오 응답 이형 방어(비JSON·id≤0·비dict·닉네임 100자·이메일 255자), 429→502, 레이스 fallback 메시지 정확화, _issue_tokens 오분류 수정, KAKAO_* 미설정 시 전면 장애 대신 카카오만 502
- 테스트 24/24 (카카오 13 시나리오 — 발신 파라미터 검증 포함)

### 의도적 보류 (후속 추적)

- state/PKCE 세션 바인딩: 클라이언트 인증 플로우가 정해지는 1.5(Flutter SDK)·1.6(웹)에서 함께 확정
- provider 컬럼 CHECK 제약: 다음 마이그레이션(1.4 user_roles)에 동승
- /auth/kakao 레이트리밋: 로그인 브루트포스 방어와 한 묶음 (v1 범위 밖, 오픈 게이트 재검토)
- 카카오 선점(verified 이메일 저장이 이메일 가입 차단, 비밀번호 설정 플로우 부재): 계정 연결 기능과 한 묶음으로 필요 확인 시

### File List

- apps/api/app/auth/{kakao.py(신규),models.py,schemas.py,service.py,router.py}
- apps/api/app/core/config.py, alembic/versions/b660f7c62253_auth_providers.py, alembic/env.py
- apps/api/tests/{test_kakao.py(신규),conftest.py}, pyproject.toml, .railway/railway.ts
