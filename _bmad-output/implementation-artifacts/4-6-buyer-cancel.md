---
baseline_commit: cfa5762951d74599228a42176c1a9475c2c5a22e
---

# Story 4.6: 구매자 취소

Status: review

## Story

As a 구매자,
I want 배송 시작 전 주문을 취소하는 것,
So that 마음이 바뀌어도 안심하고 주문할 수 있다.

## Acceptance Criteria

1. **Given** preparing 진입 전인 판매자 묶음(sub_order) **When** 구매자가 그 묶음 취소 (주문 전체 취소 = 모든 묶음 취소) **Then** 묶음의 전 라인이 취소되고 재고가 복원되며 `cancellations`에 귀책(구매자)·사유가 기록된다
2. **Given** preparing에 진입한 묶음 (테스트 시 전이 함수 직접 호출로 상태 조성) **When** 구매자가 취소 시도 **Then** 거부되며 관리자 문의 안내가 표시된다 (API는 422 — 화면 표시는 5.1 이월, 승인된 편차: 진입점 화면 자체가 5.1)
3. **And** 전 묶음이 취소되어 주문의 모든 라인이 canceled가 되면, pending_payment 주문은 order 층도 `canceled`로 전이된다 (4.3 "buyer는 전 묶음 취소의 결과로만" 조합 책임 이행)

## Tasks / Subtasks

- [x] Task 0 (사전 확인): 신규 테이블·의존성 없음 (AD-9 비대상). **UI 스코프 확정**: 취소 버튼·안내 표시는 주문 내역 화면(5.1)에 통합 — 이 스토리는 API·서비스·테스트까지 (Dev Notes 근거)
- [x] Task 1: 묶음 취소 서비스 (AC 1·3)
  - [x] `orders/service.py`에 `cancel_sub_order(session, user_id, sub_order_id, reason)` 한 트랜잭션: ① sub_order 로드 + **소유 검증** (소속 order.user_id == user_id — 아니면 404, 존재 노출 방지 관례. 엔진은 소유 검사 안 함 — docstring 계약) ② 묶음의 `ordered` 라인 조회 — 0개면 422 `invalid_transition`("이미 취소된 묶음") ③ 각 라인 `cancel_order_item(actor_role=buyer, actor_user_id=user_id, reason, responsibility="buyer")` — 타이밍 가드(preparing 진입 전)는 엔진이 강제 ④ 주문 전 라인이 canceled가 됐고 order가 pending_payment면 `transition(order→canceled, buyer)` — **판정은 엔진이 잠근 이후의 order 행 기준(잠금 후 재확인, `_auto_cancel_order` 패턴)** ⑤ commit
  - [x] reason: Pydantic 스키마 소유 — `str | None`(최대 500), None·공백-only면 서비스가 "구매자 취소"로 대체(strip 후)
- [x] Task 2: API (AC 1·2)
  - [x] `POST /api/v1/orders/sub-orders/{sub_order_id}/cancel` (인증 필수): body `{reason?}` → 200 `{canceled_items: n, order_canceled: bool}`. 미소유·미존재 404, preparing 이후 422 `invalid_transition`(엔진 message 그대로 — "배송준비가 시작된 주문은…관리자에게 문의")
- [x] Task 3: 테스트 (`tests/test_buyer_cancel.py` 신설 — 상태 조성은 전이 함수 직접 호출, 4.3 관례)
  - [x] pending_payment 묶음 취소: 전 라인 canceled·재고 복원·cancellations(buyer·사유)·order도 canceled(단일 묶음 주문) + order_events에 (order_item, canceled, buyer)·(order, canceled, buyer) 기록 — AC 1·3
  - [x] 다중 판매자: 한 묶음만 취소 → order는 pending_payment 유지, 남은 묶음 무변화. 남은 묶음도 취소 → order canceled
  - [x] preparing 진입 후(입금확인 조성) 취소 → 422 invalid_transition, 무변화 — AC 2
  - [x] paid 주문의 **전-취소 잔여 NULL 묶음**은 재취소 422 (ordered 라인 0)
  - [x] 타인 묶음·없는 id → 404 / 미인증 401 / reason 501자 422
  - [x] 재고 복원 정확히 1회: 같은 묶음 재취소 422·재고 불변
- [ ] Task 4: 배포 + 검증 — 프로덕션 E2E curl (R8): 주문 생성 → 묶음 취소 → 재고 복원·order canceled 확인 → 데이터 정리

## Dev Notes

