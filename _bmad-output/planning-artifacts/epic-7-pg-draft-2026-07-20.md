# Epic 7 초안: PG 연동과 정산 (오픈 게이트)

> **상태: 초안 — 견적·PG사 선정 전 확정 금지.** 벤더 중립 설계만 담는다. 벤더 확정 후 이 문서를 epics.md에 정식 Epic 7로 이관하고 스토리 파일을 만든다.
> 근거: PRD §"실서비스 오픈 게이트"(43~44행)·FR-20·FR-23·FR-28·NFR-5, 스파인 Deferred(전이 주체만 교체), `open-gate-pg-brief-2026-07-20.md`(방향 승인 2026-07-20).

## 에픽 목표

무통장입금(관리자 수동 확인)을 PG 자동 승인으로 대체하고, 판매자 정산을 지급대행으로 처리해 **실구매자를 받을 수 있는 상태**가 된다.

## 벤더 중립 설계 (견적과 무관 — 지금 확정 가능)

### D1. 결제 도메인 경계

- 신규 도메인 패키지 `app/payments/` (router·service·models·schemas) — 스파인 AD-2 그래프에 `orders → payments` 또는 `payments → orders` 중 **하나만** 추가 (권장: `payments → orders` — 결제가 주문 상태를 바꾸는 방향, admin→orders 선례와 동형). 확정은 벤더 선정 시 AD-9/스파인 개정 절차로.
- **전이 엔진 불변**: 승인 웹훅은 `transition(order→paid, actor_role=system, actor_user_id=None, note="PG 승인 {거래키}")` 호출 한 줄. 연쇄 preparing·이벤트·paid_at 전부 기존 엔진 소유 (4.3). **재구현 절대 금지.**

### D2. 상태 매핑 (전이표 변경 없음)

| PG 이벤트 | 처리 |
|---|---|
| 결제 승인(카드·간편) | `pending_payment→paid` (system) |
| 가상계좌 발급 | 상태 변화 없음 — 계좌 정보만 저장·안내 (현 `deposit_account` 안내를 대체) |
| 가상계좌 입금 완료 | `pending_payment→paid` (system) |
| 결제 실패·미입금 만료 | 상태 변화 없음 — 4.5 자동취소가 기존대로 처리 (기한 소스만 PG 만료로 정렬 검토) |
| 결제 취소·환불 완료 | **역방향 전이 도입 여부 결정 필요** (4.3 defer "역방향 전이" 재개 지점) — 현 전이표엔 paid→canceled 없음. 후보 ① 라인 취소(기존 admin 경로) + 환불 기록(`refunded_at`) ② `paid→canceled` 전이 신설 |

### D3. 데이터 모델 초안 (AD-9 게이트 — 승인 필요)

| 테이블 | 목적 | 핵심 컬럼 |
|---|---|---|
| `payments` | 주문↔PG 거래 대응 | order_id FK, provider, provider_tx_id(UNIQUE), method(card/vbank/easy), amount, status(ready/paid/canceled/failed), approved_at, raw_payload(JSONB) |
| `payment_events` | 웹훅 원본 감사 (멱등 판정) | payment_id, event_type, provider_event_id(UNIQUE — 재전송 멱등), payload(JSONB), received_at |
| `settlements` | 판매자 지급 기록 | sub_order_id FK, seller_id, gross_amount, fee_amount, net_amount, status(pending/requested/paid), paid_at, provider_payout_id |

`orders`는 무변경 (금액은 계속 스냅샷 파생). `settings`의 `deposit_account`는 가상계좌 도입 후 표시 우선순위 하향(삭제 아님 — 폴백).

### D4. 멱등·보안 (웹훅의 본질적 요구)

- **서명 검증 필수** (벤더별 방식) — 실패 시 401, 본문 처리 금지
- **멱등 키**: `payment_events.provider_event_id` UNIQUE — 재전송/중복 웹훅은 INSERT 충돌로 조용히 성공 반환 (200)
- **금액 대조**: 승인 금액 ≠ 주문 활성 총액이면 `paid` 전이 금지 + 관리자 알림 대상 기록 (4.4 `expected_grand_total`·5.2 `price_changed` 패턴의 연장)
- 웹훅 엔드포인트는 인증 미들웨어 예외 + 서명 게이트 (R7 판정 규칙의 명시적 예외로 기록)

### D5. 예상 스토리 분해 (견적 후 확정)

1. **7.1** 결제 도메인·데이터 모델 (AD-9 게이트) + 벤더 SDK 배선·설정
2. **7.2** 결제 요청·승인 웹훅 (카드) — 멱등·서명·금액 대조, 전이 엔진 호출
3. **7.3** 가상계좌 (발급·입금 웹훅) — 무통장 UX 대체, 4.5 자동취소 기한 정렬
4. **7.4** Flutter 결제 플로우 (주문서 → 결제 → 완료), 실패·취소 UX
5. **7.5** 환불·취소 연동 — D2의 역방향 전이 결정 반영, 5.5 관리자 개입과 통합
6. **7.6** 정산(지급대행) — settlements 생성·조회, 판매자 화면 정산 내역, 수수료 표시
7. **7.7** 오픈 준비 — 무통장 경로 정리(폴백 여부), 약관·정책 갱신, 모니터링

### D6. 견적으로 결정될 항목 (Slur 대기)

- PG사·정산 상품 확정 → D1 도메인 방향·SDK·서명 방식·웹훅 스펙
- 수수료 구조 → D3 `settlements.fee_amount` 계산 규칙, 판매자 표시 정책
- 정산 주기·지급 단위 → 7.6 스토리 범위 (자동 vs 관리자 트리거)
- 심사 요건 → 사업자 실정보 확정 시점(6.1 placeholder 교체와 한 묶음)

## 선행 조건 체크리스트

- [ ] PG사 선정 (견적 2건 — Slur)
- [ ] 사업자 실정보 확정 (PG 심사 + 6.1)
- [ ] 약관·개인정보처리방침 법률 검토 (6.1 초안 → 결제·환불 조항 확정)
- [ ] 실기 검증 완료 (A-E456-1)
- [ ] 스파인 AD-2 그래프 개정 승인 (payments 엣지)
