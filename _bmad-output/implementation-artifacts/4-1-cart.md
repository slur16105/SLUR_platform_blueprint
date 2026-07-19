---
baseline_commit: c7bc8b6e1918561f94c5ab865a826a72146de9a8
---

# Story 4.1: 장바구니

Status: done

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

**SET NULL 근거**: FR-35는 "삭제된 항목도 구매 불가로 **표시**"를 요구 — CASCADE면 행이 소리 없이 사라져 표시 불가. NULL 항목은 variant·product 조인 불가 → `get_cart`가 `meta is None` 분기에서 술어 호출 없이 "판매 종료된 상품" 고정 dict을 만든다 (`service.py:56~63`). **대안(기각 추천)**: CASCADE(조용한 소멸 — FR-35 위반 소지), RESTRICT+soft delete(과설계)
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

### Review Findings

**BMAD 코드리뷰 (2026-07-19) — Blind Hunter · Edge Case Hunter · Acceptance Auditor 병렬 리뷰. 3 decision-needed · 4 patch · 8 defer · 23 dismiss.**

- [x] [Review][Decision→Defer] 합산 후 총량이 재고 초과해도 담기 성공 — 스토리 Completion Notes에서 이미 policy로 확정("담기 응답은 성공, GET이 purchasable false로 정직히 반영, 4.4가 최종 진실"). Slur 리뷰에서 현행 유지 승인 (2026-07-19). 4.4 주문 생성에서 조건부 UPDATE로 최종 진실 확보
- [x] [Review][Decision→Defer] variants upsert flush 순서 임시 UNIQUE 위반 위험 — 완화 시 재저장 로직 재구조화(삭제 flush 선행) 필요. 3.4·3.5에서 확정된 흐름 변경 → 스토리 4.1 범위 밖. Slur 리뷰에서 현행 유지 승인 (2026-07-19). 별도 스토리로 승격 후보
- [x] [Review][Decision→Defer] Flutter `guard()` finally 무조건 `invalidate` — UX 취향 결정. 실패-스낵바-refresh 튐 vs 서버-클라 정합 보장의 트레이드오프. 현행이 정합성 편에 서 있어 유지. Slur 리뷰에서 현행 유지 승인 (2026-07-19)
- [x] [Review][Patch] `add_item`의 IntegrityError 미처리로 담기 중 조합 삭제 시 500 [`apps/api/app/carts/service.py`] — `try/except IntegrityError`로 감싸 `not_found` 404로 변환 (`replace_variants`·`create_product` 패턴과 대칭)
- [x] [Review][Patch] Flutter `_won` 헬퍼 4곳 중복 [`carts/cart_screen.dart`, `products/product_detail_screen.dart`, `screens/home_screen.dart`] — `apps/mobile/lib/src/format.dart`로 승격, `formatWon()` 공통 사용
- [x] [Review][Patch] Unused logger 제거 [`apps/api/app/carts/service.py`] — `logger = logging.getLogger("slur.carts")` 및 `import logging` 제거
- [x] [Review][Patch] Dev Notes 문서-코드 불일치 정정 [`4-1-cart.md`] — SET NULL 근거 문구를 실제 `get_cart` 분기 흐름(`meta is None`에서 술어 호출 없이 fallback dict 생성)에 맞게 재작성
- [x] [Review][Defer] IntegrityError 원인 판정 문자열 매칭 취약 [`products/service.py:179`] — `exc.orig.diag.constraint_name` 기반으로 승격 후보. 실용상 PG 메시지 안정적이라 즉시 위험 없음
- [x] [Review][Defer] 담기 합산·캡의 race 테스트 부재 [`tests/test_carts.py:159~172`] — 순차 담기만 검증. `asyncio.gather()`로 병행 담기 시 원자적 upsert·999 캡 안전성 회귀 봉인 테스트 후속
- [x] [Review][Defer] Alembic downgrade가 cart_items를 drop만 함 [`alembic/versions/7fceea006abe_cart_items.py:41~46`] — 프로덕션 롤백 시 카트 데이터 유실. 일반 alembic 관행이며 v1 완주엔 지장 없음
- [x] [Review][Defer] AD-13: `999` 리터럴 4곳 확산 [`carts/service.py:16`, `carts/models.py:22`, `carts/schemas.py:8,12`, `cart_screen.dart:140,144`, `product_detail_screen.dart:116`] — 스토리 스펙이 "1~999 서버·클라 양쪽 강제"로 고정했으므로 v1 지장 없음. 블루프린트 추출 시 `core/config`로 승격
- [x] [Review][Defer] RefreshIndicator future await 형식 [`cart_screen.dart:27`] — `onRefresh: () async => ref.refresh(cartProvider.future)`가 arrow 함수라 반환된 Future를 자동 await하지 않아 스피너가 조기 dismiss 가능. `() async { await ref.refresh(cartProvider.future); }` 명시 형식이 안전
- [x] [Review][Defer] 사용자 이탈 후 API 실패 시 스낵바 유실 [`cart_screen.dart:92~95`] — `context.mounted == false`면 오류 표시 없이 무음. 로깅·재시도 큐 후속
- [x] [Review][Defer] PATCH `quantity=1000` 방어 테스트 부재 — 스테퍼가 강제하므로 실용 영향 없으나 API 계약 회귀 봉인 후보
- [x] [Review][Defer] variants upsert 매칭이 exact match — 대소문자·strip 이후 남는 공백만 다르면 다른 조합으로 취급되어 SET NULL 조용한 소멸 위험 [`products/service.py:158`]. UX 가이드(대소문자 표기 통일) + 판매자 저장 시 정규화 후속
