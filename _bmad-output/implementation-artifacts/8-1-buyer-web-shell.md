---
baseline_commit: 8c5198375fa3bd5a966c323a82fded57a28ea311
---

# Story 8.1: 구매자 웹 셸과 반응형 기반

Status: in-progress

## Story

As a 구매자,
I want 어느 화면에서든 같은 자리에서 이동하고 같은 톤의 지면을 보는 것,
So that 앱을 설치하지 않고도 링크 하나로 SLUR를 쓸 수 있다.

## Acceptance Criteria

1. **Given** 구매자 라우트 전용 레이아웃 셸 **When** 뷰포트 폭 < 768로 렌더 **Then** 하단 고정 탭바(56px, 4탭 균등 — 홈·장바구니·주문내역·내 정보)가 표시되고, 활성 표시는 색 채움이 아니라 먹색 + 라벨 굵기 800 + 아이콘 선 굵기 1.4px→1.9px이다 (UX-DR3)
   - **And** 폭 ≥ 768에서는 탭바가 사라지고 같은 4개 항목이 헤더 우측 상단 내비(13px/600, 활성 먹색 800, 밑줄·알약·색 채움 없음)로 나타난다
   - **And** 탭바는 최상위 4화면에만 서고, 하단 고정 CTA가 있는 화면에는 서지 않는다 — 장바구니만 CTA + 탭바 2단 예외다. 셸이 이 규칙을 화면별로 표현할 수단(`tab`·`showTabbar` prop)을 갖는다
   - **And** 아이콘은 인라인 SVG(또는 CSS 도형)로 만든다 — 아이콘 폰트·이모지·외부 CDN 금지
   - **And** 하단 고정 바는 DOM 순서상 콘텐츠 뒤에 놓여 키보드 포커스가 먼저 걸리지 않는다 (UX-DR6)

2. **Given** 상단바 **When** 각 화면이 셸을 쓴다 **Then** 54px 고정 상단바가 `logo`(로고 + 장바구니 아이콘) · `logo-center` · `back-title`(뒤로가기 + 제목) · `title`(제목만, **좌측 정렬**) 네 형태로 제공되고, 최상위 화면 제목은 좌측 정렬로 통일된다 (UX-DR3)
   - **And** 로고 중앙형은 로그인·주문완료 두 화면 전용이며, 로그인·장바구니 헤더에는 뒤로가기를 두지 않는다
   - **And** 폭 ≥ 768에서는 상단바가 형태와 무관하게 **로고 + 상단 내비 한 형태로 수렴**하고 뒤로가기가 사라진다. 상세 화면은 소속 최상위 항목이 활성으로 표시된다(상품상세→홈, 주문서→장바구니, 주문상세→주문내역)

3. **Given** 구매자 팔레트 토큰 **When** 구매자 라우트를 렌더 **Then** 종이·먹색 4단·흐린 3단·hairline·흙빛 액센트·폼 계열 토큰이 **구매자 스코프로만** 정의되어 적용된다 (UX-DR1)
   - **And** 브랜드 파랑 `#2f6bff`(`--color-brand-*`)이 구매자 라우트의 어떤 요소에도 나타나지 않는다 (예외 색은 카카오 `#fee500` 하나뿐이며 8.2가 쓴다)
   - **And** 판매자·관리자 화면의 색·포커스 링·간격이 **한 픽셀도 바뀌지 않는다** — 구매자 토큰이 전역 시맨틱 토큰을 덮어쓰지 않는다
   - **And** 구매자 라우트에 `box-shadow`가 없다 — 깊이는 8px 종이 접기 띠 · 1px hairline · 테두리 상자 셋으로만 만든다 (UX-DR12)

4. **Given** 먹색 포커스 링 **When** 키보드로 구매자 화면을 이동 **Then** 모든 인터랙티브 요소(버튼·링크·칩·체크박스·입력·탭)에서 먹색 포커스 표시가 보인다 (UX-DR6)
   - **And** 슬러 시스템의 파랑 `--color-focus-ring`이 구매자 화면에 나타나지 않는다
   - **And** `outline: none`은 대체 링과 한 쌍일 때만 쓰인다

5. **Given** 반응형 레이아웃 규칙 **When** 폭을 640·768 경계로 바꿔가며 렌더 **Then** 좌우 여백 20/20/32px, ≥768에서 본문 최대 폭 1080px 가운데 정렬, 목록 그리드 열 수 2/3/3열로 전환된다 (UX-DR5)
   - **And** 읽는 화면용 640px·주문완료용 560px 컨테이너 변형과 행 내부 최대 폭 560px 규칙이 셸의 유틸리티로 제공된다
   - **And** 서버가 User-Agent로 기기를 판별해 분기하지 않는다 — 같은 라우트·같은 HTML이 폭에 따라 배치만 달라진다 (AD-14)
   - **And** 폭이 바뀌어도 화면 상태가 초기화되지 않는다 — 폭에 따라 컴포넌트를 조건부 렌더/언마운트하지 않고 **CSS만으로** 배치를 바꾼다

6. **Given** 루트 라우트 `/` **When** 비로그인 상태로 접근 **Then** 구매자 셸이 적용된 홈이 표시된다 — 기존의 `/login`으로 보내는 로그인 유도 랜딩(`app/page.tsx`의 `redirect("/login")`)은 폐기된다
   - **And** 판매자·관리자 계정도 `/`로 진입해 막히지 않는다 (역할별로 진입점을 쪼개지 않는다, FR-3)
   - **And** 홈의 **내용**은 8.3이 채운다 — 8.1은 셸 위에 반응형 그리드 규칙을 확인할 수 있는 자리표시 블록만 둔다

