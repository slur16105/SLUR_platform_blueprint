---
baseline_commit: ce6d771473d575072831890e13fc3582ed54c09d
---

# Story 3.3: 옵션 조합 그리드와 재고

Status: in-progress

## Story

As a 판매자,
I want 옵션 축을 정의하면 조합 표가 생겨 행마다 추가금액·재고를 입력하는 것,
so that 스마트스토어처럼 익숙하게 옵션 상품을 관리한다.

## Acceptance Criteria

1. **Given** 옵션 축 최대 2개와 각 축의 값들 (예: 색상 2 × 사이즈 3) **When** 조합 생성 **Then** 6개 행이 자동 생성되고 행마다 [옵션값|추가금액|재고수량|판매상태]를 입력한다 (`variants`)
2. **Given** 옵션 없는 상품 **When** 등록 **Then** 내부적으로 조합 1개로 저장된다
3. **Given** 어떤 조합의 재고가 0이 됨 **When** 구매자가 옵션 선택 목록을 봄 **Then** 해당 조합은 "품절" 표기로 비활성화된다 (숨기지 않음) **And** 판매자는 재고와 무관하게 수동 품절 토글을 켤 수 있다

## Tasks / Subtasks

- [x] Task 1: variants 마이그레이션 (Slur 승인 2026-07-16) — UNIQUE(product_id, option1_value, option2_value), stock>=0 CHECK, 조합 상한 100 (설정값, 리서치: 스마트스토어 축 3·소규모 50~100 충분)
- [x] Task 2: API — PUT /sellers/products/{id}/variants (전체 교체 방식 — 그리드 저장과 1:1), product create에 stock 필드(기본 조합 1개 자동 생성, AC 2). 본인 상품만 (403)
- [x] Task 3: AD-10 단일 술어 — products.service.check_purchasable(variant, product, qty): 상품 active·조합 is_active·stock>=qty (3.5·4.x가 재사용)
- [x] Task 4: 웹 — 상품 등록 페이지에 옵션 그리드 섹션 (축 이름+콤마 값 입력 → 조합 행 자동 생성 → 행별 추가금액·재고·판매상태)
- [x] Task 5: 테스트 — 조합 생성·전체 교체, 옵션 없는 상품 기본 조합, UNIQUE 중복 조합 422, 타인 상품 403, 술어 (품절/숨김/수동토글)
- [ ] Task 6: 배포 + 프로덕션 E2E (조합 상품 등록→조합 확인→정리)

## Dev Notes

- 전체 교체(PUT) 이유: 그리드 UI 저장과 정확히 대응, 부분 수정의 정합성 문제 회피. **주문이 생긴 조합의 교체 문제는 Epic 4에서 재검토** (order_items가 variant FK를 갖게 되면 RESTRICT — 보류 R5 기록)
- 옵션 축 이름은 variant 행에 저장 (승인 스키마 — 스파인 시드의 '축 이름은 products에'에서 구체화 시 변경, 정규화보다 그리드 1:1 단순성 우선)
- R6 code 시드: `duplicate_variant`(422), `too_many_variants`(422)
- 옵션값 없음은 빈 문자열('') 저장 — UNIQUE 제약 동작 위해 NULL 금지

## Dev Agent Record

### Agent Model Used

Claude Fable 5 (claude-fable-5)

### Completion Notes List

### File List
