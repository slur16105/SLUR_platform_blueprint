---
baseline_commit: c7bc8b6e1918561f94c5ab865a826a72146de9a8
---

# Story 4.1: 장바구니

Status: review

## Story

As a 구매자,
I want 여러 판매자의 상품을 한 장바구니에 담는 것,
so that 한 번에 주문할 수 있다.

## Acceptance Criteria

1. **Given** 상품 상세에서 조합·수량 선택 **When** 담기 **Then** 조합 단위로 저장되고(`cart_items`), 같은 조합 재담기는 수량이 합산된다
2. **Given** 장바구니에 담긴 항목이 이후 품절·숨김·삭제됨 **When** 장바구니 조회 **Then** 해당 항목이 "구매 불가"로 표시되고 주문서 진입 대상에서 제외된다 (판정은 3.5의 단일 술어 `check_purchasable` 재사용, AD-10)
3. **Given** 담긴 항목 **When** 수량 변경·삭제 **Then** 즉시 반영된다 (담기 시점 재고 차감 없음 — FR-11·AD-4)
4. **And** 장바구니는 판매자 혼합 단일 목록이다 (판매자별 분리 UI 기각 — FR-14)

## Tasks / Subtasks

- [x] Task 0 (AD-9 게이트): 스키마 초안 승인 — Dev Notes의 `cart_items` 초안 표 + **3.3 보류 해소안(variants upsert 전환 + FK SET NULL)**을 Slur에게 제시하고 승인받은 뒤에만 마이그레이션 작성. 승인 후 `alembic/env.py`에 carts models import 추가 (autogenerate 인식) — **Slur 승인 2026-07-18 (SET NULL·upsert 모두 승인)**
- [x] Task 1: variants 교체 전략 해소 (3.3 보류) — `PUT /sellers/products/{id}/variants`를 delete-then-insert에서 **upsert**로 전환: 동일 옵션 조합(`option1_value`,`option2_value`)은 id·created_at 보존하고 extra_price·stock·is_active만 갱신, 초안에 없는 기존 조합만 삭제, 신규 조합만 insert. 기존 variants 테스트 전부 통과 유지
- [x] Task 2: carts 백엔드 (AC 1·2·3)
  - [x] `POST /api/v1/carts/items` 담기: variant 존재 확인(없으면 404), `check_purchasable` 사전 검증(실패 시 422 `not_purchasable`), 같은 (user, variant) 존재 시 수량 합산 — PG `ON CONFLICT DO UPDATE` 원자적 upsert (동시 담기 레이스 안전, 999 캡은 LEAST)
  - [x] `GET /api/v1/carts` 조회: 전 항목 + 항목별 `purchasable`(술어)·`final_price`·이미지·브랜드명·옵션 표시 문자열 + **구매 가능 항목만의 상품 합계** — 전부 백엔드 계산 (AD-12). N+1 회피 (3.5 배치 조회 패턴)
  - [x] `PATCH /api/v1/carts/items/{id}` 수량 변경, `DELETE /api/v1/carts/items/{id}` 삭제: 본인 항목 아니면 404 (403 아님 — 존재 노출 방지 관례)
  - [x] carts 라우터에 `prefix="/carts"` 부여 (main.py 등록은 이미 있음), 전 엔드포인트 `get_current_user_id` 필수
- [x] Task 3: Flutter — 상품 상세 담기 활성화 (AC 1)
  - [x] 수량 스테퍼 신설 (1~999), 옵션 상품에서 조합 미선택 시 담기 버튼 비활성
  - [x] `product_detail_screen.dart:81` `FilledButton(onPressed: null)` 활성화 — 담기 API는 인증 경로(`noAuth` 없이) 호출, 성공 시 스낵바 + 장바구니 이동 액션
- [x] Task 4: Flutter — 장바구니 화면 (AC 2·3·4)
  - [x] 홈 AppBar에 장바구니 아이콘 → `Navigator.push` 진입 (BottomNavigationBar 신설은 하지 않음 — 화면 목록 밖 구조 변경)
  - [x] 단일 혼합 목록: 이미지·브랜드명·상품명·옵션·final_price·수량 스테퍼·삭제. 구매 불가 항목은 회색 처리 + "구매 불가" 뱃지 (숨기지 않음), 합계에서 제외됨을 표시
  - [x] 합계는 서버 값만 표시 (AD-12). 주문서 버튼 자리는 `onPressed: null` + "주문은 4.2·4.4" 주석 (3.5 패턴)
