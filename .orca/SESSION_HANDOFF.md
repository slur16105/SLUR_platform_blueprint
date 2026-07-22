---
state: in-progress
owner: Claude + Dan
updated_at: 2026-07-22
active_workflow: Epic 8 코드 리뷰 반영
blocked_on: "없음(자동 진행 중). Dan 결정 대기 2건은 아래 — 진행을 막지 않는다"
---

# SLUR Platform Blueprint — 세션 핸드오프

## 한 줄 요약

**구매자 표면을 Flutter 앱에서 반응형 웹으로 전환하는 Epic 8의 코드가 전부 들어갔고(8.1~8.7), 프로덕션에서 돌고 있으며, 코드 리뷰 2종의 지적을 반영 중이다.** 남은 것은 실기 검증과 8.8(Flutter 제거)뿐이다.

## Epic 8 진행 상태

| 스토리 | 상태 | 남은 것 |
|---|---|---|
| 8.1 웹 셸·반응형 기반 | 구현 완료 · 프로덕션 검증 통과 | 실계정 콘솔 회귀 확인, 폭 드래그 실측 |
| 8.2 구매자 인증 (`buyer` 쿠키) | 구현 완료 | **카카오 Redirect URI 등록 후 실왕복 1회** |
| 8.3 상품목록·상품상세 | 구현 완료 (review) | 프로덕션 실데이터 렌더 |
| 8.4 장바구니 | 구현 완료 (review) | 프로덕션에서 담기·수량·삭제 각 1회 (R3) |
| 8.5 주문서·주문완료 | 구현 완료 | 프로덕션 POST 실요청 (R3) |
| 8.6 주문내역·상세·취소 | 구현 완료 (review) | 프로덕션 취소 1회 (R3) |
| 8.7 내 정보·PWA | 구현 완료 | **실기기 설치·standalone·아이콘 마스크** |
| 8.8 Flutter 보관·제거 | 스토리만 | 착수 게이트 미충족(8.1~8.7 done 아님) |

**프로덕션**: `https://web-production-abfe1.up.railway.app` — 구매자 홈·로그인·회원가입·보호 라우트 리다이렉트·manifest·아이콘 전부 확인됨. `theme-color`가 구매자 1건 / 콘솔 0건으로 갈리는 것도 프로덕션에서 확인.

## 코드 리뷰에서 나온 것 (2026-07-22)

**즉시 고쳤다 (커밋 `37d80a8`)** — 보안 4건
1. 인증 BFF 응답에 `Cache-Control`이 없어 PII가 캐시 가능했다 → `no-store, private` + `Vary: Cookie`
2. `clearSessionCookies`가 진짜 refresh 쿠키를 못 지웠다 — ResponseCookies가 **이름만으로** 키를 잡아 두 번째 호출이 첫 번째를 덮는다(`delete()`도 `set()`도). `Path=/api`의 쿠키가 14일 살아남아 세션이 되살아날 수 있었다 → Set-Cookie 헤더 직접 append
3. 로그아웃에 Origin 검사가 없어 임의 사이트가 강제 로그아웃시킬 수 있었다 → `assertSameOrigin`
4. `Origin: null`이면 봉투 없는 500 → 403 봉투(fail-closed)

**문서 정리 (커밋 `0176cb7`)** — 스파인 3곳 정정 + 부채 10건 등재

**수정 진행 중** — 계약·접근성 7건 + 죽은 코드 6건
가장 무거운 것: **≥768 주문서에서 중개자 고지가 `주문하기`보다 아래·문서 끝에 놓인다**(FR-32 규제 요건 위반). 그 외 혼합 묶음의 구매 불가가 색으로만 전달, 체크박스가 거짓 라벨, 로그인 직후 배지 빔, 재시도 규약 6곳 중 1곳만 다름 등.

## Dan의 결정이 필요한 것 (진행을 막지 않는다)

