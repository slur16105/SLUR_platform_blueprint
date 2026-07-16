---
baseline_commit: 0a4f544598e0d7754e6472e0f4b66656bfed9eec
---

# Story 1.5: Flutter 로그인 화면

Status: in-progress

## Story

As a 구매자,
I want 앱에서 이메일 또는 카카오로 가입·로그인하는 것,
so that 앱에서 쇼핑을 시작할 수 있다.

## Acceptance Criteria

1. **Given** Flutter 앱(Android) **When** 이메일 가입/로그인 또는 카카오 로그인 **Then** 토큰이 플랫폼 보안 저장소(Android Keystore 기반 secure storage)에 저장되고 홈(빈 화면)에 진입한다
2. **And** access 만료(401) 시 refresh로 자동 갱신되고, 갱신 실패 시 로그인 화면으로 이동한다

## Tasks / Subtasks

- [x] Task 0 (백엔드): 네이티브 카카오 엔드포인트 — `POST /api/v1/auth/kakao/native` `{"kakao_access_token"}`
  - [x] `kakao.py`: `/v1/user/access_token_info`로 **app_id가 우리 앱과 일치하는지 검증**(타 앱 토큰 대입 차단 — 필수), 기존 /v2/user/me 파싱 재사용(헬퍼 분리). config에 `kakao_app_id` 추가 (콘솔 앱 ID, 숫자)
  - [x] service.kakao_login을 identity 공용으로 리팩터 (code 경로·native 경로 동일 계정 로직), respx 테스트 (app_id 불일치 401 포함)
- [x] Task 1 (앱 기반): 의존성 `flutter_riverpod`(있음)·`flutter_secure_storage`·`kakao_flutter_sdk_user ^2.0`·`dio`(또는 http). API 클라이언트 + 토큰 저장소 + 401 자동 refresh 인터셉터 (동시 401 시 단일 refresh — 회전 레이스 방지, 1.2 학습)
- [x] Task 2 (화면): 로그인(이메일/비번 + "카카오로 시작하기" 버튼) · 가입(이메일·비번·이름·선택 휴대폰) · 홈(me 정보 표시 + 로그아웃). 에러 봉투 `message` 그대로 표시, `code`로 분기
- [ ] Task 3 (카카오): `KakaoSdk.init(nativeAppKey)`(--dart-define), `isKakaoTalkInstalled()` → loginWithKakaoTalk(폴백 loginWithKakaoAccount) → 카카오 access token → `/auth/kakao/native`. AndroidManifest에 v2 핸들러(`com.kakao.sdk.flutter.auth.AuthCodeHandlerActivity`, `kakao{NATIVE_KEY}` 스킴). applicationId `com.slur.mobile`로 변경
- [ ] Task 4 (검증): flutter analyze + 에뮬레이터/실기기에서 이메일 가입→홈→앱 재시작 시 자동 로그인→로그아웃, 카카오 원탭 로그인 E2E (프로덕션 API 대상 — 1.3의 보류였던 실 카카오 E2E가 여기서 완성됨)

## Dev Notes

### 플로우 결정 (리서치 확정 — research 근거)

SDK 원탭 로그인 채택. SDK의 인가 코드는 네이티브 앱 키로 발급되어 REST 키 교환 불가(KOE101, 카카오 공식 비권장) → 카카오 access token을 받아 서버가 `access_token_info`의 **app_id 검증** 후 신원 조회. state/PKCE는 SDK가 앱 서명+패키지명 바인딩으로 대체 (1.3 보류 항목의 네이티브 측 해소). 웹(1.6)은 기존 code 플로우 + 서버 state 검증 예정.

### Slur 콘솔 설정 (구현과 병행)

1. 플랫폼 > Android 등록: 패키지명 `com.slur.mobile`, 키 해시 `JsroxPINv/xz/3LGAg+fVLMyH3w=` (디버그·이 Mac)
2. 앱 키 화면의 **네이티브 앱 키**를 제공 (KakaoSdk.init용 — 시크릿 아님, dart-define 주입)
3. 앱 ID(숫자, 앱 설정>요약정보) 제공 → 백엔드 KAKAO_APP_ID

### 승계·규칙

- 서버 계약: TokenResponse·에러 봉투(code 분기·한국어 message 표시). 401 unauthorized ↔ 갱신, invalid_token ↔ 재로그인
- flutter_secure_storage는 Android Keystore 백엔드 (AC 1). API 베이스 URL은 --dart-define (기본 프로덕션)
- 슬러 시스템 CSS는 웹 전용 — Flutter는 Material 기본, 화면 미학은 v1 범위 아님 (동작 우선)
- 카카오 신규 에러 code: 백엔드 `invalid_kakao_token`(401)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
