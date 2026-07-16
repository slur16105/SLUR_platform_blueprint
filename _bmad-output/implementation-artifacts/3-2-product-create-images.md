---
baseline_commit: 6fd0f7d6f653cc771fce5e4559d84658faa961e0
---

# Story 3.2: 상품 등록 — 기본 정보와 이미지

Status: done

## Story

As a 판매자,
I want 상품명·가격·설명·이미지·카테고리로 상품을 올리는 것,
so that 구매자에게 즉시 노출된다.

## Acceptance Criteria

1. **Given** 판매자 역할 계정 **When** 상품 등록 (상품명·기본 가격·설명·카테고리 1개·대표 이미지 1장+추가 최대 10장) **Then** 검수 없이 즉시 노출 상태가 된다 (`products`·`product_images`)
2. **And** 모든 이미지 업로드는 FastAPI가 발급한 사전서명 URL 경유로만 이루어진다 (클라이언트에 Storage 키 없음)

## Tasks / Subtasks

- [x] Task 1: 마이그레이션 (Slur 승인 2026-07-16) — products(category FK **RESTRICT** — 3.1 보류였던 category_in_use 경로 활성화), product_images(sort_order 0=대표, product FK CASCADE)
- [x] Task 2: 이미지 presign API — POST /sellers/products/images/presign {content_type} → Supabase createSignedUploadUrl (토큰 수명 Supabase 고정 2시간 — 스펙 정정), 경로 `{seller_id}/{uuid}.{ext}`. jpeg/png/webp만, 버킷 5MB 제한
- [x] Task 3: 상품 API — POST /sellers/products (이미지 경로 1~11개: 대표+추가10, 본인 소유 경로 검증), GET /sellers/products (내 상품 목록). 등록 즉시 active
- [x] Task 4: 웹 — 판매자 센터에 상품 등록 폼 (이미지 파일 선택→presign→브라우저가 직접 Storage PUT→경로 수집→등록)
- [x] Task 5: 테스트 — 등록/이미지 0장 422/11장 초과 422/비소유 경로 403/카테고리 삭제 시 category_in_use 409(3.1 보류 이행)/presign 비판매자 403
- [x] Task 6: 배포 + Slur 실사용 검증 준비 (실제 상품 등록은 3.3 옵션까지 묶어서)

## Dev Notes

- Supabase Storage REST: POST {SUPABASE_URL}/storage/v1/object/upload/sign/{bucket}/{path} (service key) → {url, token}; 클라이언트 PUT {SUPABASE_URL}{url} (x-upsert 없음). 공개 읽기: /storage/v1/object/public/product-images/{path}
- R2 셀프체크: presign 요청 rate 상한은 보류(오픈 게이트 — 관리자·판매자 소수), 외부(Storage) 호출 5초 타임아웃+이형 방어, 실패 로깅
- R6 code 시드: `unsupported_image_type`(422), `too_many_images`(422 — validation), `invalid_image_path`(403)
- 이미지 경로 소유 검증: 경로 prefix가 `{seller_id}/`인지 확인 — 타 판매자 이미지 도용 차단
- variants(옵션·재고)는 3.3 — 이 스토리의 상품은 옵션 없는 상태로 저장되고, 구매자 노출은 3.5에서

## Dev Agent Record

### Agent Model Used

Claude Fable 5 (claude-fable-5)

### Completion Notes List

- 프로덕션 E2E: presign→실제 PNG 업로드(200)→상품 등록(active)→공개 이미지 URL(200), 정리 완료 (storage 삭제는 SQL 불가 — Storage API로만, 함정 기록)
- 리뷰 반영: 이미지 경로 presign 형식 정규식 검증(도용·오염·비존재 임의 문자열 일괄 차단), 카테고리 확인-커밋 레이스 404, presign 응답 이형 방어, 프런트 stale closure 카운터, presign 401 리다이렉트
- 버킷 allowed_mime_types(jpeg/png/webp)·5MB는 생성 시 설정 확인 (M-2 해소)
- 보류: 고아 이미지 정리 잡(오픈 게이트), too_many_images 전용 code(validation 422로 수용)

### File List

- apps/api/app/products/{models,schemas,service,storage}.py, app/sellers/router.py, app/core/config.py, alembic/versions/802baf4b79a7, tests/test_products.py
- apps/web/app/{seller/{page.tsx,products/new/{page.tsx,new.css}}, api/sellers/products/route.ts}
