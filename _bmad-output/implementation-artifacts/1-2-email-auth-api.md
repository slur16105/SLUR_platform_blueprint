---
baseline_commit: 6624a7e9b1235eb3da0f668e307b927937cb37a8
---

# Story 1.2: 이메일 가입·로그인 API

Status: review

## Story

As a 구매자,
I want 이메일과 비밀번호로 가입하고 로그인하는 것,
so that 계정으로 서비스를 이용할 수 있다.

## Acceptance Criteria

1. **Given** 미가입 이메일 **When** 가입 요청(이메일·비밀번호·이름, 선택 휴대폰) **Then** 비밀번호가 Argon2id 해시로 저장되고 access+refresh 토큰이 발급된다 (`users`·`refresh_tokens` 마이그레이션은 AD-9 승인 절차 경유)
2. **Given** 이미 가입된 이메일 **When** 가입 요청 **Then** 에러 봉투의 `code`로 중복을 알린다
3. **Given** 잘못된 비밀번호 **When** 로그인 **Then** 에러 봉투로 실패한다 **And** refresh 토큰 갱신·로그아웃(서버 저장 토큰 폐기)이 동작한다

## Tasks / Subtasks

- [x] Task 1: 스키마 승인과 마이그레이션 (AC: 1) — **AD-9 게이트: 아래 컬럼 초안을 Slur 승인 후 작성**
  - [x] `users`·`refresh_tokens` Alembic 리비전 (아래 승인된 초안대로)
  - [x] 로컬 적용 + Railway pre-deploy로 프로덕션 적용 확인
- [x] Task 2: 보안 기반 (AC: 1, 3)
  - [x] 의존성 추가·핀: `argon2-cffi`(해시), `pyjwt`(JWT) — 사용자 승인 필요 시 명시
  - [x] `auth/service.py`: Argon2id 해시·검증, access JWT 발급(30분)·검증, refresh 토큰 발급(14일)·회전
  - [x] refresh 토큰은 **원문이 아니라 SHA-256 해시로 저장** (DB 유출 시에도 재사용 불가)
  - [x] `core/config.py`에 `jwt_secret`(환경변수 필수), 토큰 수명 설정 추가 — Railway에 JWT_SECRET 변수 설정
- [x] Task 3: 엔드포인트 (AC: 1, 2, 3)
  - [x] `POST /api/v1/auth/signup` — 이메일·비밀번호·이름·(선택)휴대폰. 성공 시 access+refresh 반환. 중복 이메일 → 409 `email_already_exists`
  - [x] `POST /api/v1/auth/login` — 실패 시 401 `invalid_credentials` (이메일 존재 여부를 구분해 노출하지 않는다)
  - [x] `POST /api/v1/auth/refresh` — 유효한 refresh로 새 access+refresh 발급(회전), 이전 refresh 폐기. 무효 토큰 → 401 `invalid_token`
  - [x] `POST /api/v1/auth/logout` — 해당 refresh 토큰 폐기(revoked_at)
  - [x] `GET /api/v1/auth/me` — access 토큰으로 본인 정보 조회
- [x] Task 4: 테스트 (AC: 전체)
  - [x] 가입 성공/중복(409)/검증 실패(422), 로그인 성공/실패(401), refresh 회전(이전 토큰 재사용 시 401), 로그아웃 후 refresh 거부, me 인증/무인증(401 `unauthorized`)
  - [x] 테스트 DB 격리: 각 테스트 후 생성 데이터 정리 (트랜잭션 롤백 or 테이블 truncate 픽스처)
- [x] Task 5: 배포·검증 (AC: 전체)
  - [x] JWT_SECRET Railway 변수 설정(railway.ts에 preserve 선언), push → 자동 배포
  - [x] 프로덕션에서 가입→로그인→refresh→logout 시나리오 curl 검증 후 테스트 계정 정리

## Dev Notes

### 스키마 초안 (Task 1 승인 대상 — AD-9)

