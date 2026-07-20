---
baseline_commit: ed425f82da80eaa38666a87f77c374922e2443c2
---

# Story 5.6: 관리자 조회 (회원·판매자·상품)

Status: review

## Story

As a 관리자,
I want 회원·판매자·상품을 검색·조회하는 것,
So that 운영 문의에 답할 수 있다.

## Acceptance Criteria

1. **Given** 관리자 화면 **When** 회원 목록·검색(이메일·이름) **Then** 이메일·이름·역할·가입일이 표시되고 행에서 해당 회원의 주문 이력 링크(주문 검색 q=이메일)를 제공한다
2. **Given** 관리자 화면 **When** 판매자 목록·검색(브랜드명·상호) **Then** 브랜드명·법정 신원정보(상호·대표자·사업자번호·통판신고·주소·연락처)·배송비 설정·상품 수가 표시된다
3. **Given** 관리자 화면 **When** 상품 목록·검색(상품명·판매자 브랜드·카테고리·상태) **Then** 상품명·판매자·가격·상태·재고 합계가 표시된다 (수정·제재 기능 없음 — v1 범위, FR-30)

## Tasks / Subtasks

- [x] Task 0: 신규 테이블·의존성 없음. 전부 읽기 전용 (FR-30 "읽기 중심, 제재 없음")
- [x] Task 1: 조회 API 3종 (admin 라우터 + 각 도메인 service 집계 — AD-2)
  - [x] `GET /admin/users?q=&page=` — auth service `list_users`: 이메일·이름 부분 일치(이스케이프 — 5.5 관례), {id, email, name, roles, created_at}, 최신 가입순
  - [x] `GET /admin/sellers?q=&page=` — sellers service `list_sellers_admin`: 브랜드·상호 검색, 법정 신원 6필드 + 배송비 3필드 + product_count(products service 배치 집계)
  - [x] `GET /admin/products?q=&category_id=&status=&page=` — products service `list_products_admin`: 상품명 검색(+브랜드 선해결 seller_ids — 5.5 관례)·카테고리·상태 필터, {name, brand(라우터 enrich), base_price, status, stock_sum, created_at}
  - [x] 공통: page 1~10000·q 2~100 검증, {items,total,page,size}, `require_role("admin")`
- [x] Task 2: Next.js `/admin/lookup` — 탭 3개(회원/판매자/상품), 탭별 검색 입력(+상품 탭은 카테고리·상태 select), 테이블(AC 필드), 회원 행 "주문 이력" 링크 → /admin/orders?q={email}, 페이지네이션·관례 일체(세대 카운터 등). 관리자 홈 네비 "조회" 링크
- [x] Task 3: 테스트 (`tests/test_admin_lookup.py`) — 3종 각: 검색 일치·필드·페이징 size / roles 표시(다중 역할) / product_count·stock_sum 정확성 / 상태·카테고리 필터 / 403·401 / 와일드카드 이스케이프
- [ ] Task 4: 배포 + Slur 실기 검증

## Dev Notes

- **R5 스캔**: 이월 defer 무관. 5.5 검색 관례(이스케이프·선해결·페이징)가 전제
- **스코프 밖**: 회원 정지·판매자 제재·상품 수정(FR-30 명시 제외), 회원 상세 페이지(주문 이력 링크로 대체 — epics "상세에서 링크"의 최소 이행), 탈퇴 처리(v1 없음)
- stock_sum은 variants 합(비활성 포함 — 보유 재고 관점). roles는 user_roles 조인

### 에러 code 시드 (R6)

신규 없음 — validation_error/forbidden 관례

### 아키텍처·패턴 준수

- 집계·검색은 소유 도메인 service, 조합·enrich는 admin 라우터 (5.2·5.5 관례). ILIKE 이스케이프 헬퍼 재사용(공용화 검토)
- R2: 외부 호출 없음 / 읽기 전용 / q·page 상한

### References

- [Source: epics.md#Story-5.6 (596~614행), FR-30]
- [Source: 5-5(검색 이스케이프·선해결·페이징 관례)·5-2(admin 라우터 관례)]

## Dev Agent Record

### Agent Model Used

Claude Fable 5 (claude-fable-5) — Next.js는 병렬 서브에이전트

### Completion Notes List

- 조회 3종 전부 읽기 전용 (FR-30). 검색은 core `ilike_pattern` 공용 헬퍼 신설(5.5 이스케이프 로직 승격) — auth·sellers·products 재사용
- 회원 상세 페이지 대신 행별 "주문 이력" 링크(/admin/orders?q=이메일 — 주문 검색 초기 q 지원 추가)로 epics "상세에서 링크" 최소 이행
- product_count·brand·stock_sum 집계는 소유 도메인, 조합은 admin 라우터 (관례)
- **의도적 보류**: ① 회원 정지·제재(FR-30 제외) ② CSV 내보내기(화면 목록 밖) ③ 회원 상세 전용 페이지(링크 대체)
- R2: 읽기 전용 / q·page 상한 / 이스케이프 회귀 테스트
- 테스트 2종, 전체 147/147. tsc 0

### File List

- apps/api/app/core/search.py (신규 — ilike_pattern 공용)
- apps/api/app/auth/service.py (수정 — list_users·헬퍼 공용화)
- apps/api/app/sellers/service.py (수정 — list_sellers_admin·헬퍼 공용화)
- apps/api/app/products/service.py (수정 — list_products_admin·count_products_by_sellers)
- apps/api/app/admin/router.py (수정 — /users·/sellers·/products)
- apps/api/tests/test_admin_lookup.py (신규 — 2 테스트)
- apps/web/app/api/admin/lookup/route.ts (신규 — BFF)
- apps/web/app/admin/lookup/{page.tsx,lookup.css} (신규)
- apps/web/app/admin/orders/page.tsx (수정 — ?q= 초기값+Suspense)
- apps/web/app/admin/page.tsx (수정 — 조회 링크)
