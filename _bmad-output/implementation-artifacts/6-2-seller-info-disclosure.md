---
baseline_commit: ac69b07ccc078616be535ffdcabb42d37fd1a360
---

# Story 6.2: 중개자 지위·판매자 신원정보 노출

Status: review

## Story

As a 구매자,
I want 사기 전에 누가 파는지 아는 것,
So that 안심하고 거래한다 (전자상거래법 의무).

## Acceptance Criteria

1. **Given** 상품상세 **When** 조회 **Then** "판매자 정보" 접이식 영역에 판매자 신원정보(상호·대표자·사업자등록번호·통신판매업 신고번호·주소·연락처)가 표시된다 (FR-32)
2. **Given** 주문서 **When** 청약 전 화면 표시 **Then** 중개자 지위 고지 문구가 주문 버튼 위에 노출된다 (FR-32)

## Tasks / Subtasks

- [x] Task 0: 신규 테이블 없음 — sellers 법정 6필드 기존 (2.1 수집)
- [x] Task 1: API — 공개 상품 상세(`GET /products/{id}`) 응답에 `seller_info` 추가: {brand_name, company_name, representative_name, business_registration_number, mail_order_number, business_address, contact_phone} (공개 법정 정보 — 인증 불요 공개가 법 취지)
- [x] Task 2: Flutter — 상품 상세에 "판매자 정보" ExpansionTile(기본 접힘, 6필드) / 주문서(order_preview_screen) 주문 버튼 위에 중개자 고지 문구(공통 상수 — 6.1 company.dart의 고지문 재사용)
- [x] Task 3: 테스트 — 공개 상세 seller_info 필드 존재·값 일치 (인증 없이)
- [x] Task 4: 배포 + Slur 실기 검증

## Dev Notes

- **스코프 밖**: 판매자별 페이지(화면 목록 밖), 웹 구매자 화면(구매자는 앱 전용)
- 고지 문구 단일 소스: 6.1 company 상수 모듈 (앱·웹 동일 문구)

### References

- [Source: epics.md#Story-6.2 (652~665행), FR-32, 2-1(법정 필드 수집)]

## Dev Agent Record

### Agent Model Used

Claude Fable 5 (claude-fable-5) — 웹·Flutter 병렬 서브에이전트

### Completion Notes List

- 공개 상세 `seller_info` (법정 6필드+브랜드) — 인증 불요 (법 취지). 판매자 부재 비정상 데이터는 빈 값 방어
- Flutter: ExpansionTile 기본 접힘·구버전 API 호환(seller_info 누락 시 숨김), 주문서 고지 문구는 company.dart 단일 소스
- 테스트 1종 (미인증 공개 조회), 전체 149/149

### File List

- apps/api/app/products/schemas.py·service.py (수정 — SellerInfo·seller_info)
- apps/api/tests/test_public_products.py (수정 — 1 테스트)
- apps/mobile/lib/src/products/product_detail_screen.dart·orders/order_preview_screen.dart (수정)