1. 🚨 **고아 태그 푸시** — 로컬 태그 `archive/open-gate-review-2026-07-21`이 가리키는 커밋 `c484141`이 `origin/main`의 조상이 **아니어서 이 머신에만 있다**. `git ls-remote --tags origin` 출력이 비어 있다(원격 태그 0개). 머신이 죽으면 소실. `git push origin archive/open-gate-review-2026-07-21` — 새 객체를 발행하므로 자동으로 하지 않았다
2. **8.8 실행 시점** — `apps/mobile` 삭제는 되돌리기 어렵다. 8.8 자신의 게이트가 "8.1~8.7 done"인데 실기 검증이 남아 미충족. **실기 검증 후 실행을 권장**. 실행 시 순서: 태그 생성 → push → `git ls-remote --tags origin` 실출력 확인 → 그 뒤에만 `git rm`
3. 🚨 **`KAKAO_REDIRECT_URIS`가 Railway에 미선언** — 이 상태로는 프로덕션 카카오 로그인이 100% 실패. 카카오 콘솔에 로컬·프로덕션 URI 2개 등록 + Railway 변수(R1대로 `--set` 후 즉시 확인)
4. **[오픈 게이트] 약관 동의 이력이 서버에 안 남는다 / 입금 계좌가 문자열 하나라 예금주 줄을 만들 수 없다 / 중개자 고지 문구의 법적 적정성 미검토 / 제3자 스크립트(다음 우편번호·Pretendard CDN) 고지**
5. 스파인 2종(`DESIGN.md`·`EXPERIENCE.md`) `status: draft` — 검토 후 `final` 전환 가능

## 환경 제약 (반복 확인됨)

- `apps/web`에 **테스트 프레임워크 없음** — 단위 테스트 도입은 의존성 추가라 스토리 범위 밖. 검증은 `tsc`·`lint`·`next build`·헤드리스 렌더·프로덕션 curl
- **`uv`·`docker` 없음** → `apps/api` pytest 실행 불가, 로컬 백엔드도 못 띄운다. 화면 검증은 스크래치패드 스텁으로 했다. 백엔드 무변경 증거는 `git diff --stat`의 `apps/api` 0건
- `railway` CLI 없음, `flutter`/`dart` CLI 없음
- 헤드리스 Chrome이 최소 500px 뷰포트를 강제 — 390·1280은 CDP `setDeviceMetricsOverride`로 우회
- push는 HTTP/2에서 500이 나서 `http.version HTTP/1.1`을 로컬 설정에 박아뒀다

## 이 에픽에서 발견한 진짜 버그 (문서만으로는 못 잡았을 것들)

- **`overflow-x: hidden`이 앱 전체의 `position: sticky`를 죽이고 있었다** — 8.1 상단바·8.4 요약 칼럼이 선언은 맞는데 실제로는 안 붙었다. 최소 재현으로 확정(hidden → top -500 / clip → 0). `clip` 한 단어로 해결
- **`formatPhone`이 서울 번호를 잘못 끊었다** — `0212345678` → `021-234-5678`. 02만 두 자리
- 위 보안 4건

## Git / 원격

`main`, `origin/main`과 동기. Epic 8 관련 커밋 20여 개가 푸시됨.

## 다음 액션

1. 리뷰 지적 코드 수정 완료 → 검증 → 커밋
2. Dan의 실기 검증 (콘솔 회귀 · 프로덕션 R3 · PWA 실기기 · 카카오)
3. Epic 8 회고 (`bmad-retrospective`) — 부채 35건 이상, 스파인 정정 7건, 실버그 3건이 쌓였다
4. 8.8 Flutter 보관·제거
5. 그 뒤 Epic 7(PG) — 7.4가 웹 결제 플로우로 재작성돼 있다

## 세션 종료 시 반드시 갱신할 항목

- `state`: `ready` / `blocked` / `in-progress`
- 완료한 작업과 검증 결과
- Git commit / push 상태
- 다음 BMAD 스킬과 구체적 다음 액션
- Dan의 결정이 필요한 사항
