---
baseline_commit: d9228db7cb07ae1da34c0509aa8be236ab28a758
---

# Story 8.7: 내 정보와 PWA 기반

Status: ready-for-dev

> **선행 조건.** 8.1(셸·토큰·미들웨어)·8.2(로그인·로그아웃 BFF)가 끝나 있어야 한다. **8.6(주문내역·주문상세)와는 파일이 겹치지 않지만 같은 기간에 진행 중**이므로,
> 착수 시점에 `app/(buyer)/orders/**`·`app/api/orders/**`가 중간 상태일 수 있다. **이 스토리는 그 파일들을 열지도 고치지도 않는다.**
> 유일한 접점은 `/me`의 메뉴 줄에 있는 `주문내역` 링크(`/orders`)이며, 8.6이 그 라우트를 이미 만들어 두었으므로(8.1의 자리표시 대체) 링크는 어느 쪽 상태에서도 유효하다.
>
> 이 스토리로 **Epic 8의 구매자 화면 9개가 전부 선다.** 남은 것은 8.8(Flutter 제거)뿐이다.

## Story

As a 구매자,
I want 내 계정과 SLUR가 어떤 사업자인지 확인하고, 홈 화면에서 바로 여는 것,
So that 앱 스토어 없이도 앱처럼 쓸 수 있고 누구와 거래하는지 알 수 있다.

## Acceptance Criteria

1. **Given** 로그인 상태의 `/me` **When** 진입 **Then** 상단에 `계정` eyebrow · **이름**(20px 계열) · **이메일**이 표시된다
   - **And** 상단바는 `title`(**좌측 정렬** `내 정보`)이고 **탭바가 선다** — 셸 호출은 `tab="me"`, `showTabbar`. 최상위 4화면 중 하나다 (UX-DR3)
   - **And** 컨테이너는 **최대 폭 640px 한 단**(`.b_container.m_read`)이며 폭이 아무리 넓어도 2단으로 갈라지지 않는다 (UX-DR4)
   - **And** 이름·이메일은 `GET /api/v1/auth/me` 응답을 **그대로** 쓴다. 이메일이 `null`인 계정(소셜 전용)에서는 그 자리를 `—`로 지킨다 — 줄을 지우지 않는다
   - **And** **`가입 방식` 줄을 만들지 않는다** (D2) — API가 가입 경로를 내려주지 않는다. 목업의 그 한 줄은 이 스토리에서 서지 않는다
   - **And** **회원정보 수정·배송지 관리·찜·전화번호 표시를 붙이지 않는다** — v1 밖이다 (EXPERIENCE §IA 확정)

2. **Given** `/me`의 메뉴 줄 **When** 렌더 **Then** `주문내역`(→ `/orders`) · `이용약관`(→ `/terms`) · `개인정보처리방침`(→ `/privacy`) 세 줄이 위 1px hairline · 아래 8px 종이 접기 띠 구획 안에 놓인다 (FR-33, UX-DR12)
   - **And** 각 줄은 **행 전체가 링크**이고 높이가 44px 이상이다 (UX-DR7)
   - **And** 우측 셰브런은 **CSS 도형**으로 그린다 — 새 인라인 SVG를 만들면 `[data-surface="buyer"] svg`의 `stroke-width` 전역 규칙을 물려받는다 (8.4 학습 12)
   - **And** 메뉴에 **주문내역 외의 앱 기능을 더하지 않는다** — 이 줄은 내비게이션이지 설정이 아니다

3. **Given** `/me`의 사업자 정보 구획 **When** 렌더 **Then** `사업자 정보` 라벨 + **`임시 정보` 태그**가 한 줄에 놓이고, 그 아래 상자에 **상호 · 대표자 · 사업자등록번호 · 통신판매업 신고번호 · 주소 · 연락처** 6행이 라벨-값 행으로 표시된다 (FR-31, UX-DR10)
   - **And** 값은 전부 `app/config/company.ts`의 **`COMPANY` 상수를 임포트**해서 온다 — 화면 코드에 상호·번호·주소 문자열을 다시 쓰지 않는다 (AD-13)
   - **And** 상자 아래에 `실사업자 정보는 서비스 오픈 전에 교체됩니다.`가 표시된다 (UX-DR10 — 글자 그대로)
   - **And** 그 아래에 **중개자 고지**가 표시되며 8.3이 만든 `<BrokerNotice />`를 **그대로 재사용**한다 — 문장을 복사하지 않는다 (문구 정본은 `BROKER_NOTICE` 상수다)
   - **And** 고지는 **접히지 않는다.** 모달·별도 페이지·`더보기` 뒤로 숨기지 않는다 (UX-DR10)
   - **And** `임시 정보` 태그와 `실사업자 정보는…` 문장은 **placeholder를 실제 정보로 오인하지 않게 하는 장치**이며, 실정보 교체는 오픈 게이트 항목이다

4. **Given** `/me` 하단의 로그아웃 **When** 누름 **Then** `POST /api/auth/logout`(기존 BFF)이 실행되어 `slur_access`·`slur_refresh`(현·구 path)·`slur_role` 세 쿠키가 지워지고 **`/`로 이동**한다 (에픽 8.2 AC의 "로그아웃 → `/`"를 여기서 충족한다)
   - **And** 이동 후 `router.refresh()`로 Router Cache 잔상을 지운다
   - **And** **장바구니 배지가 즉시 사라진다** — 같은 레이아웃 안 이동이라 `CartCountProvider`가 remount되지 않으므로, 이동 전에 `setCount(undefined)`를 호출한다 (D4)
   - **And** 🚨 **콘솔 공용 `app/logout-button.tsx`를 수정하지 않는다** — 9개 판매자·관리자 화면이 같은 컴포넌트를 쓰고 목적지는 `/login`이다. 구매자용 버튼을 따로 만든다
   - **And** `app/api/auth/logout/route.ts`와 `lib/auth.ts`의 `clearSessionCookies`도 **수정하지 않는다** (8.2 D7)
   - **And** 버튼 모양은 **약한 텍스트 버튼**이다 — 면 없는 12.5px 밑줄 글자, 위 1px hairline. 빨강·경고색을 쓰지 않는다 (이 팔레트에 빨강이 없다)

5. **Given** 로딩·오류·세션 만료 **When** 각 상황 **Then**
   - 최초 로딩: **블록 골격**(`.b_block_skeleton`) — 화면 중앙 스피너를 쓰지 않는다 (UX-DR9)
   - `GET /api/auth/me` 실패: 봉투의 `message` + `다시 시도` 수단
   - `401`: `router.replace("/login?next=%2Fme")` — **미들웨어 통과는 인증이 아니다**(`slur_role` 14일 > `slur_access` 30분, AD-1·R7)
   - **And** 계정 정보를 못 받아도 **사업자 정보·중개자 고지·약관 링크는 그대로 보인다** (D3) — 법적 고지가 API 실패에 딸려 사라지면 FR-31·33 회귀다
   - **And** **HTTP 상태 코드와 `code` 문자열이 화면 어디에도 나타나지 않는다** (분기는 `code`, 표시는 `message` — UX-DR9)

6. **Given** `app/manifest.ts` **When** 브라우저가 `/manifest.webmanifest`를 로드 **Then** `name`·`short_name`·`description`·`id`·`start_url`(`/`)·`scope`(`/`)·`display: "standalone"`·`lang: "ko"`·`theme_color`/`background_color`(종이색 `#faf8f4`)·`icons`(192·512 + maskable 512)가 정의된다 (NFR-7)
   - **And** `start_url`이 `/`이고 그 화면은 **비로그인 공개 화면**이다 — 설치 직후 실행이 `/login`으로 튕기지 않는다 (UX-DR11)
   - **And** 문서에 `<html lang="ko">`가 유지된다 (UX-DR16 — 8.1이 이미 충족, 이 스토리는 깨뜨리지 않는다)
   - **And** **설치 유도 배너·자동 팝업·`beforeinstallprompt` 가로채기를 만들지 않는다** (UX-DR16)
   - **And** manifest는 공개 경로다 — 미들웨어 matcher에 넣지 않는다

7. **Given** 아이콘 **When** 준비 **Then** `public/icons/icon-192.png`·`icon-512.png`·`icon-maskable-512.png`와 `app/icon.png`(탭 아이콘)·`app/apple-icon.png`(180×180)가 **저장소에 커밋된 정적 파일**로 존재한다
   - **And** **npm 의존성을 추가하지 않고** 만든다 (D8 — 헤드리스 Chrome 캡처 또는 Next 내장 `next/og`)
   - **And** maskable 아이콘은 **안전영역 80%** 규칙을 지킨다 — 마크가 한 변의 80% 안에 들어가고 나머지는 배경색(`#faf8f4`)으로 채워진다
   - **And** create-next-app 잔재인 `app/favicon.ico`(Next.js 로고, 25,931바이트)를 **삭제**한다 — 커머스 서비스의 탭에 Next 로고가 뜨는 것을 v1까지 끌고 가지 않는다. 이는 콘솔 탭 아이콘도 함께 바뀌는 **의도된 변경**이며 페이지 안의 색·레이아웃은 건드리지 않는다

8. **Given** `theme-color` **When** 각 표면의 문서를 렌더 **Then** 구매자 문서(`/`·`/products/*`·`/cart`·`/checkout`·`/orders*`·`/me`)에만 `<meta name="theme-color" content="#faf8f4">`가 실리고, **콘솔 문서(`/seller`·`/admin`·`/apply`·`/login`·`/terms`·`/privacy`·`/no-role`)에는 이 메타 태그가 없다** (D6)
   - **And** 루트 레이아웃(`app/layout.tsx`)에 `viewport`/`themeColor`를 선언하지 않는다 — 선언하면 콘솔 문서까지 종이색 크롬을 쓰게 된다
   - **And** `maximumScale`·`userScalable: false`를 선언하지 않는다 — 글자 200% 확대 요구(UX-DR7)와 충돌한다

9. **Given** service worker **When** 이 스토리를 완료 **Then** **service worker를 등록하지 않는다** (D7)
   - **And** `next-pwa`·`workbox` 등 **어떤 라이브러리도 추가하지 않는다** — `package.json`·`package-lock.json` diff 0건
   - **And** 그 판단의 근거와, **훗날 넣게 될 때 지켜야 할 캐시 계약**(정적 해시 자산만 캐시 / HTML 내비게이션·`/api/**`·인증·장바구니·주문·재고 응답은 **절대 캐시 금지** / kill switch)이 스토리에 기록된다
   - **And** 오프라인 전용 화면·백그라운드 동기화·푸시 알림을 만들지 않는다 (에픽 AC)
   - **And** ⚠️ **안드로이드 크롬 실기기에서 설치가 되지 않고 그 원인이 service worker 부재로 확인되면**, D7의 "조건부 최소 SW" 계약대로 추가하는 것이 후속이다 — 그 확인 전에는 추가하지 않는다

10. **Given** iOS 사파리 **When** 홈 화면에 추가 후 실행 **Then** `apple-touch-icon`이 적용되고 standalone으로 뜨며 구매자 화면이 정상 동작한다 (NFR-7)
    - **And** `appleWebApp` 메타는 **구매자 레이아웃에서만** 선언한다 — 콘솔 문서를 standalone 대상으로 만들지 않는다
    - **And** **`viewport-fit=cover`를 선언하지 않는다** (D9). 따라서 8.1이 `calc(56px + env(safe-area-inset-bottom))`에 넣어둔 `env()` 항은 **0으로 평가되며, 그것이 의도된 상태다** — 브라우저가 안전영역을 시각 뷰포트에서 이미 빼 준다. 8.1의 `[ASSUMPTION]`을 이 결정이 해소한다
    - **And** 실기기에서 하단 탭바가 홈 인디케이터에 가리지 않는지 확인한 결과를 스토리에 기록한다

