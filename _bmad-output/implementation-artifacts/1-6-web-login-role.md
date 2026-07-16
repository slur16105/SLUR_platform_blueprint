---
baseline_commit: 97013f8750d804731e372a864e8600a5c9825bdd
---

# Story 1.6: 웹 로그인과 Role 분기

Status: in-progress

## Story

As a 판매자·관리자,
I want PC 웹에서 로그인해 내 역할의 화면으로 들어가는 것,
so that 판매·운영 업무를 시작할 수 있다.

## Acceptance Criteria

1. **Given** Next.js 웹 **When** 로그인 **Then** Role에 따라 판매자/관리자 랜딩(빈 화면)으로 분기한다
2. **And** 웹 토큰 보관 방식(httpOnly 쿠키 vs 메모리)이 이 스토리에서 확정·기록된다 (스파인 Deferred 해소)
3. **And** 역할 없는 계정(구매자만)이 웹에 로그인하면 안내 화면이 표시된다

## Tasks / Subtasks

- [x] Task 1: 토큰 보관 확정 — **httpOnly 쿠키 + Next.js Route Handler 프록시(BFF)** 채택
  - 근거: 판매자·관리자 세션은 권한이 높아 XSS로 토큰이 탈취되는 localStorage 계열을 배제. Next 서버가 FastAPI를 대리 호출하고 토큰은 httpOnly·Secure·SameSite=Lax 쿠키로만 — 브라우저 JS는 토큰을 만질 수 없다. FastAPI 계약 불변(AD-1: 판정은 여전히 FastAPI, Next의 role 분기는 UX 라우팅일 뿐)
- [x] Task 2: Route Handlers — /api/auth/login·logout·me (FastAPI 프록시, 쿠키 설정/삭제, access 만료 시 refresh 재시도)
- [x] Task 3: 화면 — 로그인 페이지(슬러 디자인 시스템 적용), 판매자 랜딩(빈), 관리자 랜딩(빈), 역할 없음 안내. middleware로 미로그인 → /login 리다이렉트
- [x] Task 4: 검증 — 로컬(dev)에서 관리자 계정 로그인→관리자 랜딩, 구매자 계정→안내 화면. 프로덕션 배포 후 동일 확인 (Slur 계정 = admin)
- [x] Task 5: 웹 로그인은 이메일만 (카카오 웹 로그인은 구매자용 — 판매자·관리자 접점엔 불필요, 필요 확인 시 추가)

## Dev Notes

- 쿠키: slur_access(30분)·slur_refresh(14일), httpOnly+Secure+SameSite=Lax, path 제한(refresh는 /api/auth)
- Next 서버 → FastAPI는 서버간 호출 (API_BASE_URL 환경변수) — CORS 불필요 경로
- role은 로그인 응답의 /auth/roles 결과를 non-httpOnly 쿠키(slur_role — UX 라우팅 힌트 전용, 보안 판정 아님)로
- 슬러 시스템: slur-ux(문법)·slur-design(토큰) 스킬 적용 — 웹 첫 화면이므로 여기서 시드
- CSRF: SameSite=Lax + 상태 변경은 POST — v1 수용, 오픈 게이트에서 재검토

## Dev Agent Record

### Agent Model Used

Claude Fable 5 (claude-fable-5)

### Completion Notes List

### File List
