---
state: blocked
owner: Claude + Dan
updated_at: 2026-07-27
active_workflow: BMad UX Update — 구매자 홈 재설계 시안 3안 제출 완료, Dan 선택 대기
blocked_on: "Dan의 시안 선택(Q1) + Q0·Q2~Q5 결정. 그 전 세션의 실기 검증(A-E8-2)도 그대로 남아 있다"
---

# SLUR Platform Blueprint — 세션 핸드오프

## 2026-07-27 (오후) — BMad UX Update · 구매자 홈 재설계 시안 3안

**대상은 구매자 홈 `/` 한 화면이다. 앱 소스는 한 줄도 수정하지 않았다.** 산출물은 기존 UX 런 폴더의
`.working/` 아래에만 쌓았고, `DESIGN.md`·`EXPERIENCE.md` 스파인은 **아직 갱신하지 않았다** — Dan 선택 후 Finalize에서 한 번에 넣는다.

`_bmad-output/planning-artifacts/ux-designs/ux-SLUR_platform_blueprint-2026-07-21/.working/`

| 파일 | 내용 |
|---|---|
| `home-compare.html` | **여기서 시작** — 3안 요약 카드 + 결정 사항 6건 |
| `home-a-preface.html` | 시안 A · 서문 — 큐레이션 자리를 **카테고리**가 채운다. 새 데이터·API·관리자 화면 **0건** |
| `home-b-invitation.html` | 시안 B · 초대 — 큐레이션 자리를 **브랜드(판매자)**가 채운다. 브랜드별 공개 조회 1건 |
| `home-c-feature.html` | 시안 C · 편성 — **운영자 편성 슬롯**. 새 테이블 1 + 관리자 편성 화면 1 (**PRD 화면 목록 밖**) |
| `HOME-COMPARISON.md` | 차이·장단점·SLUR 적합성·구현비용·스파인 반영 예정 항목 |
| `home-shared.css` | 3안 공통 지면 (토큰 이름을 실코드 `--b-*`와 1:1로 맞췄다) |

브라우저에서 `file://`로 바로 열린다. **네 HTML은 `home-shared.css`를 함께 쓰므로 옮길 때 다섯 파일을 같이 옮긴다.**
외부 리소스·JavaScript 0건, 사진 자리는 CSS 색면이다.

### 검증 결과 (실측)

헤드리스 크롬으로 390px·1280px 렌더 후 **좌측 정렬선을 DOM 실측**했다. 그 과정에서 결함 2건을 잡아 수정했다.

- **`.b_strip`의 `scroll-snap-type`이 적재 직후 컨테이너를 좌측 패딩만큼 자동 스크롤**시켜, 첫 카드가 다른 요소의 정렬선에서 32px 어긋났다 → 스냅 제거. **스크린샷만 봤으면 놓쳤을 종류다.**
- 시안 B 히어로 2단 그리드에 `padding-inline`이 없어 이미지가 상단바·그리드보다 32px 왼쪽에 섰다 → gutter 부여.
- 수정 후 전 요소 좌측 정렬선 **132px(@1280) · 21px(@390)** 일치 확인. 의도된 예외는 C 히어로와 모바일 히어로의 full-bleed 이미지뿐이다.

### Dan 결정 필요 (이게 다음 세션의 입구다)

| # | 결정 |
|---|---|
| **Q0** | 참고 사이트(`wch.eqlstore.com/main`)가 **클라이언트 렌더링이라 자동 열람으로는 푸터만 회수됐다.** 히어로·기획전 구성은 관찰이 아니라 에디토리얼 커머스 일반 문법으로 대체 설계했다. 실화면 스크린샷을 `imports/`에 넣을지, 이대로 확정할지 |
| **Q1** | **A · B · C 중 선택** (또는 조합). 나머지 결정이 전부 여기 걸린다 |
| **Q2** | B 선택 시 B-1(소개 문장 없음, 필드 추가 0) / **B-2(브랜드 한 줄 소개 필드 추가 — ERD 변경이라 승인 필요)** |
| **Q3** | **홈에 푸터를 둘 것인가** — 지금 구매자 표면에 푸터가 없다(법적 고지는 `/me`). IA 표에도 푸터 행이 없다 |
| **Q4** | 홈이 2~4배 길어진다 — 상품상세에서 뒤로 왔을 때 **스크롤 복원**을 할지 |
| **Q5** | B 선택 시 **팀 노출 순서** (승인일 역순 / 운영자 지정 / 무작위) |

