---
baseline_commit: 22483cc91de4ff16dd3ad71930cd9d5bbec10cf9
---

# Story 4.2: 주문 데이터 모델과 배송비 계산 (주문서 미리보기)

Status: done

## Story

As a 구매자,
I want 주문 전에 상품 합계·배송비·도서산간 추가비가 정확히 계산된 금액을 보는 것,
so that 얼마를 입금해야 하는지 미리 안다.

## Acceptance Criteria

1. **Given** 주문 도메인 데이터 모델 (`orders`·`sub_orders`·`order_items`·`remote_area_zips`·`settings` 마이그레이션 — AD-9 승인 절차 경유) **When** 마이그레이션 실행 **Then** `remote_area_zips`는 우체국/택배사 공개 목록 기반으로, `settings`는 입금 계좌·미입금 기한(3일)·품절 임박 기준(5)으로 시드된다 (v1 값 변경은 시드/DB로 — 관리자 설정 화면은 v1 제외, AD-13)
2. **Given** 구매 가능 항목이 담긴 장바구니와 배송지 우편번호 **When** 주문서 미리보기 API 호출 **Then** 판매자별 배송비(판매자 설정 + 도서산간 판정)와 상품 합계·총액이 계산되어 반환된다 — 계산은 orders 도메인의 함수 하나가 소유한다 (AD-11)
3. **And** Flutter 주문서 화면에 상품 합계 + 배송비 + 도서산간 추가비 요약이 청약 전에 표시된다 (FR-16) — 화면의 모든 금액은 백엔드 응답 값만 표시한다 (AD-12)
4. **And** 구매 불가 항목은 미리보기 대상에서 제외된다 (판정은 `check_purchasable` 재사용 — AD-10, FR-35)

## Tasks / Subtasks

- [x] Task 0 (AD-9 게이트): 스키마 초안 승인 — Dev Notes의 5개 테이블 초안 표(결정 포인트 2건 포함)를 Slur에게 제시하고 승인받은 뒤에만 마이그레이션 작성. 승인 후 `alembic/env.py`에 orders models import 추가 — **Slur 승인 2026-07-20 (결정 ① NULL, 결정 ② SET NULL 모두 추천안 채택)**
- [x] Task 1: 마이그레이션 + 시드 (AC 1)
  - [x] `orders`·`sub_orders`·`order_items`·`remote_area_zips`·`settings` 생성 — down_revision `7fceea006abe` 뒤에 체인. autogenerate 산출이 승인 초안과 컬럼·제약 단위로 일치함을 확인 후 적용 (4.1 관례)
  - [x] `remote_area_zips` 시드: 제주(63000~63644 범위) + 도서 지역 우편번호 — 우체국/CJ대한통운 공개 도서산간 목록 기반 CSV를 `apps/api/app/orders/data/`에 번들, 마이그레이션에서 `op.bulk_insert`. 출처·기준일을 CSV 헤더 주석과 Dev Notes에 기록 — 총 870행 (jeju 645, island 225)
  - [x] `settings` 시드 3행: `deposit_account`(placeholder — 실계좌 값은 Slur 제공 후 DB 갱신), `unpaid_cancel_days`="3", `low_stock_threshold`="5"
- [x] Task 2: 배송비 계산 함수 — orders 도메인 단일 소유 (AC 2, AD-11)
  - [x] `orders/service.py`의 `quote()` 하나: 구매 가능 항목 → 판매자별 그룹핑 + `base_shipping_fee` + 도서산간 판정(jeju→`jeju_extra_fee`, island→`island_extra_fee`) → 판매자별 배송비·상품 합계·총액. 판매자 설정은 `sellers_service.get_sellers_by_ids` 경유 (AD-2)
  - [x] 도서산간 판정은 `get_remote_area_kind` — 우편번호 exact match 단일 조회
- [x] Task 3: 주문서 미리보기 API (AC 2·4)
  - [x] `POST /api/v1/orders/preview` (인증 필수): 구매 가능 항목만(`check_purchasable` — AD-10) → `quote()` → 응답. **계약 확정: `shipping_total`은 기본 배송비 합, `remote_extra_total` 별도 필드** (요약 행 분리 표시용 — 도서산간 추가비 합산도 서버 소유, AD-12)
  - [x] 구매 가능 항목 0개(빈 장바구니 포함) 422 `empty_cart`, 우편번호 형식 위반 422 `validation_error`
  - [x] 장바구니 접근은 `carts_service.get_purchasable_entries` 신설 경유 (AD-2), `get_variant_purchase_info` 배치 조회 재사용
