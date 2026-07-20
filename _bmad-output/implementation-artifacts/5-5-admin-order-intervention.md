---
baseline_commit: 4c8b719180b75847c4d83bcd32fe07125efb84f2
---

# Story 5.5: 관리자 주문 개입

Status: review

## Story

As a 관리자,
I want 모든 주문을 검색하고 강제 개입하는 것,
So that 배송 후 취소·환불 같은 예외를 처리할 수 있다.

## Acceptance Criteria

1. **Given** 전체 주문 검색(주문번호·구매자·판매자·상태) **When** 상태 강제 변경 + 관리자 메모 **Then** 전이 함수를 통해 반영되고 메모가 `order_events`에 남는다 (FR-29)
   - **강제 변경도 전이표 내에서만** (4.3 확정 — 역방향 전이는 미정의, 필요 확인 시 전이표 행 추가). admin 허용 전이: order pending_payment→paid/canceled, sub_order preparing→shipping(송장 필수·전-취소 묶음 불가 가드 — admin도 예외 없음)·shipping→delivered
2. **Given** 특정 라인만 취소해야 하는 상황 (판매자 품절 등) **When** 관리자가 라인 단위 취소 (귀책·사유 입력) **Then** 해당 라인만 취소되고 재고 복원·`cancellations` 기록(취소 시각과 환불 완료 시각 분리)이 일어난다 (AD-6)
3. **And** 취소 건의 환불 완료를 관리자가 기록할 수 있다 (`refunded_at` — AD-6 분리 기록의 이행 수단)
4. **And** 관리자 상세에서 주문 타임라인(`order_events`)·라인·취소 기록을 볼 수 있다

## Tasks / Subtasks

- [x] Task 0: 신규 테이블·의존성 없음 (AD-9 비대상). 전이표 변경 없음
- [x] Task 1: 관리자 주문 검색·상세 API (AC 1·4)
  - [x] `GET /api/v1/admin/orders?q=&status=&page=` — 검색·페이징은 전부 DB. **q 검색 경로**: ① UUID 파싱 성공 시 `Order.id ==` 동등 비교 ② 8자 suffix는 `upper(right(replace(id::text,'-',''),8)) = upper(q)` 캐스트 식(무인덱스 seq scan — v1 규모 허용, 명시) ③ 구매자 이름/이메일은 **admin 라우터가 auth_service로 매칭 user_ids를 선해결해 orders service에 `user_ids` 파라미터로 전달** (AD-2: orders→auth 금지 유지) ④ 브랜드는 `EXISTS(sub_orders JOIN sellers ILIKE)` (orders→sellers 허용 엣지) — 전부 OR. status는 Dev Notes **동치 매핑 표**를 SQL로. 응답: 5.2 필드 + display_status + buyer, {items,total,page,size}
  - [x] `GET /api/v1/admin/orders/{order_id}` — **get_my_order의 뷰 조립부를 내부 공용 함수로 추출**해 admin 변형 구성 (소유 검증 없음 + items에 `order_item_id`·cancellation{id,reason,responsibility,canceled_at,refunded_at} 조인 + buyer{name,email}(라우터 enrich) + order_events 타임라인(시각·layer·from→to·actor_role·note))
- [x] Task 2: 개입 API (AC 1·2·3)
  - [x] `POST /api/v1/admin/orders/{id}/cancel` body {reason(1~500), responsibility(buyer|seller|admin, 기본 admin), note?} — pending_payment 주문 전체 취소: 전 ordered 라인 `cancel_order_item(admin)` + order 전이 (4.5 `_auto_cancel_order` 패턴, actor admin, 귀책은 입력값)
  - [x] `POST /api/v1/admin/sub-orders/{id}/transition` body {to_status(shipping|delivered), carrier?, tracking_number?, note?} — `transition()` 호출만 (송장 가드는 엔진)
  - [x] `POST /api/v1/admin/order-items/{id}/cancel` body {reason(1~500), responsibility(buyer|seller|admin), note?} — `cancel_order_item(admin)` (배송 후에도 가능 — admin 타이밍 가드 예외는 4.3 확정). **후속 정합(4.6 패턴 동일): 취소 후 주문 전체 ordered 라인 0 + pending_payment면 order canceled 전이 — 5.2 입금대기 목록 유령 방지**
  - [x] `POST /api/v1/admin/cancellations/{id}/refunded` — **orders service `mark_refunded()`** (Cancellation은 orders 모델 — admin 라우터가 호출). `UPDATE ... SET refunded_at=now() WHERE id=... AND refunded_at IS NULL` 조건부 — rowcount 0이면 409 (동시 중복 안전). AST 검사 비대상 확인됨
  - [x] 전부 `require_role("admin")`, 404/422/403 봉투 관례