- [x] Task 5: 테스트 (`tests/test_carts.py` 신설 + `test_variants.py` upsert 보강)
  - [x] 담기·합산·수량 변경·삭제 / 타인 항목 404 (실제 제2 계정) / 품절·숨김 조합 담기 422 / 품절·숨김·조합 삭제 후 조회 시 purchasable false / upsert 후 cart_items 생존·제거된 조합 SET NULL / qty 0·음수·1000 초과 422 — **전체 78/78 통과 (신규 10)**
- [ ] Task 6: 배포 + Slur 실기 검증 — 프로덕션 E2E (R8, Dev Notes curl 시나리오): 담기→합산→수량 변경→판매자 웹에서 품절 처리→장바구니에서 구매 불가 확인→삭제. 테스트 데이터 즉시 정리

## Dev Notes

- **R5 스캔**: 3.3 보류 "PUT /variants 전체 교체는 variant id 전멸 — 4.1 착수 전 재검토 필수" → 이 스토리 Task 1에서 해소. 3.4 보류(상세 수정 페이지·IMG_BASE)·3.5 보류(페이지네이션)는 무관, 이월 유지
- **스코프 밖**: 배송비·주문서 미리보기(4.2, AD-11), 주문 생성·재고 차감(4.4), 찜·비회원 장바구니·재입고 알림(v1 제외). 주문 성공 시 cart_items 삭제는 orders 몫 (AD-10)

### cart_items 스키마 초안 (AD-9 — Slur 승인 대기)

| 컬럼 | 타입 | 제약 |
|---|---|---|
| id | UUID PK | uuid7 앱 생성 (`app.auth.models.uuid7`) |
| user_id | UUID FK→users | NOT NULL, ondelete=CASCADE, index |
| variant_id | UUID FK→variants | **NULLABLE, ondelete=SET NULL** |
| quantity | int | NOT NULL, CHECK 1~999 (`ck_cart_items_quantity`) |
| created_at / updated_at | timestamptz | |
| UNIQUE | (user_id, variant_id) | PG는 NULL 중복 허용 — SET NULL 후에도 안전 |

**SET NULL 근거**: FR-35는 "삭제된 항목도 구매 불가로 **표시**"를 요구 — CASCADE면 행이 소리 없이 사라져 표시 불가. variant_id NULL이면 `check_purchasable(product, None, qty)`가 이미 false를 반환(술어가 None 방어)하므로 추가 분기 최소. 단 NULL 항목은 상품 정보 조인 불가 → "판매 종료된 상품" 고정 문구로 표시. **대안(기각 추천)**: CASCADE(조용한 소멸 — FR-35 위반 소지), RESTRICT+soft delete(과설계)
**upsert 전환 근거**: 판매자가 그리드 재저장만 해도 전 구매자 장바구니가 끊기는 것을 방지. 동일 조합 = (option1_value, option2_value) 매칭

### 에러 code 시드 (R6)

| code | 상황 | HTTP | 클라이언트 반응 |
|---|---|---|---|
| `not_purchasable` | 담기·수량 변경 시 술어 실패 | 422 | 스낵바로 message 표시, 상세 화면 갱신 |
| `not_found` | 없는 variant·타인/없는 cart item | 404 | "삭제된 항목입니다" 스낵바 + 목록 갱신 |
| `validation_error` | qty 범위 밖 | 422 | 스테퍼가 1~999 강제하므로 방어적 |

`not_purchasable`은 `carts/service.py` 상단 `CODE_NOT_PURCHASABLE` 모듈 상수로 선언 (관례: 도메인 고유 code는 해당 service.py, 공통은 core/errors.py)

### 아키텍처·패턴 준수 (기존 코드가 정답 소스)

- **재사용**: `check_purchasable` (`products/service.py:183`, 동기 함수·세션 불필요) — carts에 판정 로직 중복 구현 금지 (AD-10). 호출은 products의 service 함수 경유만 (AD-2: carts→products·core만 의존)
- **담기 시점 재고 불변** (AD-4·FR-11): stock을 읽기만, 차감·soft reservation 절대 금지. 술어 docstring 경고대로 check-then-act 차감은 4.4의 조건부 UPDATE 몫
- 계층: router(얇게, response_model) → service(모듈 수준 async 함수, AppError·commit 소유) → schemas(`CartItemCreate`/`CartItemResponse`/`CartResponse`, 한국어 ValueError 검증)
- 인증: `get_current_user_id` (core/security.py) — 구매자 role 검사 불필요(로그인만 요구), 역할 팩토리는 seller/admin 전용
- Alembic head: `755424d010a0`(variants) 뒤에 체인. env.py 24~26행에 `app.carts.models` import 추가
- Flutter: Riverpod 3 + Dio(`apiClientProvider`) 관례, JSON은 `Map<String, dynamic>` raw (모델 클래스 없음), go_router 없음(`Navigator.push`), 장바구니 API는 `noAuth` extra 없이(토큰 자동 첨부·401 자동 refresh). 가격·합계·purchasable은 서버 값 표시만 (AD-12)
- R2 셀프체크 6종 통과 후 리뷰行: 이 스토리는 외부 호출 없음 — 동시성(합산 레이스)·입력 상한(qty 999)·타인 접근이 핵심

