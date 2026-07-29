---
baseline_commit: TBD
---

# Story 2.4: 입점 반려 되돌리기 (관리자 실수 복구)

Status: draft (Slur 승인 대기 — 2026-07-29 초안. UX 검토 옵션 A)

## 배경 / 문제

입점 심사에서 승인·반려는 **비가역**이다(`_claim_pending`이 `status='pending'`에서만 전이). 관리자가 **실수로 반려**하면 신청은 `rejected`로 고정되고, 신청자는 사유를 확인한 뒤 **처음부터 재신청**해야 한다 — 관리자의 실수를 신청자가 떠안는다.

UX 검토(2026-07-29, NN/G "예방 > 복구, 하지만 복구 가능성이 최선")에서 도출한 세 옵션 중 **A(반려 되돌리기)** 를 우선한다:
- 반려는 아직 **판매자 계정·권한을 만들지 않은 상태**라, 되돌려도 회수할 대상이 없다 → 무결성 리스크가 낮고 효용이 크다.
- (승인 취소 B는 이미 생성된 판매자·주문 이력 회수가 얽혀 "판매자 정지/재개" 도메인 신설 수준 — 별도 에픽. 이 스토리 범위 아님.)

승인 쪽 실수 예방은 이미 확인 모달로 처리됨(별건, 완료).

## Story

As a 관리자,
I want 실수로 반려한 입점 신청을 다시 심사 대기로 되돌리는 것,
so that 신청자에게 재신청 부담을 지우지 않고 실수를 복구한다.

## Acceptance Criteria

1. **Given** `rejected` 상태의 신청 **When** 관리자가 "되돌리기" **Then** 그 신청이 `pending`으로 복귀하고 `rejection_reason`·`decided_at`·`decided_by`가 초기화되어 다시 심사 대기 목록에 나타난다
2. **Given** 같은 계정에 이미 `pending` 신청이 존재(신청자가 반려 후 재신청함) **When** 관리자가 그 계정의 다른 rejected 건을 되돌리려 함 **Then** 409(`application_already_pending` 계열)로 막고 "이 계정은 이미 심사 대기 신청이 있습니다" 안내 — `uq_seller_applications_pending`(user_id, status='pending' 부분 유니크) 위반 방지
3. **Given** `approved` 또는 `pending` 상태 **When** 되돌리기 시도 **Then** 409 (rejected에서만 되돌릴 수 있다)
4. **Given** 되돌리기는 파괴적이지 않으나 상태를 바꾸는 액션 **When** 관리자가 버튼 클릭 **Then** 확인 후 실행(오클릭 방지, 승인/반려 모달과 동일 결)

## Tasks / Subtasks

- [ ] Task 1: API — `reopen_application(session, application_id, admin_id)` service 신설. `status='rejected'`에서만 `pending`으로 조건부 UPDATE(`_claim_*` 관례로 레이스 방어), `rejection_reason=NULL`·`decided_at=NULL`·`decided_by=NULL`. 되돌리기 전 같은 user_id의 pending 존재 검사 → 있으면 409. `POST /api/v1/admin/seller-applications/{id}/reopen`.
- [ ] Task 2: 웹 프록시 — `/api/admin/applications` POST의 action에 `"reopen"` 추가(또는 전용 경로). assertSameOrigin 유지.
- [ ] Task 3: 웹 /admin/sellers/applications — **반려됨 탭**의 각 행에 "되돌리기" 버튼 + 확인 모달("이 신청을 다시 심사 대기로 되돌립니다"). 성공 시 목록 재조회 + 토스트. 같은 계정 pending 존재 409는 안내 문구로.
- [ ] Task 4: 테스트 — rejected→pending 복구(필드 초기화 확인)/approved·pending에서 409/같은 계정 pending 존재 시 409/비관리자 403/이중 되돌리기 레이스.
- [ ] Task 5: 배포 검증(Slur) — 더미 반려 건 되돌리기 → 심사 대기로 복귀 확인.

## Dev Notes

- **ERD/스키마 변경 없음.** `status` 컬럼은 이미 pending/approved/rejected 지원. 마이그레이션 불필요. (그래도 착수 전 Slur 확인 — CLAUDE.md 규칙)
- code 시드: `application_not_rejected`(409 — rejected 아님), `application_already_pending`(409 — 같은 계정 pending 존재).
- 상태전이표에 `rejected → pending (reopen, admin)` 한 줄 추가. 승인 트랜잭션(2.2)은 건드리지 않는다.
- 알림: 신청자에게 "되돌려짐"을 알릴지는 v1 범위 밖(무통장·알림 미도입) — 관리자 화면 복구만.

## 범위 밖 (후속)
- B. 승인 취소(approved→pending) + 판매자 정지/재개 라이프사이클 — 별도 에픽.
- C. Undo 토스트 — B 선행 필요.