### 다음 액션

1. Dan이 Q1(+Q0) 결정 → `bmad-ux` **Update 모드 Finalize**로 `DESIGN.md`(홈 히어로·큐레이션 섹션·스트립·푸터 컴포넌트)와 `EXPERIENCE.md`(홈 IA·섹션 빈 상태) 갱신
2. 그 뒤 `bmad-create-story`로 홈 재설계 스토리 생성 → 구현
3. C 선택 시에만 `epics.md`·PRD 화면 목록 개정이 선행한다

### 이번 작업에서 하지 않은 것 (의도적)

- 앱 소스 수정 0건. `apps/web`·`apps/api` 모두 손대지 않았다
- `DESIGN.md`·`EXPERIENCE.md` 스파인 갱신 — 선택 전에 넣으면 되돌려야 한다
- PRD 화면 목록 밖 기능 추가 0건. **검색·리뷰·별점·찜·쿠폰·알림은 3안 어디에도 그리지 않았다** (참고 사이트 상단에는 검색이 있으나 v1 제외 목록이라 뺐다)

### ⚠️ 표준 시작 스크립트 실패 (이번 범위 밖 — 고치지 않았다)

`scripts/orca_next_session.py`가 터미널 제목 `None`으로 **TypeError**를 내며 실패한다고 Dan이 보고했다.
이번 세션은 스크립트를 우회해 수동으로 진행했다.

- **원인 지점: `scripts/orca_next_session.py:66`** — `terminal.get("title", "")`의 기본값은 **키가 없을 때만** 적용된다.
  Orca가 `"title": null`을 내려주면 `None`이 그대로 반환되고 `"BMAD" in None`에서 `TypeError: argument of type 'NoneType' is not iterable`가 난다.
- `status` 서브커맨드는 이번에 정상 동작했다(터미널 목록이 비어 있어 그 줄을 타지 않았다). 재현 경로는 BMAD 터미널이 살아 있을 때다.
- **고치지 않았다** — 이번 UX 산출물 작업의 범위 밖이라는 지시에 따랐다. 수정한다면 `terminal.get("title") or ""` 한 줄이다.

## 2026-07-27 — Hub맥 Docker 사전 운영 검증 환경

- Hub맥 Docker Compose로 Postgres → Alembic → FastAPI → Next.js 통합 기동을 구성하고 `npm run test` 통과.
- 운영 Supabase와 분리된 로컬 Postgres를 기본 DB로 유지. `.env.example`, `LOCAL_DOCKER.md`, 루트 `README.md`를 추가.
- `seed` 도구 프로필로 로컬 데모 카테고리 2개·상품 6개를 멱등 생성. Supabase Storage 미연결 시 포함된 로컬 이미지 fallback을 사용.
- 같은 Wi‑Fi 메인맥에서 `http://slur-hub.local:3000` 또는 Hub맥 LAN IP의 `:3000`으로 Web BFF·카탈로그 응답 확인.
- Railway·Supabase 운영 데이터 및 비밀값은 변경하지 않음.

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
- 2026-07-27 UX 시안 산출물 커밋·push 후 `main`과 `origin/main`은 동기화됐다. 작업 트리는 clean 유지 필요
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

- Hub맥에 Docker Desktop 29.6.2 설치 완료. `docker compose up -d --build --wait`로 API·web·로컬 Postgres·Alembic을 함께 기동할 수 있다. 상세: `LOCAL_DOCKER.md`.
- 로컬 데모 카탈로그는 `docker compose --profile tools run --rm seed`로 생성한다. 운영 Supabase 데이터에는 연결·복사·수정하지 않는다.
- 화면 검증은 Hub맥의 실제 브라우저 또는 같은 Wi‑Fi 메인맥에서 `http://slur-hub.local:3000`으로 수행한다. 자동 브라우저 도구는 private localhost 접속이 차단된다.
- push는 HTTP/1.1로 설정돼 있다(HTTP/2에서 500)

## 세션 종료 시 반드시 갱신할 항목

- `state`: `ready` / `blocked` / `in-progress`
- 완료한 작업과 검증 결과
- Git commit / push 상태
- 다음 BMAD 스킬과 구체적 다음 액션
- Dan의 결정이 필요한 사항
