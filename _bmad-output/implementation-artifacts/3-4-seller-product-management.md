---
baseline_commit: 427fbefc541f57acf2c58b188e7dc52597413acb
---

# Story 3.4: 판매자 상품 관리

Status: done

## Story

As a 판매자,
I want 내 상품 목록을 보고 수정·상태 전환하는 것,
so that 상품을 최신 상태로 유지한다.

## Acceptance Criteria

1. **Given** 판매자의 상품 목록 **When** 상품 정보·옵션·재고 수정, 상태 전환(판매중/품절/숨김) **Then** 수정 내용이 상품 조회 API에 반영되고, 숨김 전환 시 구매자 목록·상세에서 노출되지 않는다
2. **And** 다른 판매자의 상품은 조회·수정할 수 없다 (403/404)

## Tasks / Subtasks

- [x] Task 1: API — PATCH /sellers/products/{id} (name·base_price·description·category_id·status 부분 수정), 본인 상품만(404). 숨김 필터는 3.5 공개 API에서 검증
- [x] Task 2: 웹 — /seller/products 목록(썸네일·상태 뱃지·재고 합계), 상태 전환 버튼, 상태 전환 버튼 중심 (상세 수정 페이지는 실사용 피드백 후 — 옵션 재저장 API는 3.3에 존재)
- [x] Task 3: 테스트 — 부분 수정 반영·잘못된 status 422·타인 404·카테고리 변경
- [x] Task 4: 배포 (Slur 실사용 검증은 3.5 완료 후 Epic 3 통합으로)

## Dev Notes

- R5 스캔: 3.3 보류(variants 전체 교체 vs 장바구니)는 4.1 몫 유지 — 이 스토리의 옵션 재저장은 동일 PUT 재사용
- 이미지 수정은 v1 보류 (재등록으로 갈음 — 필요 확인 시 별도 스토리). status는 CHECK 3값 — pydantic Literal
- 수정 페이지는 등록 페이지와 별도 경량 구성 (그리드 컴포넌트 로직 재사용)

## Dev Agent Record

### Agent Model Used

Claude Fable 5 (claude-fable-5)

### Completion Notes List

- 리뷰 반영: PATCH 가격 불변식(base+extra>=0 대칭 가드), 제2 판매자 실권한 테스트, 3상태 버튼(판매재개/품절/숨기기), 401 리다이렉트
- 보류: 상세 수정 페이지·이미지 수정(실사용 피드백 후), IMG_BASE 하드코딩(환경 이동 시 정리)

### File List
