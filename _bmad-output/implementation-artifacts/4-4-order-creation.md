---
baseline_commit: c51f46106baa51f21885214d8e65aaa31ac0be5a
---

# Story 4.4: 주문 생성

Status: done

## Story

As a 구매자,
I want 장바구니 상품을 배송지 입력과 함께 주문하는 것,
So that 입금만 하면 물건을 받을 수 있다.

## Acceptance Criteria

1. **Given** 구매 가능 항목이 담긴 장바구니 **When** Flutter 주문서에서 배송지(카카오 우편번호 검색)·요청사항 입력 후 주문 **Then** 주문이 생성된다 — `orders`(pending_payment) + 판매자별 `sub_orders` + `order_items` 스냅샷(상품명·옵션·단가·추가금액), 배송비는 4.2 `quote()` 결과가 `sub_orders`에 스냅샷된다 (AD-7·AD-11)
2. **And** 같은 트랜잭션에서 조합 재고가 조건부 UPDATE(`stock >= n`)로 원자 차감되고(소유: orders 도메인 경로, AD-4), 주문된 장바구니 항목이 삭제된다 (AD-10)
3. **And** 주문 완료 화면에 입금 안내(금액·계좌·기한 — settings 값)가 표시된다
4. **Given** 주문 직전 어떤 항목의 재고 부족 **When** 주문 요청 **Then** 주문 전체가 생성되지 않고 문제 항목이 에러 봉투 `details`로 특정된다 (FR-35)
5. **Given** 동시에 재고 1개를 두 구매자가 주문 **When** 두 요청 처리 **Then** 한 명만 성공하고 재고는 음수가 되지 않는다 (NFR-3)

## Tasks / Subtasks

- [x] Task 0 (사전 확인 — AD-9 게이트 없음, 신규 테이블 없음): ① Flutter 우편번호 검색 패키지 채택 Slur 승인 (신규 의존성 — Dev Notes 후보 비교) ② `deposit_account` 실계좌 값 — Slur 제공 시 프로덕션 DB 갱신, 미제공 시 placeholder 유지(내부 테스트 단계 무방)
- [x] Task 1: 재고 차감 함수 (AC 2·5)
  - [x] products에 `deduct_stock(session, variant_id, qty) -> bool` — `UPDATE variants SET stock = stock - n WHERE id = ... AND stock >= n` 조건부 UPDATE, rowcount로 성공 판정 (AD-4: 읽고-계산하고-쓰기 금지). `restore_stock` 옆에 대칭 배치
- [x] Task 2: 주문 생성 서비스 (AC 1·2·4)
  - [x] **주문 대상은 클라이언트가 명시한 `cart_item_ids`다 (부분 주문 서프라이즈 방지)** — 주문서(미리보기)에 표시된 항목 id를 그대로 전송받아 그 항목들만 주문한다. 미리보기~주문 사이 그중 하나라도 불가(품절·숨김·판매종료)로 바뀌면 **전체 실패 + details 특정** — "본 것과 다른 주문이 조용히 생성"되는 일이 없다. 요청 id 중 본인 장바구니에 없는 것은 404 `not_found`
  - [x] `orders/service.py`에 `create_order(session, user_id, data)` 한 트랜잭션: ① 요청 `cart_item_ids`의 항목 로드(본인 소유 검증) — 0개면 422 `empty_cart` ② 항목별 술어 재검증: 불가 항목 전부 수집 → 1건 이상이면 422 `out_of_stock` + `details=[{cart_item_id, product_name, option_text}]` (빠른 실패, 전체 미생성) ③ `quote()` 재계산 (AD-11 — 미리보기와 같은 함수) ④ **전 항목 `deduct_stock` 시도 후 실패 목록 수집 — 1건 이상이면 예외 (부분 차감분은 rollback이 원복, details 복수 가능)** ⑤ Order INSERT(배송지·요청사항, `deposit_due_at` = now + settings `unpaid_cancel_days`일) ⑥ 판매자별 SubOrder INSERT(`shipping_fee`·`remote_extra_fee` 스냅샷, shipping_status NULL) ⑦ OrderItem INSERT — **`unit_price=product.base_price`, `extra_price=variant.extra_price` (entries에서 직접 — quote items[]의 final_price는 합산값이라 분리 컬럼 소스가 아님)**, 상품명·`variant_option_text`·수량 스냅샷 ⑧ 주문된 cart_items 삭제(carts service 함수 신설 경유 — AD-2·AD-10) ⑨ `order_events`에 주문 창생 기록
  - [x] **창생 기록 해석 확정**: 주문 생성은 전이가 아니라 초기 상태(default pending_payment)다 — 전이표에 행을 추가하지 않고, `create_order`가 `OrderEvent(entity=order, from_status=None, to_status=pending_payment, actor_role=buyer)`를 직접 남긴다 (감사 타임라인 완결 — 4.3 AST 검사 화이트리스트인 orders/service.py 안이므로 정합). **epics AC의 "전이 함수 경유" 문언은 4.3 확정 설계로 대체된 승인된 편차.** `OrderEvent.from_status` NULL 의미 주석(models.py)에 "주문 창생" 추가 갱신
  - [x] 응답: `{order_id, grand_total, deposit_account(settings), deposit_due_at}` — 입금 안내는 서버 값만 (AD-12)
