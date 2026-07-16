---
baseline_commit: edfa09117e7b2ffe657c2122a423d39b34c8052f
---

# Story 2.1: 입점 신청

Status: done

## Story

As a 초청받은 브랜드,
I want 입점 신청서를 제출하는 것,
so that 심사 후 판매를 시작할 수 있다.

## Acceptance Criteria

1. **Given** 로그인한 계정 (구매자 역할) **When** 입점 신청 폼 제출 — 법정 필수(상호·대표자명·사업자등록번호·통신판매업 신고번호·사업장 주소·연락처) + 브랜드명·브랜드 소개 **Then** 신청이 저장되고(`seller_applications`) 신청자에게 "심사 중" 상태가 표시된다
2. **Given** 신청 페이지 URL **When** 로그인한 누구나 접근 **Then** 상시 접근 가능하다 — 초청 전용/공개 전환은 링크 노출 정책일 뿐 (FR-6)
3. **Given** 필수 항목 누락 **When** 제출 **Then** 에러 봉투 `details`에 필드별 오류가 담긴다
4. **Given** 이미 심사 중인 신청이 있는 계정 **When** 재신청 **Then** 중복 신청이 거부된다

## Tasks / Subtasks

- [x] Task 1: 스키마 승인·마이그레이션 — **AD-9 게이트: 아래 초안 Slur 승인 후** (`seller_applications`)
- [x] Task 2: API (sellers 도메인 첫 가동) — `POST /api/v1/sellers/applications` (인증 필수), `GET /api/v1/sellers/applications/me` (내 신청 상태). 사업자등록번호 10자리 숫자 검증(하이픈 제거 정규화), 재직 pending 시 409
- [x] Task 3: 웹 화면 — `/apply` 신청 폼(슬러 디자인, 로그인 필요 → 미로그인 시 /login), 제출 후·재방문 시 "심사 중" 상태 화면. 반려된 경우 사유 표시+재신청 가능
- [x] Task 4: 테스트 — 제출 성공/필드 누락 422/중복 pending 409/reject 후 재신청 허용/비로그인 401 + 동시 제출 레이스(partial unique)
- [x] Task 5: 배포·프로덕션 E2E (R8: curl 시나리오 — 가입→신청→상태 조회→정리)

## Dev Notes

### 스키마 초안 (승인 대상 — AD-9)

**seller_applications**
| 컬럼 | 타입 | 제약 |
|---|---|---|
| id | UUID PK | UUIDv7 앱 생성 |
| user_id | UUID FK→users NOT NULL index | 신청자 |
| company_name | varchar(100) NOT NULL | 상호 |
| representative_name | varchar(50) NOT NULL | 대표자명 |
| business_registration_number | varchar(10) NOT NULL | 사업자등록번호 (숫자 10자리, 하이픈 제거 저장) |
| mail_order_number | varchar(50) NOT NULL | 통신판매업 신고번호 |
| business_address | varchar(255) NOT NULL | 사업장 주소 |
| contact_phone | varchar(20) NOT NULL | 연락처 |
| brand_name | varchar(50) NOT NULL | 노출용 브랜드명 |
| brand_intro | varchar(500) NOT NULL | 브랜드 소개 |
| status | varchar(20) NOT NULL | CHECK: pending/approved/rejected, 기본 pending |
| rejection_reason | text NULL | 반려 사유 (2.2에서 기록) |
| decided_at / decided_by | timestamptz NULL / UUID FK→users NULL | 처리 시각·처리 관리자 (2.2) |
| created_at | timestamptz NOT NULL | |
| | **부분 UNIQUE 인덱스: user_id WHERE status='pending'** | 중복 신청 DB 수준 방어 (AC 4 — R2 레이스 체크) |

- 관계: **users 1:N seller_applications** — 반려된 신청은 이력으로 남고, 재신청은 새 행. `GET /applications/me`는 최신 1건 반환. (스파인 ERD의 `||--o|`를 `||--o{`로 갱신 — 승인 시 동반)
- ondelete: user_id CASCADE, decided_by **SET NULL** (관리자 계정 삭제 시 이력 보존)
- 사업자등록번호: 형식(10자리) + **국세청 체크섬 검증 채택** (외부 API 불필요, 오타 차단 — 가중치 1,3,7,1,3,7,1,3,5 mod 10)

