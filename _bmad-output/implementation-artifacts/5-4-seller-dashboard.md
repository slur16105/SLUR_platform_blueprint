---
baseline_commit: 33c4bd050a2837cf0549da3973febfd32b70dc09
---

# Story 5.4: 판매자 대시보드

Status: review

## Story

As a 판매자,
I want 로그인하면 처리할 일이 바로 보이는 것,
So that 놓치는 주문이 없다.

## Acceptance Criteria

1. **Given** 판매자 랜딩 **When** 대시보드 조회 **Then** 신규 주문(입금 완료·배송준비 대기 = preparing 묶음) 건수 · 배송중(shipping) 건수 · 품절 임박(활성 조합 재고 ≤ settings `low_stock_threshold`, 기본 5) 상품 목록이 표시된다 — 전부 백엔드 계산 값 (AD-12)
   - **해석 확정 (승인된 구체화)**: epics의 "신규 주문(paid) 건수"와 "preparing 건수"는 판매자 관점에서 동일 값(paid 연쇄 = preparing 진입, UNIQUE(order,seller))이므로 "신규 주문(배송준비 대기)" 카드 하나로 병합하고, 실용을 위해 배송중 카드를 함께 표시한다
2. **And** 각 카드는 해당 화면으로 연결된다 (신규 주문 → 주문 관리 preparing 탭, 품절 임박 → 상품 관리)

## Tasks / Subtasks

- [x] Task 0: 신규 테이블·의존성 없음. `low_stock_threshold`는 4.2 시드 — `get_int_setting(minimum=0)` 재사용
- [x] Task 1: 대시보드 API (AC 1)
  - [x] `GET /api/v1/sellers/dashboard` (require_role("seller")) → `{preparing_count, shipping_count, low_stock: [{product_id, product_name, option_text, stock}] (활성 상품·활성 조합만, stock 오름차순, 최대 20), low_stock_threshold}`
  - [x] 집계는 orders service(묶음 카운트)·products service(품절 임박) 함수 신설 경유 — 라우터 층 조합 (5.3 관례)
- [x] Task 2: Next.js 판매자 랜딩 (AC 1·2)
  - [x] `/seller` 홈 상단에 대시보드 섹션: 카드 2개(신규 주문 N건 → /seller/orders, 배송중 N건 → /seller/orders?status=shipping) + 품절 임박 목록(상품명·옵션·재고 — 임계값 표기, → /seller/products)
  - [x] 슬러 시스템 CSS·기존 관례, R7 판정
- [x] Task 3: 테스트 (`tests/test_seller_dashboard.py` 신설)
  - [x] 카운트: preparing·shipping 정확(타 판매자 분리·미결제 제외·delivered 제외) / 품절 임박: 임계 경계(=5 포함, 6 제외)·비활성 조합·숨김 상품 제외·정렬·상한 / 판매자 아닌 역할 403·미인증 401 / threshold 응답 포함
- [ ] Task 4: 배포 + Slur 실기 검증

## Dev Notes

- **R5 스캔**: 이월 defer 무관. 5.3의 목록·카운트 패턴, 4.2 settings 시드가 전제
- **스코프 밖**: 매출 통계·기간 필터(v1 제외), 관리자 대시보드(없음 — 화면 목록 밖), 알림
- **품절 임박 판정**: products 도메인 소유 — `variants.stock <= threshold AND variant.is_active AND product.status='active'` (판매 종료·숨김은 임박 대상 아님). threshold는 settings에서 (AD-13)

### 에러 code 시드 (R6)

신규 code 없음 — 401/403 기존 관례

### 아키텍처·패턴 준수

- 집계 값 전부 서버 계산 (AD-12·epics 명시). 라우터 층에서 orders·products service 조합 (5.3 관례), sellers/service에서 타 도메인 import 금지
- R2 셀프체크: 외부 호출 없음 / 읽기 전용 / 입력 없음 / 이형·토큰 해당 없음

### References

- [Source: epics.md#Story-5.4 (564~575행)]
- [Source: 4-2(settings 시드 low_stock_threshold)·5-3(카운트·라우터 관례), ARCHITECTURE-SPINE.md#AD-12·AD-13]

## Dev Agent Record

### Agent Model Used

Claude Fable 5 (claude-fable-5) — Next.js는 병렬 서브에이전트

### Completion Notes List

- 해석 확정: epics "신규 주문(paid)"와 "preparing"은 판매자 관점 동일 값 → 카드 병합 + 배송중 카드 추가 (승인된 구체화, 스토리 AC 기록)
- 집계는 orders(`seller_shipping_counts`)·products(`low_stock_variants`) service 신설, 라우터 층 조합 (5.3 관례). threshold는 settings `low_stock_threshold` (AD-13)
- 품절 임박은 활성 상품·활성 조합만 (판매 종료·숨김 제외), 경계 =threshold 포함, stock 오름차순 상한 20
- orders 페이지에 `?status=` 초기 탭 지원 추가 (대시보드 카드 연결)
- **의도적 보류**: ① 매출·기간 통계(v1 제외) ② 임박 상한 20 초과 표시("더 보기" — 상품 관리 링크로 대체) ③ 관리자 대시보드(화면 목록 밖)
- R2 셀프체크: 외부 호출 없음 / 읽기 전용 / 입력 없음
- 테스트 2종(경계·비활성·숨김 제외 실증), 전체 140/140. tsc 0

### File List

- apps/api/app/orders/service.py (수정 — seller_shipping_counts)
- apps/api/app/products/service.py (수정 — low_stock_variants)
- apps/api/app/sellers/router.py (수정 — GET /sellers/dashboard)
- apps/api/tests/test_seller_dashboard.py (신규 — 2 테스트)
- apps/web/app/api/seller/dashboard/route.ts (신규 — BFF)
- apps/web/app/seller/page.tsx·seller.css (수정 — 대시보드 섹션)
- apps/web/app/seller/orders/page.tsx (수정 — ?status= 초기 탭 + Suspense)
