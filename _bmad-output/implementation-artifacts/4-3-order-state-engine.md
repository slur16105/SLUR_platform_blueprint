---
baseline_commit: 1e4604b2457f8a7689bb7c82f6e4c06738f295b7
---

# Story 4.3: 주문 상태 전이 엔진

Status: review

## Story

As a 운영자,
I want 주문 상태가 정의된 규칙으로만 바뀌는 것,
So that 어떤 화면·코드 경로에서도 무결성이 깨지지 않는다.

## Acceptance Criteria

1. **Given** 3층 전이표(orders 결제 / sub_orders 배송 / order_items 취소, 허용 역할 포함)가 orders 도메인에 **데이터로** 선언됨 — `pending_payment`→`paid`→(sub_orders) `preparing`→`shipping`→`delivered`, `confirmed`(구매확정)는 값만 정의·v1 미사용(FR-20), 취소 전이 포함 (FR-18)
2. **When** 미정의 전이·미허용 역할로 전이 시도 **Then** 에러 봉투로 거부된다 (FR-19)
3. **And** 상태 컬럼을 직접 UPDATE하는 코드가 전이 함수 밖에 존재하지 않는다 (코드 검사로 확인)
4. **And** 모든 전이 성공이 `order_events`에 기록된다 (누가·언제·무엇을) — `order_events`·`cancellations` 마이그레이션 포함 (AD-9 승인 절차 경유)
5. **And** 라인 취소 확정 트랜잭션에서 재고 복원(조건부 UPDATE +n, 정확히 1회)과 `cancellations` 기록이 함께 일어난다 (AD-4·AD-6 — 4.5·4.6은 이 경로를 호출만 한다)

## Tasks / Subtasks

- [x] Task 0 (AD-9 게이트): `order_events`·`cancellations` 스키마 초안(Dev Notes 표)을 Slur에게 승인받은 뒤에만 마이그레이션 작성. 승인 후 autogenerate 일치 확인 (관례)
- [x] Task 1: 전이표 데이터 선언 (AC 1)
  - [x] `orders/transitions.py` 신설 — `TRANSITIONS: dict[(layer, from, to) → allowed_roles]` 순수 데이터 + 상태 상수. `confirmed`는 상수만 정의, 전이표에 미등록(도달 불가 = v1 미사용). 층: `order`(pending_payment→paid, pending_payment→canceled), `sub_order`(None→preparing→shipping→delivered), `order_item`(ordered→canceled)
  - [x] 층 넘는 가드도 같은 모듈에 함수로: ① buyer 라인 취소는 소속 sub_order가 preparing 진입 전(shipping_status IS NULL)일 때만 ② shipping 진입은 송장 정보 필수(carrier·tracking_number) ③ system은 pending_payment 주문에만. **admin의 가드 예외는 ①(타이밍 가드)에 한정 — 송장 가드 ②는 admin에게도 적용** (FR-21: 송장은 구매자 표시 데이터, 빈 값 허용 불가)
- [x] Task 2: 단일 전이 함수 (AC 2·4)
  - [x] `orders/service.py`에 `transition(session, *, layer, entity, to_status, actor_role, actor_user_id, note="", carrier=None, tracking_number=None)` 하나 — 전이표 조회(미정의 422 `invalid_transition`, 역할 불허 403 `forbidden`), 가드 실행, 상태 변경, `order_events` INSERT까지 한 트랜잭션. commit은 호출자 소유(다건 전이 조합 대비 flush만). **shipping 전이 시 carrier·tracking_number 컬럼 기록도 transition()이 소유** — 5.3은 인자로 넘기기만 한다 (상태와 송장이 따로 노는 반쪽 전이 방지)
  - [x] `pending_payment→paid` 성공 시 같은 트랜잭션에서 소속 sub_orders 연쇄 `None→preparing` 전이(각각 order_events 기록) + `orders.paid_at` 기록. **단, 전 라인이 canceled인 sub_order는 연쇄에서 제외** — 부분 취소된 묶음이 판매자에게 "배송준비" 유령 주문으로 노출되는 것 방지 (4.6 부분 취소 후 입금 확인 시나리오)
