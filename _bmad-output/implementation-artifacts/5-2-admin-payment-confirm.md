---
baseline_commit: 122fb91d775b052b5123218cf5c60aa81edc9099
---

# Story 5.2: 관리자 입금 확인

Status: review

## Story

As a 관리자,
I want 입금대기 주문을 보고 입금을 확인 처리하는 것,
So that 판매자가 배송을 시작할 수 있다.

## Acceptance Criteria

1. **Given** pending_payment 주문 목록 (주문번호·금액·주문자·경과 시간) **When** 관리자가 입금 확인 **Then** paid로 전이되고(전이 함수 경유 — sub_orders 연쇄 preparing 포함) 판매자 주문관리 대상이 된다 (FR-28)
2. **And** 목록·확인은 admin 역할만 접근 가능하며, 페이지 단 판정은 FastAPI가 한다 (R7 — slur_role 쿠키는 UX 힌트일 뿐)
3. **And** (5.1 이월) 입금자 대조를 위해 목록에 표시용 주문번호(8자리)와 **전체 주문번호(UUID)·주문 일시를 병기**한다 — 8자리 충돌 대응
4. **And** (4.5 이월) `orders(payment_status)` partial index를 AD-9 게이트로 승인받아 추가한다 — 입금대기 목록·자동취소 배치 공용 조회 패턴

## Tasks / Subtasks

- [x] Task 0 (AD-9 게이트): partial index 초안 승인 — `CREATE INDEX ix_orders_pending ON orders (deposit_due_at) WHERE payment_status = 'pending_payment'` (Dev Notes 근거). 승인 후 마이그레이션 (테이블·컬럼 변경 없음, 인덱스만)
- [x] Task 1: 관리자 API (AC 1·2·3)
  - [x] `GET /api/v1/admin/orders/pending?page=` — pending_payment 최신순, 항목 {order_id(전체 UUID), order_no(8자), created_at, deposit_due_at, expired(만료 — 5.1 파생 재사용), buyer {name, email}, grand_total(활성 기준 — 입금 대조 금액), 대표 상품명 title}. `require_role("admin")` + page 상한 (5.1 관례)
  - [x] `POST /api/v1/admin/orders/{order_id}/confirm-payment` body `{note?}` — `transition(order→paid, actor=admin, actor_user_id, note)` 호출만 (연쇄·이벤트는 엔진 소유). 404(미존재)·422(`invalid_transition` — 이미 paid·canceled·전 라인 취소) 엔진 그대로
  - [x] buyer 정보는 auth 도메인 service 함수 경유 (AD-2 — users 모델 직접 import 금지, 기존 함수 확인 후 없으면 `get_users_by_ids` 신설)
- [x] Task 2: Next.js 관리자 화면 (AC 1·2)
  - [x] `/admin/deposits` 페이지 — 관리자 홈에 진입 링크 추가. **페이지 단 판정: 서버 컴포넌트/클라이언트 최초 로드에서 admin API 401/403이면 로그인/no-role로 — 기존 admin 페이지(2.2 승인 화면) 패턴 그대로**
  - [x] 목록 테이블: 표시 주문번호(8자) + 전체 UUID(축약 표시·복사 가능)·주문 일시·주문자(이름·이메일)·금액·경과 시간(deposit_due_at 기준 남음/지남 — expired 강조)·[입금 확인] 버튼
  - [x] 확인 버튼 → 확인 다이얼로그(주문번호·금액·주문자 재표시) → POST → 성공 시 행 제거·토스트, 422면 message 표시 후 목록 갱신 (동시 처리·자동취소 경합)
  - [x] 슬러 시스템 CSS (slur-ux·slur-design 스킬 규칙 — 기존 admin 화면 관례 따름), 페이지네이션(page 기반)
- [x] Task 3: 테스트 (`tests/test_admin_payment.py` 신설)
  - [x] 목록: pending만 노출(paid·canceled 제외)·최신순·필드(전체 UUID·8자·buyer·grand_total 활성 기준·expired)·admin 아닌 역할 403·미인증 401
  - [x] 확인: paid 전이 + sub_orders preparing 연쇄 + order_events(admin·note) / 이미 paid 재확인 422 / 전 라인 취소 주문 422(4.3 가드) / 자동취소된 주문 422
  - [x] 부분 취소 주문: grand_total = 잔여 활성분 (입금 대조 금액 정합)
  - [x] 동시성: 입금 확인 vs 구매자 취소 gather — 정합 종착 상태 (4.6 테스트 대칭)
- [ ] Task 4: 배포 + Slur 실기 검증 — 웹 admin에서 실제 주문 입금 확인 → 앱 주문내역 상태 변화 확인 (R8)

## Dev Notes

- **R5 스캔 (이월 해소)**: ① 4.5 defer "partial index — 5.2에서 AD-9 검토" → Task 0·AC 4 ② 5.1 defer "order_no 충돌 — 5.2에서 결정" → AC 3 (전체 UUID·일시 병기로 해소) ③ 나머지 defer 무관 이월
- **스코프 밖**: 입금 내역 자동 대사(PG 오픈 게이트), 부분 입금 처리(관리자 수동 판단 — 개입은 5.5), 판매자 주문관리 화면(5.3), 알림, 반려/거절 개념(입금 확인은 단방향 — 취소는 4.5 자동 또는 5.5 개입)
- **paid 전이의 모든 효과는 4.3 엔진 소유** — 연쇄 preparing·paid_at·이벤트 기록 재구현 금지. API는 transition 호출 한 줄
- **R7 준수**: slur_role 쿠키는 리다이렉트 힌트일 뿐 — 데이터 접근 판정은 전부 FastAPI `require_role("admin")`