- [x] Task 4: Flutter 주문서(미리보기) 화면 (AC 3)
  - [x] 장바구니 주문서 버튼 활성화 — purchasable 항목 1개 이상일 때만 진입 (0원 항목 이슈 회피 위해 합계가 아닌 항목 존재로 판정)
  - [x] 주문서 화면: 우편번호 5자리 입력(자동 조회 + 버튼) → 판매자별 묶음 카드 + 하단 요약 4행(전부 서버 값 `formatWon`). 도서산간 안내 문구, `empty_cart`는 스낵바 후 복귀. flutter analyze 오류 0
  - [x] 주문 버튼은 자리만 `onPressed: null` + "주문 생성은 4.4" 주석. 카카오 우편번호 검색 위젯은 4.4
- [x] Task 5: 테스트 (`tests/test_orders_preview.py` 신설)
  - [x] 시드 검증(제주 경계 63644 포함·도서·일반) / 다중 판매자 그룹핑·판매자별 배송비 합산·판매자별 제주 추가비 합 / 무료 배송 / 제주·도서 추가비 / 구매 불가 제외 / 전부 불가·빈 장바구니 422 `empty_cart` / 우편번호 형식 5종 422 / 미인증 401 — **전체 87/87 통과 (신규 9)**
- [ ] Task 6: 배포 + Slur 실기 검증 — 프로덕션 E2E (R8, Dev Notes curl 시나리오). 테스트 데이터 즉시 정리

## Dev Notes

- **R5 스캔 (4.1 이월 목록)**: ① 장바구니 "주문서 버튼 자리만" 보류 → **이 스토리 Task 4에서 해소**. ② variants upsert flush 순서·IntegrityError 문자열 매칭·race 테스트 부재 등 나머지는 이 스토리와 무관 — `deferred-work.md` 이월 유지
- **스코프 밖**: 주문 생성·재고 차감·장바구니 삭제(4.4), 상태 전이 엔진·`order_events`·`cancellations` 마이그레이션(4.3), 미입금 자동취소(4.5), 카카오 우편번호 검색 위젯(4.4), 관리자 설정 화면(v1 제외), PG·정산(오픈 게이트)
- **이 스토리의 런타임 기능은 미리보기·시드뿐** — `orders`·`sub_orders`·`order_items`에 행을 쓰는 코드는 없다 (쓰기는 4.4). 마이그레이션은 4.3·4.4가 스키마 재변경 없이 진행되도록 완결적으로 설계한다

### 스키마 초안 (AD-9 — Slur 승인 대기)

공통: PK는 UUIDv7 앱 생성(`app.auth.models.uuid7`), 금액은 원 단위 정수, 시간은 timestamptz, enum은 CHECK+문자열 (AD-8·규약)

**orders** — 결제 상태 층 (AD-3)

| 컬럼 | 타입 | 제약 |
|---|---|---|
| id | UUID PK | uuid7 |
| user_id | UUID FK→users | NOT NULL, **ondelete=RESTRICT** (주문 이력은 법정 보존 대상 — 탈퇴 정책은 후속) , index |
| payment_status | String(20) | NOT NULL, default `pending_payment`, CHECK (`pending_payment`,`paid`,`canceled`) — 전이표는 4.3 |
| recipient_name / recipient_phone | String(50)/String(20) | NOT NULL (4.4가 채움 — 스키마만 선행) |
| postal_code | String(5) | NOT NULL |
| address1 / address2 | String(255)/String(255) | NOT NULL / 빈 문자열 허용 |
| order_note | String(500) | NOT NULL, default '' (배송 요청사항) |
| deposit_due_at | timestamptz | NOT NULL (생성 시각 + settings `unpaid_cancel_days`) |
| paid_at | timestamptz | NULLABLE |
| created_at / updated_at | timestamptz | |

주문 총액 컬럼 없음 — 스냅샷(order_items 단가·수량, sub_orders 배송비)에서 결정적으로 파생 (AD-12). 입금 안내 금액도 같은 파생 값

**sub_orders** — 판매자별 배송 상태 층 (AD-3·AD-11)