11. **Given** 이 스토리의 모든 CSS **When** 작성 **Then** 8.1의 `--b-*` 토큰과 `.b_*` 타이포 역할 클래스만 쓴다 — **새 hex·새 px 스케일을 만들지 않는다** (UX-DR1)
    - **And** 구매자 파일에 `#2f6bff`·`--color-brand`·`--shadow-`·`box-shadow` 선언이 0건이다 (UX-DR12)
    - **And** 판매자·관리자 **화면 안**의 색·레이아웃·포커스 링이 한 픽셀도 바뀌지 않는다 (탭 아이콘은 AC 7의 의도된 예외)
    - **And** 새로 만드는 모든 컨트롤(메뉴 줄 3개·로그아웃·`다시 시도`)에 **먹색 포커스 링**이 보이고 파랑이 한 번도 나타나지 않는다 (UX-DR6)

12. **Given** 이 스토리 전체 **When** 완료 **Then** 백엔드가 변경되지 않는다 — `git diff --stat`에 `apps/api` **0건**, 마이그레이션 0건, 신규 엔드포인트 0개. 소비하는 API는 기존 2개(`GET /auth/me` · `POST /auth/logout`)뿐이다

13. **Given** 검증 **When** 실행 **Then** `npx tsc --noEmit` 0 · `npm run lint` **0 errors · 0 warnings**(A-E456-5 베이스라인) · `npx next build` 성공이 유지되고, **자동으로 확인한 것**(manifest JSON 파싱·아이콘 응답 200·메타 태그 유무·화면 렌더 4폭)과 **실기기로만 확인 가능한 것**(설치·standalone·홈 인디케이터)이 **갈라서** 기록된다
    - **And** `apps/web`에 **테스트 프레임워크를 도입하지 않는다** — 의존성 추가 0건

## 설계 판단 (이 스토리에서 확정 — 근거를 남긴다)