- **R5 스캔**: 4.4 defer "커밋 후 응답 유실"(5.1 이월 유지)·4.5 defer(인덱스 — 5.2)·4.3 defer "NULL 배송층 5.1 계약" — 이 스토리 무관, 이월 유지
- **스코프 밖**: 취소 UI(5.1 주문내역 화면 — **취소 버튼·거부 안내·code별 반응 표를 5.1 스토리에 명시 이월**), 라인 단위 부분 취소(관리자 전용 — 5.5, AD-6), paid 후 취소(관리자 수동 — FR-18), 환불 기록(refunded_at — 5.5), 알림(v1 제외)
- **UI를 5.1로 미루는 근거**: 취소 진입점은 주문 내역·상세 화면인데 그 화면 자체가 5.1이다. 4.6에서 임시 화면을 만들면 5.1에서 다시 갈아엎게 됨 — PRD 화면 목록 기준으로도 취소는 주문상세의 액션. epics 4.6의 "안내가 표시된다"는 API 계약(message)까지 이 스토리가 소유하고 표시는 5.1이 이행

### 설계 결정

- **취소 단위는 묶음(sub_order)** — AD-6 확정. 주문 전체 취소는 클라이언트가 모든 묶음에 호출 (또는 5.1 UI가 반복 호출). order 층 canceled 전이는 "전 라인 canceled + pending_payment"일 때 서비스가 자동 수행 — 4.3 Dev Notes의 "조합 책임" 이행
- **paid 주문의 묶음 취소**: paid면 활성 묶음은 전부 preparing(4.3 연쇄)이라 엔진 가드가 자연 거부 — 별도 분기 불요. paid+NULL(전-취소 잔여) 묶음은 ordered 라인 0으로 ③에서 거부
- 소유 검증은 서비스 몫 (4.3 엔진 docstring 계약: "본인 확인은 호출자 책임") — IDOR 방지 필수 지점

### 에러 code 시드 (R6)

| code | 상황 | HTTP | 클라이언트 반응 (5.1 이월) |
|---|---|---|---|
| `invalid_transition` | preparing 이후·이미 취소된 묶음 | 422 | message 그대로 표시 (관리자 문의 안내 포함) |
| `not_found` | 미소유·미존재 sub_order | 404 | 목록 갱신 |
| `validation_error` | reason 형식 | 422 | 방어적 |

### 아키텍처·패턴 준수

- 전 경로 엔진 경유 (AD-3·AD-4) — 신규 상태 로직 0, AST 검사 자동 감시. 잠금 순서는 엔진이 소유(부모 우선)
- 라우터 얇게·service가 AppError·commit 소유·`get_current_user_id` — 기존 관례
- R2 셀프체크: 외부 호출 없음 / 동시성 엔진 잠금(동시 취소·입금확인은 4.3 테스트 선례) / reason 500 상한 / 이형·토큰 해당 없음

### References

- [Source: epics.md#Story-4.6 (500~514행), FR-18(구매자 자유취소 조건)·FR-15, AD-6]
- [Source: 4-3-order-state-engine.md#전이표(buyer 가드)·cancel_order_item·"buyer 각주는 가드가 아니다"(조합 책임), 4-5-auto-cancel.md#_auto_cancel_order(같은 조합 패턴)]

## Dev Agent Record

### Agent Model Used

Claude Fable 5 (claude-fable-5)

### Debug Log References

### Completion Notes List

- `cancel_sub_order`: 소유 검증(404, 존재 노출 방지) → ordered 라인 0이면 422 → 라인별 엔진 취소(타이밍 가드·복원·기록은 엔진) → 전 라인 canceled + pending_payment면 order 전이 → commit. 신규 상태 로직 0 — 전부 4.3 엔진 조합
- order 층 판정은 엔진이 잠근 이후의 order 행 + EXISTS 재조회 기준 (_auto_cancel_order 패턴)
- reason: 스키마 max 500, None·공백은 서비스가 "구매자 취소" 대체 (테스트로 확인)
- UI(취소 버튼·안내 표시)는 5.1 주문내역 화면으로 승인된 편차 이월 — code별 반응 표 포함
- paid+NULL 잔여 묶음 케이스는 "전-취소 묶음 재취소 422" 경로로 구조 커버 (order 상태 무관하게 ordered 라인 0 거부) — 테스트명 기준 시나리오는 canceled order 재취소로 조성
- **의도적 보류**: ① 취소 UI(5.1) ② 라인 부분 취소(5.5 관리자) ③ 환불 기록(5.5) ④ 알림(v1 제외)
- R2 셀프체크: 외부 호출 없음 / 동시성 엔진 잠금 / reason 500 상한 / 이형·토큰 해당 없음
- 테스트 5종, 전체 122/122 통과

### File List

- apps/api/app/orders/service.py (수정 — cancel_sub_order)
- apps/api/app/orders/schemas.py (수정 — SubOrderCancelRequest/Response)
- apps/api/app/orders/router.py (수정 — POST /orders/sub-orders/{id}/cancel)
- apps/api/tests/test_buyer_cancel.py (신규 — 5 테스트)
