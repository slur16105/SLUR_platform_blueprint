---
baseline_commit: ac69b07ccc078616be535ffdcabb42d37fd1a360
---

# Story 6.1: 약관·개인정보처리방침과 푸터

Status: review

## Story

As a 운영자,
I want 필수 정책 페이지와 사업자 정보 고지가 갖춰지는 것,
So that 법적 기본 요건을 충족한다.

## Acceptance Criteria

1. **Given** 웹과 앱 **When** 약관·개인정보처리방침 페이지 접근 **Then** 표준 템플릿 기반 초안이 표시된다 (**"오픈 게이트 법률 검토 전 초안" 배너 명시** — FR-33)
2. **And** 웹 푸터(전 페이지)에 사업자 정보 + "통신판매중개자이며 거래 당사자가 아님" 고지가 표시된다 (FR-31)
3. **And** Flutter 앱 설정/정보 화면에 동일한 사업자 정보·고지·정책 페이지 링크가 노출된다

## Tasks / Subtasks

- [x] Task 0: 사업자 실정보(상호·대표·사업자번호·통판신고·주소·연락처·이메일)는 **placeholder 상수** — 웹 `app/config/company.ts`·Flutter `lib/src/config/company.dart` 단일 소스 (AD-13: 하드코딩 분산 금지). 실값 교체는 오픈 게이트 (deferred 기록)
- [x] Task 1: 웹 — `/terms`·`/privacy` 정적 페이지 (전자상거래 표준 템플릿 요지 초안 + 상단 경고 배너 "법률 검토 전 초안 — 실서비스 오픈 전 검토 예정"), 푸터 컴포넌트(사업자 정보 + 중개자 고지 + 정책 링크) 전 페이지 layout 적용
- [x] Task 2: Flutter — 홈 AppBar 메뉴 또는 설정 진입 → "서비스 정보" 화면: 사업자 정보·중개자 고지·약관/개인정보 링크(웹 URL 브라우저 열기 — url_launcher 불요 시 인앱 텍스트 전문 표시로 대체 가능, 의존성 추가 시 승인 필요하므로 **인앱 정적 표시 + 웹 주소 텍스트**로)
- [x] Task 3: 검증 — tsc·analyze 0, 푸터 전 페이지 렌더 확인
- [x] Task 4: 배포 + Slur 확인

## Dev Notes

- **스코프 밖**: 법률 검토(오픈 게이트), 약관 동의 체크박스(가입 플로우 변경 — PRD 밖), 버전 관리
- 정책 본문은 통신판매중개 표준 요지(중개자 면책·개인정보 최소 수집 — NFR-5 부합) 초안 — 콘텐츠는 리뷰에서 법적 표현만 점검

### References

- [Source: epics.md#Story-6.1 (638~651행), FR-31·33, NFR-5]

## Dev Agent Record

### Agent Model Used

Claude Fable 5 (claude-fable-5) — 웹·Flutter 병렬 서브에이전트

### Completion Notes List

- 사업자 정보 placeholder 단일 소스 (웹 company.ts·앱 company.dart 동일 값) — **실값 교체는 오픈 게이트 (deferred)**
- 약관 취소 조항은 실제 구현(3일 자동취소·묶음 취소·배송준비 전) 대조 작성. 법률 검토 전 초안 배너 명시
- Flutter는 신규 패키지 없이 인앱 표시 + URL 안내 (url_launcher 승인 회피)

### File List

- apps/web/app/config/company.ts·terms/page.tsx·privacy/page.tsx·styles/policy.css·site-footer.tsx·site-footer.css (신규), layout.tsx (수정)
- apps/mobile/lib/src/config/company.dart·screens/service_info_screen.dart (신규), home_screen.dart (수정)