### 프로덕션 E2E curl 시나리오 (R8 — Task 6에서 실행)

로그인 토큰으로: ① POST 담기(qty 2) → ② 같은 조합 재담기(qty 1) → GET에서 qty 3 확인 → ③ PATCH qty 5 → ④ 판매자 웹에서 해당 조합 품절 토글 → GET에서 purchasable false·합계 제외 확인 → ⑤ DELETE → 빈 장바구니 확인. 종료 후 테스트 데이터 정리

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-4.1]
- [Source: architecture/…/ARCHITECTURE-SPINE.md#AD-2·AD-4·AD-8·AD-9·AD-10·AD-12·AD-13, 에러 봉투·API 규약]
- [Source: prd.md#FR-10·FR-11·FR-14·FR-35, NFR-1·NFR-3, §4 화면 목록]
- [Source: 3-3-variant-grid-stock.md#Completion-Notes(보류: variants 교체 전략), 3-5-buyer-product-browse.md#Dev-Notes]

## Dev Agent Record

### Agent Model Used

Claude Fable 5 (claude-fable-5)

### Debug Log References

### Completion Notes List

- AD-9 게이트 통과: cart_items 스키마(variant_id SET NULL)·variants upsert 전환 모두 Slur 승인 (2026-07-18). 마이그레이션 `7fceea006abe`는 alembic autogenerate 산출이 승인 초안과 컬럼·제약 단위로 일치함을 확인 후 로컬 적용
- 합산은 PG `INSERT ... ON CONFLICT (user_id, variant_id) DO UPDATE SET quantity = LEAST(quantity + n, 999)` — 동시 담기 레이스에도 행 중복·캡 초과 없음 (IntegrityError 재시도 루프보다 단순·원자적이라 선택)
- 담기·수량 변경의 술어 검증은 **요청 수량 기준** (합산 후 총량 아님) — 합산 총량이 재고를 넘는 경우는 GET이 purchasable false로 정직하게 반영하고, 최종 진실은 4.4 주문 생성의 재검증·조건부 UPDATE가 소유
- upsert 전환으로 기존 test_variants 6종 통과 유지 + id 보존·부분 삭제 테스트 2종 추가. 장바구니 쪽은 조합 삭제 시 SET NULL 생존("판매 종료된 상품" 표시)까지 테스트로 고정
- **의도적 보류**: ① 장바구니 개수 뱃지(홈 아이콘) — PRD 화면 목록 밖 장식, 필요 시 제안 ② 주문서 버튼은 자리만(4.2·4.4에서 해소) ③ NULL 항목(판매 종료)은 정리 액션이 삭제뿐 — 일괄 정리는 실사용 피드백 후
- R2 셀프체크: 외부 호출 없음 / 실패 로깅은 전역 핸들러 / 합산 레이스 원자적 upsert / qty 1~999 서버·클라 양쪽 강제 / 외부 응답·토큰 해당 없음

### File List

- apps/api/app/carts/models.py (신규 — CartItem)
- apps/api/app/carts/schemas.py (신규)
- apps/api/app/carts/service.py (신규)
- apps/api/app/carts/router.py (수정 — prefix·엔드포인트 4종)
- apps/api/app/products/service.py (수정 — replace_variants upsert 전환, get_variant_purchase_info 신설)
- apps/api/alembic/env.py (수정 — carts models import)
- apps/api/alembic/versions/7fceea006abe_cart_items.py (신규)
- apps/api/tests/test_carts.py (신규 — 8 테스트)
- apps/api/tests/test_variants.py (수정 — upsert 테스트 2종 추가)
- apps/mobile/lib/src/carts/carts_api.dart (신규)
- apps/mobile/lib/src/carts/cart_screen.dart (신규)
- apps/mobile/lib/src/products/product_detail_screen.dart (수정 — 수량 스테퍼·담기 활성화)
- apps/mobile/lib/src/screens/home_screen.dart (수정 — 장바구니 아이콘)