- [x] Task 3: API 라우터 (AC 1·4)
  - [x] `POST /api/v1/orders` (인증 필수): body `{cart_item_ids(1~100개), postal_code(5자리), recipient_name(1~50), recipient_phone(숫자 9~11), address1(1~255), address2(0~255), order_note(0~500)}` — Pydantic 검증, 한국어 ValueError
- [x] Task 4: Flutter — 주문서 완성 + 주문 완료 화면 (AC 1·3)
  - [x] `order_preview_screen.dart` 확장: 카카오 우편번호 검색(Task 0 승인 패키지) → postal_code·address1 자동 채움 + address2(상세 주소)·수령인·연락처·요청사항 입력, 미리보기는 기존 흐름 유지
  - [x] "주문하기" 버튼 활성화 (`onPressed: null` 해소) — 미리보기 응답의 `cart_item_id`들을 주문 body로 전송. 성공 시 주문 완료 화면 **pushReplacement**(뒤로가기로 주문서 재진입 불가), `cartProvider` invalidate
  - [x] 주문 완료 화면 신설: 총 결제 금액·입금 계좌·입금 기한(서버 값 그대로, AD-12) + "쇼핑 계속" 홈 복귀
  - [x] `out_of_stock` 응답: details의 문제 항목 이름을 다이얼로그로 표시 → 장바구니 복귀(invalidate)
- [x] Task 5: 테스트 (`tests/test_order_creation.py` 신설)
  - [x] 정상 생성: orders/sub_orders(판매자별·배송비 스냅샷)/order_items(스냅샷 필드) 행 검증, 재고 차감 수치, cart_items 삭제, order_events 창생 기록, deposit_due_at ≈ now+3일, 응답 입금 안내
  - [x] 다중 판매자: sub_orders 2행·배송비 각각 스냅샷 (제주 우편번호로 remote_extra_fee 스냅샷 확인)
  - [x] 재고 부족: 주문 전 재고를 낮춰(비-레이스 조성) 요청 `cart_item_ids` 중 부족 항목 발생 → 전체 미생성(orders 0행·재고 원복·장바구니 보존) + details 특정. **복수 항목 부족 시 details 2건** / 주문서에 없던 항목이 빠지는 부분 주문이 생기지 않음(요청 id 전부가 주문에 포함되거나 전체 실패)
  - [x] **동시 주문 레이스 (AC 5)**: 재고 1, 두 구매자 `asyncio.gather` — 정확히 1명 성공, 재고 0(음수 아님), 실패자는 422 `out_of_stock`
  - [x] 빈 장바구니·전부 구매 불가 422 `empty_cart` / 배송지 필드 검증 422 / 미인증 401
  - [x] 스냅샷 불변: 주문 후 판매자가 상품명·가격 수정·조합 삭제해도 order_items 스냅샷 불변 (AD-7)