- [x] Task 3: 라인 취소 경로 (AC 5)
  - [x] `cancel_order_item(session, item, *, actor_role, actor_user_id, reason, responsibility)` — `transition()`으로 ordered→canceled 후 같은 트랜잭션에서: variant_id 있으면 재고 복원 `UPDATE variants SET stock = stock + qty`(조건부 UPDATE 대칭, AD-4 — 전이 함수 경로가 유일한 재고 증감 소유자), `cancellations` INSERT(사유·귀책·취소 시각, refunded_at은 NULL)
  - [x] variant_id NULL(조합 삭제됨)이면 복원 no-op — 4.2 결정 ② 준수
  - [x] 중복 취소 방어: 이미 canceled인 라인 재취소는 전이표가 자연 거부(canceled→canceled 미정의)
- [x] Task 4: 직접 UPDATE 금지 검사 (AC 3)
  - [x] `tests/test_order_transitions.py`에 코드 검사 테스트: `app/` 전체에서 상태 컬럼(`payment_status`·`shipping_status`·OrderItem의 `status`) **대입/UPDATE가 전이 함수 경로 밖에 없는지** 검증 — 단순 grep 한 줄이 아니라 AST 파싱 또는 대입 패턴(`\.status\s*=`, `payment_status\s*=`, `update(...).values(...status...)`)을 넉넉히 잡고 허용 파일(`orders/service.py`·`orders/transitions.py`·`orders/models.py` 컬럼 정의)만 화이트리스트. OrderItem 인스턴스 변수명이 `item` 등일 때도 걸리도록
- [x] Task 5: 테스트 (`tests/test_order_transitions.py` 신설 — 주문 생성 API가 없으므로 orders 모델로 픽스처 직접 구성, 4.6 AC의 "전이 함수 직접 호출로 상태 조성" 관례)
  - [x] 정상 경로: pending_payment→paid(sub_orders 연쇄 preparing + paid_at) / preparing→shipping(송장 필수) / shipping→delivered / ordered→canceled(재고 복원 +n·cancellations 기록)
  - [x] 거부: 미정의 전이(pending_payment→shipping, delivered→preparing, canceled 재취소) 422 / 역할 불허(buyer가 paid 전이, seller가 입금확인) 403 / buyer 라인 취소 가드(preparing 진입 후) 거부 / 송장 없이 shipping 422
  - [x] 재고 복원 정확히 1회: 같은 라인 취소 재시도가 거부되어 복원이 중복되지 않음을 재고 수치로 검증
  - [x] order_events: 전이 성공 수만큼 기록(layer·from·to·actor_role·actor_user_id), system 전이는 actor_user_id NULL
- [ ] Task 6: 배포 + 검증 — 마이그레이션 프로덕션 적용 확인 (신규 API 없음 — 실기 검증은 4.4에서 주문과 함께)

## Dev Notes