| 컬럼 | 타입 | 제약 |
|---|---|---|
| id | UUID PK | uuid7 |
| order_id | UUID FK→orders | NOT NULL, ondelete=CASCADE, index |
| seller_id | UUID FK→sellers | NOT NULL, ondelete=RESTRICT, index |
| shipping_status | String(20) | **NULLABLE**, CHECK (`preparing`,`shipping`,`delivered`) — 결제 전 NULL, `paid` 전이 시 4.3 전이 함수가 `preparing` 진입 (결정 포인트 ① 아래) |
| shipping_fee | int | NOT NULL, CHECK >= 0 — 기본 배송비 스냅샷 (AD-11) |
| remote_extra_fee | int | NOT NULL, default 0, CHECK >= 0 — 도서산간 추가비 스냅샷 |
| carrier / tracking_number | String(50)/String(50) | NULLABLE (5.3 배송 처리용 — 재변경 방지 선행) |
| created_at / updated_at | timestamptz | |
| UNIQUE | (order_id, seller_id) | 주문 내 판매자 묶음 1개 |

**order_items** — 스냅샷 + 취소 상태 층 (AD-6·AD-7)

| 컬럼 | 타입 | 제약 |
|---|---|---|
| id | UUID PK | uuid7 |
| sub_order_id | UUID FK→sub_orders | NOT NULL, ondelete=CASCADE, index |
| variant_id | UUID FK→variants | **NULLABLE, ondelete=SET NULL** (결정 포인트 ② 아래) |
| product_name | String(100) | NOT NULL — 주문 시점 스냅샷 |
| option_text | String(120) | NOT NULL, default '' (표시 문자열 스냅샷, carts 포맷과 동일) |
| unit_price | int | NOT NULL, CHECK >= 0 (base_price 스냅샷) |
| extra_price | int | NOT NULL, default 0 (조합 추가금액 스냅샷 — 음수 허용) |
| quantity | int | NOT NULL, CHECK 1~999 (carts 대칭) |
| status | String(20) | NOT NULL, default `ordered`, CHECK (`ordered`,`canceled`) — 취소 전이는 4.3 |
| created_at | timestamptz | |

**remote_area_zips** — 독립 참조 테이블

| 컬럼 | 타입 | 제약 |
|---|---|---|
| zip_code | String(5) PK | 우편번호 자체가 자연키 |
| kind | String(10) | NOT NULL, CHECK (`jeju`,`island`) — sellers의 `jeju_extra_fee`/`island_extra_fee` 이원 설정과 1:1 |
| region_name | String(100) | NOT NULL (근거 표시·관리용) |
| updated_at | timestamptz | |

**settings** — 독립 key-value 테이블 (AD-13)

| 컬럼 | 타입 | 제약 |
|---|---|---|
| key | String(50) PK | |
| value | Text | NOT NULL (타입 해석은 orders/core service 몫) |
| description | String(200) | NOT NULL |
| updated_at | timestamptz | |

**결정 포인트 (R4 — 그 자리에서 결정·기록)**
① `sub_orders.shipping_status` NULL(결제 전) vs `awaiting_payment` 값 추가 — **NULL 추천**: 배송 상태 기계는 3값으로 순수하게 유지, "결제 전" 표현은 orders.payment_status가 이미 소유(중복 상태 방지). 기각 대안: `awaiting_payment` 4번째 값(두 층이 같은 사실을 이중 표현 — AD-6 파생 원칙 위배 소지)
② `order_items.variant_id` SET NULL vs RESTRICT — **SET NULL 추천**: RESTRICT면 활성 주문이 있는 조합을 판매자가 그리드 재저장으로 삭제 시 저장 전체 실패(판매자 UX 파탄). NULL이면 취소 시 재고 복원 대상이 없어 복원 no-op — 스냅샷 표시는 불변이라 구매자 화면 무영향, 이미 삭제된 조합의 재고 복원은 의미 자체가 없음. cart_items SET NULL 선례와 일관

### 에러 code 시드 (R6)

| code | 상황 | HTTP | 클라이언트 반응 |
|---|---|---|---|
| `empty_cart` | 구매 가능 항목 0개로 미리보기 요청 | 422 | 스낵바 + 장바구니로 복귀 |
| `validation_error` | 우편번호 형식(숫자 5자리) 위반 | 422 | 필드 오류 표시 (입력이 5자리 강제하므로 방어적) |
| `unauthorized` | 미인증 | 401 | 기존 401 자동 refresh 흐름 |