- [ ] Task 6: 배포 + Slur 실기 검증 — 프로덕션 E2E (R8, Dev Notes curl 시나리오). 테스트 데이터 즉시 정리

## Dev Notes

- **R5 스캔 (이월 해소)**: ① 4.2 defer "deposit_account placeholder 가드" → Task 0-②에서 확인 ② 4.2 defer "우편번호 실존 검증 없음" → Task 4 카카오 위젯이 해소(실존 주소만 선택 가능) ③ 4.1 defer "합산 후 총량 재고 초과 담기" → 이 스토리 ③ 조건부 UPDATE가 최종 진실로 해소 ④ 4.1 "주문 성공 시 cart_items 삭제는 orders 몫" → Task 2-⑦
- **스코프 밖**: 자동취소(4.5 — deposit_due_at만 심어둠), 구매자 취소(4.6), 주문 내역 조회(5.1 — 완료 화면은 안내만, 내역 링크는 자리만), 입금 확인(5.2), PG(오픈 게이트), 재고 부족 시 부분 주문(전체 실패가 스펙 — FR-35)
- **주문번호 표시**: 별도 채번 없음 — v1은 UUID 뒤 8자리 대문자를 표시용으로 (파생 표시, 컬럼 추가 없음). 사람 친화 채번은 운영 피드백 후

### 트랜잭션·동시성 설계 (AC 2·5의 핵심)

- 순서: 요청 항목 로드·소유 검증 → 술어 재검증(불가 전부 수집, 빠른 실패) → quote() → **전 항목 조건부 UPDATE 차감(최종 진실) — 실패 수집 후 1건 이상이면 예외** → INSERT들 → cart 삭제 → 창생 이벤트 → commit. 예외 시 전체 rollback (부분 차감분도 트랜잭션 원자성으로 원복 — 명시적 보상 로직 불필요)
- `check_purchasable` 사전 검증은 UX용 빠른 실패일 뿐, 진실은 조건부 UPDATE rowcount (4.1 Completion Notes 확정 구조)
- 잠금: 4.3 전이 엔진과 달리 생성 경로는 FOR UPDATE 불요 — 조건부 UPDATE 자체가 원자적. variants 행 잠금 순서 문제도 단일 UPDATE라 없음
- `quote()`와 차감 사이 판매자가 배송비를 바꿔도 무해 — quote 시점 값이 스냅샷 (AD-11 의도)

### 에러 code 시드 (R6)

| code | 상황 | HTTP | 클라이언트 반응 |
|---|---|---|---|
| `empty_cart` | 구매 가능 항목 0 | 422 | 스낵바 + 장바구니 복귀 (4.2 재사용) |
| `out_of_stock` | 차감 실패 항목 존재 | 422 | details 항목명 다이얼로그 → 장바구니 복귀·invalidate |
| `validation_error` | 배송지 필드 형식 | 422 | 필드 오류 표시 |

### Flutter 우편번호 패키지 후보 (Task 0-① — Slur 승인 대상)

| 후보 | 방식 | 비고 |
|---|---|---|
| **kpostal (추천)** | 카카오(다음) 우편번호 서비스 WebView 래핑 | 키 불요·무료(규약 부합), 콜백으로 zip+주소 수신, 유지보수 활성 |
| daum_postcode_search | 동일 서비스 래핑 | 유사 — API 취향 차이 |
| 자체 WebView 구현 | webview_flutter + JS 채널 | 의존성 최소지만 구현·유지 비용, v1 완주 우선과 상충 |

### 아키텍처·패턴 준수 (기존 코드가 정답 소스)

