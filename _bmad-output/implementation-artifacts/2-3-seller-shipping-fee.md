---
baseline_commit: 6748487a564f32f8853539eecc6c4b0fe6b3f29b
---

# Story 2.3: 판매자 배송비 설정

Status: done

## Story

As a 판매자,
I want 내 배송 정책(무료/유료, 제주·도서산간 추가비)을 설정하는 것,
so that 주문 시 배송비가 자동 계산된다.

## Acceptance Criteria

1. **Given** 판매자 역할 계정 **When** 배송비 설정 저장 (기본 배송비 0원=무료 또는 금액, 제주 추가비, 도서산간 추가비) **Then** 설정이 판매자 프로필에 저장되고 다시 조회하면 그대로 표시된다 (주문 배송비 계산에서의 사용은 Epic 4에서 검증)
2. **And** 금액은 원 단위 정수만 허용된다

## Tasks / Subtasks

- [x] Task 1: API — GET/PUT `/api/v1/sellers/me` (require_role("seller"), 프로필+배송비 3종). 금액: 0 이상 정수, 상한 100,000원(오입력 방어 — AD-13: core/config 상수). 스키마 변경 없음 (2.2에서 컬럼 선반영)
- [x] Task 2: 웹 /seller — 판매자 센터에 프로필 요약 + 배송비 설정 폼 (BFF 라우트, R7: FastAPI seller 판정)
- [x] Task 3: 테스트 — 저장·재조회, 음수/소수/문자 422, 상한 초과 422, 비판매자 403
- [x] Task 4: 배포 → 프로덕션 E2E (R8: 신청→Slur 대신 API로 승인 불가하므로 **테스트 계정을 관리자 API로 승인** 후 판매자 토큰으로 설정 저장→조회→정리)

## Dev Notes

- code 시드 (R6): 없음 (validation_error·forbidden 재사용)
- R5 보류 스캔: 해당 없음. Epic 4의 AD-11(배송비 계산은 orders 소유)이 이 데이터를 소비 — 여기선 저장만
- 프로덕션 E2E 정리: 테스트 계정 users CASCADE 삭제 (sellers.application_id RESTRICT 주의 — application 먼저? CASCADE 경로 확인: users 삭제→applications CASCADE, sellers CASCADE... sellers.application_id RESTRICT가 applications 삭제를 막음 → **users 삭제 전 sellers 먼저 삭제** 순서 명심)

## Dev Agent Record

### Agent Model Used

Claude Fable 5 (claude-fable-5)

### Completion Notes List

- 프로덕션 E2E: 신청→승인→역할 반영→배송비 저장(3000/3000/5000)→재조회 전체 사이클 통과, 테스트 데이터 정리(sellers→users 순서)

### File List