`empty_cart`는 `orders/service.py` 상단 모듈 상수 (4.1 `CODE_NOT_PURCHASABLE` 관례)

### 아키텍처·패턴 준수 (기존 코드가 정답 소스)

- **AD-11**: 배송비·도서산간 계산 함수는 `orders/service.py`에 정확히 하나. 4.4는 이 함수 결과를 `sub_orders`에 스냅샷하고, 미리보기는 같은 함수 결과를 응답으로만 내린다 — 두 경로의 금액이 구조적으로 동일해진다
- **AD-2 의존 방향**: orders→carts·products·sellers·core만. 장바구니 항목은 carts service 함수로 읽고(모델 직접 import 금지), 구매 가능 판정은 `products_service.check_purchasable`(`products/service.py:224`, 동기 함수) + `get_variant_purchase_info` 배치 조회 재사용 (AD-10, 4.1 `carts/service.py:51~83` `get_cart` 패턴 참조)
- **재고 불변**: 이 스토리는 stock을 읽기만 한다. 차감·예약 절대 금지 (AD-4 — 4.4의 조건부 UPDATE 몫)
- 계층: router(얇게, response_model) → service(모듈 수준 async 함수, AppError·commit 소유) → schemas(Pydantic, 한국어 ValueError). `orders/router.py`는 현재 빈 APIRouter — `prefix="/orders"` 부여 (main.py 등록은 이미 있음, `main.py:49`)
- 인증: `get_current_user_id` — 로그인만 요구 (구매자 role 검사 없음, 4.1 관례)
- settings 읽기: orders service에 `get_setting(session, key)` 헬퍼 — AD-13에 따라 기한 3일·품절 임박 5 리터럴을 도메인 로직에 쓰지 않는다. `deposit_due_at` 계산(4.4)·자동취소(4.5)·대시보드(5.4)가 이 헬퍼를 재사용
- Alembic: head `7fceea006abe`(cart_items) 뒤에 체인. `env.py`에 `app.orders.models` import 추가. 시드는 마이그레이션 내 `op.bulk_insert` (다운그레이드는 테이블 drop으로 충분 — 4.1 관례)
- Flutter: Riverpod 3 + Dio(`apiClientProvider`), raw `Map<String, dynamic>`, `Navigator.push`, `formatWon`(`lib/src/format.dart` — 4.1에서 공통화됨). 금액·판정은 서버 값 표시만 (AD-12). RefreshIndicator를 쓴다면 `() async { await ...; }` 명시 형식 (4.1 defer 항목 — 신규 코드는 처음부터 준수)
- R2 셀프체크 6종 후 리뷰行: 외부 호출 없음(도서산간 판정은 로컬 테이블) / 실패 로깅은 전역 핸들러 / 동시성 위험 낮음(읽기 전용 API) / 입력 상한(postal_code 5자리·body 크기) / 이형 방어 해당 없음 / 토큰 해당 없음

### 도서산간 시드 데이터 가이드

- 제주: 63000~63644 전 구간 `kind=jeju` (범위 전개해 행으로 시드 — 판정을 exact match 단일 조회로 유지)
- 도서: 우체국 "도서지역 안내" / CJ대한통운 도서산간 추가요금 지역 공개 목록 기준 `kind=island` (인천 옹진, 백령·연평, 울릉·독도, 전남 신안·완도·진도 부속도서, 경남 통영 부속도서 등). 웹에서 최신 목록 확보 후 CSV로 정리, 출처 URL·기준일 기록
- 연륙교 연결 지역(강화·거제·영종 등)은 대부분 택배사 기준 일반 지역 — 목록에 없는 우편번호는 일반 판정이 기본값이므로 과포함보다 과소포함이 안전 (추가비 과청구 방지)

### 프로덕션 E2E curl 시나리오 (R8 — Task 6에서 실행)