**users**
| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | UUID | PK | UUIDv7, 앱 레이어 생성 (AD-8) |
| email | varchar(255) | UNIQUE, NULL 허용 | 이메일 가입자는 필수. NULL 허용인 이유: 1.3 카카오 가입자가 이메일 미제공 가능 — 소셜 계정 대비 |
| password_hash | text | NULL 허용 | Argon2id. NULL = 소셜 전용 계정 (1.3 대비) |
| name | varchar(100) | NOT NULL | 이름 또는 닉네임 |
| phone | varchar(20) | NULL 허용 | 선택 수집 (FR-4) |
| created_at / updated_at | timestamptz | NOT NULL | UTC (AD-8) |

**refresh_tokens**
| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | UUID | PK | UUIDv7 |
| user_id | UUID | FK→users, NOT NULL, index | |
| token_hash | varchar(64) | UNIQUE NOT NULL | SHA-256(원문) — 원문 미저장 |
| expires_at | timestamptz | NOT NULL | 발급+14일 |
| revoked_at | timestamptz | NULL 허용 | 로그아웃·회전 시 기록 |
| created_at | timestamptz | NOT NULL | |

역할(`user_roles`)은 Story 1.4, 카카오(`auth_providers`)는 1.3에서 — 이 스토리는 테이블 2개만 (테이블은 필요한 스토리에서).

### API 계약 (두 클라이언트가 쓰는 계약 — 임의 변경 금지)

- 토큰 응답(공통): `{"access_token": str, "refresh_token": str, "token_type": "bearer"}`
- `POST /auth/refresh`·`/auth/logout` 요청 바디: `{"refresh_token": str}`
- refresh 원문 생성: `secrets.token_urlsafe(48)` — DB에는 SHA-256 hex(64자)만 저장
- 비밀번호 정책: 최소 8자 (Pydantic `min_length=8` → 미달 시 422 `validation_error`)
- 라우터: `app/auth/router.py`는 `APIRouter(prefix="/auth")` — main.py의 `/api/v1`과 합쳐져 `/api/v1/auth/*`
- 웹의 토큰 보관 방식(httpOnly 쿠키 vs 메모리)은 Story 1.6에서 확정 (epics 배치 기준) — 이 스토리는 JSON 바디 반환까지만

### 인증 의존성의 의존 방향 (순환 import 함정 주의)

`core`는 도메인(`auth`)을 import할 수 없다 (AD-2: core에 도메인 코드 금지). 분해:
- **core** (`core/security.py`): JWT 인코딩/디코딩 + `get_current_user_id()` 의존성 — **user_id(UUID)까지만** 반환. User 모델을 모른다
- **auth** (`auth/service.py`): user_id → User 로딩. `/auth/me` 등 User 객체가 필요한 곳은 auth service 함수 사용
- 이후 도메인들은 대부분 user_id만 필요하므로 core 의존성으로 충분

무인증 처리: `HTTPBearer(auto_error=False)` 사용 필수 — 기본값(auto_error=True)은 **403**을 던져 봉투 code가 어긋난다. 토큰 없음/무효 → `AppError("unauthorized", "로그인이 필요합니다.", status_code=401)`

### 아키텍처 규칙 (이 스토리에 걸리는 것)

- **AD-5**: 비밀번호 해시는 **Argon2id** (bcrypt 아님 — 2026-07-15 교체 승인). JWT 발급은 FastAPI 전담. refresh는 서버 저장(폐기 가능).
- **AD-8**: PK는 `uuid.uuid7()` 앱 생성. 시간 UTC timestamptz. 상태·에러 code는 영어 snake_case.
- **AD-9**: 마이그레이션 작성 전 Slur 승인 (스키마 초안 위 표).
- **AD-2**: 로직은 `auth/service.py`, 라우터는 얇게. 인증 의존성(`get_current_user`)은 core에 — 전 도메인이 재사용.
- **에러 code 시드 추가**: `email_already_exists`(409), `invalid_credentials`(401), `invalid_token`(401), `unauthorized`(401). 메시지는 한국어.
- **보안 원칙**: 로그인 실패 시 "이메일 없음"과 "비밀번호 틀림"을 구분해 응답하지 않는다(계정 존재 노출 방지). JWT_SECRET은 환경변수만.