7. **Given** `middleware.ts`의 라우팅 가드 **When** 세션 없이 `/`·`/products/[id]`를 요청 **Then** 통과한다 (공개 라우트 — matcher에 포함하지 않아 미들웨어가 아예 실행되지 않는다)
   - **And** 세션 없이 `/cart`·`/checkout`·`/orders`·`/orders/[id]`·`/orders/complete`·`/me`를 요청하면 `/login`으로 보내고 원래 경로를 `next` 쿼리로 보존한다
   - **And** `next` 값은 자체 경로(`/`로 시작하고 `//`·`/\`로 시작하지 않는 값)만 실린다 — 오픈 리다이렉트 방지
   - **And** 기존 `/seller`·`/admin`·`/apply`의 판정 규칙 세 줄은 **한 글자도 바뀌지 않는다**
   - **And** 미들웨어는 UX 편의 리다이렉트일 뿐이며 보안 판정은 FastAPI가 한다 (AD-1) — 페이지 단에서 API 401/403을 그대로 처리한다

8. **Given** 라우트 그룹 분리 **When** 판매자·관리자·정책 페이지를 렌더 **Then** `SiteFooter`가 지금과 똑같은 자리에 그대로 붙는다 (URL·마크업·스타일 불변)
   - **And** 구매자 라우트에는 `SiteFooter`가 붙지 않는다 — 모바일에 상시 푸터가 없고 FR-31·33은 `/me`(8.7)가 받는다
   - **And** 라우트 그룹 도입으로 **바뀌는 URL이 하나도 없다**

9. **Given** 여러 화면이 공유하는 컴포넌트 **When** 셸을 만든다 **Then** 브랜드 라벨 · 판매자 묶음 카드 뼈대 · 금액 요약 · 상태 라벨의 **자리(파일·타입·CSS)** 가 잡힌다 — 실제 데이터 연결과 동작은 각 화면 스토리(8.4~8.6)가 채운다 (UX-DR13)

10. **Given** 이 스토리 전체 **When** 완료 **Then** 백엔드가 변경되지 않는다 — `apps/api` 파일 0건 수정, 마이그레이션 0건, API 테스트 153건 그대로 통과, 이 스토리의 코드는 FastAPI API를 **한 번도 호출하지 않는다**

11. **Given** 검증 **When** 실행 **Then** `npx tsc --noEmit` 0 · `npm run lint` 0(현재 베이스라인, A-E456-5)이 유지되고, 로그인 후 `/seller`·`/admin` 진입 시 기존 화면의 색·레이아웃·포커스 링이 그대로임을 눈으로 확인한 결과가 스토리에 기록된다

## 설계 판단 (이 스토리에서 확정 — 근거를 남긴다)

스파인 Deferred "프론트 상세 폴더 구조 (Next.js)"를 이 스토리가 해소한다.
[Source: ARCHITECTURE-SPINE.md#Deferred]

### D1 — 구매자 팔레트와 슬러 파랑의 공존: **이름공간 분리 + 데이터 속성 스코프**

**결정.** 구매자 색은 슬러 시맨틱 토큰(`--color-*`)을 재바인딩하지 않고, `--b-*`라는 **별도 이름공간**의 새 토큰으로 선언한다. 선언 위치는 `[data-surface="buyer"]` 셀렉터이며, 이 속성은 `(buyer)` 라우트 그룹 레이아웃의 셸 래퍼 하나에만 붙는다.

```css
/* apps/web/app/styles/buyer/tokens.css */
[data-surface="buyer"] {
  --b-paper: #faf8f4;  --b-ink: #1f1d1a;  --b-accent: #8c4a32;  /* … */
}
```

**근거.**
- 이름이 겹치지 않으면 판매자·관리자로 새는 경로가 **물리적으로 닫힌다.** `:root`에서 `--color-brand`를 흙빛으로 remap하는 방식은 셀렉터 하나만 잘못 써도 전 화면이 갈색이 되고, 그 사고를 tsc·lint가 잡아주지 못한다.
- 데이터 속성 스코프는 CSS만으로 판정된다 — 서버가 역할이나 기기를 보고 분기할 필요가 없다 (AD-14: 표면은 하나다).
- 슬러 시스템 파일(`app/styles/slur/**`)은 **한 줄도 수정하지 않는다.** 구매자 CSS는 새 폴더 `app/styles/buyer/`에만 쓴다.

**예외 하나.** 구매자 스코프 **안에서만** `--color-focus-ring`을 무력화한다 (D4 참조). 스코프 안 재정의이므로 밖으로 새지 않으며, 검증 Task가 이를 확인한다.

**body 배경 처리.** 루트 `body`는 `slur/global.css`가 `--color-surface-page`(흰색)로 칠하고 있고 이 선언은 건드리지 않는다. 구매자 셸 래퍼가 `min-height: 100dvh` + `background: var(--b-paper)`로 뷰포트를 덮는다. `[ASSUMPTION]` iOS 오버스크롤(바운스) 영역에서 흰 `body`가 잠깐 보일 수 있다 — 브라우저 크롬 색·`theme-color`와 함께 8.7(PWA)에서 확인한다. `100vh`가 아니라 `100dvh`를 쓴다(모바일 브라우저 주소창 높이 변화 대응).

### D2 — 레이아웃 분리: **라우트 그룹 2개, 루트 레이아웃은 계속 하나**

**결정.**

```
apps/web/app/
  layout.tsx              ← <html lang="ko"> · 슬러 CSS 임포트 유지 · SiteFooter 제거
  (buyer)/
    layout.tsx            ← 구매자 셸 (data-surface="buyer", 상단바 + 탭바/상단 내비)
    page.tsx              ← "/"  (8.3이 내용을 채운다)
    cart/page.tsx         ← 자리표시 (8.4)
    orders/page.tsx       ← 자리표시 (8.6)
    me/page.tsx           ← 자리표시 (8.7)
    buyer-shell.tsx · buyer-topbar.tsx · buyer-tabbar.tsx · buyer-topnav.tsx
    buyer-icons.tsx · brand-label.tsx · status-label.tsx · amount-summary.tsx · seller-pack.tsx
    buyer.css
  (console)/
    layout.tsx            ← <SiteFooter /> (지금 루트 레이아웃이 하던 일)
    seller/ admin/ apply/ login/ no-role/ terms/ privacy/   ← git mv, URL 불변
  api/                    ← BFF Route Handler. 그룹 안으로 옮기지 않는다
  site-footer.tsx · site-footer.css · logout-button.tsx · config/company.ts   ← 자리 유지
  styles/slur/**          ← 무변경
  styles/buyer/tokens.css · type.css   ← 신설
```

**근거.**
- **루트 레이아웃을 쪼개지 않는다.** 다중 루트 레이아웃은 그룹 간 이동 시 전체 페이지 리로드를 일으킨다(Next 공식 caveat). `/` ↔ `/seller` 이동은 실제로 일어나는 경로(FR-3: 한 계정 다역할)이므로 피한다. 루트 레이아웃 하나 + 중첩 레이아웃 둘이면 리로드가 없다. [Source: nextjs.org/docs/app/api-reference/file-conventions/route-groups#Caveats]
- 라우트 그룹 폴더명은 URL에 나타나지 않으므로 **`/seller`·`/admin`·`/apply`·`/login`·`/terms`·`/privacy` URL이 전부 그대로다.** 미들웨어 matcher도 손댈 필요가 없다.
- 현재 푸터가 붙어 있던 페이지 전부를 `(console)`로 옮기므로 **푸터 회귀가 0이다.** 그룹을 나누면서 푸터를 빼먹는 페이지가 없어야 한다 — 이동 대상 7개 폴더를 Task에 명시했다.
- `/login`도 `(console)`에 넣는다. 8.1 시점의 `/login`은 판매자·관리자 로그인 화면이고 푸터가 붙어 있다 — 현행 100% 보존이 우선이다. **8.2 접점:** 구매자 로그인·회원가입을 만들 때 `(console)/login` → `(buyer)/login`으로 옮기거나 화면을 구매자 셸로 갈아끼우면 되고, **어느 쪽이든 URL은 `/login` 그대로다.**

**기존 랜딩(`app/page.tsx`)의 행방.** 삭제한다. `redirect("/login")`이 하던 일은 두 경로가 대체한다 — (1) 미들웨어가 세션 없는 `/seller`·`/admin`·`/apply` 요청을 `/login`으로 보내는 기존 규칙, (2) `/login` 성공 시 role에 따라 `/admin`·`/seller`·`/no-role`로 보내는 기존 코드(`app/login/page.tsx`). **판매자·관리자가 `/`에서 자기 화면으로 가는 헤더 링크는 8.1이 만들지 않는다** — DESIGN.md의 상단바 네 형태에 역할 링크 자리가 없고(시각 계약), 역할 판정의 정본은 8.2가 `buyer` 값을 도입하며 정리한다. 에픽 AC의 "헤더 **또는** 로그인 후 안내"에서 후자로 충족한다.

> **주의(빌드 오류 지뢰).** `app/page.tsx`와 `app/(buyer)/page.tsx`는 둘 다 `/`로 해석되어 **빌드가 실패한다.** 같은 커밋에서 반드시 함께 처리한다. [Source: route-groups#Caveats — Conflicting paths]

### D3 — 미들웨어 확장: **공개는 matcher에서 빼고, 보호만 추가한다**

**결정.**

```ts
// 기존 3줄(세션 없음 / admin / seller)은 손대지 않는다. 아래를 그 "앞"에 새 블록으로 추가한다.
const PROTECTED = ["/cart", "/checkout", "/orders", "/me"];   // prefix 판정
if (!hasSession && PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("next", pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = { matcher: [
  "/seller/:path*", "/admin/:path*", "/apply/:path*", "/apply",   // ← 기존 그대로
  "/cart", "/checkout", "/orders", "/orders/:path*", "/me",        // ← 신규
] };
```

**근거.**
- **공개 라우트(`/`·`/products/*`)를 matcher에 넣지 않는다.** 미들웨어가 아예 실행되지 않으므로 "통과"가 코드가 아니라 구조로 보장되고, 기존 세 규칙과 간섭할 여지가 0이다. 공개 라우트를 matcher에 넣고 `if`로 통과시키는 방식은 규칙이 하나 늘 때마다 회귀 표면이 넓어진다.
- 신규 블록을 기존 세 개의 `if` **앞**에 두되 판정 경로가 겹치지 않으므로(구매자 경로 ∩ `/seller`·`/admin`·`/apply` = ∅) 순서가 동작을 바꾸지 않는다. 그래도 앞에 두는 이유는 diff를 읽을 때 "기존 블록이 통째로 보존됐다"가 한눈에 보이기 때문이다.
- **8.2 접점 — 세션 판정은 지금과 같은 식을 그대로 쓴다.** `hasSession = req.cookies.get("slur_role") !== undefined`. 8.2가 이 쿠키에 `buyer` 값을 추가해도 `!== undefined`는 그대로 참이므로 **8.1의 코드는 수정 없이 계속 맞다.** 8.1은 역할을 보지 않고 **로그인 여부만** 본다.
- 리다이렉트 URL은 신규 블록에서만 `req.nextUrl.clone()`을 쓴다(프록시 뒤에서 `req.url`이 내부 호스트를 담을 수 있는 위험 회피). **기존 세 줄의 `new URL(..., req.url)`은 1.6에서 프로덕션 검증된 코드이므로 통일 목적으로 건드리지 않는다.**

**알려진 한계(회귀가 아니라 기존 성질).** `slur_role`은 14일, `slur_access`는 30분이다. access가 만료돼도 미들웨어는 통과시키고 페이지가 API 401을 받는다. 그래서 **보호 라우트의 페이지는 401 → `/login` 처리를 자기 손으로 해야 한다**(기존 판매자 화면들이 이미 그렇게 한다: `if (res.status === 401) router.replace("/login")`). 8.1은 API를 부르지 않으므로 이 처리를 하지 않지만, 8.4~8.7이 반드시 따라야 할 규칙으로 남긴다. 미들웨어를 인증으로 착각하지 않는다 (AD-1).

### D4 — 먹색 포커스 링: **`outline` 기반으로 신설하고, 구매자 스코프 안에서 슬러 링을 무력화**

**결정.**

```css
[data-surface="buyer"] {
  --b-focus-ring-color: var(--b-ink);
  --b-focus-ring-width: 2px;
  --b-focus-ring-offset: 2px;
}
[data-surface="buyer"] :is(a, button, input, textarea, select, summary, [tabindex]):focus-visible {
  outline: var(--b-focus-ring-width) solid var(--b-focus-ring-color);
  outline-offset: var(--b-focus-ring-offset);
  box-shadow: none;              /* slur/global.css의 파랑 링을 스코프 안에서만 끈다 */
}
```

**근거.**
- **`box-shadow`가 아니라 `outline`을 쓴다.** UX-DR12가 구매자 화면의 `box-shadow`를 금지하는데, 슬러 시스템의 포커스 링은 `--color-focus-ring: 0 0 0 3px rgba(47,107,255,.30)`이라는 **box-shadow 값**이다. 같은 수단을 색만 바꿔 쓰면 "구매자 라우트에 box-shadow 없음"(AC 3)을 스스로 위반한다. `outline`은 둥근 모서리를 따라가고 레이아웃을 밀지 않으며 강제 색상 모드에서도 살아남는다.
- `slur/global.css`가 `input:focus-visible … { outline: none; box-shadow: var(--color-focus-ring) }`를 **전역 태그 셀렉터**로 걸어두었으므로, 구매자 폼 요소에 파랑 링이 따라온다. 위 규칙이 명시적으로 `box-shadow: none`을 선언해 이를 끊는다 — 특이도(0,2,1 > 0,1,1)로 이긴다.
- 슬러 시스템 파일을 수정하지 않으므로 판매자·관리자 포커스 링은 그대로다. **AC 4·11의 검증 Task가 두 표면을 각각 탭 이동으로 확인한다.**
- `--color-focus-ring`을 구매자 스코프에서 remap하는 대안은 기각했다 — box-shadow 수단이 그대로 남아 UX-DR12와 충돌한다.

### D5 — 반응형 골격: **셸이 컨테이너·그리드·고정바 규칙을 소유하고, 화면은 그것을 쓴다**

**결정.** 아래 유틸리티를 `buyer.css`가 소유한다. 개별 화면은 여기서 정한 값을 다시 쓰지 않는다.

| 유틸리티 | 규칙 |
|---|---|
| `.b_container` | `padding-inline: 20px` / ≥768: `max-width: 1080px; margin-inline: auto; padding-inline: 32px` (1080px에 패딩 포함 — 목업 `.pad1280` 선언과 일치) |
| `.b_container.m_read` | `max-width: 640px` — 주문내역·주문상세·내 정보·로그인·회원가입 |
| `.b_container.m_narrow` | `max-width: 560px` — 주문완료 |
| `.b_row` / `--b-row-max: 560px` | 라벨-값 행·항목 조작 행은 칼럼이 아무리 넓어도 560px 안에서 좌측 정렬 |
| `.b_grid` | `repeat(2,1fr)` 14/26px → ≥640 `repeat(3,1fr)` → ≥768 간격 20/36px |
| `.b_topbar` | 54px 고정, 종이 배경, 하단 1px hairline, `z-index: var(--z-sticky)` |
| `.b_tabbar` | 56px, `position: fixed; bottom: 0`, 상단 1px hairline, **≥768에서 `display: none`** |
| `.b_topnav` | ≥768에서만 `display: flex` (그 아래 `display: none`) |

**근거·규칙.**
- **폭 전환은 CSS만으로 한다.** 탭바와 상단 내비를 **둘 다 항상 렌더**하고 `display`로 감춘다. `matchMedia`로 조건부 렌더하면 폭이 바뀔 때 컴포넌트가 언마운트되어 선택한 옵션·체크·입력 중인 값이 날아간다 — AC 5의 "상태 초기화 없음"이 이 규칙 하나에 걸려 있다. `display: none`인 쪽은 접근성 트리에서도 제외되므로 스크린리더에 내비가 두 번 읽히지 않는다.
- 브레이크포인트는 기존 슬러 시스템 값(sm 640 / md 768 / lg 1024 / xl 1280)을 그대로 물려받는다. CSS 커스텀 프로퍼티는 `@media` 안에서 못 쓰므로 px 리터럴을 직접 적고 `tokens/breakpoints.css`의 주석 규약을 따른다.
- 고정 바에 가려지지 않도록 셸이 본문에 `padding-bottom`을 준다: 탭바 있는 화면 `calc(56px + env(safe-area-inset-bottom))`. `[ASSUMPTION]` `env(safe-area-inset-bottom)` 실제 값은 PWA standalone에서만 의미가 커진다 — 8.7에서 확인한다.
- 고정 바는 **DOM 순서상 `<main>` 뒤**에 둔다 (UX-DR6 — 포커스가 콘텐츠보다 먼저 걸리면 안 된다).
- z-index는 슬러 `--z-sticky`(200)를 재사용한다. 새 z 토큰을 만들지 않는다.
- **"탭 전환 시 각 탭의 스크롤 위치 유지"는 v1에서 브라우저 기본 동작에 맡긴다.** `[ASSUMPTION]` 이 요구(UX-DR3)는 네이티브 탭 컨테이너의 성질이고, 웹 히스토리 모델에서는 뒤로/앞으로 이동 시에만 스크롤이 복원된다. 탭별 스크롤 저장소를 직접 만드는 것은 완주에 기여하지 않는다. 다만 **"같은 탭 재탭은 최상단 복귀"는 구현한다**(현재 활성 탭 클릭 시 `window.scrollTo({ top: 0 })`, `prefers-reduced-motion`을 존중해 smooth를 쓰지 않는다).

### D6 — 타이포·색 값의 소유권: **토큰과 역할 클래스는 8.1이 전부 선언한다**

**결정.** `styles/buyer/tokens.css`(색·간격·라운드)와 `styles/buyer/type.css`(역할별 타이포 클래스)를 8.1이 만들고, DESIGN.md 프론트매터의 값을 1:1로 옮긴다. 화면 스토리는 hex·px를 쓰지 않고 이 토큰·클래스만 쓴다.

- **타이포는 원자 토큰이 아니라 역할 클래스로 낸다.** `.b_brand_label { font-size:11px; font-weight:800; letter-spacing:.15em }` 처럼 세 속성이 한 벌로 움직인다. 크기·굵기·자간을 따로 토큰화하면 조합을 틀릴 수 있고, UX-DR2가 "이 조합이 이 지면의 유일한 지문"이라며 임의 변경을 금지한다.
- **글꼴은 새로 만들지 않는다.** 슬러 `--font-sans`를 그대로 쓴다 (DESIGN.md Typography: "같은 스택이므로 글꼴은 공유하고 색만 갈린다").
- 금액에는 `font-variant-numeric: tabular-nums`를 클래스 차원에서 붙인다.
- DESIGN.md 프론트매터 밖이지만 본문에 나오는 5색도 **여기서 이름을 붙여 토큰화한다** — `--b-surface-inset: #f7f4ee`(판매자 정보 상자·선택 결과 줄), `--b-product-name: #605b53`(카드 상품명), `--b-ink-unavailable: #a8a29a`(구매 불가 묶음 글자), `--b-checkbox-border: #d5cfc4`, `--b-pack-foot-line: #efeae1`. 근거: 지금 이름을 안 주면 8.3~8.6이 hex를 인라인으로 박기 시작하고, UX-DR1의 "값을 새로 만들지 말고 이 안에서 고른다"가 그 순간 깨진다. 값은 전부 DESIGN.md 본문에서 온 것이며 새로 만든 값이 아니다.