### partial index 초안 (AD-9 — Slur 승인 대기)

| 항목 | 내용 |
|---|---|
| 인덱스 | `ix_orders_pending` ON `orders (deposit_due_at)` WHERE `payment_status = 'pending_payment'` |
| 근거 | 입금대기 목록(이 스토리)·자동취소 배치(4.5, 10분 주기)가 같은 조회 패턴. partial이라 pending 행만 인덱싱 — 쓰기 비용 최소 |
| 기각 대안 | 전체 `(payment_status)` 인덱스 — paid·canceled까지 인덱싱해 이득 없이 큼. 무인덱스 유지 — 배치가 영구 seq scan (4.5 리뷰 지적) |

### 에러 code 시드 (R6)

| code | 상황 | HTTP | 반응 |
|---|---|---|---|
| `invalid_transition` | 이미 paid·canceled·전 라인 취소 | 422 | message 표시 + 목록 갱신 |
| `forbidden` | admin 아님 | 403 | no-role 안내 |
| `not_found` | 미존재 주문 | 404 | 목록 갱신 |

### 아키텍처·패턴 준수

- admin 라우터는 `app/admin/router.py` 기존 (2.2 승인 API 선례 — `require_role("admin")`·페이지 관례). admin→orders service 호출 (AD-2 허용 방향)
- 경과 시간·만료는 서버 파생 (`expired` — 5.1 재사용, AD-12). 클라 시계 계산 금지
- Next.js: 기존 admin 페이지(카테고리·승인) 파일 구조·fetch 관례·슬러 시스템 CSS 준수. 서버 판정은 API 401/403 반응으로 (R7)
- R2 셀프체크: 외부 호출 없음 / 동시성은 엔진 잠금 + 테스트 / note 500 상한(엔진) / 이형·토큰 해당 없음

### References

- [Source: epics.md#Story-5.2 (536~546행), FR-28, R7]
- [Source: 4-3(transition·paid 연쇄)·4-5(배치 조회 패턴·index defer)·5-1(expired 파생·order_no defer), deferred-work.md]
- [Source: apps/web/app/admin/ 기존 패턴, ARCHITECTURE-SPINE.md#AD-2·AD-9·AD-12·규약]

## Dev Agent Record

### Agent Model Used

Claude Fable 5 (claude-fable-5) — Next.js 화면은 병렬 서브에이전트 (slur-ux·slur-design 스킬 적용)

### Completion Notes List

- AD-9 게이트: partial index `ix_orders_pending` Slur 승인 (2026-07-20) — 마이그레이션 `a4d8cf26d891` + 모델 선언(autogenerate 정합). 4.5 배치·5.2 목록 공용
- 이월 해소 2건: order_no 충돌(전체 UUID·일시 병기 — 5.1 defer), partial index(4.5 defer)
- confirm-payment는 transition 호출 한 줄 — 연쇄 preparing·paid_at·이벤트 전부 엔진 소유 (AD-3). 입금 대조 금액은 활성 기준 (5.1 `_amounts` 재사용)
- buyer 정보는 `auth_service.get_users_by_ids` 신설 경유 (AD-2)
- 웹: BFF 라우트(`app/api/admin/deposits`) + proxyWithRefresh 관례, 슬러 시스템 table/modal 컴포넌트 복사 적용, R7 판정(401→login, 403→no-role)
- lint 기존 베이스라인 이슈(react-hooks 룰, 전 목록 페이지 공통 패턴)는 별도 defer — 신규 유형 0
- **의도적 보류**: ① 입금 자동 대사(PG 게이트) ② 부분 입금 판단(관리자 수동) ③ 목록 검색·필터(5.6 조회 영역)
- R2 셀프체크: 외부 호출 없음 / 동시성 엔진 잠금 + confirm vs cancel 테스트 / note 500·page 상한 / 이형·토큰 해당 없음
- 테스트 4종, 전체 133/133. tsc 오류 0

### File List

- apps/api/alembic/versions/a4d8cf26d891_orders_pending_partial_index.py (신규)
- apps/api/app/orders/models.py (수정 — partial index 선언)
- apps/api/app/orders/service.py (수정 — list_pending_orders·confirm_payment)
- apps/api/app/admin/router.py (수정 — pending 목록·confirm-payment)
- apps/api/app/auth/service.py (수정 — get_users_by_ids)
- apps/api/tests/test_admin_payment.py (신규 — 4 테스트)
- apps/web/app/admin/deposits/page.tsx·deposits.css (신규)
- apps/web/app/api/admin/deposits/route.ts (신규 — BFF)
- apps/web/app/styles/slur/components/table.css·modal.css (신규 — 디자인시스템 복사)
- apps/web/app/layout.tsx·app/admin/page.tsx (수정 — import·진입 링크)