로그인 토큰으로: ① 장바구니에 2개 판매자 상품 담기 → ② POST /orders/preview 일반 우편번호(예: 06236) — 판매자별 그룹 2개·배송비 합산·remote_extra_fee 0 확인 → ③ 제주 우편번호(63001) — jeju 추가비 반영 확인 → ④ 도서 우편번호(시드 목록 중 1개) — island 추가비 확인 → ⑤ 판매자 웹에서 한 상품 품절 → preview에서 해당 그룹 제외 확인 → ⑥ 전부 품절 시 422 `empty_cart` 확인 → 테스트 데이터 정리

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-4.2 (431~446행)]
- [Source: architecture/…/ARCHITECTURE-SPINE.md#AD-2·AD-8·AD-9·AD-10·AD-11·AD-12·AD-13, ERD 18테이블, 환경·운영(도서산간 판정 데이터)]
- [Source: prd.md#FR-16·FR-17·FR-35, addendum.md#도서산간 판정]
- [Source: 4-1-cart.md#Dev-Notes·Completion-Notes (upsert·SET NULL 선례, get_cart 배치 조회 패턴), 2-3-seller-shipping-fee (sellers 3필드)]

## Dev Agent Record

### Agent Model Used

Claude Fable 5 (claude-fable-5) — Flutter 화면은 병렬 서브에이전트 구현

### Debug Log References

### Completion Notes List

- AD-9 게이트 통과: 5개 테이블 초안 + 결정 포인트 2건 Slur 승인 (2026-07-20) — ① sub_orders.shipping_status 결제 전 NULL, ② order_items.variant_id SET NULL. 마이그레이션 `0275fa5bfee4`는 autogenerate 산출이 승인 초안과 컬럼·제약 단위로 일치함을 확인 후 시드만 수기 추가
- 도서산간 시드 출처: 택배사 공통 기준표(campaignus/imweb 게시본, 2026-07-20 확인). 원본 오탈자 2건 교차 확인 후 보정: "경남 통영 54000"→전북 군산 섬지역, "전남 신안 28826"→58826. 연륙교 연결 지역은 미포함 — 목록에 없으면 일반 판정 (추가비 과청구 방지 원칙)
- 응답 계약 확정: `shipping_total`(기본 배송비 합)과 `remote_extra_total`(도서산간 추가비 합)을 분리 — 요약 4행(상품/배송/도서산간/총액)의 표시용 합산까지 서버가 소유 (AD-12). Flutter 병행 에이전트의 계약 모호성 지적을 반영한 결정
- AD-2 준수를 위해 인접 도메인에 service 함수 2개 신설: `carts.get_purchasable_entries`(구매 가능 항목만 — 4.4 주문 생성도 재사용 예정), `sellers.get_sellers_by_ids`(배치 조회). orders는 타 도메인 모델을 직접 import하지 않는다
- `quote()`가 배송비·총액 계산의 유일 소유자 (AD-11) — 미리보기는 결과를 응답으로, 4.4는 같은 결과를 sub_orders에 스냅샷
- **의도적 보류**: ① 주문하기 버튼 자리만(4.4 해소) ② 카카오 우편번호 검색 위젯(4.4) ③ deposit_account 실계좌 값 — Slur 제공 후 프로덕션 DB 갱신 필요 ④ remote_area_zips 관리자 갱신 화면 없음(v1 제외, DB 직접 갱신) ⑤ settings 캐시 없음 — 호출 빈도 낮아 매 조회, 필요 시 후속
- R2 셀프체크: 외부 호출 없음(판정은 로컬 테이블) / 실패 로깅 전역 핸들러 / 읽기 전용이라 동시성 위험 낮음 / postal_code 5자리 pattern 상한 / 이형·토큰 해당 없음
- Task 6(배포+Slur 실기 검증)은 4.1 관례대로 리뷰 후 진행

### File List

- apps/api/app/orders/models.py (신규 — Order·SubOrder·OrderItem·RemoteAreaZip·Setting)
- apps/api/app/orders/schemas.py (신규)
- apps/api/app/orders/service.py (신규 — get_setting·get_remote_area_kind·quote·preview_order)
- apps/api/app/orders/router.py (수정 — prefix·POST /preview)
- apps/api/app/orders/data/remote_area_zips.csv (신규 — 시드 870행)
- apps/api/app/carts/service.py (수정 — get_purchasable_entries 신설)
- apps/api/app/sellers/service.py (수정 — get_sellers_by_ids 신설)
- apps/api/alembic/env.py (수정 — orders models import)
- apps/api/alembic/versions/0275fa5bfee4_orders_domain_and_settings.py (신규 — 5테이블 + 시드)
- apps/api/tests/test_orders_preview.py (신규 — 9 테스트)
- apps/mobile/lib/src/orders/orders_api.dart (신규)
- apps/mobile/lib/src/orders/order_preview_screen.dart (신규)
- apps/mobile/lib/src/carts/cart_screen.dart (수정 — 주문서 버튼 활성화)

### Review Findings

**BMAD 코드리뷰 (2026-07-20) — Blind Hunter · Edge Case Hunter · Acceptance Auditor 병렬 리뷰. 0 decision-needed · 13 patch · 6 defer · 4 dismiss.**

- [x] [Review][Patch] 묶음 배송비 클라이언트 합산 — AD-12 위반 소지: 그룹별 배송비 합계도 서버 필드로 [`order_preview_screen.dart`, `orders/schemas.py`]
- [x] [Review][Patch] `empty_cart` pop 후 장바구니 stale — pop 전 cartProvider invalidate [`order_preview_screen.dart:38~41`]
- [x] [Review][Patch] 시드 CSV 강건화 — BOM(utf-8-sig)·5자리 형식·중복·행 수 검증 후 실패 fast [`alembic/versions/0275fa5bfee4`]
- [x] [Review][Patch] 테스트 seller2 id를 `ORDER BY created_at DESC LIMIT 1` 추정 대신 brand_name 정확 조회로 [`tests/test_orders_preview.py`]
- [x] [Review][Patch] 조회 중 우편번호 재입력 시 드롭 — 응답 후 입력과 불일치면 재조회 [`order_preview_screen.dart:28`]
- [x] [Review][Patch] `get_purchasable_entries` 정렬을 `get_cart`와 동일(desc)로 — 4.4 스냅샷 순서 대비 [`carts/service.py`]
- [x] [Review][Patch] `_option_text` carts·orders 복붙 중복 — variant 소유자인 products로 승격 [`orders/service.py`, `carts/service.py`]
- [x] [Review][Patch] `quote()` seller 누락 레이스 시 raw KeyError 500 — 명시적 internal_error 방어 [`orders/service.py:66`]
- [x] [Review][Patch] `ix_sub_orders_order_id`가 UNIQUE(order_id, seller_id)와 중복 — 제거 [`orders/models.py`, 마이그레이션]
- [x] [Review][Patch] `remote_area_kind`를 `Literal["jeju","island"] | None`으로 [`orders/schemas.py:35`]
- [x] [Review][Patch] 도서산간 안내 문구가 추가비 0원에도 표시 — 조건을 `remote_extra_total > 0`으로 [`order_preview_screen.dart:78~83`]
- [x] [Review][Patch] `ApiException` 외 예외 미포착 — 무반응 실패 방지 [`order_preview_screen.dart`, `orders_api.dart`]
- [x] [Review][Patch] 경계 테스트 공백 — 62999·63645·앞자리 0 우편번호 보강 [`tests/test_orders_preview.py`]
- [x] [Review][Defer] 마이그레이션이 app 트리 CSV를 런타임에 읽음 — 리비전 불변성 원칙 위배 소지. v1 단일 환경에선 무해(검증 patch로 완화), 블루프린트 추출 시 시드 분리 검토
- [x] [Review][Defer] 시드 출처가 서드파티 재게시본 — 공식 우체국/CJ대한통운 목록과 표본 대조 후속. 오탈자 2건은 교차 보정됨
- [x] [Review][Defer] remote_area_zips 갱신 운영 절차 부재 — 신규 우편번호 배정·목록 개정 시 과소청구 감지 장치 없음. 실서비스 오픈 게이트에서 점검 항목으로
- [x] [Review][Defer] `deposit_account` placeholder 가드 없음 — **4.4 선행 조건: 주문 완료 화면 구현 전 실계좌 값 DB 갱신 확인 Task 필수**
- [x] [Review][Defer] 우편번호 실존 여부 미검증 — 형식만 통과하면 일반 지역 계산. 4.4 카카오 우편번호 위젯 도입으로 해소 예정, 4.4 스토리에 명시 이월
- [x] [Review][Defer] 장바구니 행 수 상한 없음 — 미리보기 IN 절·응답 크기 무상한. 읽기 전용이라 실해 낮음, 실사용 피드백 후
