---
baseline_commit: 58f6a47918ec28969c01c8eb2a04718c1fd2c92a
---

# Story 5.3: 판매자 주문관리와 배송 처리

Status: done

## Story

As a 판매자,
I want 들어온 주문을 확인하고 배송 단계를 처리하는 것,
So that 주문을 이행할 수 있다.

## Acceptance Criteria

1. **Given** paid 상태인 자기 sub_order (= paid 주문에 속한 preparing 상태 sub_order) **When** preparing → shipping(택배사+송장번호 입력 필수) → delivered 처리 **Then** 각 전이가 전이 함수를 통해 반영되고 송장번호가 구매자 주문상세에 표시된다 (FR-24~26 일부, FR-21)
2. **Given** 다른 판매자의 주문 **When** 조회·처리 시도 **Then** 403으로 거부된다 (epics 명시 — seller 간에는 403, 존재 노출 방지 404 관례의 예외)
3. **And** 목록은 배송 상태 필터(preparing/shipping/delivered)를 제공하고, 배송지·라인 스냅샷·묶음 배송비가 표시된다

## Tasks / Subtasks

- [x] Task 0: 신규 테이블·의존성 없음 (AD-9 비대상). seller 소유 판정은 `sellers_service.get_my_seller` 재사용
- [x] Task 1: 판매자 주문 API (AC 1·2·3)
  - [x] `GET /api/v1/sellers/orders?status=&page=` — 자기 sub_orders만(require_role("seller") + seller_id 필터), status 필터(preparing/shipping/delivered, 기본 preparing), 최신순. 항목: {sub_order_id, order_no(8자)+order_id(UUID 병기 — 5.2 관례), created_at, 배송지 {recipient_name, recipient_phone, postal_code, address1, address2, order_note}, 라인 스냅샷[전 라인 포함 — canceled 라인은 status로 구분해 취소 표시], shipping_fee·remote_extra_fee, shipping_status, carrier, tracking_number}. 응답 {items, total, page, size}
  - [x] `POST /api/v1/sellers/sub-orders/{id}/ship` body {carrier(1~50), tracking_number(1~50)} — 소유 검증(타 판매자 403 — epics 명시) 후 `transition(sub_order→shipping, seller, carrier·tracking)` 한 줄 (송장 기록·가드는 엔진 소유)
  - [x] `POST /api/v1/sellers/sub-orders/{id}/deliver` — 동일 패턴, shipping→delivered
- [x] Task 2: Next.js 판매자 주문관리 화면 (AC 1·3)
  - [x] `/seller/orders` — 판매자 센터 네비에 진입 링크. 상태 탭(배송준비/배송중/배송완료) + 목록 카드/테이블: 주문번호·주문일·수령인·주소·요청사항·라인(상품명·옵션·수량 — 취소 라인 구분 표시)·배송비
  - [x] preparing 행: [배송 시작] → 모달(택배사 선택/입력 + 송장번호) → ship POST → 성공 시 재조회로 행 정리(탭별 카운트 UI는 없음 — 리뷰 문언 정정), 422 message 표시
  - [x] shipping 행: 송장 표시 + [배송 완료] → 확인 → deliver POST
  - [x] 슬러 시스템 CSS·기존 seller 페이지 관례 (5.2 admin 패턴 대칭), R7 판정(401→login, 403→no-role)
- [x] Task 3: 테스트 (`tests/test_seller_orders.py` 신설)
  - [x] 목록: 자기 sub_orders만·상태 필터·배송지·전 라인(취소 구분) 표시·paid 전 주문(NULL) 미노출 / 타 판매자 목록 분리
  - [x] ship: preparing→shipping + 송장 기록(엔진) + 구매자 상세(5.1)에 송장 노출 / 송장 누락 422 / NULL(미결제)·delivered에서 ship 422 / 타 판매자 403 / 구매자 역할 403
  - [x] deliver: shipping→delivered / preparing에서 deliver 422
  - [x] order_events 기록 (seller actor)
- [ ] Task 4: 배포 + Slur 실기 검증 — 웹 판매자 센터에서 배송 처리 → 앱 주문상세 송장 확인 (R8)

## Dev Notes

- **R5 스캔**: 이월 defer 전부 무관 (인덱스·CONCURRENTLY는 오픈 게이트, lint 베이스라인 별도). 4.3 엔진의 shipping 가드·송장 소유가 이 스토리의 전제
- **스코프 밖**: 판매자 대시보드 집계(5.4), 라인 취소(5.5 관리자), 배송 추적 연동(v1 제외), 알림, 반품/교환(v1 제외)
- **모든 전이는 엔진 한 줄** — 송장 필수 가드·기록·이벤트 재구현 금지 (4.3). API는 소유 검증 + transition 호출
- **403 vs 404**: epics 5.3 AC가 "403으로 거부"를 명시 — seller 간 접근은 403 (이 스토리 한정 관례 예외, 근거 기록)
- **paid 전(NULL) sub_orders는 판매자에게 노출하지 않는다** — 입금 확인 전 주문은 판매자 작업 대상이 아님 (입금 확인 전 주문은 5.4 대시보드 집계에서도 판매자 작업 대상 아님)

### 에러 code 시드 (R6)

| code | 상황 | HTTP | 반응 |
|---|---|---|---|
| `invalid_transition` | 순서 위반(NULL→ship 등)·송장 누락 | 422 | message 표시 + 목록 갱신 |
| `forbidden` | 타 판매자·비판매자 | 403 | no-role 안내 |
| `not_found` | 미존재 sub_order | 404 | 목록 갱신 |

