---
baseline_commit: d9b2239c7ee96324d4af439dba2083dcdbd12acb
---

# Story 2.2: 관리자 입점 승인·반려

Status: review

## Story

As a 관리자,
I want 신청 목록을 보고 승인/반려하는 것,
so that 플랫폼의 결을 유지하며 판매자를 받아들인다.

## Acceptance Criteria

1. **Given** 심사 중인 신청 **When** 관리자가 승인 **Then** 판매자 프로필(`sellers`)이 생성되고 같은 계정에 판매자 역할이 부여되며, 신청자는 즉시 판매자 화면에 접근할 수 있다
2. **Given** 심사 중인 신청 **When** 관리자가 반려 (사유 입력 필수) **Then** 신청자에게 반려 상태와 사유가 표시된다

## Tasks / Subtasks

- [x] Task 1: `sellers` 마이그레이션 (Slur 승인 완료 2026-07-16 — user_id UNIQUE, application_id FK, 브랜드·법정 정보 복사본, 배송비 3종 int 기본 0)
- [x] Task 2: API (admin 도메인 첫 가동, require_role("admin")) — GET /admin/seller-applications?status= (기본 pending, page 기반), POST .../{id}/approve, POST .../{id}/reject {reason 필수}. 승인 트랜잭션: 신청 approved+프로필 생성+seller 역할 부여 (admin→sellers·auth service 경유, AD-2). pending만 처리 가능 — 조건부 UPDATE로 이중 처리 레이스 방어 (R2)
- [x] Task 3: 웹 /admin — 신청 목록(대기 기본)·상세 정보·승인/반려(사유 입력) UI. **R7: 페이지 데이터는 BFF 경유 FastAPI가 admin 판정** — 403이면 /no-role로. 승인 성공 시 "신청자가 다시 로그인하면 판매자 센터 이용 가능" 안내 (1.4 역할 반영 규칙)
- [x] Task 4: 테스트 — 승인(프로필+역할+상태)/반려(사유 필수 422)/비관리자 403/이중 처리 409/승인 후 신청자 refresh 시 seller claim
- [x] Task 5: 배포 → **프로덕션 검증은 Slur가 직접**: /admin에서 테스트 신청("검증굿즈") 반려 처리 (사유 입력) → 정리는 반려로 갈음 (R8 변형 — 실사용 검증)

## Dev Notes

- code 시드 (R6): `application_not_pending`(409 — 이미 처리됨), `rejection_reason_required`는 422 validation으로 갈음
- sellers 스키마: 승인 메시지의 표 그대로. seller 역할 부여는 auth 도메인 service 함수 `grant_role(session, user_id, "seller")` 신설 (bootstrap과 공용화)
- 이전 보류 스캔 (R5): R7(페이지 단 FastAPI 판정) 이 스토리에서 이행. proxyWithRefresh 동시 회전은 이 스토리도 순차 호출이라 해당 없음 — 유지

## Dev Agent Record

### Agent Model Used

Claude Fable 5 (claude-fable-5)

### Completion Notes List

- 프로덕션 검증: Slur가 /admin에서 테스트 신청(검증굿즈) 상세 확인 후 반려 처리 완료 (2026-07-16) — 첫 실무 화면 사용
- 승인 트랜잭션(신청→프로필→역할 원자), 이중 처리 조건부 UPDATE 방어, grant_role 공용화(bootstrap 재사용)

### File List

- apps/api/app/{sellers/{models,service}.py, admin/router.py, auth/service.py}, alembic/versions/16a1879f8881
- apps/api/tests/test_admin_approval.py
- apps/web/app/{admin/{page.tsx,admin.css}, api/admin/applications/route.ts, layout.tsx}