## Tasks / Subtasks

- [x] **Task 1 — 라우트 그룹 분리와 푸터 이관** (AC: 6, 8)
  - [x] `git mv`로 `app/{seller,admin,apply,login,no-role,terms,privacy}` → `app/(console)/` (7개 폴더)
  - [x] `app/(console)/layout.tsx` 신설 — **반드시 프래그먼트로** `<>{children}<SiteFooter /></>`를 반환한다. `site-footer.tsx`·`site-footer.css`·`logout-button.tsx`·`config/company.ts`는 `app/` 자리에 그대로 둔다
    - 🚨 **`<div>`로 감싸면 푸터가 깨진다.** `globals.css:23-26`이 `body { display:flex; flex-direction:column }`이고 `site-footer.css:6`의 `.layout_footer { margin-top: auto }`가 **body의 flex 자식일 때만** 동작한다. 래핑 엘리먼트가 하나라도 끼면 푸터가 짧은 페이지에서 바닥에 붙지 않고 콘텐츠 바로 아래로 올라온다 — 눈에 잘 안 띄는 회귀다
    - [x] 검증: `/terms`처럼 **콘텐츠가 짧은 페이지**에서 푸터가 뷰포트 바닥에 붙는지 확인한다 (긴 페이지에서는 이 회귀가 보이지 않는다)
  - [x] `app/layout.tsx`에서 `SiteFooter` import·렌더 **두 줄만** 제거. `<html lang="ko">`·Pretendard link·슬러 CSS 임포트 18줄·`metadata`는 손대지 않는다
  - [x] 깨진 상대 경로 수정 — 이동한 파일들의 `../logout-button`(9곳)·`../config/company`(2곳)·`../styles/policy.css`(2곳)를 `@/app/logout-button`·`@/app/config/company`·`@/app/styles/policy.css`로 바꾼다(별칭 `@/*` → `./*`는 tsconfig에 이미 있다). 깊이 결합을 끊어 다음 이동 때 다시 깨지지 않게 한다. 같은 폴더 안 상대 경로(`./category-panel`·`./status`·`./*.css`)는 함께 이동하므로 손대지 않는다
  - [x] `app/page.tsx` 삭제 (`/`는 `(buyer)/page.tsx`가 가진다 — 남겨두면 경로 충돌로 빌드 실패)
  - [x] `app/api/**`는 이동하지 않는다 (BFF Route Handler)

- [x] **Task 2 — 구매자 토큰·타이포 신설 (스코프 격리)** (AC: 3, 4)
  - [x] `app/styles/buyer/tokens.css` — `[data-surface="buyer"] { --b-* }`. DESIGN.md 프론트매터 `colors` 24색 + D6의 5색 + `spacing`(gutter 20/32, section-y 22, band 8, grid-gap 14/26·20/36, topbar-h 54, tabbar-h 56, cta-bar 13/20) + `rounded`(2/3/4/5/999) + `--b-content-max:1080px`·`--b-read-max:640px`·`--b-narrow-max:560px`·`--b-row-max:560px` + 포커스 링 3종
  - [x] `app/styles/buyer/type.css` — DESIGN.md 프론트매터 `typography` 전 항목을 역할 클래스로 (logo·brand-label·eyebrow·section-label·display·title·title-sm·topbar-title·price-*·deposit-amount·product-name-*·body·control·input·meta·status-label·notice·tab-label·button·tag). 금액 계열에 `tabular-nums`
  - [x] **슬러 시스템 파일(`app/styles/slur/**`)을 열지도 수정하지도 않는다.** 이 스토리의 diff에 `styles/slur/` 경로가 나타나면 잘못된 것이다
  - [x] 두 파일은 `(buyer)/layout.tsx`에서만 임포트한다
    - ⚠️ **격리의 근거는 임포트 위치가 아니라 셀렉터다.** App Router는 임포트된 CSS가 다른 라우트의 스타일시트에 섞이지 않는다고 보장하지 않는다 — 실제 격리는 전부 `[data-surface="buyer"]` 스코프에서 나온다. 임포트 위치는 정리 차원일 뿐이므로, **스코프 없는 전역 셀렉터(`body`·`a`·`button` 같은 태그 셀렉터)를 구매자 CSS에 절대 쓰지 않는다**

