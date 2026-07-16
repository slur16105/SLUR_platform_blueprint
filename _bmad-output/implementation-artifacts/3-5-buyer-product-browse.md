---
baseline_commit: b9118de336451b8d9dc29f259e5e475a6b0ee73f
---

# Story 3.5: 구매자 상품 목록·상세

Status: done

## Story

As a 구매자,
I want 앱에서 상품을 둘러보고 상세를 보는 것,
so that 살 물건을 고를 수 있다.

## Acceptance Criteria

1. **Given** Flutter 앱 홈 **When** 상품 목록 조회 **Then** 카테고리 필터 탭(전체|카테고리…)으로 상품이 표시된다 (숨김 상품 제외)
2. **Given** 상품 상세 **When** 옵션 선택 **Then** 조합별 추가금액이 반영된 가격이 표시되고, 품절 조합은 선택 불가다
3. **And** 판정·가격은 products 단일 술어와 백엔드 계산 값만 표시 (AD-10·AD-12)

## Tasks / Subtasks

- [x] Task 1: 공개 API — GET /products (category·page 필터, hidden 제외, 항목: 대표 이미지·브랜드명·**대표가(백엔드 계산)**·품절 여부(전 조합 술어 false)), GET /products/{id} (이미지 전체·조합별 final_price·purchasable — 전부 백엔드 계산, AD-12)
- [x] Task 2: Flutter — 홈을 상품 그리드로 교체(카테고리 탭), 상품 상세(이미지·옵션 선택→백엔드 final_price 표시·품절 비활성), 빈 상태 화면
- [x] Task 3: 테스트 — hidden 제외·soldout 노출(품절 표기)·카테고리 필터·페이지네이션·상세 조합 가격/구매가능 값
- [x] Task 4: 배포 + **Epic 3 통합 검증 (Slur)**: 판매자 웹에서 실상품 등록(옵션 포함) → 앱에서 진열·옵션·품절 확인

## Dev Notes

- R5 스캔: 3.3 보류(variants 교체 vs 참조)는 4.1 몫 — 이 스토리는 조회만이라 무관. soldout 상품도 목록 노출(품절 표기) — PRD "숨기지 않음"
- 대표가: min(base+extra of active variants) — 옵션가 다양할 때 "~부터" 표기용 최저가. 조합 0개 상품(비정상)은 base_price 폴백+품절 처리
- Flutter 이미지: 공개 URL 조립은 API가 image_url 완성형으로 내려줌 (클라이언트 조립 금지 — AD-12 정신)

## Dev Agent Record

### Agent Model Used

Claude Fable 5 (claude-fable-5)

### Completion Notes List

- Slur 에뮬레이터 실기 검증 (2026-07-17): 그리드·카테고리 탭(실카테고리 문구/수영복)·데모 상품·상세 옵션 가격 변경·품절 칩 비활성 확인
- 공개 API: hidden 노출 경로 없음(감사 확인), AD-10/12 준수
- **명시 이월**: Flutter 페이지네이션(21개째부터 비노출) — 실판매자 상품 20개 근접 시 필수, Epic 5 이후 백로그

### File List
