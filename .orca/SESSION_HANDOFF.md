---
state: ready
owner: Claude + Dan
updated_at: 2026-07-26
active_workflow: 없음 — 카카오 로그인·샘플 데이터 완료. 8.1~8.7 done 게이트(실기 검증 ③) Dan 대기
blocked_on: "Dan의 실기 검증(③ 콘솔 회귀·주문 플로우·PWA)만 남음 — 이게 8.8 착수 조건"
---

# SLUR Platform Blueprint — 세션 핸드오프

## 2026-07-26 세션에서 완료한 것 (이전 ①②는 여기서 닫혔다)

- **① 카카오 로그인 — 완료·실왕복 성공 확인.** 콘솔 Web 플랫폼+Redirect URI 등록(Dan/헤르메스),
  Railway 변수 3개 `--set`(web `KAKAO_REST_API_KEY`·`KAKAO_REDIRECT_URI`, api `KAKAO_REDIRECT_URIS` — **변수 쓰기는 Claude 안전정책상 차단되어 Dan이 `!` 로 직접 실행**). Dan이 실제 로그인 성공.
  - **버그 1건 잡아 배포(커밋 `09d9536`)**: 카카오 콜백 성공 후 리다이렉트가 `new URL(dest, req.nextUrl)`로
    절대 URL을 만들어 프록시(Railway) 뒤 내부호스트 `0.0.0.0:8080`으로 샜다(ERR_CONNECTION_REFUSED).
    `leave()`를 **상대경로 Location**으로 바꿔 해소. 에러경로 실측(잘못된 state→Location `/login?e=state`)으로 검증.
    `lib/auth.ts:87`·`middleware.ts:20`이 이미 문서화한 내부 호스트 문제의 콜백판.
- **② 샘플 데이터 — 완료.** 데모 계정 **`demo-shop@slur.dev`**(admin+seller, 비번은 아래) 생성,
  카테고리 3개 추가(포스터·의류·잡화), 브랜드 **`샘플스토어`**로 상품 10개 등록(품절 3건, loremflickr 실사진).
  - ⚠️ **데모용** — 스톡 이미지 라이선스 불명, **오픈 전 실상품·실사진으로 교체**(오픈 게이트).
  - 데모 계정 자격: `demo-shop@slur.dev` / `Slur-demo-c11b7696!` (관리자·판매자 둘 다 로그인 가능, ③ 검증에 사용)

## 남은 것 — 순서대로

### ③ 직접 써보기 (1시간) — Claude가 못 하는 유일한 일 · 8.1~8.7 done 게이트

이제 샘플 데이터·카카오가 준비됐으니 바로 가능. 이게 8.1~8.7을 `done`으로 올리는 게이트이자 **8.8(Flutter 제거) 착수 조건**이다. (액션 A-E8-2) — 로그인은 `demo-shop@slur.dev` 사용.

| 확인할 것 | 왜 |
|---|---|
| **관리자·판매자 계정으로 로그인 → 기존 8개 화면 둘러보기** | 구매자 화면을 만들면서 콘솔을 안 깨뜨렸는지. **가장 중요** |
| Tab 키로 콘솔 화면 이동 | 파랑 포커스 링이 그대로인지(구매자 먹색이 새지 않았는지) |
| 구매자로 **담기 → 주문 → 취소** 각 1회 | 프로덕션 프록시 뒤에서 상태 변경이 되는지 (회고 R3) |
| 창 폭을 좁혔다 넓혔다 | 입력·선택이 초기화되지 않는지 |
| **폰에서 열어 홈 화면에 추가** | PWA 설치·standalone 동작 |

### ④ 말씀만 해주시면 되는 것

- **로컬 태그 `archive/open-gate-review-2026-07-21`(커밋 `c484141`)는 다른 컴퓨터(이전 세션 머신)에만 있다** — 이 머신(miny332)에도, 원격에도 없다(원격 태그 0개). 올릴지 판단 필요. **푸시하려면 그 컴퓨터에서** `git push origin archive/open-gate-review-2026-07-21`
- **같은 브랜드명으로 두 팀 승인하지 않기** — 코드가 아니라 운영 규칙. 겹치면 장바구니에서 두 판매자가 한 묶음이 되고 배송비 2건이 1건처럼 보인다. 비용 0인데 어디에도 안 적혀 있다 (A-E8-9)
- **자동 검사 도구(`npm run check`) 채택 여부** — 안 해도 손해는 없다. 이미 만들어진 5개 명제가 회귀를 막고 있으니 "그대로 두고 늘리지 않기"도 유효한 선택 (A-E8-4)
- **부채 33건의 오픈 게이트 분류 승인** (A-E8-8)