- [x] Task 3: Next.js 관리자 주문 화면 (AC 1·2·3·4)
  - [x] `/admin/orders` — 검색 입력(q)+상태 필터+테이블(5.2 스타일: 주문번호 병기·주문자·브랜드 목록·대표 상태·금액·일시), 행 클릭 → 상세
  - [x] `/admin/orders/[id]` 상세 — 주문 정보·배송지·판매자 묶음(라인·상태·송장), **개입 액션**: pending 주문 [주문 취소(사유)], 라인별 [라인 취소(귀책·사유)], 묶음 [배송중 처리(송장)]·[배송완료 처리], 취소 기록에 [환불 완료 기록] 버튼(refunded_at 표시). 타임라인 섹션(order_events 시간순)
  - [x] 모든 액션 확인 모달 + note 입력(선택), 5.2·5.3 관례(세대 카운터·keepAlerts·ESC·토스트)
- [x] Task 4: 테스트 (`tests/test_admin_orders.py` 신설)
  - [x] 검색: 주문번호 8자·이메일·브랜드명 부분 일치 / status 매핑 필터 / 페이징 / admin 아닌 역할 403
  - [x] 상세: 타임라인·라인·cancellation 표시(refunded_at NULL→기록 후 시각)
  - [x] 개입: pending 주문 취소(라인+order+복원) / pending 마지막 라인 취소 → order 자동 canceled(5.2 유령 방지) / delivered 후 라인 취소(admin 예외 — 복원·귀책 기록) / 송장 없이 shipping 422 / **전-취소 묶음 shipping 422 (admin도 가드)** / 정의 밖 전이 422 / refunded 중복 409
- [ ] Task 5: 배포 + Slur 실기 검증

## Dev Notes

- **R5 스캔**: 4.3 defer "역방향 전이"(필요 시 전이표 행 — 이번에도 추가하지 않음, 기록 유지)·"invalid_transition 코드 분리"(유지). refunded_at 기록은 4.3 defer 해소
- **스코프 밖**: 환불 금액 계산·PG 환불(오픈 게이트 — v1은 완료 시각 기록만), 알림, 주문 데이터 수정(배송지 등 — 화면 목록 밖), 회원·판매자·상품 조회(5.6)
- **엔진 존중**: 모든 상태 변경은 transition/cancel_order_item만. `refunded_at`은 상태 기계 밖 감사 필드 — admin service 직접 UPDATE 허용 (AST 검사 비대상 확인)

### status 필터 SQL 매핑 (Task 1 — 파생 필터 근사)

`has_ordered` = EXISTS(주문 전체에 status='ordered' 라인), `active_sub(X)` = EXISTS(sub: 조건 X AND 그 sub에 ordered 라인 존재)

| 필터 값 | SQL 조건 (5.1 파생 표와 동치 — 전-취소·paid 잔류 케이스 포함) |
|---|---|
| canceled | payment_status = canceled **OR NOT has_ordered** |
| awaiting_payment | payment_status = pending_payment **AND has_ordered** |
| shipping | paid AND has_ordered AND active_sub(shipping_status = shipping) |
| delivered | paid AND has_ordered AND NOT active_sub(shipping_status NOT IN (delivered, confirmed)) |
| preparing | paid AND has_ordered AND NOT active_sub(shipping) AND active_sub(preparing 또는 NULL 방어) — 위 두 조건의 여집합 |