### Story 1.1에서 승계한 학습

- 에러 봉투·전역 핸들러·`AppError`는 이미 구축됨 — auth 서비스는 `AppError(code, message, status)`만 던지면 됨
- 테스트 픽스처 `client`(ASGITransport) 존재, `validation_probe` 패턴 참고. 테스트는 로컬 PG(compose) 필요
- 배포는 push → 자동. pre-deploy가 Alembic 실행. Railway 변수 추가 시 railway.ts에 `preserve()` 선언 필수 (IaC가 삭제하는 사고 방지 — 1.1 리뷰에서 실제 발생할 뻔함)
- Supabase 연결은 Session pooler(aws-1), URL의 `%`는 alembic env.py에서 이스케이프 처리 완료
- uv 의존성 추가는 `uv add "pkg==X.*"` 핀 스타일 유지

### 기술 노트

- PyJWT로 HS256 access 토큰(sub=user_id, exp). 라이브러리 검증: PyJWT 2.x 현행 표준, argon2-cffi는 공식 Argon2 바인딩 — 둘 다 훈련 지식이 아니라 구현 시 최신 버전 pypi 확인 후 핀할 것
- refresh 회전: /refresh 호출 시 기존 토큰 revoked_at 기록 + 새 토큰 발급. 재사용 감지(이미 revoked된 토큰으로 refresh 시도) → 해당 유저 전 토큰 폐기(탈취 대응)는 **v1 제외** — 단순 401만
- `updated_at`은 SQLAlchemy `onupdate`로. email 대소문자: 저장 전 lowercase 정규화
- **중복 이메일 레이스**: 사전 조회 + UNIQUE 제약 이중 방어 — `IntegrityError`를 잡아 409 `email_already_exists`로 변환 (동시 가입 시 500 방지)
- 이메일 인증(본인 확인 메일)은 FR-4에서 명시 생략

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.2] — AC 원문
- [Source: ARCHITECTURE-SPINE.md] — AD-2·5·8·9, 에러 봉투, 스택 핀
- [Source: _bmad-output/implementation-artifacts/1-1-walking-skeleton.md] — Dev Agent Record (배포 함정·픽스처 패턴)
- [Source: prd.md §5 F1] — FR-1·4, NFR-2

## Dev Agent Record

### Agent Model Used

Claude Fable 5 (claude-fable-5)

### Debug Log References

- pytest-asyncio 루프 불일치(엔진 풀이 첫 루프에 바인딩) → pyproject에 test/fixture loop scope를 session으로 통일
- 프로덕션 프로브에서 `.test` TLD 이메일이 422 — email-validator가 예약 도메인 거부 (정상 동작 확인)

### Completion Notes List

- 스키마 Slur 승인(2026-07-16) 후 autogenerate 마이그레이션 — 로컬·프로덕션(pre-deploy) 적용 확인
- Argon2id(argon2-cffi 25.1), PyJWT 2.13, refresh SHA-256 저장·회전, 에러 code 4종 시드
- 테스트 11/11 (auth 7 신규), 프로덕션 E2E 8단계 전부 통과, 테스트 계정 삭제 완료
- JWT_SECRET Railway 변수 + railway.ts preserve() 선언

### File List

- apps/api/app/auth/{models,schemas,service,router}.py
- apps/api/app/core/{security.py,config.py(+jwt 설정)}
- apps/api/alembic/env.py(+모델 등록), alembic/versions/6e7ec5b149e5_users_and_refresh_tokens.py
- apps/api/tests/{conftest.py(+격리 픽스처),test_auth.py}
- apps/api/pyproject.toml(+argon2-cffi·pyjwt·email-validator, 루프 스코프), .railway/railway.ts(+JWT_SECRET preserve)