- **R5 스캔 (4.2 이월)**: deposit_account 실계좌(4.4 선행)·우편번호 실존 검증(4.4)·시드 출처 격상·갱신 절차(오픈 게이트) — 전부 이 스토리 무관, 이월 유지. 4.1 이월 variants upsert flush 순서 등도 무관
- **스코프 밖**: 주문 생성·재고 차감(4.4), 자동취소 스케줄러(4.5 — system 역할 호출만 여기서 준비), 구매자 취소 API(4.6), 입금 확인 API(5.2), 배송 처리 API(5.3), 관리자 개입 API(5.5), 환불 완료 기록(refunded_at 갱신은 5.5)
- **5.5 강제 변경도 정의된 전이 내에서만** — 역방향 전이(shipping→preparing 정정 등)는 현재 전이표에 없다. 5.5에서 필요가 확인되면 그때 전이표에 행을 추가한다(코드 데이터라 AD-9 게이트 불요) — 전이표 밖 우회 UPDATE는 어떤 이유로도 금지
- **order층 `pending_payment→canceled`의 buyer 각주는 가드가 아니다** — 엔진은 역할만 검사하고, "전 묶음 취소의 결과로만"은 4.6 서비스 함수(전 라인 취소 후 order 전이 호출)의 조합 책임. 엔진 가드로 두지 않는 이유: 4.5 system 자동취소도 같은 전이를 쓰며, 라인 취소와 order 전이의 순서를 엔진이 강제하면 조합 코드가 경직됨
- **이 스토리는 API 엔드포인트를 만들지 않는다** — 엔진(전이표·전이 함수·취소 경로)과 마이그레이션만. FR-19의 "어떤 클라이언트에서도 불가능"은 후속 스토리의 모든 엔드포인트가 이 함수만 호출하는 구조로 보장되며, 에러 봉투 검증은 서비스 레벨 테스트 + 전역 핸들러(기존 검증됨)로 충분

### 스키마 초안 (AD-9 — Slur 승인 대기)

공통: UUIDv7 앱 생성, timestamptz, CHECK+문자열 (AD-8)

**order_events** — 전이 감사 로그 (AD-3: 세 층 모든 전이 성공 기록)

| 컬럼 | 타입 | 제약 |
|---|---|---|
| id | UUID PK | uuid7 |
| order_id | UUID FK→orders | NOT NULL, ondelete=CASCADE, index (주문 단위 타임라인 조회용) |
| entity_type | String(20) | NOT NULL, CHECK (`order`,`sub_order`,`order_item`) |
| entity_id | UUID | NOT NULL (FK 없음 — 3층 폴리모픽, 층별 FK 분리는 과설계) |
| from_status | String(20) | **NULLABLE** (sub_order None→preparing 진입 표현) |
| to_status | String(20) | NOT NULL |
| actor_role | String(10) | NOT NULL, CHECK (`buyer`,`seller`,`admin`,`system`) |
| actor_user_id | UUID FK→users | **NULLABLE, ondelete=SET NULL** (system 전이는 NULL, 탈퇴 후 이력 보존) |
| note | String(500) | NOT NULL, default '' (관리자 메모 — FR-29) |
| created_at | timestamptz | |

**cancellations** — 취소 기록 (AD-6: 사유·귀책·취소 시각·환불 완료 시각)

| 컬럼 | 타입 | 제약 |
|---|---|---|
| id | UUID PK | uuid7 |
| order_item_id | UUID FK→order_items | NOT NULL, ondelete=CASCADE, index, **UNIQUE** (라인당 취소 1회 — 복원 중복의 DB 수준 방어) |
| reason | String(500) | NOT NULL |
| responsibility | String(10) | NOT NULL, CHECK (`buyer`,`seller`,`admin`,`system`) — 귀책 |
| canceled_at | timestamptz | NOT NULL, server_default now() |
| refunded_at | timestamptz | NULLABLE (환불 완료는 5.5 관리자 기록 — 취소 시각과 분리, AD-6) |
| created_by | UUID FK→users | NULLABLE, ondelete=SET NULL (system은 NULL) |

**결정 포인트 (R4)**: `cancellations.order_item_id UNIQUE` — 라인당 취소 기록 1회를 DB가 강제해 재고 복원 "정확히 1회"(AD-4)의 이중 방어가 된다. 기각 대안: UNIQUE 없이 전이표 거부에만 의존(앱 버그 시 복원 중복 가능)

### 전이표 초안 (AC 1 — 코드에 데이터로 들어갈 내용)

