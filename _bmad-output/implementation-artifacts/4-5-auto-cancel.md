---
baseline_commit: 3ea09f8b8f6d76ca141bf496e21848cd0c52b721
---

# Story 4.5: 미입금 자동취소

Status: review

## Story

As a 운영자,
I want 기한 내 미입금 주문이 자동으로 취소되는 것,
So that 재고가 유령 주문에 잠기지 않는다.

## Acceptance Criteria

1. **Given** pending_payment 상태로 기한(4.4가 스탬프한 `deposit_due_at` 기준 — 원천은 settings `unpaid_cancel_days` 기본 3일) 경과한 주문 **When** APScheduler 주기 작업 실행 **Then** `system` 역할로 전이 함수를 통해 자동취소되고, 전 라인 취소·재고 복원·`cancellations` 기록이 **한 트랜잭션**에서 일어난다
2. **Given** 기한 이내의 주문 **When** 같은 작업 실행 **Then** 아무 변화가 없다

## Tasks / Subtasks

- [x] Task 0 (사전 확인): APScheduler 의존성 추가 — 아키텍처 스파인 확정 사항("FastAPI 프로세스 내 스케줄러(APScheduler)")이라 **별도 승인 불요**, `apscheduler` 최신 3.x를 pyproject에 추가. **설치 후 Python 3.14에서 import·기동 스모크 확인 — 문제 시 대안(asyncio 태스크 + sleep 루프) 보고.** 신규 테이블 없음(AD-9 비대상)
- [x] Task 1: 자동취소 작업 함수 (AC 1·2)
  - [x] `orders/service.py`에 `auto_cancel_expired_orders(session) -> int`(취소 주문 수 반환): 대상 id 목록을 먼저 확정(`payment_status = pending_payment AND deposit_due_at < func.now()` — **`unpaid_cancel_days` 재조회 금지**, 기한은 4.4 스냅샷이 진실. 재계산하면 설정 변경이 기존 주문 기한을 소급 변경하는 버그) → **주문 단위로** 전 `ordered` 라인 `cancel_order_item(actor_role=system, actor_user_id=None, reason="미입금 자동취소", responsibility="system")` → `transition(order, pending_payment→canceled, system)` → commit (주문 1건 = 트랜잭션 1건). **주문별 예외 캐치 시 반드시 `session.rollback()` 후 다음 주문 진행** — rollback 없이 넘어가면 오염된 세션이 다음 주문에 섞인다 (cancel_order_item은 호출자 rollback 전제)
  - [x] 이미 전 라인이 canceled인 주문(4.6 부분 취소 잔여)도 order 층 전이만 수행 — cancel 시도는 전이표가 자연 거부하므로 라인 상태 확인 후 ordered만 취소
  - [x] 4.3 가드 정합: system 라인 취소는 order pending_payment 전제 — order 전이를 **라인 취소 뒤에** 수행 (순서 바꾸면 가드에 걸림)
- [x] Task 2: 스케줄러 배선 (AC 1)
  - [x] `app/core/scheduler.py` 신설: `AsyncIOScheduler` + interval 주기(분)는 `core/config` Settings `auto_cancel_interval_minutes` (기본 10, AD-13 — 코드 리터럴 금지). job은 자체 세션(`async_session_factory`)을 열고 작업 함수 호출, 예외는 로깅만(프로세스 생존)
  - [x] `main.py` lifespan에서 시작·종료 — **start는 반드시 lifespan 내부(러닝 이벤트 루프 존재), 모듈 레벨 start 금지** (Py3.12+ get_event_loop 변화). 단일 인스턴스 전제(스파인 명시). 테스트는 스케줄러 자연 미기동(httpx ASGITransport는 lifespan 미실행 — 검증됨)
  - [x] Railway 신규 환경변수 없음 확인 (기본값으로 충분 — R1: 신규 변수 시 railway.ts preserve 동시 선언)
- [x] Task 3: 테스트 (`tests/test_auto_cancel.py` 신설 — 작업 함수 직접 호출, 스케줄러 자체는 배선만 검증)
  - [x] 기한 경과 주문: 전 라인 canceled·재고 복원(+n)·cancellations(responsibility=system)·order canceled·order_events(system, actor NULL) — 한 트랜잭션 검증
  - [x] 기한 이내 주문: 무변화 (AC 2)
  - [x] paid 주문·이미 canceled 주문: 대상 제외
  - [x] 다중 만료 주문: 한 주문의 취소 실패(예: monkeypatch로 예외)가 다른 주문 취소를 막지 않음 — 개별 트랜잭션 격리
  - [x] variant SET NULL 라인 포함 주문: 복원 no-op으로 정상 취소
  - [x] 멱등성: 같은 작업 2회 실행 — 두 번째는 무변화 (이미 canceled)
- [ ] Task 4: 배포 + 검증 — 프로덕션에서 스케줄러 기동 로그 확인 (실기 검증은 기한 3일이라 로그 확인으로 대체, 필요 시 DB에서 deposit_due_at 과거로 당겨 1건 실검증 후 정리)

## Dev Notes