- [x] **Task 3 — 구매자 셸 레이아웃** (AC: 1, 2, 3, 5)
  - [x] `app/(buyer)/layout.tsx` — 셸 래퍼에 `data-surface="buyer"`, `min-height:100dvh`, 종이 배경. 상단바 → `<main>` → 하단 고정 바(탭바) **DOM 순서 준수**
  - [x] `buyer-topbar.tsx` — `variant: "logo" | "logo-center" | "back-title" | "title"`, `title?`, `showCart?`. ≥768에서는 형태와 무관하게 로고 + 상단 내비로 수렴하고 뒤로가기가 사라진다
  - [x] `buyer-tabbar.tsx` / `buyer-topnav.tsx` — 같은 4항목 정의를 공유(단일 배열 상수). 활성 판정은 셸이 받는 `tab: "home" | "cart" | "orders" | "me"` prop으로 하고 pathname 추측에 의존하지 않는다(상세 화면이 소속 최상위를 활성 표시해야 하므로)
  - [x] `buyer-icons.tsx` — 22px 인라인 SVG 4종(홈·장바구니·주문내역·내 정보). `currentColor` + `stroke-width: var(--b-tab-stroke)` (1.4px, 활성 1.9px). 아이콘 폰트·이모지·외부 CDN 금지
  - [x] 장바구니 배지 **슬롯만** 만들고 값은 넣지 않는다 — 개수 조회는 8.4 소관 (담긴 항목 수 **전체**, 구매 불가 포함)
  - [x] 같은 탭 재탭 → `window.scrollTo({ top: 0 })` (smooth 미사용)
  - [x] 탭바·상단 내비를 **둘 다 항상 렌더**하고 CSS `display`로만 전환 (조건부 렌더 금지)

- [x] **Task 4 — 반응형 유틸리티와 셸 CSS** (AC: 1, 2, 3, 4, 5)
  - [x] `app/(buyer)/buyer.css` — D5 표의 유틸리티 전부 + 상단바/탭바/상단 내비 컴포넌트 스타일 + D4의 포커스 링 규칙
  - [x] `box-shadow` 선언이 이 파일에 **0건**인지 확인 (`grep -n "box-shadow" app/(buyer)/buyer.css app/styles/buyer/*.css` → `box-shadow: none` 한 줄 외에 없어야 한다)
  - [x] `#2f6bff`·`--color-brand`·`--shadow-` 문자열이 구매자 파일에 0건인지 확인
  - [x] `100vh` 대신 `100dvh`

- [x] **Task 5 — 라우트 자리표시와 홈** (AC: 5, 6)
  - [x] `(buyer)/page.tsx`(`/`) — 셸 적용 + `.b_grid` 위 자리표시 블록 6개(높이를 서로 다르게 두어 2/3/3열 전환과 리듬을 눈으로 확인). **8.3이 통째로 대체한다**
  - [x] `(buyer)/cart/page.tsx`·`orders/page.tsx`·`me/page.tsx` — 탭 목적지가 실제로 존재해야 탭바를 검증할 수 있으므로 최소 자리표시만. 각각 8.4·8.6·8.7이 대체한다
  - [x] `/products/[id]`·`/checkout`·`/orders/[id]`·`/orders/complete`는 **만들지 않는다** — 미들웨어 matcher에만 미리 등록한다 (해당 스토리가 페이지를 만든다)
  - [x] `viewport` export를 추가하지 **않는다** — Next가 `width=device-width, initial-scale=1`을 기본으로 넣는다. 특히 `maximumScale`·`userScalable: false`는 글자 200% 확대 요구(UX-DR7)와 충돌하므로 금지. `themeColor`는 8.7(PWA)

- [x] **Task 6 — 미들웨어 확장** (AC: 7)
  - [x] D3의 신규 블록 추가 + matcher에 보호 라우트 5개 추가. **기존 세 개의 `if`와 기존 matcher 4항목은 문자 그대로 보존**
  - [x] `next` 파라미터 생성 규칙 구현(자체 경로만, 쿼리 포함). **소비(로그인 성공 후 복귀)는 8.2 소관**임을 코드 주석에 남긴다
  - [x] 세션 판정은 `slur_role !== undefined` 유지 — 8.2가 `buyer` 값을 추가해도 수정 불필요함을 주석으로 명시

- [x] **Task 7 — 공유 컴포넌트 자리 잡기** (AC: 9)
  - [x] `brand-label.tsx` — 완성 (순수 표현. `size: "card" | "pack" | "detail"` → 11px/.15em · 10.5px/.14em · 11.5px/.17em. 자간은 CSS로만 주고 글자 사이에 공백을 넣지 않는다 — 낭독을 깨뜨린다)
  - [x] `status-label.tsx` — 완성 (면 없는 11.5px/800/.05em. 입금대기=액센트 / 진행 중=먹색 / 완료·취소=흐린색. 색 + 텍스트를 항상 함께, 스크린리더에 상태로 전달)
  - [x] `amount-summary.tsx`·`seller-pack.tsx` — **뼈대만**: 타입·마크업 골격·CSS. 행 순서 고정(상품 금액 · 배송비 · 도서산간 추가 · 합계)과 "도서산간 0원이어도 줄을 지우지 않는다"를 타입·주석으로 못 박는다. 데이터 연결은 8.4·8.5·8.6

- [x] **Task 8 — 검증: 빌드·정적 규칙** (AC: 10, 11)
  - [x] `cd apps/web && npx tsc --noEmit` → 0
  - [x] `cd apps/web && npm run lint` → 0 errors · 0 warnings (현재 베이스라인, A-E456-5 — 늘어나면 이 스토리가 깬 것)
  - [x] **백엔드 무변경의 1차 증거는 `git diff --stat`에 `apps/api` 경로가 0건인 것이다.** 이 스토리는 `apps/api`를 열지 않으므로 이것으로 충분하다
  - [ ] `cd apps/api && uv run pytest -q` → 153 passed — **환경이 갖춰진 경우에만.** 현재 이 머신에는 `uv`도 `docker`도 PATH에 없고(pytest는 docker compose로 띄운 로컬 Postgres를 요구한다) 이 스토리는 백엔드를 건드리지 않는다. 실행하지 못했다면 Completion Notes에 **"미실행 + 사유"** 를 적는다 — 통과했다고 쓰지 않는다
  - [x] `next build` 성공 — 경로 충돌(`/` 중복)·그룹 이동 후 임포트 깨짐이 여기서 잡힌다

- [ ] **Task 9 — 검증: 판매자·관리자 회귀 (눈으로)** (AC: 3, 4, 8, 11) — **이 스토리의 가장 중요한 Task다**
  - [ ] 관리자 계정으로 로그인 → `/admin`·`/admin/orders`·`/admin/settings`·`/admin/lookup`·`/admin/deposits` 진입. 파랑 버튼·카드·배지·표의 **색과 레이아웃이 전과 동일**한지 확인
  - [ ] 판매자 계정으로 로그인 → `/seller`·`/seller/products`·`/seller/orders` 동일 확인
  - [x] `/apply`·`/terms`·`/privacy`·`/no-role`·`/login`에 **푸터가 그대로** 붙는지 확인 (사업자 정보 2줄 + 중개자 고지 + 약관·개인정보 링크)
  - [ ] 판매자·관리자 화면에서 Tab 키로 이동 → **파랑 포커스 링이 그대로** 보이는지 확인 (구매자 링이 새지 않았다는 증거)
  - [ ] 구매자 화면에서 Tab 키로 이동 → **먹색 링**이 모든 인터랙티브 요소에 보이는지, 파랑이 한 번도 나타나지 않는지 확인
  - [x] 브라우저 개발자도구에서 `/seller` 문서의 `<body>`에 `data-surface` 속성이 없는지, computed `--color-focus-ring`이 파랑 그대로인지 확인
  - [ ] 결과를 Completion Notes에 기록한다 (단위 테스트로 대체하지 않는다)

- [ ] **Task 10 — 검증: 반응형 3폭** (AC: 1, 2, 5)
  - [x] 390 / 768 / 1280 세 폭에서 `/`·`/cart`·`/orders`·`/me` 렌더 확인
  - [x] 390: 하단 탭바 56px 4탭 균등, 활성=먹색+800+굵은 선, 상단 내비 없음, 좌우 여백 20px, 그리드 2열
  - [x] 640~767(예: 700): 그리드 3열, 여백 20px, 아직 탭바
  - [x] 768: 탭바 사라지고 상단 내비 등장, 여백 32px, 본문 1080px 미만이라 가운데 정렬 효과 없음, 그리드 3열 간격 20/36
  - [x] 1280: 본문 1080px 가운데 정렬, 좌우 여백 100px씩 남음
  - [ ] **폭을 390 ↔ 1280으로 드래그하며 바꿔도 화면이 새로 마운트되지 않는지** 확인 (자리표시 페이지에 입력 필드를 임시로 하나 두고 값을 친 뒤 폭을 바꿔 값이 남는지 본다 — 확인 후 제거)
  - [ ] 키보드만으로 탭바·상단 내비·본문을 완주 (포커스 순서가 읽기 순서를 따르고, 하단 고정 바가 먼저 걸리지 않는지)