| 층 | from | to | 허용 역할 | 가드 |
|---|---|---|---|---|
| order | pending_payment | paid | admin, system¹ | — (같은 트랜잭션에서 sub_orders 연쇄 None→preparing) |
| order | pending_payment | canceled | buyer², admin, system | ² buyer는 전 묶음 취소의 결과로만 (4.6) |
| sub_order | (NULL) | preparing | admin, system | paid 연쇄 전용 — 단독 호출 금지 아님(전이표상 동일) |
| sub_order | preparing | shipping | seller, admin | 송장(carrier·tracking_number) 필수 |
| sub_order | shipping | delivered | seller, admin | — |
| order_item | ordered | canceled | buyer, admin, system | buyer: 소속 sub_order shipping_status IS NULL / system: 소속 order pending_payment / admin: 무제한 (FR-29) |

¹ system은 PG 자동 승인 대비 (Deferred: 전이 주체만 교체). ² `confirmed`는 상수만 정의, 전이표 미등록 (FR-20). delivered→confirmed 활성화는 PG·정산 시점

### 에러 code 시드 (R6)

| code | 상황 | HTTP | 클라이언트 반응 |
|---|---|---|---|
| `invalid_transition` | 전이표에 없는 (layer, from, to) 또는 가드 실패 | 422 | message 그대로 표시 (후속 스토리 화면) |
| `forbidden` | 정의된 전이지만 역할 불허 | 403 | 권한 안내 |

### 아키텍처·패턴 준수 (기존 코드가 정답 소스)

- **AD-3**: 전이표는 데이터(dict), 가드는 같은 모듈의 함수, 전이 함수는 `orders/service.py`에 정확히 하나. 4.5(system)·4.6(buyer)·5.2·5.3·5.5(admin/seller)는 전부 이 함수만 호출
- **AD-4**: 재고 복원은 라인 canceled 확정 트랜잭션 안에서 `UPDATE variants SET stock = stock + n WHERE id = ...` 1회 — 원자적 UPDATE(읽고-계산하고-쓰기 금지). 복원은 증가라 `stock >= n` 조건절은 불필요(차감 쪽 4.4와 혼동 금지). **복원 UPDATE도 orders 도메인이 소유하되 variants 모델 직접 import 금지(AD-2)** — products에 `restore_stock(session, variant_id, qty)` service 함수 신설해 경유 (4.2의 `get_sellers_by_ids` 선례)
- **AD-6**: 대표 상태 파생은 이 스토리 범위 아님(5.1 조회 화면 몫) — 엔진은 층별 상태만 소유
- 상태 값·CHECK는 4.2 승인 스키마와 일치 (orders: pending_payment/paid/canceled, sub_orders: NULL+preparing/shipping/delivered, order_items: ordered/canceled) — **이 스토리에서 기존 3테이블 스키마 변경 없음**
- transition()은 flush까지만, commit은 호출자(엔드포인트 서비스 함수) 소유 — 4.5 "전 라인 취소+복원+기록 한 트랜잭션" 요구의 전제
- 동시성: 같은 엔티티 동시 전이는 `SELECT ... FOR UPDATE`(엔티티 행 잠금) 후 상태 확인 — check-then-act 레이스 방어. SQLAlchemy `with_for_update()` — **기존 코드에 선례 없는 신규 도입**이므로 transition() 안에서만 사용하고 docstring에 이유 명시
- Alembic: head `0275fa5bfee4` 뒤 체인. env.py는 orders models import 이미 있음(4.2) — 신규 모델은 같은 models.py에 추가라 추가 작업 없음
- R2 셀프체크: 외부 호출 없음 / 동시 전이 FOR UPDATE / 재고 복원 중복은 UNIQUE+전이표 이중 방어 / 입력 상한 note 500 / 이형·토큰 해당 없음

### 픽스처 가이드 (Task 5)

