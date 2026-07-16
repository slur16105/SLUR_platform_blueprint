# Story 1.4: 역할과 권한 분기 (RBAC)

Status: draft

## Story

As a 시스템 관리자,
I want 모든 API의 역할 판정이 FastAPI 한 곳에서 강제되는 것,
so that 클라이언트를 우회한 권한 상승이 불가능하다.

## Acceptance Criteria

1. **Given** 가입 직후 계정 **When** 역할 조회 **Then** 구매자 역할을 가진다 (`user_roles`) **And** 판매자·관리자 전용 엔드포인트 호출 시 403 에러 봉투를 받는다
2. **Given** 최초 배포 환경 (관리자 없음) **When** 관리자 부트스트랩 실행 (시드 스크립트 또는 CLI 명령) **Then** 지정 계정에 관리자 역할이 부여된다 — 이것이 최초 관리자를 만드는 유일한 경로다
3. **Given** 관리자 역할이 부여된 계정 **When** 관리자 전용 엔드포인트 호출 **Then** 통과한다 **And** 역할 검사는 core의 공통 의존성 하나로만 구현된다 (엔드포인트별 자체 검사 금지)

## Tasks / Subtasks

- [ ] Task 1: `user_roles` 마이그레이션 (AC: 1) — **승인된 ERD 범위, 컬럼 초안은 아래 표 (Slur에게 표시 후 진행)**
- [ ] Task 2: 역할을 JWT claims에 (AC: 1, 3)
  - [ ] `_issue_tokens`가 발급 시점의 역할 목록을 조회해 access 토큰 `roles` claim에 포함 (구매자는 암묵 — claim에는 seller/admin만)
  - [ ] `core/security.py`: `require_role("admin")` / `require_role("seller")` 의존성 팩토리 — claims만 읽으므로 core가 도메인을 import하지 않음 (AD-2 유지)
  - [ ] 역할 없음 → 403 `forbidden` (한국어 메시지). 미인증은 기존 401 `unauthorized`
  - [ ] **반영 시점 규칙 문서화**: 역할 부여·회수는 다음 토큰 발급(로그인/refresh)부터 반영 — 입점 승인 화면(2.2)은 "재로그인 안내"를 포함해야 함을 스토리 노트로 남김
- [ ] Task 3: 관리자 부트스트랩 (AC: 2)
  - [ ] `uv run python -m app.auth.bootstrap <email>` — 해당 이메일 계정에 admin 역할 부여 (멱등: 이미 있으면 no-op). 프로덕션 실행법(railway run 또는 SSH) Dev Notes에 기록
- [ ] Task 4: 테스트 (AC: 전체)
  - [ ] 가입 직후 access 토큰의 roles claim 없음 → 보호 엔드포인트(테스트용 probe 라우트) 403 `forbidden`
  - [ ] admin 부여 후 refresh → 새 access로 통과 / 이전 access는 여전히 403 (반영 시점 규칙 검증)
  - [ ] 부트스트랩 멱등성
- [ ] Task 5: 배포·검증
  - [ ] push 자동 배포 → 프로덕션에서 Slur 계정 가입 + 부트스트랩으로 실제 최초 관리자 생성

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

### 1.2·1.3 승계

- `create_access_token(user_id)` 시그니처가 `(user_id, roles)`로 확장됨 — 기존 호출부(_issue_tokens) 일괄 수정, 기존 테스트 18개 회귀 확인
- 테스트 probe 라우트는 conftest 픽스처 패턴(teardown 포함) 재사용
- 에러 code 시드 추가: `forbidden`(403) — errors.py `_HTTP_DEFAULTS`가 아니라 AppError로 던짐

### References

- [Source: epics.md#Story 1.4], [Source: ARCHITECTURE-SPINE.md AD-2·8, 스파인 ERD user_roles], [Source: 1-2/1-3 Dev Agent Record]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