- [ ] **Task 11 — 검증: 미들웨어 (로컬 + 프로덕션, R3)** (AC: 7)
  - [x] 비로그인: `/` 200 · `/products/1` 200(페이지 없으면 404여도 리다이렉트가 아니면 통과 확인) · `/cart` → `/login?next=%2Fcart` · `/orders/abc` → `/login?next=%2Forders%2Fabc` · `/me` → `/login?next=%2Fme`
  - [x] 비로그인: `/seller`·`/admin`·`/apply` → `/login` (기존 동작 유지, `next` 없음)
  - [x] 판매자 로그인 후: `/admin` → `/seller` · `/seller` 통과 (기존 규칙)
  - [x] 관리자 로그인 후: `/admin` 통과 · `/seller` 통과 (기존 규칙)
  - [x] 로그인 상태로 `/cart`·`/orders`·`/me` 통과
  - [x] `next=https://evil.example` 같은 외부 URL이 **미들웨어가 만든 리다이렉트에는 실릴 수 없음**을 확인 (미들웨어는 `pathname`만 싣는다)
  - [ ] **프로덕션(Railway 프록시 뒤) 배포 후 같은 시나리오를 curl로 재확인** — 회고 R3: 쿠키·Origin·리다이렉트는 프로덕션 실요청 검증 전에는 done이 아니다. 특히 리다이렉트 `Location` 헤더가 내부 호스트가 아닌 공개 호스트인지 확인한다

## Dev Notes

### 이 스토리의 경계 — 하지 않는 일

| 하지 않는다 | 어디가 하는가 |
|---|---|
| 백엔드 수정·마이그레이션·API 호출 | 없음. Epic 8 전체가 백엔드 무변경 |
| 구매자 화면의 **내용** (상품 카드·옵션 칩·장바구니 행…) | 8.3~8.7 |
| 역할 쿠키에 `buyer` 추가, `/login`·`/signup` 화면, 카카오 웹 플로우, `next` 복귀 처리 | **8.2** |
| PWA manifest · service worker · `theme-color` · 아이콘 | **8.7** |
| `/me` 내용(사업자 정보·중개자 고지·약관 링크) | **8.7** |
| 우편번호 검색 오버레이(유일한 모달 예외) | 8.5 |
| `apps/mobile` 제거 | 8.8 |

### 고칠 코드 — ① 지금 무엇을 하는가 ② 무엇을 바꾸는가 ③ 깨뜨리면 안 되는 것

**`apps/web/app/layout.tsx`**
1. `<html lang="ko">` + Geist 폰트 변수 + Pretendard CDN `<link>` + `globals.css` + 슬러 토큰 8·global·컴포넌트 7 임포트 + `metadata` + `<body>{children}<SiteFooter /></body>`. **모든 페이지에 푸터가 붙는다.**
2. `SiteFooter` import와 렌더 **두 줄만** 제거. 푸터는 `(console)/layout.tsx`로 내려간다.
3. `<html lang="ko">`(UX-DR16이 요구, 이미 충족), 슬러 CSS 임포트 순서, `metadata`, Pretendard 로드. **여기에 구매자 CSS를 임포트하지 않는다** — 임포트하면 콘솔 번들에도 섞이고 스코프 격리의 의도가 흐려진다.

**`apps/web/app/page.tsx`**
1. `redirect("/login")` 다섯 줄. `/`는 로그인 유도 랜딩이다.
2. **삭제.** `/`는 `(buyer)/page.tsx`가 가진다.
3. 대체 경로가 실제로 있는지 — 미들웨어의 `/seller`·`/admin`·`/apply` 미로그인 리다이렉트(유지)와 `login/page.tsx`의 role별 분기(유지). 둘 다 이 스토리에서 손대지 않으므로 판매자·관리자의 로그인 동선은 그대로다.

**`apps/web/middleware.ts`**
1. `slur_role` 쿠키 존재로 세션을 판정하고, 세 개의 `if`로 (a) 미로그인 `/seller`·`/admin`·`/apply` → `/login`, (b) `/admin`인데 admin 아님 → `/seller` 또는 `/no-role`, (c) `/seller`인데 seller·admin 아님 → `/no-role`. matcher는 4항목.
2. D3의 신규 블록 + matcher에 보호 라우트 5개 추가.
3. **기존 세 `if`와 기존 matcher 4항목.** 한 글자도 바꾸지 않는다. 특히 `/admin` → `/seller` 허용 규칙과 판매자 → `/admin` 차단 규칙은 8.2의 회귀 검증 대상이기도 하다.

**`apps/web/app/globals.css`**
1. `--background/--foreground`(다크 미디어쿼리 포함), `html/body` 리셋, `body { font-family: Arial… }`, 전역 `*` 리셋, `a { color: inherit }`, `.page_landing`(= `/no-role` 전용).
2. **수정하지 않는다.** 구매자 규칙은 새 파일에만 쓴다.
3. `body`의 `display:flex; flex-direction:column`(`globals.css:23-26`)과 `.page_landing`(`/no-role`이 쓴다). `body { font-family: Arial }`은 뒤에 임포트되는 `slur/global.css`가 `var(--font-sans)`로 덮고 있다 — 이 순서 의존을 흔들지 않는다.
   - 🚨 **푸터가 이 flex에 의존한다.** `.layout_footer { margin-top: auto }`(`site-footer.css:6`)는 푸터가 **body의 직계 flex 자식일 때만** 바닥에 붙는다. Task 1에서 `(console)/layout.tsx`를 프래그먼트로 만들어야 하는 이유이며, 래핑 엘리먼트를 하나라도 끼우면 짧은 페이지에서 푸터가 떠오른다.
   - 구매자 셸도 body의 직계 flex 자식이 된다. `min-height:100dvh`를 주되 flex 축소로 눌리지 않는지 확인한다(`flex-shrink:0` 또는 `flex:1`).

**`apps/web/app/styles/slur/**` (토큰 8 + global + 컴포넌트 7)**
1. `--color-brand-500: #2f6bff` 등 프리미티브 → `--color-brand`·`--color-focus-ring`·`--color-surface-page` 등 시맨틱 2층 구조. `global.css`가 `body`와 폼 컨트롤 포커스를 전역 태그 셀렉터로 지정. `data-theme="dark"` 지원(구매자는 라이트 한 벌뿐).
2. **아무것도 바꾸지 않는다.** 구매자는 `--b-*` 이름공간을 새로 만든다(D1). 재사용하는 것은 `--font-sans`와 `--z-sticky` 둘뿐이다.
3. 판매자·관리자 전 화면이 이 시맨틱 토큰 위에 서 있다. `:root` 선언을 하나라도 바꾸면 5개 관리자 화면·3개 판매자 화면·`/apply`·`/login`·`/terms`·`/privacy`가 동시에 영향을 받는다.

**`apps/web/app/site-footer.tsx` / `site-footer.css`**
1. `COMPANY`·`BROKER_NOTICE`(`app/config/company.ts`)를 읽어 사업자 정보 2줄 + 중개자 고지 + `/terms`·`/privacy` 링크를 렌더. `margin-top:auto`로 바닥에 붙는다(6.1, FR-31·33).
2. **파일은 그대로 두고 렌더 위치만** 루트 → `(console)/layout.tsx`로 옮긴다.
3. 마크업·클래스·`config/company.ts` 경로. 판매자·관리자 표면의 FR-31·33 충족 수단이므로 사라지면 법적 고지 회귀다. 구매자 표면은 `/me`(8.7)가 대응 자리를 받는다.

**`apps/web/app/seller/page.tsx` (관례 참조용)**
1. `"use client"` + `useEffect`로 BFF(`/api/seller/*`) 호출 → 401은 `router.replace("/login")`, 403은 `/no-role`. 마크업은 `.page_seller > .p_head/.p_dashboard/.p_panel` + 슬러 컴포넌트 클래스(`.card`·`.btn m_primary`·`.alert m_inline m_danger`·`.field`·`.input_text`). CSS는 같은 폴더 `./seller.css`를 컴포넌트에서 임포트.
2. 폴더 이동에 따른 `../logout-button` 경로만 바뀐다. 로직·마크업 무변경.
3. **네이밍 관례** — 페이지 루트 `page_*`, 페이지 요소 `p_*`, 내부 요소 `i_*`, 변형 `m_*`. 구매자 CSS도 이 문법을 따르되 접두사만 `b_*`로 둔다(`.b_topbar`·`.b_tabbar`·`.b_container`). **CSS는 라우트 옆에 두고 컴포넌트가 임포트한다** — 이 저장소의 관례다.

### 앞선 학습 (sprint-status.yaml action_items에서 골라온 것)

- **R3 (open) — 쿠키·Origin·CORS 미들웨어는 프로덕션(프록시 뒤) 실요청 검증 후에만 done.** 이 스토리가 미들웨어를 건드리므로 정면으로 해당한다. Task 11의 프로덕션 재확인이 완료 조건이다. 1.6의 함정도 함께 기억한다 — Railway `config apply`가 web 환경변수 추가를 조용히 누락한 적이 있다(R1). 이 스토리는 새 환경변수를 요구하지 않는다.
- **R6 — 에러 code는 Dev Notes에 사전 시드 선언.** 아래 별도 절.
- **R7 — `slur_role`은 UX 힌트일 뿐 권한 판정이 아니다.** 이 스토리의 미들웨어 확장은 그 성질을 그대로 물려받는다. 보호 라우트를 통과했다는 것이 인증됐다는 뜻이 아니다 — 페이지가 API 401/403을 스스로 처리해야 한다(AD-1).
- **R5 — 이전 보류 스캔.** 스파인 Deferred "프론트 상세 폴더 구조 (Next.js)"가 이 스토리 소관이며 D2에서 해소한다. `deferred-work.md`의 "웹 lint 베이스라인"은 A-E456-5로 이미 0이 되었으므로 **0을 유지하는 것**이 이 스토리의 의무다.
- **A-E456-5 (done) — lint 0.** 베이스라인이 0이므로 이 스토리 후 1건이라도 늘면 이 스토리가 만든 것이다. 특히 이동한 파일에서 미사용 import가 남기 쉽다.
- **1.6 / 2.1 — 인증 경로의 확정 사실.** 토큰은 httpOnly 쿠키(`slur_access` 30분 · `slur_refresh` 14일, refresh path `/api`)로만 존재하고 브라우저 JS는 만지지 않는다. BFF Route Handler(`app/api/**`)가 FastAPI를 대리 호출하며 401 시 refresh 회전 후 1회 재시도한다(`lib/auth.ts` `proxyWithRefresh`). **8.1은 이 경로를 쓰지도 바꾸지도 않는다** — 8.3부터 소비한다.