### 아키텍처·패턴 준수

- 조회·전이 서비스 함수(`list_seller_sub_orders`·`ship_sub_order`·`deliver_sub_order`)는 **orders/service.py**에 둔다(모델 소유 도메인). 엔드포인트는 **sellers/router.py**에 추가하고 orders service를 호출한다 — 라우터는 HTTP 조합 층으로 AD-2 service-층 방향 규칙의 적용 대상이 아니라는 것이 기존 관례 (선례: sellers/router.py의 products_service 직접 호출 — 3.x, admin/router.py의 auth_service enrich — 5.2). **sellers/service.py에서 orders import는 금지.** 전이는 `transition(session, layer=SUB_ORDER, entity_id, to_status, actor_role=seller, actor_user_id=user_id, carrier=, tracking_number=)` keyword 시그니처 — commit은 호출자(신설 orders service 함수) 소유
- 소유 검증: `get_my_seller`로 seller_id 확보 → sub_order.seller_id 대조. 대조 실패 403 (epics), 미존재 404
- 페이지네이션·size 필드·UUID 병기: 5.2 관례
- R2 셀프체크: 외부 호출 없음 / 동시성 엔진 잠금 / carrier·tracking 1~50 / 이형·토큰 해당 없음

### References

- [Source: epics.md#Story-5.3 (548~562행), FR-21·24~26]
- [Source: 4-3(shipping 가드·송장 소유·transition)·5-1(구매자 상세 송장 표시)·5-2(admin 라우터→orders service 선례·UUID 병기·size)]

## Dev Agent Record

### Agent Model Used

Claude Fable 5 (claude-fable-5) — Next.js 화면은 병렬 서브에이전트 (slur 스킬 적용)

### Completion Notes List

- 전이는 전부 엔진 한 줄 (송장 가드·기록·이벤트 4.3 소유). 서비스 함수는 orders/service, 엔드포인트는 sellers 라우터 (라우터 층 관례 — 검증 리포트 근거 명문화)
- 타 판매자 403 (epics 문언 우선 — 404 관례의 기록된 예외), 미존재 404 분리
- paid 전(NULL) sub_orders는 상태 필터가 자연 배제 — 판매자 작업 대상 아님
- 웹은 5.2 패치 사항(세대 카운터·size·빈 페이지 이동·모달 접근성·토스트)을 처음부터 반영
- **의도적 보류**: ① 배송 추적 연동(v1 제외 — 송장 텍스트만) ② 대량 발송 처리(운영 피드백 후) ③ 취소선 라인의 재고 복원 표시(관리자 영역)
- R2 셀프체크: 외부 호출 없음 / 동시성 엔진 잠금 / carrier·tracking 1~50 / 이형·토큰 해당 없음
- 테스트 3종, 전체 137/137. tsc 오류 0·신규 lint 유형 0

### File List

- apps/api/app/orders/service.py (수정 — list_seller_sub_orders·ship/deliver_sub_order·_owned_sub_order)
- apps/api/app/sellers/router.py (수정 — GET /sellers/orders·ship/deliver 엔드포인트)
- apps/api/tests/test_seller_orders.py (신규 — 3 테스트)
- apps/web/app/api/seller/orders/route.ts (신규 — BFF)
- apps/web/app/seller/orders/page.tsx·orders.css (신규)
- apps/web/app/seller/page.tsx·seller.css (수정 — 주문 관리 링크)

### Review Findings

**BMAD 코드리뷰 (2026-07-20) — Blind+Edge 통합 · Acceptance Auditor 병렬. 실질 위반 없음(경미 2). 0 decision-needed · 10 patch · 2 defer · 2 dismiss.**

- [x] [Review][Patch] **전-취소 묶음 유령 발송** — 엔진에 shipping 진입 가드(활성 라인 0 → 422) + `all_canceled` 필드로 UI 버튼 억제·배지
- [x] [Review][Patch] **422/404 message가 load()의 setError(null)에 상쇄 — 한 프레임도 미표시** — keepAlerts 옵션으로 해소
- [x] [Review][Patch] 뒷페이지 마지막 행 처리 후 좌초 — 성공 시 재조회(빈 페이지 이동 재사용)
- [x] [Review][Patch] carrier·tracking 공백 패딩 저장 — 엔진 strip 저장 (구매자 화면·송장 조회 오염 방지)
- [x] [Review][Patch] 취소 라인 표시·NULL ship 422·페이지 경계·strip 테스트 공백 — 테스트 1종 보강 (138/138)
- [x] [Review][Patch] 도서산간 +0원 노이즈 숨김 / 택배사 Enter 포커스 이동 / KST 고정(admin 화면 포함) / 탭 카운트 문언 정정 — 일괄 반영
- [x] [Review][Defer] 자기 소유 NULL sub_order의 ship 422가 존재를 누설 — 입금 후 어차피 노출될 자기 주문 정보라 실해 미미. invalid_transition 코드 분리(4.3 defer)와 함께 후속
- [x] [Review][Defer] 모달 풀 포커스 트랩 — 5.2·5.3 공통 부재(ESC·초기 포커스·submitting 가드는 있음). 웹 공통 모달 컴포넌트 승격 시 일괄 (블루프린트)
- 최종: 백엔드 138/138, tsc 0, 신규 lint 유형 0
