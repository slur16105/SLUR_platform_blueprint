# Story 1.3: 카카오 로그인

Status: draft

## Story

As a 구매자,
I want 카카오로 빠르게 가입·로그인하는 것,
so that 비밀번호 없이 바로 쇼핑을 시작할 수 있다.

## Acceptance Criteria

1. **Given** 유효한 카카오 인가 코드 **When** 소셜 로그인 요청 **Then** 카카오는 신원 확인에만 쓰이고 FastAPI 자체 JWT가 발급된다 (`auth_providers`는 provider 컬럼 기반 범용 구조 — 제공자 추가 시 스키마 변경 불필요)
2. **Given** 같은 카카오 계정의 재로그인 **When** 소셜 로그인 요청 **Then** 기존 계정으로 로그인된다 (중복 계정 미생성)

## Tasks / Subtasks

- [ ] Task 1: 스키마 승인과 마이그레이션 (AC: 1, 2) — **AD-9 게이트: 아래 초안 Slur 승인 후 작성**
  - [ ] `auth_providers` Alembic 리비전
- [ ] Task 2: 카카오 OAuth 연동 (AC: 1)
  - [ ] 의존성: `httpx`를 런타임 의존성으로 승격 (현재 dev 전용)
  - [ ] `core/config.py`: `kakao_rest_api_key`(환경변수 필수), `kakao_client_secret`(선택)
  - [ ] `auth/service.py`: 인가 코드 → kauth.kakao.com 토큰 교환 → kapi.kakao.com/v2/user/me 사용자 조회. **카카오 access token은 신원 확인 즉시 폐기 — 저장 금지 (AD-5)**
  - [ ] 카카오 API 오류(무효 코드, 네트워크)는 401 `invalid_kakao_code` 또는 502 `kakao_unavailable` 봉투로
- [ ] Task 3: 계정 생성·연결 로직 (AC: 1, 2)
  - [ ] `POST /api/v1/auth/kakao` — 요청 `{"code": str, "redirect_uri": str}`, 응답은 기존 TokenResponse (1.2와 동일 계약)
  - [ ] (provider='kakao', provider_user_id=카카오 id) 존재 → 기존 계정 로그인
  - [ ] 미존재 + 카카오가 **인증된(verified) 이메일** 제공 + 같은 이메일 계정 존재 → 그 계정에 카카오 연결 (자동 링크)
  - [ ] 그 외 → 새 계정 생성 (email은 카카오 제공 시만, name은 카카오 닉네임, password_hash NULL)
  - [ ] 트랜잭션: 연결·생성과 refresh 발급이 한 트랜잭션
- [ ] Task 4: 테스트 (AC: 전체)
  - [ ] 카카오 API는 respx(httpx mock)로 모킹 — 신규 가입 / 재로그인(계정 1개 유지) / verified 이메일 자동 링크 / unverified 이메일은 새 계정 / 무효 코드 401
- [ ] Task 5: 배포·검증
  - [ ] KAKAO_REST_API_KEY Railway 변수 + railway.ts preserve() (**Slur 제공 필요 — 카카오 개발자 앱**)
  - [ ] 프로덕션 검증은 실 인가 코드가 필요하므로 Story 1.5(Flutter 로그인 화면)에서 E2E로 수행 — 이 스토리는 배포+모킹 테스트까지

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
- 이메일은 동의 항목 — 미동의 시 없음 (users.email NULL 허용이 이 대비)
- redirect_uri는 카카오 앱 설정에 등록된 것과 일치해야 함 — Flutter/웹 각각 등록 필요 (1.5·1.6에서)

### 자동 링크 정책 (보안 근거)

같은 이메일 계정 자동 연결은 **카카오가 이메일을 verified로 표시할 때만**. unverified 이메일로 링크하면 타인 이메일을 카카오에 등록해 계정 탈취가 가능하므로 새 계정으로 분리한다. `[ASSUMPTION]` 이 정책은 표준 보안 관행 — Slur 승인 시 함께 확인.

### 아키텍처·승계

- AD-5: 카카오는 신원 확인만, JWT는 FastAPI. AD-2: 로직은 auth/service.py. AD-8: UUIDv7 앱 생성.
- 1.2 계약 재사용: TokenResponse, `_issue_tokens`, AppError, 에러 봉투. 신규 에러 code: `invalid_kakao_code`(401), `kakao_unavailable`(502)
- 1.2 학습: Railway 변수는 railway.ts에 preserve() 선언, 테스트 루프 스코프 session, uv 핀 스타일
- 외부 HTTP 호출은 5초 타임아웃 (헬스체크와 동일 원칙 — 카카오 장애가 우리 API를 행 걸지 않게)

### References

- [Source: epics.md#Story 1.3], [Source: ARCHITECTURE-SPINE.md AD-5], [Source: 1-2-email-auth-api.md Dev Agent Record]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