### 에러 code 시드 (R6)

**없음 — 이 스토리는 FastAPI를 호출하지 않는다.** 대신 후속 화면 스토리가 따를 표시 규약만 못 박는다: 분기는 에러 봉투의 `code`로, 화면 표시는 `message`로. **HTTP 코드·`code` 문자열을 화면에 노출하지 않는다.** 네트워크·서버 실패는 문장형 한국어 + 재시도 수단. 오류 표시 컴포넌트는 8.3이 처음 만든다 (UX-DR9).

### 발견한 위험 · 기존 코드의 문제 (구현 전에 읽을 것)

1. **목업 `responsive-768-1280.html`은 "고치기 전" 상태를 그린 검증본이다.** 카드 이미지 높이가 279·411px로 그려져 있고 상품상세 2단이 62/34로 라벨링돼 있는데, 이것이 바로 결함으로 발견돼 **DESIGN.md에서 200~260px · 50/50 좌측 sticky로 고쳐진** 그 화면이다(커밋 `8c51983`). **DESIGN.md가 정본이고 목업이 진다.**
2. **`epics.md`의 UX-DR4·UX-DR5 표도 같은 이유로 낡았다** — UX-DR4는 상품상세를 아직 "좌 62% / 우 34%, 우측 sticky"로, UX-DR5는 카드 이미지 높이를 "160~216px"로만 적고 있다. UX-DR 목록 서두가 "수치는 DESIGN.md 프론트매터 토큰이 정본"이라고 선언해 두었으므로 충돌 시 DESIGN.md를 따른다. (8.1의 직접 범위는 아니지만 8.3이 그대로 밟을 지뢰라 여기 남긴다.)
3. **`DESIGN.md`의 상단바는 세 형태가 아니라 네 형태다** — 로고형 / 로고 중앙형 / 제목형(뒤로가기+제목) / 제목만(좌측 정렬). 에픽 AC와 UX-DR3 본문은 "세 형태"라고 쓰지만 같은 문단에서 "최상위 화면의 제목은 좌측 정렬로 통일"을 요구하므로 네 번째 형태가 필요하다. **네 형태로 구현한다**(AC 2).
4. **Pretendard가 외부 CDN(jsdelivr) `<link>`로 로드된다** (`layout.tsx:45`). UX-DR16의 금지 대상은 아이콘 CDN이지만, PWA 오프라인·초기 렌더 안정성 관점에서 8.7이 판단할 거리다. **8.1에서는 건드리지 않는다.**
5. **`next/font/google`의 Geist·Geist Mono가 로드되지만 실질적으로 쓰이지 않는다** — `slur/global.css`가 `body`를 `var(--font-sans)`로 덮기 때문이다. 죽은 로드지만 제거는 이 스토리 범위 밖이다(레이아웃 diff를 최소로 유지한다).
6. **`app/page.module.css`는 어디서도 임포트되지 않는 create-next-app 잔재다.** `app/page.tsx`를 지우면 확실히 고아가 된다. 함께 지울지는 구현자 판단에 맡기되, 지운다면 `grep -rn "page.module" apps/web/app`이 0건임을 먼저 확인한다.
7. **`/no-role` 문구가 사실과 어긋나게 된다** — 현재 "이 웹은 판매자·관리자용입니다. 구매는 SLUR 앱을 이용해 주세요."라고 안내하는데, 구매자 표면이 이 웹으로 들어오면 거짓말이 된다. **문구 수정은 8.2 소관**이다(에픽 8.2 AC: "`/no-role` 화면은 남되 판매자·관리자 화면 접근 안내 전용이 된다"). 8.1은 화면을 `(console)`로 옮기기만 하고 문구는 그대로 둔다 — 8.2가 반드시 고쳐야 할 항목으로 여기 기록한다.
8. **미들웨어 통과 ≠ 인증.** D3의 "알려진 한계" 참조. `slur_role`(14일)이 `slur_access`(30분)보다 오래 살아 있어 만료 세션도 보호 라우트를 통과한다.
9. **`orders/complete`와 `orders/[id]`의 경로 경합.** Next는 정적 세그먼트를 동적보다 먼저 매칭하므로 `/orders/complete`는 `complete/page.tsx`로 간다. 8.5·8.6이 두 파일을 만들 때 순서를 착각하지 않도록 기록한다.

### Project Structure Notes

