---
baseline_commit: 17181be8a7f952f41e7301e4357d983264995c72
---

# Story 5.1: 구매자 주문내역·상세

Status: review

## Story

As a 구매자,
I want 내 주문들의 진행 상황을 보는 것,
So that 내 물건이 어디쯤인지 안다.

## Acceptance Criteria

1. **Given** 주문한 계정 **When** 주문내역 조회 **Then** 최신순 목록이 표시되고, 주문 카드에 판매자 묶음별 상태가 각각 표시된다 (대표 상태는 백엔드 파생 값 — AD-12, FR-22)
2. **Given** 주문상세 **When** 조회 **Then** 판매자별 배송 상태·배송지·금액 내역(스냅샷)·pending_payment 시 입금 안내(금액·계좌·기한 — FR-23)가 표시된다
3. **And** (4.6 이월) preparing 진입 전 묶음에 취소 버튼이 표시되고, 취소·거부 반응은 4.6 code별 반응 표를 따른다. 취소 가능 여부도 서버 파생 값만 사용한다 (AD-12)
4. **And** (4.3 이월 계약) paid 주문의 shipping_status NULL 묶음은 "취소된 묶음"으로 표시된다 — NULL을 미결제로 오해하는 파생 금지 (구현 기준은 Dev Notes 파생 표 — 표가 단일 소스)

## Tasks / Subtasks

- [x] Task 0 (사전 확인): 신규 테이블·의존성 없음(AD-9 비대상). 대표 상태 파생 규칙 확정은 Dev Notes 표 — 기술 파생이므로 Slur 질문 불요, 표시 문언만 UX 관례 준수
- [x] Task 1: 파생 계산 + 목록·상세 서비스 (AC 1·2·4)
  - [x] `orders/service.py`에 파생 함수(순수): 묶음 표시 상태 `derive_sub_status(order_payment, shipping_status, has_active_lines)` → `awaiting_payment`/`preparing`/`shipping`/`delivered`/`canceled`(전 라인 취소 또는 paid+NULL), 주문 대표 상태 `derive_order_status` → Dev Notes 파생 표. **파생 로직은 여기 하나뿐 — 클라이언트 구현 금지 (AD-12)**
  - [x] `list_my_orders(session, user_id, page)` — size는 `get_settings().page_size` 재사용 (AD-13): 최신순, 카드용 필드(주문번호 표시 = UUID 뒤 8자리 대문자(4.4 결정), 대표 상태, 묶음별 {브랜드명, 표시 상태}, 총액 파생 합계, 대표 상품명 "외 n건", created_at). N+1 회피 배치 조회
  - [x] `get_my_order(session, user_id, order_id)`: 소유 검증 404 → 배송지·요청사항, 판매자 묶음별 {브랜드명, 표시 상태, 송장(carrier·tracking_number — FR-21 표시), 라인 스냅샷[상품명·옵션·단가+추가금·수량·line_total·status], 배송비(shipping_fee+remote_extra_fee), **cancellable(서버 파생: 묶음 내 ordered 라인 존재 AND shipping_status IS NULL)**}, 금액 요약(상품 합계·배송비 합계·총액 — 전부 스냅샷 파생), pending_payment면 입금 안내 {grand_total, deposit_account(settings), deposit_due_at}
- [x] Task 2: API (AC 1·2)
  - [x] `GET /api/v1/orders?page=1` (인증 필수, page 기반 — 규약, 응답 `{items, total, page}` — PublicProductList 관례), `GET /api/v1/orders/{order_id}` — 봉투·404 관례
- [x] Task 3: Flutter — 주문내역·상세 화면 (AC 1·2·3)
  - [x] 진입점: 홈 AppBar 주문내역 아이콘(장바구니 옆) + 주문 완료 화면의 "주문 내역 보기" 활성화 (4.4 자리 해소)
  - [x] 목록 화면: 최신순 카드(주문번호·날짜·대표 상태·묶음별 상태 칩·총액·대표 상품명), 무한 스크롤 또는 페이지네이션(page 기반), 당겨서 새로고침(명시 async 블록 형식), 빈 상태 문구
  - [x] 상세 화면: 배송지·요청사항 / 판매자 묶음 카드(브랜드명·표시 상태·송장번호 표시·라인 스냅샷·묶음 배송비) / 금액 요약 / **입금 안내 박스(금액·계좌·기한) — 상태값 분기가 아니라 응답에 입금 안내 객체(deposit_info)가 존재할 때만 표시 (AD-12)** / `cancellable` 묶음에만 "묶음 취소" 버튼 → 사유 입력(선택) 다이얼로그 → 4.6 API 호출
  - [x] code별 반응 (4.6 표 이행): `invalid_transition` → message 다이얼로그(관리자 문의 안내 포함) + 상세 재조회 / `not_found` → 스낵바 + 목록 복귀 / 성공 → 상세 재조회 (order_canceled면 대표 상태 갱신 확인)
  - [x] 전 화면 금액·상태·가능 여부는 서버 값 표시만 (AD-12) — 클라이언트 파생 0