주문 생성 API가 없으므로 테스트는 orders 도메인 모델로 직접 행 구성: users(가입 API)→sellers(승인 API)→products/variants(4.1 `_shop` 재사용)→Order/SubOrder/OrderItem 직접 INSERT(스냅샷 필드 수동 채움). 헬퍼 `_order_fixture(session, ...)` 하나로 통일 — 4.4 구현 후에도 엔진 테스트는 API 비의존 유지

### References

- [Source: epics.md#Story-4.3 (448~460행), FR-18·19·20·28·29]
- [Source: ARCHITECTURE-SPINE.md#AD-2·AD-3·AD-4·AD-6·AD-8·AD-9, Deferred(PG 전이 주체 교체)]
- [Source: 4-2-order-model-shipping-calc.md#스키마(3테이블 CHECK·결정 ①②)·Completion-Notes·Review-Findings(defer: deposit_account 4.4)]
- [Source: epics.md#Story-4.5·4.6·5.2·5.3·5.5 (전이 주체·가드 역산)]

## Dev Agent Record

### Agent Model Used

Claude Fable 5 (claude-fable-5)

### Debug Log References

### Completion Notes List

- AD-9 게이트 통과: order_events·cancellations 초안 + 결정(cancellations.order_item_id UNIQUE) Slur 승인 (2026-07-20). 마이그레이션 `7ef2fee3ff3e` autogenerate 일치 확인 후 적용. 기존 3테이블 무변경
- 전이표는 `transitions.py`에 순수 데이터 dict — DB 접근 없음. `confirmed`는 상수만(전이표 미등록 = 도달 불가, FR-20). 가드 3종(송장 필수·buyer 타이밍·system pending_payment)도 같은 모듈의 순수 함수
- `transition()`은 FOR UPDATE 행 잠금 재조회 후 검사 — 동시 전이 check-then-act 레이스 방어(이 엔진 한정 신규 패턴). 라인 취소 시 부모 sub_order·order도 잠가 paid 연쇄와 직렬화. flush까지만, commit은 호출자 소유
- paid 연쇄에서 전 라인 canceled인 sub_order 제외(유령 배송준비 방지), shipping 전이의 송장 기록은 transition()이 소유(반쪽 전이 방지) — 스토리 검증 지적 반영 사항 그대로 구현
- `cancel_order_item()` = 전이 + `products_service.restore_stock`(원자적 +n, AD-2 경유) + Cancellation INSERT 한 트랜잭션. 복원 1회는 전이표 거부 + UNIQUE 이중 방어, 테스트로 재고 수치 검증
- AC 3 코드 검사는 AST 기반: payment_status/shipping_status 속성 대입(전 파일), orders 모델 import 파일의 .status 대입, update(Order|SubOrder|OrderItem) 호출을 잡고 orders/service.py·transitions.py·models.py만 화이트리스트
- **의도적 보류**: ① 전이 API 엔드포인트 없음(5.2·5.3·5.5 몫) ② refunded_at 갱신 경로(5.5) ③ 역방향 전이 행(5.5 필요 확인 시 추가) ④ order 취소 시 orders.canceled 전이와 라인 취소의 조합(4.5·4.6 서비스 함수 몫)
- R2 셀프체크: 외부 호출 없음 / FOR UPDATE 직렬화 / 복원 중복 이중 방어 / note 500 상한 / 이형·토큰 해당 없음
- 테스트 10종 신설, 전체 97/97 통과

### File List

- apps/api/app/orders/models.py (수정 — OrderEvent·Cancellation 추가)
- apps/api/app/orders/transitions.py (신규 — 전이표 데이터 + 가드)
- apps/api/app/orders/service.py (수정 — transition·cancel_order_item·_locked)
- apps/api/app/products/service.py (수정 — restore_stock 신설)
- apps/api/alembic/versions/7ef2fee3ff3e_order_events_and_cancellations.py (신규)
- apps/api/tests/test_order_transitions.py (신규 — 10 테스트, AC 3 AST 검사 포함)