- 정렬: `Consistency Conventions`의 "프론트 = Next.js App Router + 슬러 시스템 CSS"를 따르며, 구매자 표면은 그 위에 스코프된 확장 층을 얹는 형태다. [Source: ARCHITECTURE-SPINE.md#Consistency-Conventions]
- 신규 폴더 2개: `app/(buyer)/`, `app/(console)/`. 신규 스타일 폴더 1개: `app/styles/buyer/`.
- 변이: 라우트 그룹 도입은 이 저장소의 첫 사례다. **URL이 바뀌지 않는다**는 점이 채택 근거이며, Task 8의 `next build`가 경로 충돌을 잡는 안전망이다.
- 컴포넌트 파일은 라우트 폴더 안에 평평하게 둔다(`app/(buyer)/buyer-topbar.tsx`). 이는 기존 관례(`app/site-footer.tsx`·`app/logout-button.tsx`·`app/admin/category-panel.tsx`)와 같다. `page.tsx`·`layout.tsx`·`route.ts`가 아닌 파일은 라우트를 만들지 않는다.
- 스택 핀: Next.js 16.2.10 / React 19.2.4 (`apps/web/package.json`). `node_modules`가 설치돼 있지 않으면 `npm install` 후 검증 Task를 돈다.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic-8 — 이 에픽의 경계 (백엔드 무변경·ERD 0건·API 12개 재사용·테스트 153건)]
- [Source: _bmad-output/planning-artifacts/epics.md#Story-8.1 — AC 원문 및 Dev Notes(상단바 3형태·공유 컴포넌트 자리·백엔드 호출 없음·폴더 구조 확정 지시)]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR1 — 구매자 팔레트 토큰 신설, 브랜드 파랑 미사용]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR2 — 브랜드 라벨 타이포 11px/800/.15em, 글꼴 한 벌, tabular-nums]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR3 — 탭바 56px 4탭, ≥768 상단 내비 전환, 배치 규칙 4줄, 상단바 54px]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR4 — 2단 화면 3개·sticky·끝까지 한 단인 화면(640/560px)]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR5 — 여백 20/20/32, 본문 1080px, 열 2/3/3, 간격 26·14 / 36·20]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR6 — 먹색 포커스 링 신설, 하단 고정 바는 DOM 순서상 콘텐츠 뒤]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR7 — 터치 타깃 44×44, 글자 200% 확대 시 고정 높이 바가 늘어날 것]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR12 — box-shadow 금지, 깊이는 8px 띠·1px hairline·테두리 상자, 라운드 스케일]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR13 — 판매자 묶음 카드 뼈대·금액 요약 행 순서·배지 vs CTA 카운트]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR16 — 인터랙션 금지 목록, `<html lang="ko">`, 자간은 CSS로만]
- [Source: ux-designs/ux-SLUR_platform_blueprint-2026-07-21/DESIGN.md#frontmatter — colors·typography·rounded·spacing·components 값의 정본]
- [Source: ux-designs/ux-SLUR_platform_blueprint-2026-07-21/DESIGN.md#Layout-&-Spacing — 모바일 퍼스트 390px 기준, gutter 20px, 고정 바 높이 예산]
- [Source: ux-designs/ux-SLUR_platform_blueprint-2026-07-21/DESIGN.md#Layout-&-Spacing#반응형 — 폭별 표, 카드 이미지 200~260px, 2단 3화면, 행 내부 560px, 2단 우측 hairline 테두리 예외]
- [Source: ux-designs/ux-SLUR_platform_blueprint-2026-07-21/DESIGN.md#Elevation-&-Depth — 그림자 금지, `--shadow-*` 미사용]
- [Source: ux-designs/ux-SLUR_platform_blueprint-2026-07-21/DESIGN.md#Components — 상단바·탭바·CTA 바·버튼·브랜드 라벨·상태 라벨 수치]
- [Source: ux-designs/ux-SLUR_platform_blueprint-2026-07-21/EXPERIENCE.md#Information-Architecture — 10화면 표(헤더·탭바·CTA), 배치 규칙 4줄, 로그인/장바구니 뒤로가기 없음]
- [Source: ux-designs/ux-SLUR_platform_blueprint-2026-07-21/EXPERIENCE.md#라우트와-접근-권한 — 공개/보호 표, `/`는 구매자 홈, 복귀 규칙]
- [Source: ux-designs/ux-SLUR_platform_blueprint-2026-07-21/EXPERIENCE.md#Responsive-&-Platform — 동작 차이 표, ≥768 뒤로가기 없음·소속 최상위 활성, sticky는 짧은 칼럼, 폭 변경 시 상태 유지]
- [Source: ux-designs/ux-SLUR_platform_blueprint-2026-07-21/EXPERIENCE.md#Accessibility-Floor — 포커스 표시·키보드 완주·200% 확대·자간 낭독]
- [Source: ux-designs/.../.working/screens-1-browse.html — 390px 확정본: `.topbar` 54px, `.tabbar` 56px, `--sw` 1.4/1.9px, `.badge` 액센트 원]
- [Source: ux-designs/.../.working/responsive-768-1280.html — 768·1280 검증본: `.topnav` 54px 로고+4항목(13px/600, 활성 800), `.pad1280{max-width:1080px;padding:0 32px}`. **단, 카드 높이·2단 비율은 고치기 전 값이므로 DESIGN.md가 이긴다**]
- [Source: architecture/architecture-SLUR_platform_blueprint-2026-07-15/ARCHITECTURE-SPINE.md#AD-1 — FastAPI가 유일한 문지기]
- [Source: architecture/architecture-SLUR_platform_blueprint-2026-07-15/ARCHITECTURE-SPINE.md#AD-14 — 클라이언트 표면 단일화, 하나의 Next.js 앱, 동일 BFF 경로, DESIGN/EXPERIENCE가 목업을 이긴다]
- [Source: architecture/architecture-SLUR_platform_blueprint-2026-07-15/ARCHITECTURE-SPINE.md#Consistency-Conventions — 프론트·인증 흐름·에러 봉투]
- [Source: architecture/architecture-SLUR_platform_blueprint-2026-07-15/ARCHITECTURE-SPINE.md#Stack — Next.js 16.2 / React 19.2]
- [Source: architecture/architecture-SLUR_platform_blueprint-2026-07-15/ARCHITECTURE-SPINE.md#Deferred — 프론트 상세 폴더 구조(이 스토리가 해소)]
- [Source: implementation-artifacts/1-6-web-login-role.md — httpOnly 쿠키 + BFF 확정, 쿠키 수명·path, slur_role은 UX 힌트, 슬러 시스템 시드]
- [Source: implementation-artifacts/2-1-seller-application.md — refresh path 개정(`/api`), R5·R6 적용 방식]
- [Source: implementation-artifacts/sprint-status.yaml#action_items — R1·R3·R5·R6·R7·A-E456-5]
- [Source: implementation-artifacts/deferred-work.md — 웹 lint 베이스라인, 사업자 실정보 교체(오픈 게이트), 8.4로 넘긴 후속 지점]
- [Source: apps/web/app/layout.tsx · page.tsx · middleware.ts · globals.css · site-footer.tsx · styles/slur/** · seller/page.tsx · login/page.tsx · lib/auth.ts — 현재 상태 확인 (baseline_commit 기준)]
- [Source: https://nextjs.org/docs/app/api-reference/file-conventions/route-groups (v16.2.10 문서) — 그룹 폴더는 URL에 포함되지 않음 / 다중 **루트** 레이아웃 간 이동만 전체 리로드 / 서로 다른 그룹이 같은 URL로 해석되면 오류]
- [Source: https://nextjs.org/docs/app/api-reference/functions/generate-viewport (v16.2.10 문서) — viewport meta는 자동 설정되어 별도 구성이 대개 불필요, `viewport`/`generateViewport`는 서버 컴포넌트 전용]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Claude Code) — 2026-07-22

### Debug Log References

로컬 검증에만 쓰고 저장소에는 남기지 않은 도구 두 가지(스크래치패드에서만 실행):

1. **쿠키 주입 프록시** — 보호 라우트(`/cart`·`/orders`·`/me`)를 헤드리스 캡처하려면 세션 쿠키가 필요한데
   Chrome `--headless --screenshot`에는 쿠키를 넣을 인자가 없다. `:3002` → `:3000`으로 요청을 넘기며
   `Cookie: slur_role=buyer`를 붙이는 20줄짜리 Node 프록시로 해결했다.
2. **포커스 링 계측 스크립트** — 같은 프록시가 HTML에 스크립트를 주입해 `<input>`을 만들고 `focus()` 후
   `getComputedStyle`을 읽게 했다. Task 9의 "computed 값 확인"을 자동화한 것이며 결과는 아래 Completion Notes에 있다.

### Completion Notes List

#### 완료 — Task 1~8, 10(대부분), 11(로컬 전부)

**Task 8 결과 (수치)**
- `npx tsc --noEmit` → **0** (exit 0)
- `npm run lint` → **0 errors · 0 warnings** (A-E456-5 베이스라인 유지)
- `npx next build` → **성공**. 35개 라우트 생성, 경로 충돌 없음. **URL이 하나도 바뀌지 않았다** —
  `/seller`·`/seller/orders`·`/seller/products`·`/seller/products/new`·`/admin`(+4)·`/apply`·`/login`·`/no-role`·`/terms`·`/privacy`
  전부 그대로이고, 신규는 `/`·`/cart`·`/orders`·`/me` 넷뿐이다.
- `git diff --stat`에 **`apps/api` 0건** (백엔드 무변경의 1차 증거). `app/styles/slur/` 경로도 **0건**.
- **`cd apps/api && uv run pytest -q` → 미실행.** 사유: 이 머신 PATH에 `uv`·`docker`가 없고(pytest는
  docker compose로 띄운 로컬 Postgres를 요구한다), 이 스토리는 `apps/api`를 한 번도 열지 않았다.
  **통과했다고 기록하지 않는다.** 153건 통과는 CI 또는 백엔드 환경이 있는 곳에서 확인해야 한다.

**정적 격리 확인 (AC 3·4)**
- 구매자 파일(`app/(buyer)/**`·`app/styles/buyer/**`)에 `#2f6bff`·`--color-brand`·`--shadow-`·`outline: none`
  문자열 **0건**. `box-shadow`는 D4가 파랑 링을 끊는 `box-shadow: none` **한 줄뿐**이고 나머지는 주석이다.
  `100vh`도 주석에만 있고 실제 선언은 `100dvh`다.
- 서빙된 `/seller` 문서에 `data-surface` **0건**, `--b-paper` **0건**. `/` 문서에는 `data-surface="buyer"` 존재.

**포커스 링 — computed 값으로 증명 (AC 4, Task 9 일부)**
같은 `<input>`을 각 표면에 넣고 `focus()` 후 계측한 결과:

| | 구매자 `/` | 콘솔 `/seller` |
|---|---|---|
| `outline` | `rgb(31, 29, 26) solid 2px` (먹색 `#1f1d1a`) | `none` |
| `box-shadow` | `none` | `rgba(47, 107, 255, 0.3) 0 0 0 3px` (슬러 파랑) |
| `--color-focus-ring` | `0 0 0 3px #2f6bff4d` | `0 0 0 3px #2f6bff4d` |

→ 구매자 스코프에서 먹색 outline이 서고 파랑 box-shadow가 꺼진다. 콘솔은 파랑 링 그대로다.
→ `--color-focus-ring` 변수 값이 **양쪽에서 동일**한 것이 D1의 핵심 증거다 — 구매자는 전역 시맨틱 토큰을
  재바인딩하지 않고 스코프 안에서 *수단*(box-shadow)만 껐다.

**Task 10 — 반응형 (실제 렌더 캡처를 눈으로 확인)**
Chrome이 최소 500px 폭을 강제해 390px은 정확히 재현되지 않는다. `<640` 구간은 **500px**으로 확인하고
390px 고유 수치는 CSS 미디어쿼리 값과 대조했다(브레이크포인트가 640이므로 390과 500은 같은 구간이다).

- **500 (=<640)**: 하단 탭바 표시·4탭 균등·활성 `홈`이 먹색+라벨 800+굵은 아이콘 선, 상단 내비 없음,
  좌우 여백 20px, 그리드 **2열**, 카드 높이 200/168… 로 어긋난 리듬. 한글 정상 렌더.
- **700 (640~767)**: 그리드 **3열**, 여백 **20px 유지**, **탭바 여전히 있음**, 간격 14/26 유지. 사양대로.
- **768**: 탭바 사라지고 **상단 내비 등장**(활성 항목 먹색 800), 여백 **32px**, 그리드 3열 간격 20/36.
  상단바가 형태와 무관하게 **로고 + 내비로 수렴**하는 것을 `/cart`에서 확인 — 768에서 `장바구니` 제목이 사라진다(AC 2).
- **1280**: 본문 **1080px 가운데 정렬**, 좌우 100px씩 남음(카드 좌단 x=132 = 100 + padding 32).
  `/orders`는 `m_read`로 본문만 640px 중앙(x=352), 상단바는 1080px 컨테이너를 유지.
- `/cart`·`/orders`·`/me` 자리표시 페이지 전부 정상 표시, 각 탭이 활성으로 표시됨.

**Task 11 — 미들웨어 로컬 전 시나리오 통과**

| 요청 | 쿠키 | 결과 |
|---|---|---|
| `/` | 없음 | 200 |
| `/products/1` | 없음 | 404 (리다이렉트 아님 = 통과) |
| `/cart` `/checkout` `/orders` `/orders/abc` `/orders/complete` `/me` | 없음 | 307 → `/login?next=%2F…` (경로 인코딩 보존) |
| `/seller` `/admin` `/apply` | 없음 | 307 → `/login` (**`next` 없음** — 기존 동작 유지) |
| `/cart` `/orders` `/me` | `slur_role=buyer` | 200 |
| `/admin` | `slur_role=seller` | 307 → `/seller` (기존 규칙 보존) |
| `/seller` `/apply` | `slur_role=seller` | 200 |
| `/seller` `/admin` | `slur_role=admin` | 200 |
| `/cart?next=https://evil.example` | 없음 | `Location: /login?next=%2Fcart%3Fnext%3D…` — Location이 항상 자체 경로로 시작. 외부 URL이 실릴 수 없다 |

**Task 1 — 푸터 회귀 없음 (프래그먼트 규칙 확인)**
`/terms`·`/privacy`·`/no-role`·`/login` 네 페이지 모두 `layout_footer` 마크업이 그대로 붙는다.
**뷰포트보다 짧은 페이지에서 푸터가 바닥에 붙는지**를 `/no-role`과 `/login`에서 눈으로 확인했다 —
둘 다 콘텐츠가 화면 절반이고 푸터가 뷰포트 하단에 정확히 붙는다(`margin-top: auto` 살아 있음).

#### 미완 — 사람이 해야 할 것

- **Task 9 (판매자·관리자 회귀, 로그인 필요)** — 관리자/판매자 계정으로 실제 로그인해
  `/admin`(+`orders`·`settings`·`lookup`·`deposits`)와 `/seller`(+`products`·`orders`)의 **색·레이아웃이
  전과 동일한지** 눈으로 확인해야 한다. 이 머신에는 계정도 백엔드도 없어 로그인할 수 없었다.
  대신 로그인 없이 가능한 두 항목(푸터 4페이지, `/seller`의 `data-surface` 부재 + computed `--color-focus-ring`)은
  확인했고, 포커스 링은 위 표처럼 computed 값으로 증명했다.
- **Task 9 — Tab 키 이동 눈 확인** (양 표면). computed 값 증명은 했으나 **실제 키보드 이동 시 링이
  모든 인터랙티브 요소에서 보이는지**는 사람이 봐야 한다.
- **Task 10 — 폭 드래그 시 언마운트 없음** 확인. 헤드리스로는 창 크기를 실시간으로 바꿀 수 없다.
  구조적으로는 보장돼 있다: `app/(buyer)` 전체에 `matchMedia`·`innerWidth`·`resize` **0건**이고
  탭바/상단 내비 전환이 전부 CSS `display`다. 다만 스토리가 요구한 "입력 필드에 값을 치고 폭을 바꿔
  값이 남는지" 실측은 하지 않았다(임시 입력 필드를 저장소에 넣지 않기 위해서이기도 하다).
- **Task 10 — 키보드만으로 완주.** DOM 순서(`header` → `main` → `nav.b_tabbar`)는 서빙된 HTML에서
  확인했으므로 하단 고정 바가 먼저 걸리지 않는 것은 보장되나, 실제 Tab 순회는 사람이 해야 한다.
- **Task 11 — 프로덕션(Railway 프록시 뒤) 재확인 (R3).** 배포 후 같은 curl 시나리오를 돌려
  리다이렉트 `Location`이 내부 호스트가 아닌 공개 호스트인지 확인해야 한다. **이것 전에는 done이 아니다.**

#### 구현 중 발견 — 스토리와 어긋났던 지점

1. **`/terms`는 짧은 페이지가 아니다.** Task 1의 검증 지시가 "`/terms`처럼 콘텐츠가 짧은 페이지"라고
   쓰여 있지만 실제 `/terms`는 뷰포트를 훨씬 넘는 긴 약관 문서라 이 페이지로는 푸터 회귀가 보이지 않는다.
   짧은 페이지는 **`/no-role`과 `/login`**이며, 이 둘로 검증했다. (검증 의도는 그대로 충족)
2. **`middleware.ts`는 Next 16에서 deprecated다.** 번들된 문서(`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`)
   첫 줄이 "The `middleware` file convention is deprecated and has been renamed to `proxy`"이고,
   빌드 출력도 `ƒ Proxy (Middleware)`로 표시된다. 코드모드도 제공된다.
   **이 스토리에서는 옮기지 않았다** — 스토리가 기존 세 `if`와 matcher를 문자 그대로 보존하라고 못박았고,
   파일 이름 변경은 그 지시의 범위 밖이다. 별도 부채 항목으로 남긴다.
3. **`page.module.css`를 함께 삭제했다.** Dev Notes 위험목록 6번의 판단 위임에 따라
   `grep -rn "page.module" apps/web/app` → **0건**을 확인한 뒤 지웠다(`app/page.tsx` 삭제로 확실한 고아가 됨).
4. **`npm install`이 `package-lock.json`을 건드렸다.** 이 머신의 npm이 optional 의존성의 `libc` 필드를
   지우는 diff를 만들어, 의존성 변화가 아님을 확인하고 `git checkout`으로 되돌렸다. 락파일은 무변경이다.
5. **`buyer-icons.tsx`가 `BUYER_NAV_ITEMS`와 `CartBadge`도 내보낸다.** D2의 파일 목록에 내비 항목 배열을
   둘 파일이 없어서, 탭바·상단 내비·상단바 셋이 공유해야 하는 정의(Task 3의 "단일 배열 상수")를
   아이콘과 짝지어 이 파일에 두었다. 새 파일을 만들지 않기 위한 선택이다.
6. **셸이 레이아웃과 컴포넌트로 나뉜다.** `(buyer)/layout.tsx`는 `data-surface="buyer"` 래퍼와 CSS 임포트만
   갖고, 상단바/`<main>`/탭바 조립은 `buyer-shell.tsx`가 한다. Next 레이아웃은 페이지에서 prop을 받을 수
   없는데 AC 1이 `tab`·`showTabbar`를 화면별로 요구하기 때문이다. DOM 순서 요구(UX-DR6)는 셸이 지킨다.

#### 후속 스토리가 반드시 이어받아야 할 것

- **8.2** — `/no-role` 문구가 이제 사실과 어긋난다("구매는 SLUR 앱을 이용해 주세요"). 8.1은 화면을
  `(console)`로 옮기기만 했고 문구는 그대로 두었다. 8.2가 고쳐야 한다.
- **8.2** — 미들웨어가 만든 `next` 값의 **소비**(로그인 성공 후 복귀)는 8.2 소관이며, 소비 측도
  자체 경로 여부를 다시 확인해야 한다(미들웨어는 자체 경로만 싣지만 `/login?next=`는 누구나 손으로 붙일 수 있다).
- **8.4~8.7** — 보호 라우트 페이지는 API 401을 **자기 손으로** `/login` 처리해야 한다.
  미들웨어 통과는 인증이 아니다(`slur_role` 14일 > `slur_access` 30분).
- **8.7** — iOS 오버스크롤에서 흰 `body`가 비칠 수 있다(`[ASSUMPTION]`). `theme-color`와 함께 확인.
  `env(safe-area-inset-bottom)`의 실제 값도 PWA standalone에서 의미가 커진다.

### File List

**신규 (18)**
- `apps/web/app/(buyer)/layout.tsx`
- `apps/web/app/(buyer)/page.tsx`
- `apps/web/app/(buyer)/buyer-shell.tsx`
- `apps/web/app/(buyer)/buyer-topbar.tsx`
- `apps/web/app/(buyer)/buyer-tabbar.tsx`
- `apps/web/app/(buyer)/buyer-topnav.tsx`
- `apps/web/app/(buyer)/buyer-icons.tsx`
- `apps/web/app/(buyer)/brand-label.tsx`
- `apps/web/app/(buyer)/status-label.tsx`
- `apps/web/app/(buyer)/amount-summary.tsx`
- `apps/web/app/(buyer)/seller-pack.tsx`
- `apps/web/app/(buyer)/buyer.css`
- `apps/web/app/(buyer)/cart/page.tsx`
- `apps/web/app/(buyer)/orders/page.tsx`
- `apps/web/app/(buyer)/me/page.tsx`
- `apps/web/app/(console)/layout.tsx`
- `apps/web/app/styles/buyer/tokens.css`
- `apps/web/app/styles/buyer/type.css`

**수정 (2)**
- `apps/web/app/layout.tsx` — `SiteFooter` import·렌더 두 줄만 제거
- `apps/web/middleware.ts` — 보호 라우트 블록 + matcher 5항목 추가 (기존 세 `if`·matcher 4항목 무변경)

**삭제 (2)**
- `apps/web/app/page.tsx` — `/`는 `(buyer)/page.tsx`가 가진다
- `apps/web/app/page.module.css` — create-next-app 잔재, 참조 0건

**이동 (`git mv`, URL 불변 — 29파일 / 7폴더)**
- `apps/web/app/seller/**` → `apps/web/app/(console)/seller/**` (8)
- `apps/web/app/admin/**` → `apps/web/app/(console)/admin/**` (14)
- `apps/web/app/apply/**` → `apps/web/app/(console)/apply/**` (2)
- `apps/web/app/login/**` → `apps/web/app/(console)/login/**` (2)
- `apps/web/app/no-role/page.tsx` → `apps/web/app/(console)/no-role/page.tsx`
- `apps/web/app/terms/page.tsx` → `apps/web/app/(console)/terms/page.tsx`
- `apps/web/app/privacy/page.tsx` → `apps/web/app/(console)/privacy/page.tsx`

이동한 파일 중 11개는 깨진 상대 경로를 별칭으로 바꿨다(`../logout-button` 9곳 · `../config/company` 2곳 ·
`../styles/policy.css` 2곳 → `@/app/…`). 로직·마크업은 무변경이다.

**무변경 (확인)**
- `apps/web/app/styles/slur/**` — diff 0건
- `apps/web/app/globals.css` · `site-footer.tsx` · `site-footer.css` · `logout-button.tsx` · `config/company.ts`
- `apps/web/app/api/**` (BFF Route Handler, 그룹 안으로 옮기지 않음)
- `apps/api/**` — diff 0건

### Change Log

| 날짜 | 변경 | 비고 |
|---|---|---|
| 2026-07-22 | Task 1~7 구현 (라우트 그룹 2개 분리, 구매자 토큰·타이포, 셸·탭바·상단 내비, 반응형 유틸리티, 자리표시 라우트, 미들웨어 확장, 공유 컴포넌트 4종) | D1~D6 그대로 적용 |
| 2026-07-22 | Task 8 통과 — tsc 0 · lint 0 · next build 성공 · URL 불변 · `apps/api` diff 0건 | pytest는 미실행(환경 없음) |
| 2026-07-22 | Task 10 반응형 500/700/768/1280 렌더 확인, Task 11 로컬 미들웨어 전 시나리오 확인 | 폭 드래그·키보드 완주·프로덕션은 미완 |
| 2026-07-22 | Status → `in-progress` (Task 9 로그인 회귀와 Task 11 프로덕션 검증이 남음) | |