- **AD-11**: `quote()` 재사용 — 미리보기·생성의 금액이 같은 함수에서 나온다. 스냅샷 필드는 quote 결과의 `seller_groups[].shipping_fee/remote_extra_fee`·`items[]` 그대로
- **AD-2**: cart 삭제는 carts에 `delete_items(session, user_id, item_ids)` service 함수 신설 경유(commit 없이 flush — 트랜잭션은 orders 소유). 차감·복원은 products 함수 경유
- **AD-8**: `deposit_due_at` 계산은 UTC. 표시 변환은 클라이언트
- 4.3 엔진 존중: 생성 후 상태 변경은 없음(pending_payment 그대로). AST 검사(`test_no_status_writes_outside_engine`)는 orders/service.py가 화이트리스트라 창생 INSERT·이벤트 기록과 충돌 없음
- Flutter: 기존 `order_preview_screen.dart`·`orders_api.dart` 확장, `formatWon`, `ApiException.from` 관례. 주문 성공 후 `pushReplacement`로 완료 화면 (재제출 방지)
- 계층·인증·에러 봉투: 기존 관례 (router 얇게, service가 AppError·commit 소유, `get_current_user_id`)
- R2 셀프체크: 외부 호출 없음(카카오 위젯은 클라이언트 웹뷰) / 동시성은 조건부 UPDATE + 레이스 테스트 / 입력 상한 Pydantic / 이형·토큰 해당 없음

### 프로덕션 E2E curl 시나리오 (R8 — Task 6)

① 두 판매자 상품 담기 → ② POST /orders (일반 우편번호) → 201, 응답 입금 안내 확인 → ③ GET /carts 빈 장바구니 확인 → ④ 판매자 웹에서 재고 수치 차감 확인 → ⑤ 재고 1 상품을 담고 수량 2로 주문 → 422 out_of_stock·장바구니 보존 확인 → ⑥ 앱 실기: 주문서 → 카카오 우편번호 검색 → 주문 → 완료 화면 입금 안내. 테스트 데이터 정리

### References