- [x] Task 4: 테스트 (`tests/test_order_history.py` 신설)
  - [x] 목록: 최신순·page 동작·타인 주문 미노출·카드 필드(대표 상태·묶음 상태) 파생 검증
  - [x] 파생 규칙 표 전체: pending_payment(awaiting_payment 묶음) / paid(preparing·shipping·delivered) / 전 라인 취소 주문(canceled) / **paid+NULL 묶음 = canceled 표시 (AC 4)** / 부분 취소 혼합 / **부분 취소 후 입금 안내·총액 = 잔여 활성분만 (과입금 방지)**
  - [x] 상세: 스냅샷 필드·송장 표시(shipping 조성 후)·금액 요약 합계·입금 안내(pending만) / cancellable 파생(preparing 후 false·취소 후 false) / 소유 404·미인증 401
  - [x] 스냅샷 불변: 판매자 상품 수정 후에도 상세 금액 불변 (AD-7 회귀)
- [ ] Task 5: 배포 + Slur 실기 검증 — 앱에서 주문 → 내역 → 상세 → 묶음 취소 → 상태 갱신 확인 (R8)

## Dev Notes

- **R5 스캔 (이월 해소)**: ① 4.3 defer "paid+NULL = 취소된 묶음 파생 계약" → AC 4 ② 4.4 defer "커밋 후 응답 유실 시 주문 확인 경로" → 이 스토리의 주문내역이 확인 경로 (완료) ③ 4.6 이월 "취소 버튼·code별 반응 표" → Task 3 ④ 4.5 defer(인덱스)는 5.2로 유지
- **스코프 밖**: 입금 확인(5.2)·배송 처리(5.3)·관리자 개입(5.5), 리뷰·재구매·배송 추적 연동(v1 제외), 웹(판매자·관리자) 주문 화면(5.2·5.3), 알림
- **주문번호**: UUID 뒤 8자리 대문자 — 4.4 결정 재사용, 컬럼 추가 없음 (서버가 `order_no` 필드로 파생 제공 — 클라 가공 금지)

### 대표 상태 파생 표 (Task 1 확정 — 파생 로직의 단일 소스)

**묶음 표시 상태** (`sub_order` 단위):
| 조건 | 표시 상태 |
|---|---|
| 활성 라인 0 (전 라인 canceled) — order 상태 무관 | `canceled` |
| order pending_payment | `awaiting_payment` |
| order canceled — 활성 라인 유무 무관 | `canceled` |
| paid + shipping_status NULL + 활성 라인 존재 | (구조상 불가 — 4.3 paid 연쇄가 보장. 발생 시 `canceled`로 표시하지 말 것 — 활성 라인 은폐. 경고 로그 후 `preparing` 표시) |
| paid + preparing/shipping/delivered | 그대로 |

**주문 대표 상태** (`order` 단위 — 카드 1줄):
| 조건 | 대표 상태 |
|---|---|
| payment canceled 또는 전 라인 canceled | `canceled` |
| pending_payment | `awaiting_payment` |
| paid + 활성 묶음 전부 delivered | `delivered` |
| paid + 활성 묶음에 shipping 존재 | `shipping` |
| paid + 그 외 (preparing만) | `preparing` |

**`awaiting_payment`·묶음 파생 `canceled`는 응답 표시 전용 값** — transitions.py 상수·DB CHECK 추가 금지, `transition()` 입력 사용 금지. 저장 상태는 `pending_payment` 그대로.
**금액 파생 규칙 (부분 취소 정합 — 과입금 방지)**: 모든 금액은 **활성(ordered) 라인만** 합산 — 상품 합계 = 활성 라인 (unit_price+extra_price)×qty 합, 배송비 합계 = **활성 라인이 남은 묶음만의** shipping_fee+remote_extra_fee 합, 총액·입금 안내 grand_total = 둘의 합. 부분 취소 후 입금 안내는 잔여 활성분 금액이어야 한다.
한국어 표시 문언(입금대기/배송준비/배송중/배송완료/취소완료)은 **클라이언트 표현 계층** 몫 (AD-8 — 상태값은 영어 enum)