### ⑤ 오픈 전 법률 검토 때 함께 물어볼 것

- **약관 동의 기록이 서버에 안 남는다** — 화면에선 필수 체크인데 저장 필드가 없다. 보관이 법적으로 요구되는지
- **입금 계좌가 한 줄뿐** — `국민 123-456 (예금주 슬러)` 식으로 한 문자열에 다 넣어야 한다. 구매자가 입금할 때 가장 많이 읽는 정보
- **중개자 고지 문구**의 법적 적정성 (정본은 `apps/web/app/config/company.ts`의 `BROKER_NOTICE`)
- **제3자 스크립트 고지** — 다음 우편번호 검색과 Pretendard 글꼴을 외부에서 로드한다

## 지금 상태

**Epic 8(구매자 반응형 웹) 코드가 전부 프로덕션에서 돌고 있다.** 8.1~8.7 코드 완료, **카카오 로그인·샘플 데이터까지 실동작**. 남은 건 ③ 실기 검증(→ 8.1~8.7 done) → **8.8(Flutter 제거)**.

- 프로덕션: `https://web-production-abfe1.up.railway.app` (카카오 로그인 정상)
- `main`과 `origin/main` 동기(커밋 `09d9536` 배포됨), 이 변경 커밋 후 작업 트리 clean 유지 필요
- Epic 8 액션: A-E8-1·3·6·7·10 완료, A-E8-4 프로토타입 제출, **잔여 Dan: A-E8-2(③)·8·9 + A-E8-5(uv/docker)**
- 부채 33건 중 3건 해소

## 이번 세션에서 잡은 진짜 버그 (참고)

문서·타입 검사로는 못 잡히는 종류였다.
- `overflow-x: hidden`이 앱 전체 `position: sticky`를 죽이고 있었다 (선언은 맞는데 스크롤해야 보임)
- `clearSessionCookies`가 refresh 쿠키를 한 path만 지웠다 — 로그아웃 후 세션이 되살아날 수 있었다
- 인증 BFF에 `Cache-Control`이 없어 이름·주소·주문이 캐시 가능했다
- 콘솔 BFF 9개에 Origin 검사가 없어 임의 사이트가 판매자·관리자를 강제 로그아웃시킬 수 있었다
- ≥768 주문서에서 중개자 고지가 `주문하기`보다 아래에 있었다 (FR-32 규제 요건)
- `formatPhone`이 서울 번호를 `021-234-5678`로 끊었다

전부 수정·배포 완료. 다섯 번째까지는 `npm run check`의 명제로도 남겼다.

## 환경 제약 (머신마다 다름 — 확인하고 시작할 것)

- `apps/web`에 테스트 프레임워크 없음 → `tsc`·`lint`·`build`·헤드리스 렌더·프로덕션 curl로 검증
- **2026-07-26 이 머신(miny332)**: `railway` CLI 있음·로그인됨(프로젝트 `slur-platform`/production 링크), `apps/web` node_modules 있어 `next dev` 로컬 기동 가능. **단 `railway variables --set`(쓰기)·`--list`(읽기)는 Claude 안전정책 classifier가 차단** → Railway 변수 변경은 Dan이 `!` 로 직접.
- **`uv`·`docker`(실행)·`flutter` CLI 없음**(추정 유지) → `apps/api` pytest·로컬 백엔드 불가. 로컬 웹은 `API_BASE_URL=<프로덕션 api>`로 프로덕션 API에 붙여 검증(스토리 8.3 방식). 프로덕션 API: `https://api-production-8bfb.up.railway.app`
- 프로덕션 admin 부여 경로: `railway run --service api uv run python -m app.auth.bootstrap <email>` (이번에 실사용)
- push는 HTTP/1.1로 설정돼 있다(HTTP/2에서 500)

## 세션 종료 시 반드시 갱신할 항목

- `state`: `ready` / `blocked` / `in-progress`
- 완료한 작업과 검증 결과
- Git commit / push 상태
- 다음 BMAD 스킬과 구체적 다음 액션
- Dan의 결정이 필요한 사항