`EXPERIENCE.md` §Foundation의 `[ASSUMPTION]` **"PWA의 범위(manifest 항목, 오프라인 캐시 대상, 설치 유도 시점)는 아직 결정된 바 없다"** 를 **D5·D7·D8이 해소한다.**
PRD NFR-7의 `[ASSUMPTION]` **"오프라인 캐시 범위·설치 유도 시점은 구현 스토리에서 확정한다"** 도 같은 판단들이 받는다.
8.1이 남긴 `[ASSUMPTION]` 셋 — **iOS 오버스크롤 흰 배경**(D10) · **`env(safe-area-inset-bottom)`의 실제 값**(D9) · **Pretendard CDN**(D11) — 을 이 스토리가 정리한다.
[Source: EXPERIENCE.md#Foundation, prd.md#NFR-7, 8-1-buyer-web-shell.md#후속-스토리가-반드시-이어받아야-할-것]

### D1 — `/me`는 **웹 푸터의 모바일 대응**이다. 정보의 소유권은 `config/company.ts` 한 곳에 있다

**결정.** `/me`의 사업자 정보·중개자 고지는 `app/config/company.ts`의 `COMPANY`·`BROKER_NOTICE`를 **임포트**해서 그린다. 중개자 고지는 8.3이 만든 `<BrokerNotice />`를 재사용한다. 화면 코드에 문자열을 다시 쓰지 않는다.

```
apps/web/app/config/company.ts   (COMPANY · BROKER_NOTICE)
  ├─ app/site-footer.tsx            → 판매자·관리자·정책 페이지 (6.1)
  ├─ app/(console)/terms · privacy  → 약관 본문 (6.1)
  ├─ app/(buyer)/seller-info.tsx    → 상품상세·주문서의 중개자 고지 (8.3·8.5)
  └─ app/(buyer)/me/**              → 구매자 표면의 FR-31·33  ← 이 스토리
```

**근거.**
- **모바일에는 상시 푸터가 없다.** 8.1이 구매자 라우트에서 `SiteFooter`를 뺐고(AC 8), 그 순간부터 **구매자에게 FR-31·33이 닿는 경로는 `/me` 하나뿐**이다. 이 화면은 편의 기능이 아니라 규제 요건의 유일한 수용처다.
- **문자열을 복제하면 실정보 교체(오픈 게이트)가 여러 지점 수정이 된다.** 그날 하나를 빼먹는 것이 곧 법적 고지 회귀다. `BROKER_NOTICE`는 `COMPANY.name`에서 파생되므로 상호 한 줄만 고치면 네 표면이 동시에 바뀐다.
- **UX 스파인이 이미 이 상수를 정본으로 못 박았다** — "정본은 코드 상수 `apps/web/app/config/company.ts`의 `BROKER_NOTICE`다. 이 문서가 아니라 그쪽이 이긴다." (2026-07-22 스파인 정정, `deferred-work.md` 등재)
- **`임시 정보` 태그를 상품상세에는 두지 않고 `/me`에만 두는 이유**도 여기 있다 — 상품상세 6항목은 판매자 **실데이터**이고, placeholder인 것은 **플랫폼** 사업자 정보다. `seller-info.tsx`의 파일 주석이 이미 그렇게 선언해 두었다.

**시각 규격**(목업 확정본 `screens-2-account.html` `.biz`): 라벨 + `임시 정보` 태그(`.b_tag`, 액센트 글자 + `--b-accent-soft` 면) → **1px dashed 테두리 + `--b-surface-inset` 면 + 4px 라운드** 상자에 6행 → `--b-ink-quiet` 안내 한 줄 → 중개자 고지. 점선 테두리는 "아직 확정되지 않은 값"의 표기이며 이 지면에서 여기 한 곳에만 쓴다.

### D2 — **`가입 방식` 줄을 만들지 않는다.** 서버가 그 사실을 내려주지 않는다

**결정.** 목업 `내 정보`의 `가입 방식 / 이메일` 행을 **v1에서 그리지 않는다.** 계정 구획은 `계정` eyebrow · 이름 · 이메일 세 줄이다.

**근거.**
- 🚨 **`MeResponse`는 `{id, email, name, phone}`뿐이다.** `provider`도 `has_password`도 없다. `auth_providers` 테이블은 존재하지만 조회 API가 없다.
- **`email`의 유무로 추론할 수 없다.** `email is None ⇒ 소셜 전용`은 참이지만(회원가입은 이메일 필수), **역은 거짓이다** — 카카오는 `is_email_verified && is_email_valid`일 때 이메일을 채워 저장한다(`auth/kakao.py:92~97`, `service.py:161`). 즉 **이메일이 있는 카카오 계정에 `가입 방식: 이메일`이라고 쓰게 된다.** 한쪽 방향만 맞는 추론을 화면에 내는 것은 조용한 거짓말이다.
- **비대칭 표기(있을 때만 보여주기)도 채택하지 않는다** — 어떤 사용자에게는 있고 어떤 사용자에게는 없는 행은 "내 계정에 뭔가 빠졌다"로 읽힌다.
- **근본 해소는 `MeResponse`에 필드를 더하는 것**이며 백엔드 변경이라 Epic 8 경계 밖이다. `deferred-work.md`에 올린다(위험 2).
- **이메일이 `null`이면 그 줄은 `—`로 지킨다** — 8.6이 배송 정보 빈 값에 쓴 규칙과 같다. 행을 지우면 레이아웃이 계정마다 달라진다.

### D3 — 화면을 **두 층으로 가른다**: API가 필요한 계정 구획 / API 없이 서는 법적 고지

**결정.** `/me`의 서버 컴포넌트(`page.tsx`)가 셸과 **사업자 정보·메뉴 줄·고지**를 정적으로 그리고, `"use client"` 조각(`account-card.tsx`)만 `GET /api/auth/me`를 부른다. 로그아웃 버튼도 클라이언트 조각이다.

```
me/page.tsx            (서버) 셸 · 메뉴 줄 · 사업자 정보 · 중개자 고지   ← API 없이 선다
me/account-card.tsx    (client) 계정 구획 — 조회·골격·오류·401
me/logout-link.tsx     (client) 로그아웃 — 쿠키 제거 · 배지 리셋 · "/" 이동
me/me.css              화면 전용 배치
```

**근거.**
- **법적 고지가 API 실패에 딸려 사라지면 안 된다.** 계정 조회가 실패했다는 이유로 사업자 정보·중개자 고지·약관 링크가 빈 화면이 되면 그것이 FR-31·33 회귀다. 두 층을 갈라 두면 그런 결합 자체가 생기지 않는다.
- **`COMPANY`는 빌드 타임 상수**라 서버에서 그대로 렌더된다 — 클라이언트 번들에 계정 조회 로직만 실린다.
- **8.3~8.6이 세운 관례를 따른다** — 조회는 effect 안 async IIFE + `alive` 가드, 결과는 `{data, error} | null` 한 벌로 두고 **로딩을 파생**시킨다. 🚨 `react-hooks/set-state-in-effect`가 **lint error**이므로 effect 안에서 동기 `setState`를 하지 않는다 (A-E456-5).

### D4 — 로그아웃: **BFF는 그대로, 버튼만 구매자용으로 새로 만든다**

**결정.** `me/logout-link.tsx`를 신설한다. 동작 순서는 **(1) `POST /api/auth/logout` → (2) `setCount(undefined)` → (3) `router.replace("/")` → (4) `router.refresh()`** 다.

**근거.**
- **`app/logout-button.tsx`는 콘솔 9화면의 공용 부품이고 목적지가 `/login`이다.** 목적지 prop을 더하는 방법도 있지만, 그러면 **콘솔이 쓰는 파일의 시그니처가 바뀌고** 9개 화면이 회귀 검증 대상이 된다. 구매자 버튼은 모양(약한 텍스트 버튼)도 클래스(`.btn m_ghost`는 슬러 파랑 계열)도 다르므로 **공유할 실익이 없다.** 8.2 D7이 "8.7이 목적지 prop을 더하거나 구매자 전용 버튼을 새로 만든다"로 열어둔 선택지 중 후자를 택한다.
- **BFF와 `clearSessionCookies`는 이미 맞다** — refresh 서버 폐기(멱등) + 쿠키 3종(`slur_access`·`slur_refresh` 현·구 path·`slur_role`) 삭제까지 8.2가 검증했다. **한 줄도 바꾸지 않는다.**
- 🚨 **배지 리셋이 없으면 로그아웃 후에도 장바구니 숫자가 남는다.** `/me` → `/` 이동은 **같은 `(buyer)` 레이아웃 안의 클라이언트 내비게이션**이라 `CartCountProvider`가 remount되지 않는다. `router.refresh()`는 서버 컴포넌트를 다시 그릴 뿐 클라이언트 Context state를 비우지 않는다. 그래서 이동 **전에** `useCartCount().setCount(undefined)`를 호출한다. (`cart-count.tsx`는 수정하지 않는다 — `setCount`가 이미 공개 API다.)
- `replace`를 쓴다(`push` 아님) — 뒤로 가기로 로그아웃된 `/me`에 돌아가면 401 화면을 보게 된다.
- **확인 줄을 두지 않는다.** 로그아웃은 되돌릴 수 없는 파괴적 동작이 아니다(다시 로그인하면 된다). UX-DR16의 "확인 후 실행"은 `삭제`·`주문 취소`를 가리킨다.

### D5 — manifest: **`app/manifest.ts` 한 벌**, 앱 전체가 하나의 PWA다

**결정.**

```ts
// apps/web/app/manifest.ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "SLUR",                       // [ASSUMPTION] 정식 표기 미확정 — 위험 5
    short_name: "SLUR",
    description: "큐레이션형 디자인 편집숍",
    lang: "ko",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#faf8f4",
    theme_color: "#faf8f4",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
```

**근거.**
- **`start_url`이 `/`이고 그 화면은 비로그인 공개다** (UX-DR11, 8.1 AC 7 — 미들웨어 matcher에 `/`가 없어 아예 실행되지 않는다). 설치 직후 실행이 로그인 벽에 부딪히는 PWA는 첫인상에서 죽는다. 8.1이 랜딩을 폐기하고 `/`를 상품목록으로 만든 결정이 **여기서 설치 경험의 전제로 회수된다.**
- **`scope: "/"`는 콘솔 라우트까지 포함한다.** 좁히지 않는 이유: 한 계정이 여러 역할을 가질 수 있고(FR-3) 설치된 창에서 `/seller`로 이동하는 것이 정상 동선이다. scope를 `/`보다 좁히면 그 이동이 **외부 브라우저로 튀어나간다.**
- **manifest의 `theme_color`는 하나뿐이다** — 설치되는 것은 구매자 표면이므로 종이색이다. 문서별 `<meta name="theme-color">`와 값이 갈리지 않도록 D6과 짝을 맞춘다.
- **`app/manifest.ts`는 `/manifest.webmanifest`로 나가고 Next가 `<link rel="manifest">`를 자동으로 붙인다.** 정적 `manifest.json`이 아니라 `.ts`를 쓰는 이유는 **타입 검사**(`MetadataRoute.Manifest`)를 받기 위해서다 — 오타 난 필드가 tsc에서 잡힌다. [Source: next/dist/docs/…/01-metadata/manifest.md]
- **`shortcuts`·`screenshots`·`orientation`·`categories`를 넣지 않는다** — 설치 판정에 필요 없고 v1 완주에 기여하지 않는다.
- **설치 유도 UI를 만들지 않는다** (UX-DR16 — 자동 팝업 금지). 브라우저 기본 설치 경로에 맡긴다.

### D6 — `theme-color` 충돌: **메타 태그는 문서당 하나다 — 그래서 라우트 그룹별로 선언한다**

**결정.** `app/layout.tsx`에는 `viewport`를 **선언하지 않고**, `app/(buyer)/layout.tsx`에만 선언한다.

```ts
// apps/web/app/(buyer)/layout.tsx
export const viewport: Viewport = { themeColor: "#faf8f4" };   // 종이색
```

| 문서 | `<meta name="theme-color">` |
|---|---|
| `/`·`/products/*`·`/cart`·`/checkout`·`/orders*`·`/me`·`/login`·`/signup`(구매자) | `#faf8f4` |
| `/seller`·`/admin`·`/apply`·`/terms`·`/privacy`·`/no-role` | **없음**(지금과 동일) |

**근거.**
- **"한 앱에 메타 태그는 하나"는 사실이 아니다 — 한 *문서*에 하나다.** 그리고 이 앱의 모든 문서는 `(buyer)`·`(console)` 두 그룹 중 정확히 하나에 속한다(8.1 D2). Next의 `viewport` export는 **라우트 세그먼트 단위**로 해석되어 가장 깊은 선언이 이긴다. 따라서 충돌은 **그룹 레이아웃에 각각 선언하는 것으로 사라진다.** 서버가 기기나 역할을 판별해 분기하는 것이 아니라 라우트가 판별한다 (AD-14).
- **콘솔에는 아무것도 선언하지 않는다.** 슬러 시스템의 페이지 배경은 흰색이고 브라우저 기본 크롬과 어긋나지 않는다. 여기에 흰색을 명시하는 것은 **회귀 표면만 늘리는 변경**이다 — 이 스토리의 원칙은 "콘솔 문서의 `<head>`는 지금과 같다"이며, AC 8이 그것을 **메타 태그 유무로** 검증한다.
- **`(buyer)/layout.tsx`는 서버 컴포넌트다**(8.1이 `"use client"`를 붙이지 않은 이유가 주석에 남아 있다) — `viewport` export는 서버 컴포넌트 전용이므로 그대로 가능하다.
- **`maximumScale`·`userScalable`을 넣지 않는다** (8.1 Task 5의 규칙 승계 — 글자 200% 확대와 충돌).
- 대안 기각: 루트에 선언하고 콘솔에서 덮어쓰기 → 콘솔 문서의 `<head>`가 바뀌므로 "지금과 같다"를 잃는다. JS로 런타임에 메타를 바꾸기 → 표면 판별을 CSS·라우트가 아닌 스크립트가 하게 되어 AD-14의 방향과 어긋난다.

### D7 — service worker: **v1에 넣지 않는다.** 넣게 될 조건과 계약만 못 박는다

**결정.** 이 스토리는 service worker를 **등록하지 않는다.** `next-pwa`·`workbox` 등 라이브러리도 도입하지 않는다.

**근거.**
- **온라인에서 얻는 것이 사실상 0이다.** 캐시해도 되는 대상은 `/_next/static/**`의 **해시 붙은 불변 자산**뿐인데, 이것은 이미 `Cache-Control: immutable`로 브라우저 HTTP 캐시가 처리한다. SW를 얹으면 같은 일을 한 겹 더 하는 것이다.
- **캐시해서는 안 되는 것이 이 제품의 본체다.** 재고·장바구니·주문·인증 응답은 **구매자가 보는 사이에 움직인다**(EXPERIENCE §State Patterns). 오래된 재고를 보여주는 순간 이 제품의 핵심 계약이 깨진다 — 에픽 AC가 명시적으로 금지한 것이기도 하다. HTML 내비게이션 응답도 로그인 상태에 따라 달라지므로 캐시 대상이 아니다.
- **캐시할 수 있는 것과 없는 것을 다 빼면 남는 것이 없다.** 남는 유일한 기능은 "오프라인 전용 화면"인데 **에픽이 v1에서 금지**했다. 즉 이 스토리에서 SW가 할 일이 실제로 없다.
- **SW는 되돌리기가 비싸다.** 한 번 등록되면 사용자 브라우저에 남아 잘못된 캐시가 "옛 버전에 갇힌 사용자"를 만들고, 회수하려면 unregister 코드를 배포하고 그것이 도달하기를 기다려야 한다. **넣지 않으면 회수할 것도 없다.** 완주가 목표인 v1에서 이 비대칭은 결정적이다.
- **의존성 추가 금지 규칙과도 맞는다** — `apps/web`은 Next·React 세 패키지만 갖고 있고(테스트 프레임워크도 없다) 8.1~8.6이 전부 그 상태를 유지했다. `next-pwa`는 빌드 파이프라인에 손을 대는 종류의 의존성이라 더 무겁다.

**⚠️ 조건부 후속 — 설치 판정이 SW를 요구하는 경우.**
`[ASSUMPTION]` 안드로이드 크롬의 설치 판정 기준(manifest만으로 충분한지, fetch 핸들러를 가진 SW가 필요한지)은 **브라우저 버전에 따라 달라져 왔다.** 문서를 믿지 말고 **실기기에서 확인한다**(Task 8). 설치가 되지 않고 그 원인이 SW 부재로 확인되면, 아래 계약을 **그대로** 지키는 최소 SW를 추가한다.

| 항목 | 계약 |
|---|---|
| 파일 | `public/sw.js` (빌드 파이프라인 개입 없음) + `(buyer)` 안의 등록 조각. **라이브러리 없음** |
| 캐시 대상 | `same-origin` + `GET` + 경로가 `/_next/static/`로 시작하는 요청 **only** |
| **절대 캐시 금지** | HTML 내비게이션(`request.mode === "navigate"`) · `/api/**`(BFF 전부) · manifest · 인증·장바구니·주문·상품·재고 응답 · `GET` 이외 전부 |
| 수명 | `install`에서 `skipWaiting()`, `activate`에서 `clients.claim()` + **이름이 현재 버전이 아닌 캐시 전부 삭제** |
| kill switch | 캐시 이름에 버전 문자열을 박고, 문제 시 `sw.js`를 "모든 캐시 삭제 + `self.registration.unregister()`"만 하는 내용으로 배포할 수 있게 둔다 |
| 금지 | 오프라인 폴백 화면 · 백그라운드 동기화 · 푸시 · precache 목록 |

이 표는 **에픽 AC 3의 요구("앱 셸 정적 자산까지만 캐시 / 인증·재고 응답 캐시 금지")를 그대로 옮긴 것**이다. 이 스토리는 그 경계를 **0으로 잡는 쪽**을 선택했고, 경계선 자체는 위 표로 남긴다.

### D8 — 아이콘: **커밋된 정적 PNG.** 생성은 저장소가 이미 쓰는 도구로 한다

**결정.**

| 파일 | 크기 | 쓰임 |
|---|---|---|
| `apps/web/app/icon.png` | 512×512 (브라우저가 축소) | 탭 아이콘 — Next가 `<link rel="icon">`을 자동 생성 |
| `apps/web/app/apple-icon.png` | 180×180 | iOS 홈 화면 (`apple-touch-icon`) |
| `apps/web/public/icons/icon-192.png` | 192×192 | manifest `purpose: "any"` |
| `apps/web/public/icons/icon-512.png` | 512×512 | manifest `purpose: "any"` |
| `apps/web/public/icons/icon-maskable-512.png` | 512×512 | manifest `purpose: "maskable"` (안전영역 80%) |

**도안.** 종이색(`#faf8f4`) 면 + 먹색(`#1f1d1a`) `SLUR` 워드마크. 자간은 로고 규격(`.b_logo` = 800 / `.22em`)을 따른다. **파랑을 쓰지 않는다** — 설치되는 것은 구매자 표면이다.

**생성 방법(의존성 0).**
1. 스크래치패드에 512×512 HTML 한 장을 쓴다(배경 + 워드마크, maskable용은 마크를 80% 안으로 축소한 변형).
2. 헤드리스 Chrome으로 캡처한다 — `--headless --screenshot=out.png --window-size=512,512 --default-background-color=0 file://…`. **8.1이 이미 반응형 검증에 쓴 도구**이며 새로 설치할 것이 없다.
3. 192는 같은 방법으로 `--window-size=192,192`, apple-icon은 180.
4. **PNG만 커밋한다.** 생성용 HTML은 저장소에 남기지 않는다.

**대안과 기각 사유.**
- **`next/og`의 `ImageResponse`** — Next에 이미 들어 있어(`node_modules/next/og.js`) 의존성 0이고 `app/icon.tsx`로 쓰면 빌드 타임 생성이 된다. 다만 **manifest가 참조할 URL이 해시 붙은 생성 경로**(`/icon?<generated>`)라 `manifest.ts`에서 안정적으로 가리키기 어렵다. 파일을 커밋하면 URL이 `/icons/icon-192.png`로 고정되고, 아이콘이 실제로 무엇인지 저장소에서 **눈으로 확인**할 수 있다. 폴백 수단으로만 남긴다.
- **SVG 아이콘 한 장** — manifest의 SVG 지원은 브라우저·버전에 따라 갈리고 설치 판정에 직결되는 부분이라 도박이다. 192·512 PNG가 가장 오래된 합의다.
- **`app/favicon.ico`(Next 기본 로고)를 남기기** — 남기면 `favicon.ico`와 `icon.png`가 함께 나가 브라우저에 따라 Next 로고가 이긴다. **삭제한다.**

### D9 — iOS: `apple-icon` + `appleWebApp`은 구매자에만. **`viewport-fit=cover`는 넣지 않는다**

**결정.**

```ts
// apps/web/app/(buyer)/layout.tsx
export const metadata: Metadata = {
  appleWebApp: { capable: true, title: "SLUR", statusBarStyle: "default" },
};
export const viewport: Viewport = { themeColor: "#faf8f4" };   // viewportFit 선언 없음
```

**근거.**
- **`env(safe-area-inset-*)`는 `viewport-fit=cover`가 있어야 0이 아닌 값을 낸다.** Next의 기본 viewport 메타는 `width=device-width, initial-scale=1`뿐이므로, **8.1이 넣어둔 `calc(56px + env(safe-area-inset-bottom))`의 `env()` 항은 지금 0으로 평가된다.** 이것은 버그가 아니라 **의도해야 할 상태**다 — cover가 없으면 브라우저·iOS가 안전영역을 시각 뷰포트에서 이미 빼 주므로, 하단 고정 탭바는 홈 인디케이터 위에 정상적으로 앉는다.
- **cover를 켜면 일이 늘어난다.** 콘텐츠가 노치·홈 인디케이터 아래까지 확장되므로 **가로 방향 inset(landscape의 44px)까지** 상단바·탭바·컨테이너에 손으로 넣어야 하고, 그것을 빠뜨리면 가로 모드에서 글자가 노치에 잘린다. 얻는 것은 배경색이 끝까지 차는 시각 효과뿐이며 **완주에 기여하지 않는다.**
- 그래서 8.1의 `env()` 항은 **지우지 않고 그대로 둔다** — cover를 켜는 날 자동으로 맞는 값이 되고, 지금은 `calc(56px + 0px)`로 무해하다. **8.1의 `[ASSUMPTION]`은 "무의미해서가 아니라 지금은 0이 정답이라서" 해소된다.**
- `appleWebApp`을 **구매자 레이아웃에만** 두는 이유는 D6과 같다 — 콘솔 문서의 `<head>`를 건드리지 않는다.
- `[ASSUMPTION]` `statusBarStyle: "default"`(밝은 배경 위 어두운 글자)가 종이색과 맞는 선택이다. `black-translucent`는 콘텐츠가 상태바 아래로 들어가 cover와 같은 문제를 만든다 — 쓰지 않는다.

### D10 — 오버스크롤의 흰 배경: **증상을 먼저 확인하고, 보이면 `:has()` 한 줄로 고친다**

**결정.** 실기기(iOS 사파리)에서 **바운스 영역에 흰색이 보이는지 먼저 확인**한다. 보이면 아래를 적용하고, 보이지 않으면 **아무것도 하지 않는다.**

```css
/* app/styles/buyer/tokens.css — 셀렉터 목록에만 추가 (값은 하나도 바꾸지 않는다) */
[data-surface="buyer"],
html:has([data-surface="buyer"]) { --b-paper: #faf8f4; /* …기존 블록 그대로… */ }

/* app/(buyer)/buyer.css */
html:has([data-surface="buyer"]) { background: var(--b-paper); }
```

**근거.**
- **루트 `body`는 `slur/global.css`가 흰색으로 칠하고 그 파일은 건드리지 않는다**(8.1 D1). 구매자 셸 래퍼는 `100dvh`로 뷰포트를 덮지만 **바운스 영역은 캔버스(html) 배경**이라 래퍼가 닿지 않는다.
- **`:has()`는 조건부 셀렉터라 스코프가 새지 않는다.** 콘솔 문서에는 `[data-surface="buyer"]`가 존재하지 않으므로(8.1이 프로덕션에서 0건을 확인했다) 이 규칙은 **절대 매칭되지 않는다.** "스코프 없는 태그 셀렉터 금지"(8.1 Task 2)의 취지 — 콘솔로 새지 않을 것 — 를 지키는 형태다.
- **`styles/buyer/tokens.css`를 여는 유일한 지점**이며, **셀렉터 목록에 한 줄을 더할 뿐 값은 하나도 바꾸지 않는다.** (8.6이 지킨 "`styles/buyer/**` 무수정"은 그 스토리의 규약이었고, 토큰의 소유자는 8.1이며 이 확장은 토큰 자체가 아니라 적용 범위의 문제다.)
- **증상 확인이 먼저인 이유:** 이 어긋남은 8.1이 `[ASSUMPTION]`으로만 남긴 것이고 실제로 보이지 않을 수 있다. **보이지 않는 것을 고치면 진단할 수 없는 코드가 남는다.** `:has()` 지원(Safari 15.4+ / Chrome 105+ / Firefox 121+)도 확인 대상이며, 미지원 브라우저에서는 현행 동작이 유지된다 — 순수한 시각적 사족이라 이것이 안전한 열화다.

### D11 — Pretendard CDN: **v1에서 옮기지 않는다.** CSP 스토리와 한 묶음으로 넘긴다

**결정.** `app/layout.tsx:44`의 jsdelivr `<link>`를 그대로 둔다. 자가 호스팅(`next/font/local`)도 `preconnect` 추가도 하지 않는다.

**근거.**
- **폰트 스택이 이미 4단 폴백을 갖는다** — `"Pretendard Variable", "Pretendard", ui-sans-serif, system-ui, -apple-system, "Segoe UI", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`. CDN이 죽어도 한국어는 시스템 고딕으로 정상 렌더된다. **글자가 사라지는 종류의 실패가 아니다.**
- **"오프라인에서 웹폰트가 없다"는 문제가 성립하지 않는다** — SW를 넣지 않기로 했으므로(D7) 오프라인에서는 **HTML 자체가 오지 않는다.** 폰트만 캐시해 봐야 표시할 문서가 없다.
- **바꿀 때가 따로 있다.** `deferred-work.md`에 이미 "**앱에 CSP가 없다**"와 "다음 우편번호 스크립트(`t1.daumcdn.net`)"가 등재돼 있다. CSP를 도입하는 순간 `cdn.jsdelivr.net`도 `style-src`/`font-src` allowlist 대상이 되며, **그때 "외부 호스트를 줄인다"는 판단을 한 번에 하는 것**이 맞다. 지금 폰트만 자가 호스팅하면 CSP는 여전히 필요하고, 대신 1~2MB 폰트 바이너리가 저장소에 들어온다.
- `[ASSUMPTION]` 초기 렌더의 FOUT(시스템 고딕 → Pretendard 교체) 체감은 측정된 바 없다. Task 8에서 **네트워크를 느리게 한 상태의 첫 렌더를 눈으로 확인**하고, 눈에 거슬리면 그 사실만 `deferred-work.md`에 적는다 — 이 스토리에서 고치지 않는다.

### D12 — 검증: **자동으로 확인되는 것과 실기기에서만 확인되는 것을 처음부터 가른다**

**결정.**

| 확인 대상 | 방법 | 자동? |
|---|---|---|
| manifest가 유효한 JSON이고 필수 키가 다 있는가 | `curl /manifest.webmanifest` → `JSON.parse` + 키 단언 | ✅ |
| 아이콘 5개가 200으로 응답하고 PNG인가, 크기가 선언과 맞는가 | `curl -I` + `file`/헤더 확인 | ✅ |
| `theme-color` 메타가 **구매자 문서에만** 있는가 | 두 문서 HTML을 받아 `grep -c "theme-color"` → 1 / 0 | ✅ |
| `<html lang="ko">`·`<link rel="manifest">`·`apple-touch-icon`이 붙는가 | 같은 방법 | ✅ |
| `/me` 4폭 렌더·640px 한 단·탭바·≥768 상단 내비 활성 | 헤드리스 캡처(8.1의 쿠키 주입 프록시 재사용) | ✅ |
| 401 → `/login?next=%2Fme` | 스텁 또는 만료 쿠키 | ✅ |
| **설치 프롬프트가 뜨는가 / 설치가 되는가** | 안드로이드 크롬 실기기 | ❌ |
| **standalone으로 뜨는가, 주소창이 사라지는가** | 실기기(안드로이드·iOS) | ❌ |
| **홈 화면 아이콘이 마스크에 잘리지 않는가** | 실기기(안드로이드 원형·스쿼클) | ❌ |
| **하단 탭바가 홈 인디케이터에 가리지 않는가** | iOS 실기기 | ❌ |
| **오버스크롤 흰 배경(D10)** | iOS 실기기 | ❌ |

**근거.** 8.1이 세운 규약 — **"실행하지 못한 검증은 '미실행 + 사유'로 적는다. 통과했다고 쓰지 않는다."** PWA는 이 규약이 가장 크게 걸리는 스토리다. 설치·standalone은 헤드리스로 재현할 수 없고, "빌드가 통과했으니 설치될 것"이라는 추론이 가장 흔한 PWA 사고다. **이 표의 ❌ 항목이 남아 있는 동안 이 스토리는 done이 아니다.**

## Tasks / Subtasks

- [ ] **Task 0 — 착수 전 확인** (AC: 전부)
  - [ ] `git pull` 후 `app/(buyer)/me/page.tsx`가 아직 8.1의 자리표시인지 확인한다 (이 스토리가 통째로 대체한다)
  - [ ] `app/api/auth/` 아래에 **`me/route.ts`가 없는지** 확인한다 — baseline에는 `login`·`logout`·`signup`·`kakao/*`만 있다. 있으면 그것을 쓰고 새로 만들지 않는다
  - [ ] `app/(buyer)/seller-info.tsx`의 `BrokerNotice` export 시그니처를 읽는다 (`{ className?: string }`)
  - [ ] `app/(buyer)/buyer-feedback.tsx`의 골격·오류 컴포넌트와 `getPublicJson`·`NETWORK_MESSAGE`·`GENERIC_MESSAGE`를 읽는다 — **두 번째 규약을 만들지 않는다**
  - [ ] `app/(buyer)/cart-count.tsx`의 `useCartCount().setCount` 시그니처를 확인한다 (D4)
  - [ ] `buyer.css`의 `.b_row`·`.b_tag`·`.b_block_skeleton`·`.b_section`·포커스 링 블록 실제 선언을 읽는다. **값을 다시 선언하지 않는다**
  - [ ] 🚨 **8.6이 진행 중이면 `app/(buyer)/orders/**`·`app/api/orders/**`를 열지 않는다.** 이 스토리는 그 파일들이 필요 없다

- [ ] **Task 1 — 계정 조회 BFF** (AC: 1, 5, 12)
  - [ ] `app/api/auth/me/route.ts` 신설 — `GET`, `proxyWithRefresh(req, "/api/v1/auth/me", { method: "GET" })`
  - [ ] **`assertSameOrigin`을 붙이지 않는다** — 읽기 요청이다 (8.6 Task 1의 GET 규칙과 같다)
  - [ ] `proxyWithRefresh`가 돌려준 `NextResponse`를 **그대로 반환**한다 — 다시 감싸면 회전된 세션 쿠키가 유실된다
  - [ ] `lib/auth.ts`는 **import만 한다. 수정하지 않는다**

- [ ] **Task 2 — `/me` 화면 골격 (서버 층)** (AC: 1, 2, 3, 11)
  - [ ] `me/page.tsx` 대체 — `<BuyerShell tab="me" showTabbar topbar={{ variant: "title", title: "내 정보" }}>` + `.b_container.m_read`. **셸 호출 형태를 바꾸지 않는다**(8.1이 탭 활성 판정에 쓴다)
  - [ ] 구획 순서: **계정(`<AccountCard />`) → 8px 띠 → 메뉴 줄 3개 → 8px 띠 → 사업자 정보 + 고지 → 1px hairline → 로그아웃**
  - [ ] 메뉴 줄 — `<Link>` 3개(`/orders`·`/terms`·`/privacy`), 각 줄 아래 1px hairline, 높이 ≥44px, 우측 셰브런은 **CSS 도형**(`::before` 회전 사각, 목업 `.chev`와 같은 방식). **인라인 SVG 금지**
  - [ ] 사업자 정보 — `COMPANY` 임포트, 6행을 `<dl>` 라벨-값 행(`.b_row`, 560px)으로. `임시 정보` 태그(`.b_tag`) + `실사업자 정보는 서비스 오픈 전에 교체됩니다.`
  - [ ] 중개자 고지 — `import { BrokerNotice } from "../seller-info"` 재사용. **문장을 다시 쓰지 않는다**
  - [ ] `me/me.css` — 이 화면 전용 배치만. 공용 규칙을 `buyer.css`에 새로 만들지 않는다(이 화면에만 쓰이는 것들이다)

- [ ] **Task 3 — 계정 구획과 로그아웃 (클라이언트 층)** (AC: 1, 4, 5)
  - [ ] `me/account-card.tsx` — `"use client"`. effect 안 async IIFE + `alive` 가드로 `GET /api/auth/me` 조회. **effect 안에서 동기 `setState` 금지**(`react-hooks/set-state-in-effect`가 lint error)
  - [ ] 결과는 `{ data, error } | null` 한 벌 — 로딩을 **파생**시킨다(8.4·8.6의 관례)
  - [ ] 표시: `계정` eyebrow(`.b_eyebrow`) · 이름(`.b_title_sm`) · 이메일(`.b_meta`, `null`이면 `—`). **`가입 방식`·전화번호 줄을 만들지 않는다** (D2)
  - [ ] 로딩은 `.b_block_skeleton`, 오류는 `message` + `다시 시도`, 401은 `router.replace("/login?next=%2Fme")`
  - [ ] `me/logout-link.tsx` — `"use client"`. `POST /api/auth/logout` → `setCount(undefined)` → `router.replace("/")` → `router.refresh()` (D4)
  - [ ] 요청 중 버튼 비활성 + 중복 제출 차단. **스피너를 쓰지 않는다**. 실패해도 쿠키는 이미 지워졌을 수 있으므로 **`/`로 보낸다**(BFF가 멱등이다)
  - [ ] 🚨 `app/logout-button.tsx`·`app/api/auth/logout/route.ts`·`lib/auth.ts`·`cart-count.tsx`를 **열지 않는다**

- [ ] **Task 4 — manifest** (AC: 6)
  - [ ] `app/manifest.ts` 신설 — D5의 객체 그대로. `MetadataRoute.Manifest` 타입을 붙인다
  - [ ] `npx next build` 후 라우트 목록에 `/manifest.webmanifest`가 나오는지 확인
  - [ ] 미들웨어 matcher를 **건드리지 않는다** — manifest는 공개 경로이고 matcher에 없으므로 미들웨어가 실행되지 않는다

- [ ] **Task 5 — 아이콘 5개** (AC: 7)
  - [ ] 스크래치패드에 512 HTML 도안(일반 1장 + maskable 1장) → 헤드리스 Chrome 캡처로 PNG 생성 (D8)
  - [ ] `public/icons/icon-192.png` · `icon-512.png` · `icon-maskable-512.png` 커밋
  - [ ] `app/icon.png`(512) · `app/apple-icon.png`(180) 커밋
  - [ ] `app/favicon.ico` **삭제** (create-next-app 잔재, Next 로고)
  - [ ] maskable은 **안전영역 80%** — 512 기준 마크가 중앙 410px 안. 원형·스쿼클 마스크로 잘라보며 확인
  - [ ] 생성용 HTML·스크립트는 **저장소에 남기지 않는다**

- [ ] **Task 6 — theme-color와 iOS 메타** (AC: 8, 10)
  - [ ] `app/(buyer)/layout.tsx`에 `viewport`(themeColor) + `metadata`(appleWebApp) export 추가. **`"use client"`를 붙이지 않는다**(서버 컴포넌트여야 export가 산다)
  - [ ] `app/layout.tsx`·`app/(console)/layout.tsx`에는 **아무것도 추가하지 않는다**
  - [ ] `viewportFit`을 선언하지 **않는다** (D9). `maximumScale`·`userScalable`도 없다
  - [ ] 8.1이 넣은 `env(safe-area-inset-bottom)` 항을 **지우지 않는다** — 지금은 0이고 그것이 정답이다

- [ ] **Task 7 — 검증: 정적 규칙과 빌드** (AC: 11, 12, 13)
  - [ ] `cd apps/web && npx tsc --noEmit` → 0
  - [ ] `npm run lint` → **0 errors · 0 warnings** (A-E456-5 베이스라인 — 늘어나면 이 스토리가 깬 것)
  - [ ] `npx next build` 성공 — `/manifest.webmanifest`·`/icon.png`·`/apple-icon.png`가 라우트/자산 목록에 나오는지 확인
  - [ ] `grep -rn "#2f6bff\|--color-brand\|--shadow-\|box-shadow\|matchMedia\|innerWidth" "app/(buyer)/me"` → 0건
  - [ ] `git diff --stat`에 `apps/api` **0건** · `app/styles/slur/` 0건 · `package.json`/`package-lock.json` **0건** · `app/logout-button.tsx` 0건 · `app/api/auth/logout/` 0건 · `lib/auth.ts` 0건
  - [ ] `grep -rn "통신판매중개자\|사업자등록번호" "app/(buyer)/me"` → **문자열 리터럴 0건**(전부 상수 임포트여야 한다). 라벨(`상호`·`대표자` 등)만 화면 문자열이다
  - [ ] `cd apps/api && uv run pytest -q` → **환경이 있을 때만.** 이 머신에는 `uv`·`docker`가 없다. 실행하지 못했으면 Completion Notes에 **"미실행 + 사유"** 를 적는다 — **통과했다고 쓰지 않는다**

- [ ] **Task 8 — 검증: 자동으로 확인 가능한 것** (AC: 6, 7, 8, 13) — D12 표의 ✅ 항목
  - [ ] `curl -s localhost:3000/manifest.webmanifest | python3 -m json.tool` → 유효 JSON. `name`·`short_name`·`start_url`·`scope`·`display`·`theme_color`·`background_color`·`icons`(3개) 존재 단언
  - [ ] 아이콘 5개 `curl -I` → 200 + `content-type: image/png`. `file` 또는 PNG 헤더로 **실제 픽셀 크기**가 선언과 같은지 확인(192·512·512·512·180)
  - [ ] `curl -s localhost:3000/ | grep -c 'name="theme-color"'` → **1**, `curl -s localhost:3000/seller | grep -c 'name="theme-color"'` → **0** (AC 8의 핵심 증거)
  - [ ] `/` 문서에 `<link rel="manifest"`·`apple-touch-icon`·`apple-mobile-web-app-capable` 존재 / `/seller` 문서에 `apple-mobile-web-app-capable` **부재** 확인
  - [ ] `<html lang="ko">`가 양쪽 문서에 그대로 있는지 확인
  - [ ] `/me`를 500(=<640) / 700 / 768 / 1280 네 폭에서 렌더 — 640px 한 단, `<768` 탭바 있음·`내 정보` 활성, `≥768` 상단 내비로 전환·`내 정보` 활성. **8.1의 쿠키 주입 프록시를 재사용**한다(보호 라우트라 세션 쿠키가 필요하다)
  - [ ] 계정 조회를 실패시킨 상태에서 **사업자 정보·고지·약관 링크가 그대로 보이는지** 확인 (AC 5 — D3의 핵심)
  - [ ] 401 응답 스텁 → `/login?next=%2Fme`로 replace되는지 확인
  - [ ] 키보드만으로 완주 — 메뉴 줄 3개 → 로그아웃까지 **먹색 포커스 링**이 보이고, 하단 탭바가 콘텐츠보다 먼저 걸리지 않는지 (UX-DR6)
  - [ ] `[ASSUMPTION]` 느린 네트워크에서 첫 렌더의 폰트 교체(FOUT)가 거슬리는지 눈으로 보고, 거슬리면 사실만 `deferred-work.md`에 적는다 (D11)

- [ ] **Task 9 — 검증: 실기기 (이것 전에는 done이 아니다)** (AC: 6, 9, 10, 13) — D12 표의 ❌ 항목
  - [ ] **안드로이드 크롬** — 프로덕션 URL 접속 → 메뉴에 `앱 설치`/`홈 화면에 추가`가 뜨는지. 설치 → 실행 → **주소창 없는 standalone**으로 뜨고 `/`(상품목록)가 보이는지
  - [ ] 🚨 **설치가 되지 않으면 원인을 확인한다** — 크롬 DevTools의 Application → Manifest에 "Installability" 진단이 나온다. 원인이 **service worker 부재**로 확인되면 D7의 조건부 계약대로 최소 SW를 추가하고, **다른 원인(아이콘·start_url·HTTPS)이면 그것을 고친다.** 진단 문구를 Completion Notes에 그대로 옮긴다
  - [ ] 홈 화면 아이콘이 **원형·스쿼클 마스크에서 잘리지 않는지** (maskable 안전영역 확인)
  - [ ] **iOS 사파리** — 공유 → 홈 화면에 추가 → 아이콘이 `apple-icon`인지, 실행 시 standalone인지, **하단 탭바가 홈 인디케이터에 가리지 않는지**
  - [ ] iOS에서 **오버스크롤(바운스) 영역에 흰색이 보이는지** — 보이면 D10을 적용하고, 보이지 않으면 **적용하지 않고 그 사실을 기록한다**
  - [ ] 설치 상태에서 `/me` → 로그아웃 → `/`로 가고 **배지가 사라지는지**, 다시 로그인이 되는지
  - [ ] 설치 상태에서 `/seller`로 이동해도 **standalone 창 안에 머무는지**(`scope: "/"` 확인, D5)
  - [ ] 실기기가 없어 실행하지 못한 항목은 **"미실행 + 사유"** 로 적는다. **통과했다고 쓰지 않는다**

- [ ] **Task 10 — 검증: 프로덕션과 콘솔 회귀 (R3)** (AC: 4, 8, 11)
  - [ ] 배포 후 프로덕션에서 `/manifest.webmanifest`·아이콘 5개가 200인지 curl로 확인 (Railway 프록시 뒤)
  - [ ] 프로덕션 `/me` 비로그인 접근 → `/login?next=%2Fme` (8.1의 미들웨어 규칙이 그대로인지)
  - [ ] `/seller`·`/admin` 진입 → 색·레이아웃·**파랑 포커스 링**이 그대로인지 눈으로 확인
  - [ ] 콘솔의 **로그아웃 버튼이 여전히 `/login`으로 가는지** 확인 (AC 4의 회귀 증거 — 판매자 또는 관리자 계정으로 실제 로그아웃)
  - [ ] `/apply`·`/terms`·`/privacy`·`/no-role`·`/login`의 **푸터가 그대로**인지 확인 (사업자 정보 2줄 + 중개자 고지 + 정책 링크)
  - [ ] 탭 아이콘이 Next 로고에서 SLUR 마크로 바뀐 것을 확인하고 **의도된 변경**임을 기록한다 (AC 7)

## Dev Notes

### 이 스토리의 경계 — 하지 않는 일

| 하지 않는다 | 어디가 하는가 |
|---|---|
| 백엔드 수정·마이그레이션·신규 엔드포인트·응답 필드 추가 | 없음. Epic 8 전체가 백엔드 무변경 |
| 회원정보 수정·비밀번호 변경·배송지 관리·찜·알림 설정·회원탈퇴 | **v1 밖** (PRD 화면 목록 밖, EXPERIENCE §IA 확정) |
| `가입 방식` 표시 | **만들지 않는다** (D2 — API에 없다) |
| 콘솔 로그아웃 버튼의 목적지 변경 | **하지 않는다** (D4 — 9화면 공용) |
| service worker · 오프라인 화면 · 푸시 · 백그라운드 동기화 | **하지 않는다** (D7). 조건부 후속만 계약으로 남긴다 |
| 설치 유도 배너·`beforeinstallprompt` 가로채기 | **금지** (UX-DR16) |
| Pretendard 자가 호스팅 · CSP 도입 | **하지 않는다** (D11) — CSP 스토리와 묶어 후속 |
| `/terms`·`/privacy`의 구매자 톤 사본 | **만들지 않는다** — 알고 남기는 어긋남(deferred 등재), 중립 톤 정리는 별건 |
| 다크 모드 | v1 밖 (EXPERIENCE §Foundation `[ASSUMPTION]`) |
| `apps/mobile` 제거 | **8.8** |
| `apps/web` 테스트 프레임워크·PWA 라이브러리 도입 | 하지 않는다 (의존성 추가 0건) |

### 소비하는 백엔드 API — 계약 (읽기만, 수정 금지)

**① `GET /api/v1/auth/me`** (인증 필수, `get_current_user`) → `200 MeResponse`

```jsonc
{ "id": "uuid",
  "email": "soyeon.k@example.com",   // 🚨 null 가능 — 소셜 전용 계정
  "name": "김소연",
  "phone": "01028473391" }           // 이 화면은 쓰지 않는다
```
- 🚨 **`provider`·`has_password` 같은 가입 경로 필드가 없다** (D2, 위험 2)
- 401은 봉투 `{code: "unauthorized", …}`. BFF가 refresh 회전을 1회 시도한 뒤에도 실패하면 그대로 내려온다

**② `POST /api/v1/auth/logout`** → `204`
- BFF(`app/api/auth/logout/route.ts`)가 refresh 쿠키를 본문에 실어 대리 호출하고, **서버 실패와 무관하게 쿠키를 지운다**(멱등). 화면은 BFF만 부른다
- 지워지는 쿠키: `slur_access` · `slur_refresh`(현 path `/api` + 구 path `/api/auth`) · `slur_role`

**에러 봉투 (공통)** — `{code, message, details}`. 분기는 `code`, 표시는 `message`. **HTTP 코드·`code` 문자열은 화면에 나타나지 않는다.**

### 고칠 코드 — ① 지금 무엇을 하는가 ② 무엇을 바꾸는가 ③ 깨뜨리면 안 되는 것

**`apps/web/app/(buyer)/me/page.tsx`**
1. 8.1의 자리표시. `<BuyerShell tab="me" showTabbar topbar={{variant:"title", title:"내 정보"}}>` + `.b_container.m_read` + 안내 두 줄. 파일 주석이 이미 **"사업자 정보·중개자 고지(FR-31)·약관 링크(FR-33)가 구매자 표면에서 놓일 자리가 여기다"** 라고 선언하고 있다.
2. **통째로 대체한다.** 셸 호출 형태(`tab="me"`·`showTabbar`·`topbar.variant="title"`)는 **그대로 유지**한다.
3. 🚨 `.b_container.m_read`(640px)를 빼지 않는다 — UX-DR4의 "끝까지 한 단"이 이 클래스 하나에 걸려 있다. 🚨 `showTabbar`를 빼면 최상위 화면에서 탭바가 사라진다. 🚨 상단바는 **좌측 정렬 `title`**이다 — 목업은 중앙 정렬로 그렸지만 DESIGN.md가 `[ASSUMPTION]`으로 "좌측 정렬 통일 권장"을 적었고 EXPERIENCE §IA 배치 규칙 4가 확정했다. **DESIGN/EXPERIENCE가 목업을 이긴다** (AD-14).

**`apps/web/app/config/company.ts`**
1. `COMPANY`(상호·대표자·사업자등록번호·통신판매업 신고번호·주소·연락처·이메일) + `COMPANY.name`에서 파생된 `BROKER_NOTICE`. 파일 첫 줄에 **"TODO(오픈 게이트): 아래 값은 전부 placeholder"** 가 박혀 있다.
2. **수정하지 않는다. 임포트만 한다.**
3. 🚨 이 상수가 **네 표면(콘솔 푸터·약관 본문·상품상세/주문서 고지·`/me`)의 단일 소스**다. 값을 화면에 복사하는 순간 실정보 교체가 다지점 수정이 되고, 그날 하나를 빼먹는 것이 법적 고지 회귀다. 🚨 `COMPANY.email`은 `/me` 6항목에 없다(목업 기준) — 넣지 않는다.

**`apps/web/app/(buyer)/seller-info.tsx`**
1. 8.3의 산출물. `SellerInfoSection`(판매자 6항목 `<details open>`) + **`BrokerNotice`**(중개자 고지 한 줄, `.b_notice b_broker`). 파일 주석이 "8.5가 6항목 없이 고지만 재사용할 수 있게 분리해 둔다"고 명시.
2. **수정하지 않는다. `BrokerNotice`만 임포트한다.**
3. 🚨 이 파일 주석의 **"상품상세에는 `임시 정보` 태그를 두지 않는다 — placeholder인 것은 플랫폼 사업자 정보(/me, 8.7)다"** 가 이 스토리의 짝이다. `/me`에는 태그를 **둔다**.

**`apps/web/app/logout-button.tsx` (읽기만, 수정 금지)**
1. `"use client"` + `fetch("/api/auth/logout", {method:"POST"})` → `router.push("/login")` → `router.refresh()`. 클래스는 `.btn m_ghost`(슬러 파랑 계열).
2. **한 글자도 바꾸지 않는다.** 구매자용은 `me/logout-link.tsx`로 따로 만든다.
3. 🚨 `/seller`·`/seller/products`·`/seller/orders`·`/admin`(+4)·`/apply` 등 **9개 화면이 이 컴포넌트를 임포트**한다. 시그니처·목적지·클래스 중 하나라도 바뀌면 그 전부가 회귀 대상이 된다. **동작 관례(`router.refresh()`로 Router Cache 잔상 제거)는 구매자 버튼도 따라 쓴다.**

**`apps/web/app/api/auth/logout/route.ts` · `lib/auth.ts` (읽기만, 수정 금지)**
1. refresh 쿠키가 있으면 상류 `POST /api/v1/auth/logout` 호출(실패 무시 — 멱등) → `clearSessionCookies(res)`로 쿠키 3종(구 path 포함 4개 삭제 지시) → `{ok:true}`.
2. **수정하지 않는다** (8.2 D7이 이미 검증했다).
3. 🚨 `clearSessionCookies`는 `proxyWithRefresh`의 401 경로에서도 쓰인다 — 여기를 건드리면 **모든 BFF의 세션 만료 처리**가 영향을 받는다.

**`apps/web/app/(buyer)/cart-count.tsx` (읽기만, 수정 금지)**
1. `CartCountProvider`가 `(buyer)` 레이아웃에서 children을 감싸고, 마운트 1회 `GET /carts`로 `items.length`를 담는다. `useCartCount()`가 `{count, setCount}`를 준다. `count === undefined`면 배지를 그리지 않는다.
2. **수정하지 않는다.** `setCount(undefined)`를 **호출만** 한다.
3. 🚨 프로바이더는 `(buyer)` 레이아웃에 있으므로 **구매자 라우트 사이 이동에서 remount되지 않는다.** 로그아웃 후 `/`로 가도 state가 살아 있다 — D4의 배지 리셋이 필요한 이유다. 🚨 `slur_role` 쿠키 유무를 UX 힌트로만 쓴다(R7) — 그 성질을 흔들지 않는다.

**`apps/web/app/layout.tsx`**
1. `<html lang="ko">` + Geist 폰트 변수 + **Pretendard CDN `<link>`(44행)** + `globals.css` + 슬러 CSS 18줄 + `metadata`(title `SLUR`) + `<body>{children}</body>`. 8.1이 `SiteFooter` 두 줄을 걷어냈다.
2. **아무것도 추가하지 않는다.** `viewport`·`themeColor`·`appleWebApp`은 전부 `(buyer)/layout.tsx`로 간다 (D6).
3. 🚨 여기에 `themeColor`를 넣으면 **콘솔 문서까지 종이색 크롬**이 된다 — AC 8이 정확히 그것을 금지한다. 🚨 Pretendard `<link>`를 옮기거나 지우지 않는다 (D11). 🚨 `<html lang="ko">`는 UX-DR16 요건이다.

**`apps/web/app/(buyer)/layout.tsx`**
1. 구매자 CSS 3개 임포트 + `<div className="b_surface" data-surface="buyer">` + `CartCountProvider`. **서버 컴포넌트다**(주석이 "`use client`를 붙이지 않는다"를 못 박고 있다).
2. `viewport`(themeColor) · `metadata`(appleWebApp) **export 두 개만** 추가한다.
3. 🚨 **`"use client"`를 붙이는 순간 두 export가 죽는다**(viewport·metadata는 서버 컴포넌트 전용). 🚨 `data-surface="buyer"`는 팔레트·포커스 링 스코프의 전부다 — 래퍼를 하나 더 끼우거나 속성을 옮기지 않는다.

**`apps/web/app/favicon.ico`**
1. create-next-app 기본 파일(Next.js 로고, 25,931바이트). 현재 전 페이지의 탭 아이콘이다.
2. **삭제한다.** `app/icon.png`가 대체한다 (D8).
3. 🚨 콘솔 탭 아이콘도 함께 바뀐다 — **의도된 변경**이며 페이지 안의 색·레이아웃은 건드리지 않는다. Task 10이 이를 기록한다.

### 앞선 학습 (sprint-status.yaml action_items · 앞선 스토리에서 골라온 것)

- **A-E456-5 (done) — 웹 lint 베이스라인 0 errors · 0 warnings.** 🚨 **`react-hooks/set-state-in-effect`가 error다.** 이 스토리도 마운트 시 조회(`account-card.tsx`)를 하므로 정면으로 해당한다 — 8.4·8.6의 형태(effect 안 async IIFE + `alive` 가드, 로딩은 `null` 여부로 파생)를 그대로 쓴다.
- **R3 (open) — 쿠키·Origin·CORS는 프로덕션(프록시 뒤) 실요청 검증 후에만 done.** 이 스토리는 **읽기 BFF 하나**를 신설하고 **로그아웃(쿠키 삭제)** 을 새 자리에서 실행한다. Task 10이 프로덕션 확인이다.
- **R6 (done) — 에러 code는 Dev Notes에 사전 시드 선언.** 아래 별도 절.
- **R7 (done) — `slur_role`은 UX 힌트일 뿐 권한 판정이 아니다.** 미들웨어가 `/me`를 통과시키는 것은 인증이 아니다(`slur_role` 14일 > `slur_access` 30분). 페이지가 API 401을 **자기 손으로** 처리한다 (AD-1).
- **R8 (in-progress) — 프로덕션 E2E 시나리오 사전 명시 + 테스트 데이터 즉시 정리.** 이 스토리는 데이터를 만들지 않는다(조회·로그아웃뿐) — 정리할 것이 없다는 사실을 기록한다.
- **8.1의 규약 — 실행하지 못한 검증은 "미실행 + 사유".** PWA에서 가장 크게 걸린다 (D12).
- **8.1의 학습 — Chrome 헤드리스는 최소 500px 폭을 강제한다.** `<640` 구간은 500px으로 확인하고 390 고유 수치는 미디어쿼리 값과 대조한다.
- **8.1의 도구 — 쿠키 주입 프록시.** 보호 라우트(`/me`)를 헤드리스로 캡처하려면 세션 쿠키가 필요하다. 8.1 Debug Log에 방식이 적혀 있다. **저장소에 남기지 않는다.**
- **8.2 D7 — 로그아웃 BFF는 이미 맞다. 목적지는 8.7이 정한다.** 이 스토리가 그 인계를 받는다.
- **8.2의 인계 — `/login`에서 푸터가 사라졌다.** 로그인 **전** 화면이라 `/me`에 닿을 수 없어 `/signup`의 약관 `보기` 링크로 FR-33 접근 경로를 유지했다. `[ASSUMPTION]` 로그인 화면 자체에 법적 링크가 필요한지는 확인된 바 없다 — **8.7이 한 번 더 보라고 남긴 항목**이며, UX-DR10의 세 자리(상품상세·주문서·내 정보)에 로그인이 없으므로 **이 스토리도 추가하지 않는다.** 판단 근거를 여기 남긴다.
- **8.3의 D10 — 고지 문구는 `BROKER_NOTICE` 상수 하나에서 온다.** `BrokerNotice` 컴포넌트가 그 결정의 산물이며 8.5·8.7이 재사용한다.
- **8.4의 학습 12 — `[data-surface="buyer"] svg`의 `stroke-width` 전역 규칙.** 메뉴 줄 셰브런을 SVG로 그리면 굵기를 물려받는다. **CSS 도형으로 그린다.**
- **8.6의 관례 — 빈 값은 `—`로 지키고 행을 지우지 않는다.** 이메일 `null`에 그대로 적용한다.
- **`apps/web/AGENTS.md`: "이건 네가 아는 Next.js가 아니다 — `node_modules/next/dist/docs/`를 먼저 읽어라."** manifest·app-icons·generate-viewport 세 문서를 착수 전에 읽는다.

### 에러 code 시드 (R6)

이 스토리가 만나는 `code`는 전부 **기존 백엔드/BFF 코드**이며 새로 만들지 않는다.

| code | HTTP | 언제 | 화면 처리 |
|---|---|---|---|
| `unauthorized` | 401 | 세션 만료·비로그인(refresh 회전도 실패) | `router.replace("/login?next=%2Fme")`. **사업자 정보·고지는 그대로 남는다** |
| `internal_error` | 500 | 상류 장애 | `message` + `다시 시도` |
| `service_unavailable` | 503 · BFF 폴백 | 상류 장애, JSON 아닌 응답 | `message` + `다시 시도` |
| `http_error` | 그 외 | 매핑 없는 상태 | `message` + `다시 시도` |
| (봉투 없음) | — | fetch throw(네트워크 단절) | `연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요.` + 재시도 |

**로그아웃은 실패 경로를 화면에 그리지 않는다** — BFF가 멱등이라 상류가 죽어도 쿠키는 지워진다. 네트워크 자체가 끊겨 BFF에 닿지 못한 경우에도 **`/`로 보낸다**(쿠키가 남아 있어도 다음 API 호출이 401을 받아 정리된다). 로그아웃 실패 문구를 만들지 않는 이유는, 그 문구가 뜨는 순간 사용자가 "로그아웃이 안 됐다"고 믿고 같은 버튼을 반복해서 누르기 때문이다.

**표시 규약**: 분기는 `code`, 표시는 `message`. **HTTP 코드·`code` 문자열을 화면에 렌더하지 않는다** (UX-DR9).

### 발견한 위험 · 기존 코드의 문제 (구현 전에 읽을 것)

1. 🚨 **`/me`가 없으면 구매자에게 FR-31·33이 닿지 않는다.** 8.1이 구매자 라우트에서 푸터를 뺐고 모바일에는 상시 푸터가 없다. **이 화면은 편의 기능이 아니라 규제 요건의 유일한 수용처**이며, 이 사실이 스토리 전체의 우선순위를 정한다 — 계정 조회가 실패해도 고지는 서야 한다(D3).

2. 🚨 **`MeResponse`에 가입 경로가 없다.** 목업의 `가입 방식` 행을 만들 수 없고, `email` 유무로 추론하면 **이메일이 있는 카카오 계정에 "이메일 가입"이라고 쓰게 된다**(카카오는 검증된 이메일을 저장한다). D2가 행을 만들지 않기로 했다. 근본 해소는 `MeResponse`에 필드를 더하는 것이며 **Epic 8 경계 밖**이다 — `deferred-work.md`에 올린다.

3. 🚨 **로그아웃 후 장바구니 배지가 남는다.** `CartCountProvider`가 `(buyer)` 레이아웃에 있어 구매자 라우트 사이 이동에서 remount되지 않고, `router.refresh()`도 클라이언트 Context를 비우지 않는다. **조용히 틀린 숫자**라 놓치기 쉽다 — D4가 명시적 리셋을 요구한다.

4. 🚨 **`env(safe-area-inset-bottom)`은 지금 0이다.** `viewport-fit=cover`가 없으면 `env()`가 값을 내지 않는다. 8.1은 이것을 "PWA standalone에서 의미가 커진다"고 남겼지만 **실제로는 cover 선언 여부의 문제**다. D9가 "0이 정답"으로 확정했고, 그 판단을 모르면 다음 사람이 무심코 cover를 켜서 **가로 모드 노치 잘림**을 만들 수 있다.

5. **`name`·`short_name`의 정식 표기가 확정된 바 없다.** `[ASSUMPTION]` `COMPANY.name`은 `(주)슬러`(placeholder), 로고는 `SLUR`, PRD 제목은 `SLUR`이다. manifest에는 **`SLUR`** 을 쓰되, 실사업자 정보 교체(오픈 게이트) 때 **표기를 함께 확정**해야 한다. `short_name`은 홈 화면 아이콘 아래 글자라 12자 이내가 안전하다.

6. **설치 판정 기준은 브라우저 버전에 따라 움직여 왔다.** `[ASSUMPTION]` "manifest만으로 설치 가능"인지 "fetch 핸들러를 가진 SW가 필요"한지는 문서로 확정하지 말고 **실기기 + DevTools 진단으로 확인**한다(Task 9). D7의 조건부 계약이 그 결과를 받는 자리다.

7. **`/terms`·`/privacy`가 구매자 톤이 아니다.** 슬러 파랑 문서이고 콘솔 푸터가 붙는다 — `/me`의 메뉴 줄에서 그 링크를 누르면 **지면이 갈린다.** `deferred-work.md`에 이미 등재된 알고 남기는 어긋남이며, 이 스토리에서 사본을 만들지 않는다(FR-33은 "접근 가능"을 요구하고 톤을 요구하지 않는다). 다만 **구매자가 실제로 밟는 첫 경로**가 되므로 위험도가 올라갔다는 사실을 기록한다.

8. **`app/icon.png`·manifest·`favicon.ico` 삭제는 콘솔 문서에도 영향이 있다.** 탭 아이콘과 `<link rel="manifest">`는 **전 페이지에 붙는다**(루트 레이아웃 소관이 아니라 파일 컨벤션이라 라우트 그룹으로 가를 수 없다). 페이지 안의 색·레이아웃은 그대로지만 **"콘솔 문서가 한 글자도 안 바뀐다"는 주장은 이 스토리에서 더 이상 참이 아니다** — `theme-color`·`appleWebApp`만 갈라진다(AC 8·10).

9. **`:has()` 지원 경계.** D10을 적용한다면 Safari 15.4+ / Chrome 105+ / Firefox 121+에서만 동작한다. 미지원 환경은 현행 유지(흰 바운스)이며 **시각적 사족이라 안전한 열화**다. 다만 이 스토리가 `:has()`를 저장소에 처음 들이는 사례이므로 기록한다.

10. **manifest는 인증 없이 누구나 읽는다.** 서비스 이름·설명·아이콘 외에 **아무것도 담지 않는다.** `start_url`에 쿼리 파라미터(추적용 `?source=pwa` 등)를 붙이지 않는다 — 붙이면 `/`가 미들웨어 matcher 밖이라 통과는 하지만, 홈 URL이 두 벌이 되고 8.1이 세운 "같은 라우트 하나" 원칙이 흐려진다.

11. **`middleware.ts`는 Next 16에서 deprecated이며 `proxy`로 이름이 바뀌었다**(8.1이 발견해 부채로 남긴 항목, Epic 8 완료 후 rename). 이 스토리는 미들웨어를 건드리지 않는다 — `/me`는 8.1이 이미 matcher에 등록했고 manifest·아이콘은 공개 경로다.

12. **이 스토리는 데이터를 만들지 않는다.** 조회 1개 + 로그아웃뿐이라 프로덕션에서 정리할 테스트 데이터가 없다(R8). 다만 **프로덕션 계정으로 로그아웃하면 그 세션이 끊긴다** — 판매자·관리자 계정으로 회귀 검증(Task 10)을 할 때 순서를 고려한다.

### Project Structure Notes

- 정렬: `Consistency Conventions`의 "프론트 = Next.js App Router + 슬러 시스템 CSS", 그 위에 8.1이 얹은 구매자 스코프 확장 층. 8.7은 그 층을 **소비하고, 앱 수준 메타데이터(manifest·아이콘·theme-color)를 처음으로 도입한다.** [Source: ARCHITECTURE-SPINE.md#Consistency-Conventions]
- 신규 페이지 라우트 **0개** — `/me`는 8.1의 자리표시 대체다. 신규 BFF 1파일(`api/auth/me`). 신규 메타데이터 라우트 1개(`/manifest.webmanifest`). **기존 URL 변경 0건.**
- 컴포넌트 파일은 라우트 폴더 안에 평평하게 둔다(`me/account-card.tsx`·`me/logout-link.tsx`). `page.tsx`·`layout.tsx`·`route.ts`가 아닌 파일은 라우트를 만들지 않는다. **단 `manifest.ts`·`icon.png`·`apple-icon.png`는 파일 컨벤션이라 이름 자체가 라우트를 만든다** — 이 저장소의 첫 사례다.
- CSS는 라우트 옆에 두고 컴포넌트가 임포트한다(`me/me.css`). 공용 규칙을 `buyer.css`에 새로 만들지 않는다 — 이 화면에만 쓰이는 배치다.
- 스택 핀: Next.js 16.2.10 / React 19.2.4. **의존성을 추가하지 않는다** — `package.json`·`package-lock.json` diff 0건이 AC 9·13의 증거다.
- 이 스토리로 **Epic 8의 구매자 화면 9개가 전부 선다.** 남은 것은 8.8(Flutter 보관·제거)뿐이다.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic-8 — 에픽 경계: 백엔드 무변경·ERD 0건·구매자 API 재사용·테스트 153건]
- [Source: _bmad-output/planning-artifacts/epics.md#Story-8.7 — AC 원문(계정 정보·사업자 정보 `임시 정보` 태그·기존 소스 재사용·manifest 항목·최소 SW의 캐시 경계·설치 유도 금지·안드로이드/iOS 홈 화면) 및 Dev Notes(`/me`는 Flutter `service_info_screen.dart`의 웹 대응, **캐시 범위 결정과 근거를 스토리에 기록**)]
- [Source: _bmad-output/planning-artifacts/epics.md#Story-8.8 — 이 스토리 완료가 8.8의 선행 조건("8.1~8.7 완료로 구매자 웹이 기능 동등")]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR10 — **법적 고지 배치 규칙 3자리**, `내 정보`는 웹 푸터 대응, 문구는 글자 그대로, `임시 정보` 태그 + `실사업자 정보는 서비스 오픈 전에 교체됩니다.`, 모달·별도 페이지·더보기 뒤 숨김 금지]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR11 — 라우트와 접근 권한: `/me`는 로그인 필요, `/`는 공개(설치 경험의 전제)]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR3 — 탭바는 최상위 4화면(내 정보 포함), 상단바 형태, ≥768 상단 내비]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR4 — **내 정보는 끝까지 한 단(최대 640px)**]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR6 — 먹색 포커스 링, 키보드 완주, 하단 고정 바는 DOM 순서상 콘텐츠 뒤]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR7 — 터치 타깃 44×44, 글자 200% 확대(→ `maximumScale` 금지)]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR12 — box-shadow 금지, 8px 띠·1px hairline·테두리 상자, 라운드 스케일]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR16 — **설치 유도 배너·자동 팝업 금지**, 모달 금지, `<html lang="ko">`, 자간은 CSS로만]
- [Source: ux-designs/ux-SLUR_platform_blueprint-2026-07-21/EXPERIENCE.md#Foundation — **모바일 퍼스트 반응형 웹(PWA)**, `[ASSUMPTION]` PWA 범위는 "브라우저에서 정상 동작하는 반응형 웹 + 최소 manifest"까지(D5·D7·D8이 해소), `[ASSUMPTION]` 다크 모드 v1 제외]
- [Source: …/EXPERIENCE.md#Information-Architecture — **`내 정보` 화면을 둔다(2026-07-21 Slur 확정)**, Flutter `service_info_screen.dart`의 웹 대응, v1 밖 기능 금지, 최상위 화면 제목 좌측 정렬 통일]
- [Source: …/EXPERIENCE.md#법적-고지-배치-규칙 — 세 자리 표, "청약 전"이 규칙의 전부, placeholder 표기 요구, **실정보 교체·약관 법률 검토는 오픈 게이트**]
- [Source: …/EXPERIENCE.md#Voice-&-Tone — **고지 문구 정본은 `apps/web/app/config/company.ts`의 `BROKER_NOTICE`이며 문서가 아니라 코드가 이긴다. 화면은 문자열을 복사하지 말고 임포트한다**]
- [Source: …/EXPERIENCE.md#Component-Patterns — 법적 고지는 접히지 않는 고정 텍스트]
- [Source: …/EXPERIENCE.md#Responsive-&-Platform — 하나의 문서·세 개의 폭, ≥768 상단 내비 전환, 폭 변경 시 상태 유지]
- [Source: …/DESIGN.md#Layout-&-Spacing#반응형 — **끝까지 한 단으로 두는 화면: 내 정보(최대 640px)**]
- [Source: …/DESIGN.md#Components — 상단바 네 형태(`[ASSUMPTION]` 내 정보 제목 좌측 정렬 통일 권장), `{typography.title-sm}` 20px가 내 정보의 이름, 안내/고지 11px `{colors.ink-quiet}` + 위 1px hairline("법적 고지는 경고가 아니라 인쇄된 사실")]
- [Source: …/.working/screens-2-account.html — `내 정보` 확정 시안: `.acct`(eyebrow·이름 24px·이메일·가입 방식 행) · `.menu`/`.menu-i`/`.chev`(CSS 도형 셰브런) · `.biz`/`.ph-tag`/`.biz-body`(1px dashed + `#f7f4ee`)/`.biz-note`/`.notice` · `.logout`(약한 텍스트 버튼, 위 hairline) · 탭바 `내 정보` 활성. **단 상단바 정렬과 `가입 방식` 행은 DESIGN/EXPERIENCE·API가 이긴다** (위험 2)]
- [Source: prd.md#FR-31 — 푸터: 사업자 정보 + 통신판매중개자 고지 / #FR-33 — 약관·개인정보처리방침(오픈 게이트 법률 검토) / #NFR-7 — **PWA 설치 가능, `[ASSUMPTION]` v1 범위는 최소 manifest까지, 오프라인 캐시 범위·설치 유도 시점은 구현 스토리에서 확정**]
- [Source: prd.md#내-정보-화면 (43행) — 신규 기능이 아니라 Flutter `service_info_screen.dart`의 웹 대응, 모바일에 상시 푸터가 없어 FR-31·33이 여기 놓인다]
- [Source: architecture/…/ARCHITECTURE-SPINE.md#AD-1 — FastAPI가 유일한 문지기, 미들웨어·쿠키는 판정이 아니다]
- [Source: …#AD-13 — SLUR 고유 값 하드코딩 금지: 브랜드명·사업자 정보는 상수 모듈에만 둔다]
- [Source: …#AD-14 — 클라이언트 표면 단일화, 구매자 라우트는 모바일 퍼스트 반응형(+PWA), **동일 BFF 경로**, DESIGN/EXPERIENCE가 목업을 이긴다]
- [Source: implementation-artifacts/6-1-legal-pages-footer.md — 푸터·약관 페이지 계약(사업자 정보 + 중개자 고지 + 정책 링크), `config/company.ts` 단일 소스의 출발점]
- [Source: implementation-artifacts/8-1-buyer-web-shell.md — D1(토큰 스코프·`body` 흰 배경 `[ASSUMPTION]`)·D2(라우트 그룹 2개·`/me` 자리표시)·D4(먹색 포커스 링)·D5(`m_read` 640px·`env(safe-area-inset-bottom)` `[ASSUMPTION]`)·Task 5(`themeColor`는 8.7)·위험 4(Pretendard CDN은 8.7 판단), 미실행 검증의 기록 규약, 쿠키 주입 프록시]
- [Source: implementation-artifacts/8-2-buyer-auth-web.md — **D7(로그아웃 BFF는 이미 맞다, 목적지는 8.7)**, `LogoutButton` 무수정 원칙, `/login` 푸터 소멸과 `[ASSUMPTION]`(8.7이 한 번 더 본다)]
- [Source: implementation-artifacts/8-3-buyer-product-browse-web.md — D10(고지 문구는 `BROKER_NOTICE` 상수 하나), `BrokerNotice` 컴포넌트 분리, `buyer-feedback.tsx`의 로딩·오류 규약]
- [Source: implementation-artifacts/8-4-cart-web.md — D5(`CartCountProvider` 소유권), 학습 12(svg stroke-width 전역 규칙)]
- [Source: implementation-artifacts/8-6-order-history-cancel-web.md — `/orders` 라우트의 소유자(메뉴 줄 링크 대상), 빈 값 `—` 규약, 같은 기간 진행 중이므로 파일 접점 없음을 확인]
- [Source: implementation-artifacts/deferred-work.md#Deferred-from-Epic-8 — **CSP 부재**·다음 우편번호 스크립트 호스트·**제3자 스크립트 고지(오픈 게이트)**·**중개자 고지 문구 최종 확정(오픈 게이트)**·`middleware.ts` deprecated·`/terms`·`/privacy` 톤 어긋남·사업자 실정보 교체]
- [Source: implementation-artifacts/sprint-status.yaml#action_items — R3·R6·R7·R8·A-E456-5]
- [Source: apps/api/app/auth/router.py — `GET /auth/me`(`get_current_user`) · `POST /auth/logout`(204) (읽기만)]
- [Source: apps/api/app/auth/schemas.py#MeResponse — `{id, email(nullable), name, phone}` — **provider 없음** (읽기만)]
- [Source: apps/api/app/auth/kakao.py · service.py — 카카오는 검증된 이메일을 저장한다(`email` 유무로 가입 경로를 추론할 수 없다는 근거) (읽기만)]
- [Source: apps/web/app/config/company.ts · site-footer.tsx — 사업자 정보 단일 소스와 콘솔 푸터의 렌더 형태(`/me`가 그 모바일 대응이다)]
- [Source: apps/web/app/logout-button.tsx · app/api/auth/logout/route.ts · lib/auth.ts — 콘솔 공용 로그아웃과 쿠키 3종 삭제 (읽기만, 수정 금지)]
- [Source: apps/web/app/(buyer)/{layout.tsx, buyer-shell.tsx, cart-count.tsx, seller-info.tsx, buyer-feedback.tsx, me/page.tsx} — 재사용 대상의 현재 시그니처 (baseline_commit 기준)]
- [Source: apps/web/app/styles/buyer/{tokens.css, type.css} · app/(buyer)/buyer.css — `--b-*` 토큰과 `.b_*` 역할 클래스의 실제 선언]
- [Source: apps/web/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/manifest.md — `app/manifest.ts`가 `MetadataRoute.Manifest`를 반환하는 특수 Route Handler]
- [Source: …/01-metadata/app-icons.md — `icon`·`apple-icon` 파일 컨벤션(`app/**/*`), `<link>` 태그 자동 생성, `next/og` `ImageResponse` 생성 경로]
- [Source: …/04-functions/generate-viewport.md — `viewport` export는 **layout·page 세그먼트 단위**, `themeColor`, 서버 컴포넌트 전용]
- [Source: apps/web/AGENTS.md — Next 16은 학습 데이터와 다르다. `node_modules/next/dist/docs/`를 먼저 읽는다]

## Dev Agent Record

### Agent Model Used

(구현 시 기록)

### Debug Log References

(구현 시 기록 — 아이콘 생성용 HTML·헤드리스 캡처 스크립트·쿠키 주입 프록시는 스크래치패드에만 두고 저장소에 남기지 않는다)

### Completion Notes List

(구현 시 기록 — **자동 확인 항목**과 **실기기 확인 항목**을 갈라서 적는다. 실행하지 못한 것은 "미실행 + 사유"로 적고 통과했다고 쓰지 않는다. 안드로이드 설치가 되지 않았다면 DevTools의 Installability 진단 문구를 그대로 옮긴다)

### File List

(구현 시 기록)

### Change Log

| 날짜 | 변경 | 비고 |
|---|---|---|
