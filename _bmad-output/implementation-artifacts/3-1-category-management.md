---
baseline_commit: d81d5ff5e6cf098c17bcd74d1b60afa959236be3
---

# Story 3.1: 카테고리 관리

Status: review

## Story

As a 운영자,
I want 카테고리를 만들고 고치고 순서를 바꾸는 것,
so that 카테고리 이름 자체가 큐레이션이 된다.

## Acceptance Criteria

1. **Given** 관리자 화면 **When** 카테고리 생성·이름 수정·순서 변경 **Then** 변경이 카테고리 목록 API 응답(순서 포함)에 반영된다 (`categories` — 단일 계층, 하드코딩 금지)
2. **Given** 상품이 속한 카테고리 **When** 삭제 시도 **Then** 소속 상품이 있으면 거부하고 사유를 알린다 (DB RESTRICT는 3.2에서 products FK와 함께 — 이 스토리는 API 삭제 동작까지)

## Tasks / Subtasks

- [x] Task 1: 마이그레이션 (Slur 승인 2026-07-16 — name UNIQUE varchar(30), sort_order int)
- [x] Task 2: API — GET /categories (공개 — 구매자 목록 필터용, 순서 정렬), admin: POST/PATCH(이름)/PUT 순서 일괄/DELETE. name 중복 409 `category_name_exists` (R6), 공백 검증
- [x] Task 3: 웹 /admin — 탭 구조로 확장(입점 신청 | 카테고리), 생성·이름 수정·위/아래 이동·삭제
- [x] Task 4: 테스트 — CRUD·순서 변경 반영·중복 이름 409·비관리자 403·공개 목록 무인증 200
- [x] Task 5: 배포 → **Slur 실사용 검증**: 실제 시작 카테고리 생성 (R8 변형)

## Dev Notes

- 순서 변경: PUT /admin/categories/order {"ids": [정렬된 전체 id]} — 개별 swap보다 단순·원자적
- categories는 products 도메인 소유 (스파인 구조). 공개 GET은 인증 불필요 (상품 진열용)
- R5: 해당 보류 없음. products FK(RESTRICT)는 3.2 마이그레이션에서

## Dev Agent Record

### Agent Model Used

Claude Fable 5 (claude-fable-5)

### Completion Notes List

### File List