### 에러 code 시드 (R6)

| code | 상황 | HTTP | 반응 |
|---|---|---|---|
| `not_found` | 타인·미존재 주문 | 404 | 스낵바 + 목록 복귀 |
| `validation_error` | page < 1 | 422 | 방어적 |
| (취소는 4.6 표 재사용) | | | |

### 아키텍처·패턴 준수

- 파생 값 전부 서버 계산 (AD-12) — Flutter는 표시만. 스냅샷만 읽기 (AD-7 — variant 원본 조회 금지, 단 송장·배송 상태는 sub_orders 실시간)
- 페이지네이션 page 기반 (규약), `sellers.get_sellers_by_ids`로 브랜드명 배치 (AD-2)
- 입금 안내는 4.4 응답과 동일 소스(settings) — `get_setting` 재사용
- Flutter: 기존 관례 (Riverpod 3·raw Map·formatWon·Navigator·ApiException). RefreshIndicator는 명시 async 블록
- R2 셀프체크: 외부 호출 없음 / 읽기 전용(취소는 4.6 API) / page·size 상한 / 이형·토큰 해당 없음

### References

- [Source: epics.md#Story-5.1 (520~534행), FR-21·22·23, §4 화면 목록(주문내역·주문상세)]
- [Source: ARCHITECTURE-SPINE.md#AD-6(대표 상태 파생)·AD-7·AD-8·AD-12, 규약(페이지네이션)]
- [Source: 4-3(NULL 배송층 계약)·4-4(order_no·입금 안내)·4-6(취소 API·code 표) 스토리·deferred-work.md]

## Dev Agent Record

### Agent Model Used

Claude Fable 5 (claude-fable-5) — Flutter는 병렬 서브에이전트

### Completion Notes List

- 파생 로직 단일 소스: `derive_sub_status`·`derive_order_status` 순수 함수 (표시 전용 값 — transitions 상수·DB CHECK 미추가). Flutter는 한국어 매핑·표시만 (order_display.dart)
- 금액 파생은 활성(ordered) 라인만 합산 — 부분 취소 후 입금 안내 = 잔여 활성분 (과입금 방지, 테스트 봉인)
- 이월 3건 해소: 4.3 NULL 배송층 계약(AC 4 테스트), 4.4 주문 확인 경로(내역 화면), 4.6 취소 버튼·code 반응 표(상세 화면)
- 목록 카드 title은 활성 라인 우선 상품명 + "외 n건", order_no는 UUID 8자리 파생 (4.4 결정)
- **의도적 보류**: ① 목록 필터·검색(화면 목록 밖) ② 배송 추적 연동(v1 제외 — 송장 텍스트만) ③ 주문 카드 상품 이미지(스냅샷에 이미지 없음 — 필요 시 제안)
- R2 셀프체크: 외부 호출 없음 / 읽기 전용 / page ≥1·size 설정값 / 이형·토큰 해당 없음
- 테스트 4종(파생 매트릭스·paid+NULL·부분 취소 금액·스냅샷 불변), 전체 127/127. flutter analyze 오류 0

### File List

- apps/api/app/orders/service.py (수정 — derive_*·list_my_orders·get_my_order·_amounts)
- apps/api/app/orders/schemas.py (수정 — OrderCard·OrderDetailResponse 등)
- apps/api/app/orders/router.py (수정 — GET /orders·GET /orders/{id})
- apps/api/tests/test_order_history.py (신규 — 4 테스트)
- apps/mobile/lib/src/orders/orders_api.dart (수정 — listOrders·getOrder·cancelSubOrder)
- apps/mobile/lib/src/orders/order_display.dart (신규 — 상태 매핑·뱃지·날짜 포맷)
- apps/mobile/lib/src/orders/order_history_screen.dart (신규)
- apps/mobile/lib/src/orders/order_detail_screen.dart (신규)
- apps/mobile/lib/src/screens/home_screen.dart (수정 — 내역 아이콘)
- apps/mobile/lib/src/orders/order_complete_screen.dart (수정 — 내역 링크 활성화)