### 회고 규칙 적용 (R5 보류 스캔 · R6 code 시드 · R2 셀프체크)

- 이전 보류 스캔: 1.6 백로그 "관리자 페이지 FastAPI 판정"은 2.2 몫 (이 스토리는 관리자 화면 없음). state/PKCE 웹은 이 스토리 무관(자체 폼)
- code 시드: `application_already_pending`(409). 웹 반응: 409 → "이미 심사 중입니다" 상태 화면으로 전환
- 셀프체크 6종 중 해당: 입력 길이 상한(스키마 varchar가 Pydantic max_length와 일치), 동시 제출 레이스(partial unique + IntegrityError→409), 실패 로깅
- 웹 폼은 BFF 경유: `/api/sellers/apply` Route Handler가 쿠키의 access로 FastAPI 호출. **1.6 결정 개정: refresh 쿠키 path를 `/api/auth` → `/api`로 확장** (BFF API 라우트 전체가 401 시 refresh 회전 가능, 페이지 요청에는 여전히 미탑재 — 원래 목적 유지). login/logout 라우트의 set/delete path와 공용 refresh 헬퍼(lib/auth.ts에 rotateTokens) 동반 수정. 갱신 실패 시 쿠키 정리 후 401 반환 → 클라이언트가 /login 이동
- 상태 조회(GET)는 서버 컴포넌트에서 slur_access(path=/)로 FastAPI 직접 호출 (읽기 전용 — Route Handler 불필요). /apply 미로그인 처리는 middleware matcher에 "/apply" 추가
- Alembic: `alembic/env.py`에 `import app.sellers.models` 등록 (누락 시 빈 리비전)
- partial unique는 PG에서 제약이 아니라 **부분 인덱스**: `Index(..., "user_id", unique=True, postgresql_where=text("status = 'pending'"))` — autogenerate 지원됨

### 의도적 보류

- 사업자등록번호 진위 확인(국세청 API): 오픈 게이트 재검토 — v1은 형식 검증만
- 신청 수정·취소: 필요 확인 시 (반려 후 재신청으로 갈음)

## Dev Agent Record

### Agent Model Used

Claude Fable 5 (claude-fable-5)

### Completion Notes List

- seller_applications 마이그레이션(승인 스키마, 부분 유니크 인덱스), 신청 API+상태 조회, 웹 /apply(슬러 디자인)
- refresh 쿠키 path /api 개정 + 옛 path 쿠키 마이그레이션 정리(리뷰 발견), proxyWithRefresh 공용 BFF 헬퍼
- 리뷰 반영: constraint명 확인 후 409 매핑, 전각 숫자 차단, 공백-only·연락처 형식 검증, 검증 메시지 한국어화, 최신 조회 타이브레이커, 반려 후 재신청·동시 제출 레이스 테스트 보강
- 테스트 41/41. 프로덕션 E2E: 제출→pending·중복 409·미인증 401. 테스트 신청 1건(검증굿즈)은 2.2 검증용으로 의도적 보존
- 문서 정정: 상태 조회는 GET Route Handler(클라이언트 컴포넌트) — 서버 컴포넌트 직접 호출 계획에서 변경 (refresh 가능 이점)

### 의도적 보류

- proxyWithRefresh 동시 회전 레이스(다중 BFF 요청 동시 401): BFF 라우트가 늘어나는 2.2+에서 구조 개선 검토
- returnTo 파라미터(로그인 후 원래 페이지 복귀): UX 개선 백로그

### File List

- apps/api/app/sellers/{models,schemas,service,router}.py, alembic/versions/ca64b8ab1e3b, alembic/env.py, app/core/errors.py, tests/test_seller_application.py
- apps/web/{lib/auth.ts, middleware.ts, app/api/auth/{login,logout}/route.ts, app/api/sellers/apply/route.ts, app/apply/{page.tsx,apply.css}}