테스트: 각 필터 결과의 display_status가 필터 값과 전부 일치함을 대조 (paid 후 전-취소 주문 = canceled 필터 케이스 필수)

### 에러 code 시드 (R6)

| code | 상황 | HTTP | 반응 |
|---|---|---|---|
| `invalid_transition` | 전이표 밖·가드 실패·재취소 | 422 | message 표시 + 재조회 |
| `duplicate_request` | refunded 중복 기록 | 409 | message + 재조회 |
| `not_found`/`forbidden` | 관례 | 404/403 | 관례 |

### 아키텍처·패턴 준수

- 검색·상세·개입 서비스는 orders service(주문 데이터 소유) + admin 라우터 조합 (5.2 관례). buyer·브랜드 enrich는 라우터 층 (AD-2)
- refunded 기록은 orders service `mark_refunded` — admin 라우터 호출 (Task 2와 통일)
- 검색 부분 일치는 ILIKE, q 최소 2자 (과광역 스캔 방지), 파라미터 바인딩 (인젝션 방지 — ORM)
- R2 셀프체크: 외부 호출 없음 / 동시성 엔진 잠금 / q 2~100·note·reason 상한 / 이형·토큰 해당 없음

### References

- [Source: epics.md#Story-5.5 (580~594행), FR-29, AD-3·AD-6]
- [Source: 4-3(admin 가드 예외·전이표·defer)·4-5(_auto_cancel_order 패턴)·5-1(파생 표)·5-2(admin 라우터·검색 화면 관례)]

## Dev Agent Record

### Agent Model Used

Claude Fable 5 (claude-fable-5) — Next.js는 병렬 서브에이전트 (slur 스킬)

### Completion Notes List

- 검색: UUID 동등·8자 suffix 캐스트·구매자/브랜드는 라우터 층 선해결(user_ids·seller_ids 파라미터 — AD-2 유지). status 필터는 5.1 파생 표 동치 SQL (paid 전-취소 = canceled 케이스 테스트 봉인)
- 개입 전부 엔진 조합 — pending 전체 취소(4.5 패턴·귀책 입력), 라인 취소 + pending 전-취소 시 order 자동 전이(5.2 유령 방지), 강제 배송 전이(가드 admin 예외 없음), refunded 조건부 UPDATE(중복 409·AST 비대상)
- 상세는 `_order_detail_view` 공용 추출 (5.1 재사용) + admin 변형(라인 id·cancellation·events)
- refunded_at 기록으로 4.3 defer(환불 완료 분리 기록) 해소
- **의도적 보류**: ① 환불 금액 계산·PG 환불(오픈 게이트) ② 역방향 전이(전이표 미정의 유지) ③ 주문 데이터 수정(화면 목록 밖)
- R2 셀프체크: 외부 호출 없음 / 엔진 잠금 / q 2~100·reason·note 상한 / 이형·토큰 해당 없음
- 테스트 4종(파생 필터 동치·개입 전 경로·가드·refunded), 전체 145/145. tsc 0·build 통과

### File List

- apps/api/app/orders/service.py (수정 — search_orders·admin_get_order·admin_cancel_order/item·admin_transition_sub_order·mark_refunded·_order_detail_view 추출)
- apps/api/app/sellers/service.py (수정 — find_seller_ids_by_brand)
- apps/api/app/auth/service.py (수정 — find_user_ids_by_name_or_email)
- apps/api/app/admin/router.py (수정 — 주문 검색·상세·개입 6 엔드포인트)
- apps/api/tests/test_admin_orders.py (신규 — 4 테스트)
- apps/web/app/api/admin/orders/{route.ts,[id]/route.ts,actions/route.ts} (신규 — BFF)
- apps/web/app/admin/orders/{page.tsx,orders.css,[id]/page.tsx,detail.css,status.ts} (신규)
- apps/web/app/admin/page.tsx (수정 — 주문 관리 링크)