- **R5 스캔**: 4.4 defer "커밋 후 응답 유실"(5.1 이월)·"잠금 최적화"·"테스트 헬퍼" — 이 스토리 무관. 4.3의 system 가드·`cancel_order_item` 경로가 이 스토리의 전제 (이미 구현·테스트됨)
- **스코프 밖**: 구매자 취소(4.6), 입금 확인(5.2), 알림(v1 제외 — 자동취소 통지 없음, PRD 화면 목록 밖), 다중 인스턴스 잠금(단일 인스턴스 전제)
- **엔진 재사용이 전부다**: 이 스토리의 신규 로직은 "대상 주문 선별 + 조합 호출 + 스케줄 배선"뿐. 재고 복원·기록·가드는 4.3이 소유 — 여기서 재구현 금지 (AD-3·AD-4)

### 설계 결정

- **주문 단위 개별 트랜잭션**: AC 1의 "한 트랜잭션"은 주문 1건 내부(전 라인+복원+기록+order 전이)를 말한다. 주문 간에는 개별 커밋 — 오염된 주문 하나가 배치 전체를 막으면 안 됨. 실패 주문은 error 로깅 후 다음 주기 재시도 (멱등)
- **대상 선별 시 FOR UPDATE SKIP LOCKED 불요** — 단일 인스턴스·단일 스케줄러라 경합 주체가 없고, 라인·주문 전이가 어차피 행 잠금. 관리자 입금확인과의 레이스는 전이표가 해소(paid 후엔 system 라인 취소 가드 거부 → 해당 주문 스킵 로깅)
- **시간 판정은 DB now() 기준** (`deposit_due_at < func.now()`) — 앱 서버 시계 의존 금지 (AD-8 UTC 일관)

### 에러 code 시드 (R6)

신규 API 없음 — 클라이언트 노출 code 없음. 작업 내부 실패는 `slur.orders` 로거 error 기록만

### 아키텍처·패턴 준수

- 전이·취소는 `cancel_order_item`·`transition`만 호출 (AD-3) — AST 검사(`test_no_status_writes_outside_engine`)가 자동 감시
- APScheduler 3.x `AsyncIOScheduler` — FastAPI lifespan에서 start/shutdown. 4.x는 대규모 재설계 버전이라 3.x 고정 (안정성 우선, 스파인의 "주기 실행" 요구에 3.x로 충분)
- interval 값은 `core/config` Settings (env 오버라이드 가능). **배치는 `unpaid_cancel_days`를 읽지 않는다** — 기한은 4.4가 `deposit_due_at`으로 스냅샷한 값이 진실
- R2 셀프체크: 외부 호출 없음 / 동시성은 엔진 잠금 + 개별 트랜잭션 / 입력 없음 / 로깅은 주문 id 포함 error

### References

- [Source: epics.md#Story-4.5 (484~498행), FR-18(자동취소 화살표)]
- [Source: ARCHITECTURE-SPINE.md#환경·운영(APScheduler 단일 인스턴스)·AD-3·AD-4·AD-13]
- [Source: 4-3-order-state-engine.md#전이표(system 역할·가드)·cancel_order_item 계약, 4-4-order-creation.md#deposit_due_at·get_int_setting]

## Dev Agent Record

### Agent Model Used

Claude Fable 5 (claude-fable-5)

### Debug Log References

### Completion Notes List

- APScheduler 3.11.3 추가 — Python 3.14 import·기동 스모크 통과 (스파인 확정 의존성, 별도 승인 불요)
- `auto_cancel_expired_orders`: 대상 판정은 `deposit_due_at < func.now()`만 (unpaid_cancel_days 재조회 금지 — 소급 변경 버그 방지). 주문 1건 = 트랜잭션 1건, 예외 시 rollback 후 다음 주문 (격리 테스트로 봉인)
- 순서: 전 ordered 라인 cancel_order_item(system) → order canceled 전이 — 4.3 system 가드(pending_payment 전제)와 정합. 재고 복원·cancellations·events는 전부 엔진 소유 재사용, 신규 상태 로직 0
- 스케줄러: `core/scheduler.py` + main.py lifespan start/shutdown (러닝 루프 내부, 모듈 레벨 start 금지). interval은 Settings `auto_cancel_interval_minutes`(기본 10, env 오버라이드). 테스트는 ASGITransport lifespan 미실행으로 자연 미기동
- Railway 신규 환경변수 없음 (기본값 충분 — R1 해당 없음)
- **의도적 보류**: ① 자동취소 통지(알림 v1 제외) ② 다중 인스턴스 잠금(단일 인스턴스 전제 — 확장 시 재설계) ③ 대상 대량화 시 배치 페이징(v1 규모 불요)
- R2 셀프체크: 외부 호출 없음 / 동시성 엔진 잠금+개별 트랜잭션 / 입력 없음 / 실패 주문 id 로깅
- 테스트 5종(자동취소 전체 흐름·기한 이내·paid 제외·멱등+격리·SET NULL 복원 no-op·배선), 전체 116/116

### File List

- apps/api/pyproject.toml·uv.lock (수정 — apscheduler 3.11.3)
- apps/api/app/core/config.py (수정 — auto_cancel_interval_minutes)
- apps/api/app/core/scheduler.py (신규)
- apps/api/app/main.py (수정 — lifespan)
- apps/api/app/orders/service.py (수정 — auto_cancel_expired_orders)
- apps/api/tests/test_auto_cancel.py (신규 — 5 테스트)