- [Source: epics.md#Story-4.4 (462~482행), FR-15·16·22·35, NFR-3]
- [Source: ARCHITECTURE-SPINE.md#AD-2·AD-4·AD-7·AD-8·AD-10·AD-11·AD-12, 규약(주소 입력 카카오 우편번호)]
- [Source: 4-2-order-model-shipping-calc.md#quote 계약·Review-Findings(defer 이월 2건), 4-3-order-state-engine.md#Completion-Notes(엔진 계약·AST 검사)]
- [Source: deferred-work.md#4-1·4-2 (합산 재고 초과 policy·deposit_account·우편번호 실존)]

## Dev Agent Record

### Agent Model Used

Claude Fable 5 (claude-fable-5) — Flutter는 병렬 서브에이전트 구현

### Debug Log References

### Completion Notes List

- Task 0: kpostal 패키지·deposit_account placeholder 유지 모두 Slur 확정 (2026-07-20). 신규 테이블 없음 — AD-9 게이트 비대상
- **주문 대상 명시 설계**: 클라이언트가 미리보기의 cart_item_ids를 전송 → 그 항목 전부 주문되거나 전체 실패. 스토리 검증에서 발견된 "조용한 부분 주문" 모순의 해소책. 요청 id 소유 검증은 carts.get_entries_for_order(404), 판정·차감 실패는 details 복수 특정
- 재고의 최종 진실은 deduct_stock 조건부 UPDATE rowcount — 술어 재검증은 UX용 빠른 실패. 동시 주문 레이스 테스트(재고 1, 2구매자 gather)로 정확히 1명 성공·재고 0 봉인
- 창생 이벤트는 전이가 아닌 초기 상태로 기록 (epics "전이 함수 경유" 문언은 4.3 설계로 대체된 승인된 편차). OrderEvent.from_status NULL 주석 갱신
- empty_cart는 사실상 도달 불가 경로가 됨(cart_item_ids min 1 + 소유 검증 404) — 코드에는 방어로 유지, 클라이언트 분기는 out_of_stock·not_found 중심
- **의도적 보류**: ① 주문 내역 링크 자리만(5.1) ② 자동취소는 deposit_due_at만 심음(4.5) ③ 주문번호 사람 친화 채번(UUID 8자리 표시로 대체) ④ deposit_account 실계좌(5.7 또는 오픈 전 DB)
- R2 셀프체크: 외부 호출 없음 / 동시성 조건부 UPDATE+레이스 테스트 / 입력 상한 Pydantic 전 필드 / 이형·토큰 해당 없음
- 테스트 11종 신설(다중 판매자·스냅샷 불변·검증·레이스·price_changed·이중 제출·부분 차감 원복), 전체 111/111 통과. flutter analyze 오류 0

### File List

- apps/api/app/orders/service.py (수정 — create_order·CODE_OUT_OF_STOCK)
- apps/api/app/orders/schemas.py (수정 — OrderCreateRequest/Response)
- apps/api/app/orders/router.py (수정 — POST /orders)
- apps/api/app/orders/models.py (수정 — from_status 주석)
- apps/api/app/carts/service.py (수정 — get_entries_for_order·delete_items)
- apps/api/app/products/service.py (수정 — deduct_stock)
- apps/api/tests/test_order_creation.py (신규 — 8 테스트)
- apps/mobile/pubspec.yaml·pubspec.lock (수정 — kpostal ^1.1.0)
- apps/mobile/lib/src/api/client.dart (수정 — ApiException.details)
- apps/mobile/lib/src/orders/orders_api.dart (수정 — createOrder)
- apps/mobile/lib/src/orders/order_preview_screen.dart (수정 — 배송지 폼·kpostal·주문하기)
- apps/mobile/lib/src/orders/order_complete_screen.dart (신규)

### Review Findings

**BMAD 코드리뷰 (2026-07-20) — Blind Hunter · Edge Case Hunter · Acceptance Auditor 병렬. 0 decision-needed · 11 patch · 3 defer · 2 dismiss.**

- [x] [Review][Patch] **variant 차감 순서 미정렬 — 교차 주문 데드락 가능** — variant_id 정렬로 잠금 획득 순서 고정 [`orders/service.py`]
- [x] [Review][Patch] **미리보기~주문 사이 가격·배송비 인상 조용히 흡수** — `expected_grand_total` 필수화, 불일치 409 `price_changed` + details에 새 총액. Flutter는 다이얼로그 후 미리보기 재조회
- [x] [Review][Patch] **동일 유저 동시 이중 제출 → 중복 주문** — `delete_items` rowcount 가드(409 `duplicate_request`), 동시 제출 테스트로 주문 1건·차감 1회 봉인
- [x] [Review][Patch] 부분 차감 rollback 경로 무검증 — monkeypatch로 차감 단계 도달시켜 부분 차감 원복 실검증 테스트 추가
- [x] [Review][Patch] 장바구니 보존 assertion 항진 — `or` 제거, items==2 직접 단언
- [x] [Review][Patch] settings int() ValueError 500 + 하한 미검증 — `get_int_setting`(봉투 변환·minimum 가드)
- [x] [Review][Patch] 잠금 구간 축소 — settings 조회를 차감 전으로 이동, `delete_items` 재SELECT를 bulk delete로
- [x] [Review][Patch] Flutter `not_found`/`duplicate_request` 미분기 — invalidate + 장바구니 복귀
- [x] [Review][Patch] 완료 화면 raw 캐스트 — 형 불일치에도 크래시 없는 안전 접근 (주문 성공 직후 화면)
- [x] [Review][Patch] 완료 화면 시스템 back 무차단 — PopScope + 입금 안내 확인 다이얼로그
- [x] [Review][Patch] empty_cart 죽은 경로 문구 — Completion Notes에 도달 불가(방어 유지) 기록
- [x] [Review][Defer] 커밋 직후 응답 유실 시 주문 확인 경로 부재 — 5.1 주문 내역이 확인 경로. 5.1 스토리에 이월
- [x] [Review][Defer] 잠금 유지 구간 추가 최적화(차감 후 INSERT·flush 왕복) — v1 트래픽 무관, 블루프린트 시
- [x] [Review][Defer] 테스트 헬퍼 모듈 결합·제2 판매자 인라인 중복 — conftest 승격 후보 (4.3 defer와 동일)
