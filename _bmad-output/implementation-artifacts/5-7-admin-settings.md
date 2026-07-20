---
baseline_commit: b5421318bbf94e4e9929cf49abbca9b03f47fb15
---

# Story 5.7: 관리자 설정 (입금 계좌)

Status: review

## Story

As a 관리자,
I want 무통장입금 계좌를 관리자 화면에서 확인·수정하는 것,
So that 계좌 변경 시 DB를 직접 만지지 않아도 되고 오타 사고를 막을 수 있다.

## Acceptance Criteria

1. **Given** 관리자 설정 화면 **When** settings 조회 **Then** `deposit_account`는 수정 가능한 폼으로, `unpaid_cancel_days`·`low_stock_threshold`는 읽기 전용으로 표시된다 (수치 정책 변경은 여전히 DB — 범위 최소화, 2026-07-20 Slur 승인 스토리)
2. **Given** 입금 계좌 수정 **When** 저장 (은행·계좌번호·예금주 — 빈 값 불가) **Then** `settings` 테이블에 반영되고, 이후 주문 완료 화면·입금 안내(4.4·5.1)가 새 값을 표시한다. 수정은 admin 역할만 가능하다

## Tasks / Subtasks

- [x] Task 0: 신규 테이블 없음 (settings 기존). 값 형식: 자유 텍스트 1~200자 (기존 시드 "은행/계좌번호/예금주" 관례 — 구조화 3필드는 과설계, 표시 문자열 그대로)
- [x] Task 1: API — `GET /admin/settings` (3키 값+설명, admin 전용), `PUT /admin/settings/deposit-account` body {value(1~200, strip 후 빈 값 422)} — orders service `update_deposit_account` (settings는 orders 모델 — AD-2). 수정 성공 시 order_events 아님(주문 무관) — 감사는 로그로 (관리자 id·이전 값 logger.info)
- [x] Task 2: Next.js `/admin/settings` — 입금 계좌 입력 폼(현재 값·저장·성공 토스트), 기한·임박 기준 읽기 전용 카드(설명 포함 "변경은 DB에서"). 관리자 홈 네비 "설정" 링크. 관례 일체
- [x] Task 3: 테스트 — GET 3키 / PUT 반영 후 주문 완료·입금 안내가 새 값(4.4 응답 재확인) / 빈 값·201자 422 / 403·401 / placeholder → 실값 갱신 시나리오
- [ ] Task 4: 배포 + Slur 실기 검증 (실계좌 입력은 Slur 몫)

## Dev Notes

- **R5 스캔**: 4.2 defer "deposit_account placeholder" — 이 스토리로 수정 수단 완성 (실값 입력은 운영 행위). 5.4 defer "threshold=0 정책"은 읽기 전용 유지로 무관
- **스코프 밖**: 수치 설정 수정(승인 범위 밖 — 읽기 전용 표시만), 설정 이력 테이블(로그로 대체), remote_area_zips 관리(별도 defer)
- 계좌 값 검증은 형식 자유(은행마다 상이) — 길이·공백만. 표시 그대로 저장

### 에러 code 시드 (R6)

validation_error(빈 값·길이)·forbidden·401 관례

### 아키텍처·패턴 준수

- Setting 모델은 orders 소유 — `update_deposit_account`는 orders service, admin 라우터 호출 (관례). AD-13 이행 완결(값 변경 경로가 화면으로)
- R2: 읽기+단일 UPDATE / 길이 상한 / 이전 값 로깅(감사)

### References

- [Source: epics.md#Story-5.7 (Slur 승인 2026-07-20 추가분), 4-2(settings 시드)·deferred-work(placeholder)]

## Dev Agent Record

### Agent Model Used

Claude Fable 5 (claude-fable-5) — Next.js는 병렬 서브에이전트

### Completion Notes List

- 계좌 값은 자유 텍스트 1~200자 (구조화 3필드는 과설계 기각 — 표시 문자열 그대로). 이전 값은 감사 로그(admin id 포함)
- 갱신이 4.4 주문 완료 응답·5.1 입금 안내에 즉시 반영됨을 테스트로 봉인. 4.2 defer "placeholder 가드"의 수정 수단 완성 — 실계좌 입력은 Slur 운영 행위
- 수치 2종은 읽기 전용 (승인 범위 — 변경은 DB 유지, 화면에 안내 명시)
- 웹: 저장 전 확인 모달(이전→새 계좌 재표시 — 돈 관련 이중 확인), 동일 값 저장 차단
- **의도적 보류**: ① 수치 설정 수정(승인 밖) ② 설정 이력 테이블(로그 대체) ③ remote_area_zips 관리(기존 defer)
- 테스트 1종(전파 포함), 전체 148/148. tsc 0

### File List

- apps/api/app/orders/service.py (수정 — list_settings·update_deposit_account)
- apps/api/app/admin/router.py (수정 — GET /settings·PUT /settings/deposit-account)
- apps/api/tests/test_admin_settings.py (신규 — 1 테스트)
- apps/web/app/api/admin/settings/route.ts (신규 — BFF)
- apps/web/app/admin/settings/{page.tsx,settings.css} (신규)
- apps/web/app/admin/page.tsx (수정 — 설정 링크)
