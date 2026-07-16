---
baseline_commit: 91217144b9d0fb0c65c19f024b38c1496f433e61
---

# Story 1.4: 역할과 권한 분기 (RBAC)

Status: in-progress

## Story

As a 시스템 관리자,
I want 모든 API의 역할 판정이 FastAPI 한 곳에서 강제되는 것,
so that 클라이언트를 우회한 권한 상승이 불가능하다.

## Acceptance Criteria

1. **Given** 가입 직후 계정 **When** 역할 조회 **Then** 구매자 역할을 가진다 (`user_roles`) **And** 판매자·관리자 전용 엔드포인트 호출 시 403 에러 봉투를 받는다
2. **Given** 최초 배포 환경 (관리자 없음) **When** 관리자 부트스트랩 실행 (시드 스크립트 또는 CLI 명령) **Then** 지정 계정에 관리자 역할이 부여된다 — 이것이 최초 관리자를 만드는 유일한 경로다
3. **Given** 관리자 역할이 부여된 계정 **When** 관리자 전용 엔드포인트 호출 **Then** 통과한다 **And** 역할 검사는 core의 공통 의존성 하나로만 구현된다 (엔드포인트별 자체 검사 금지)

## Tasks / Subtasks

- [x] Task 1: `user_roles` 마이그레이션 (AC: 1) — **승인된 ERD 범위, 컬럼 초안은 아래 표 (Slur에게 표시 후 진행)**
- [x] Task 2: 역할을 JWT claims에 (AC: 1, 3)
  - [x] `GET /api/v1/auth/roles` — 현재 access 토큰의 역할 목록 반환 (구매자는 빈 배열 = 암묵 기본). AC 1의 "역할 조회"는 이 엔드포인트로 검증
  - [x] `_issue_tokens`가 발급 시점의 역할 목록을 조회해 access 토큰 `roles` claim에 포함 (구매자는 암묵 — claim에는 seller/admin만)
  - [x] `core/security.py`: `require_role("admin")` / `require_role("seller")` 의존성 팩토리 — claims만 읽으므로 core가 도메인을 import하지 않음 (AD-2 유지)
  - [x] 역할 없음 → 403 `forbidden` (한국어 메시지). 미인증은 기존 401 `unauthorized`
  - [x] **반영 시점 규칙**: 역할 부여는 다음 토큰 발급(로그인/refresh)부터 — 입점 승인 화면(2.2)에 "재로그인 안내" 필요. **역할 회수 기능이 생기는 시점(v1 제외)에는 해당 유저의 refresh 토큰 일괄 폐기가 필수** — 회수 지연 창을 access 수명(30분)으로 한정하는 규칙을 여기 못박는다
- [x] Task 3: 관리자 부트스트랩 (AC: 2)
  - [x] `uv run python -m app.auth.bootstrap <email>` — normalize_email 적용 후 admin 부여. 멱등(이미 있으면 no-op·exit 0), 계정 미존재 시 명확한 에러·exit 1
  - [x] 프로덕션 실행은 **railway run 권장** (로컬에서 Railway 환경변수 주입해 실행 — 로컬 체크아웃+uv 필요, Supabase는 공인망 pooler라 접근 가능. SSH 방식은 이미지에 소스·uv가 있어야 해 전제 복잡)
- [x] Task 4: 테스트 (AC: 전체)
  - [x] 가입 직후 access 토큰의 roles claim 없음 → 보호 엔드포인트(테스트용 probe 라우트) 403 `forbidden`
  - [x] admin 부여 후 refresh → 새 access로 통과 / 이전 access는 여전히 403 (반영 시점 규칙 검증)
  - [x] 부트스트랩 멱등성
- [ ] Task 5: 배포·검증
  - [ ] push 자동 배포 → 프로덕션에서 Slur 계정 가입 + 부트스트랩 → refresh 후 `GET /auth/roles`에 "admin" 확인 (관리자 전용 실 엔드포인트는 2.2에서 — 이 스토리의 프로덕션 검증 범위는 여기까지)

## Dev Notes

### user_roles 컬럼 초안 (승인 ERD의 구체화 — AD-9)

| 컬럼 | 타입 | 제약 |
|---|---|---|
| id | UUID PK | UUIDv7 앱 생성 (AD-8) |
| user_id | UUID FK→users, NOT NULL, index | |
| role | varchar(20) NOT NULL | CHECK: 'seller' 또는 'admin' (구매자는 행 없음 = 암묵 기본) |
| created_at | timestamptz NOT NULL | |
| | UNIQUE(user_id, role) | 중복 부여 방지 |

### 역할을 JWT에 넣는 설계 근거 (AD-2 충돌 회피)

역할 검사가 DB를 조회하면 core가 auth 테이블을 알아야 해서 의존 방향이 깨진다. 대신 **발급 시점에 auth service가 역할을 읽어 JWT claims에 넣고, core는 claims만 판독**한다 — core는 여전히 도메인을 모른다. 트레이드오프: 역할 변경은 다음 토큰부터 반영 (access 수명 30분 내). v1 규모(수동 승인, 판매자 5~10팀)에서 수용, 입점 승인 UX에서 재로그인 안내로 보완.

### 참고 결정

- `auth_providers.provider`에 CHECK 제약을 추가하지 않는다 — AD-5의 "제공자 추가 시 스키마 변경 불필요"와 상충 (1.3 리뷰 backlog 항목의 처리 결정)
- roles claim 부재(기존 토큰) = 빈 역할로 해석 — 하위 호환

### 1.2·1.3 승계

- `create_access_token(user_id)` 시그니처가 `(user_id, roles)`로 확장됨 — 기존 호출부(_issue_tokens) 일괄 수정, 기존 테스트 18개 회귀 확인
- 테스트 probe 라우트는 conftest 픽스처 패턴(teardown 포함) 재사용
- 에러 code 시드 추가: `forbidden`(403) — errors.py `_HTTP_DEFAULTS`가 아니라 AppError로 던짐

### References

- [Source: epics.md#Story 1.4], [Source: ARCHITECTURE-SPINE.md AD-1·2·8, 스파인 ERD user_roles], [Source: 1-2/1-3 Dev Agent Record]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
