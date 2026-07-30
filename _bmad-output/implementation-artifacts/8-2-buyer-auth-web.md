---
baseline_commit: 5d60203dfdf672162e547ffc042f5d52fafaa6fd
---

# Story 8.2: 구매자 가입·로그인 (역할 쿠키 `buyer` 도입)

Status: done

## Story

As a 구매자,
I want 웹에서 이메일 또는 카카오로 가입·로그인하고 하려던 일을 이어가는 것,
So that 담으려던 물건을 잃어버리지 않고 주문까지 갈 수 있다.

> **이 스토리의 핵심은 회귀 방지다.** 지금 `app/api/auth/login/route.ts`는 역할을 `admin | seller | none` 3값으로 계산하고, `middleware.ts`가 `none`을 `/no-role`로 보낸다 — **구매자가 웹에 로그인하면 튕긴다.** `buyer`를 도입하는 이 변경이 판매자·관리자 웹 라우팅에 닿는 유일한 지점이며, 그 지점은 **문자열 하나(`"none"` → `"buyer"`)**다. 그 밖의 모든 것은 새로 더하는 코드여야 한다.

## Acceptance Criteria

1. **Given** BFF의 역할 계산 **When** 로그인·회원가입·카카오 콜백이 성공해 `slur_role` 쿠키를 세운다 **Then** 값은 `admin | seller | buyer` 셋 중 하나이며 `none`은 **어디서도 생성되지 않는다** (`grep -rn '"none"' apps/web/app apps/web/lib` → 0건)
   - **And** 판정식의 admin·seller 분기는 **한 글자도 바뀌지 않는다** — `roles.includes("admin") ? "admin" : roles.includes("seller") ? "seller" : <fallback>`에서 `<fallback>`만 `"none"`에서 `"buyer"`로 바뀐다 (역할이 없는 계정 = 구매자. 백엔드 `GET /api/v1/auth/roles`가 빈 배열을 돌려주는 것이 정본이다)
   - **And** 쿠키 속성(이름 `slur_role`, 14일, `httpOnly:false`, `sameSite:lax`, `path:/`)은 기존 그대로다
   - **And** `slur_role`은 여전히 **UX 라우팅 힌트일 뿐**이며 권한 판정은 FastAPI가 한다 (R7, AD-1) — 이 스토리가 만드는 어떤 화면도 이 쿠키로 데이터 접근을 판정하지 않는다
   - **And** 세 진입점(로그인·회원가입·카카오 콜백)이 **같은 헬퍼 한 벌**을 쓴다 — 역할 판정식이 파일마다 복제되지 않는다

2. **Given** `middleware.ts` **When** 이 스토리를 완료 **Then** 이 파일의 diff가 **0줄**이다 (`git diff --stat`에 `apps/web/middleware.ts`가 나타나지 않는다)
   - **And** 그 이유가 코드로 성립한다 — `hasSession = role !== undefined`는 `buyer` 값에도 참이고, `/admin`·`/seller`의 두 판정은 `role`을 `"admin"`·`"seller"`와만 비교하므로 `buyer`는 자동으로 "권한 없음"으로 떨어진다
   - **And** Next 16의 `middleware` → `proxy` rename(deprecated)은 **이 스토리에서 하지 않는다** (D8)

3. **Given** `/login` 화면 **When** 렌더 **Then** 구매자 셸 위에 선다 — 로고 중앙 상단바(뒤로가기 없음), 탭바 없음, 본문 최대 폭 640px(`.b_container.m_read`), 구매자 팔레트 (UX-DR3·4, EXPERIENCE §IA 4번 행)
   - **And** 이메일·비밀번호 입력, `로그인`(solid), `또는` 구분선, `카카오로 시작하기`(`#fee500`), `아직 회원이 아니신가요? 회원가입` 링크가 목업 순서대로 놓인다
   - **And** 브랜드 파랑 `#2f6bff`가 이 화면의 어떤 요소에도 나타나지 않는다. 예외 색은 카카오 노랑 하나뿐이다 (UX-DR1)
   - **And** URL은 `/login` 그대로다 — 판매자·관리자도 같은 화면으로 로그인한다 (FR-3: 역할별로 진입점을 쪼개지 않는다)

4. **Given** `/login`에서 잘못된 이메일·비밀번호로 제출 **When** 백엔드가 401 `invalid_credentials`를 돌려줌 **Then** **두 필드 모두** 오류 테두리(`--b-accent`) + 오류 면(`--b-field-error-surface`)이 되고 비밀번호 아래 한 줄로 `이메일 또는 비밀번호가 올바르지 않습니다.`가 표시된다 (UX-DR9·15)
   - **And** 어느 쪽이 틀렸는지 말하지 않고, HTTP 코드·에러 `code` 문자열을 화면에 노출하지 않는다 — 분기는 `code`로, 표시는 정해진 한국어 문장으로 한다
   - **And** 상단 요약 배너를 쓰지 않는다
   - **And** 제출 중에는 버튼이 비활성이고 중복 제출이 차단된다 (스피너 없이 텍스트 유지)
   - **And** 오류 메시지가 `aria-describedby`로 해당 입력과 프로그램적으로 묶인다 (UX-DR9 "라벨-필드-오류가 프로그램적으로 묶인다")

5. **Given** `/signup` 화면 **When** 이메일·비밀번호(8자 이상)·이름·(선택)휴대폰과 **필수 동의 2개**를 체크하고 제출 **Then** BFF가 `POST /api/v1/auth/signup`을 호출하고 세션이 httpOnly 쿠키로 설정된다 — 브라우저 JS가 access/refresh 토큰을 읽거나 저장하지 않는다 (AD-14)
   - **And** 상단바는 뒤로가기 + `회원가입` 제목형이고 탭바가 없다 (EXPERIENCE §IA 5번 행)
   - **And** 필수 동의 2개가 모두 체크되기 전에는 `가입하기`가 비활성이다
   - **And** 필드 오류는 **해당 필드에만** 표시된다 — 422 `validation_error`의 `details[].field`(`email`/`password`/`name`/`phone`, `body.` 접두어가 붙어 올 수 있다)를 그 필드에 매핑하고, 매핑되지 않는 항목은 폼 하단 한 줄로 흘린다
   - **And** 409 `email_already_exists`는 이메일 필드의 오류로 표시된다
   - **And** 가입 성공 시 로그인과 **같은 복귀 규칙**(AC 7)을 따른다
   - **And** 하단에 `가입하면 구매자로 시작합니다. 판매자 입점은 별도 신청이 필요합니다.`가 놓인다

6. **Given** `카카오로 시작하기` **When** 누름 **Then** 브라우저가 카카오 인가 페이지로 이동하고, 콜백으로 돌아오면 BFF가 인가 코드를 받아 **기존** `POST /api/v1/auth/kakao`(`{code, redirect_uri}`)를 호출해 세션 쿠키를 세운다 — **백엔드 신규 작업 0건**
   - **And** 인가 코드·access·refresh 토큰이 **클라이언트 번들·`localStorage`·`sessionStorage`·클라이언트 컴포넌트 어디에도 남지 않는다** — 콜백은 페이지가 아니라 Route Handler이고, 코드는 서버에서만 읽혀 즉시 FastAPI로 넘어간 뒤 리다이렉트 응답으로 끝난다 (AD-14)
   - **And** CSRF 방어로 `state`를 쓴다 — 시작 시 난수 `state`를 httpOnly 쿠키에 넣고 카카오에 같은 값을 보내며, 콜백에서 쿼리 `state`와 쿠키가 **일치하지 않으면 세션을 세우지 않고** `/login`으로 돌려보낸다. 성공·실패와 무관하게 `state` 쿠키는 소비 즉시 삭제된다
   - **And** 사용자가 카카오에서 취소해 `error=access_denied`로 돌아오면 조용히 `/login`으로 돌아가고 오류 문구를 띄우지 않는다
   - **And** 실패(`invalid_kakao_code`·`kakao_unavailable`·`email_conflict`)는 `/login?e=<짧은 토큰>`으로 돌아가 화면이 **자기가 가진 고정 한국어 문장**을 보인다 — 서버 메시지 원문을 URL에 싣지 않는다 (텍스트 주입 방지)
   - **And** 같은 카카오 계정 재로그인은 기존 계정으로 이어진다 (1.3 백엔드 동작 재사용 — 프론트는 아무것도 하지 않는다)

7. **Given** 8.1 미들웨어가 심은 `?next=` **When** 로그인·회원가입·카카오 로그인이 성공 **Then** 그 경로로 돌아간다
   - **And** 소비 측이 **다시** 자체 경로 여부를 확인한다 — `/`로 시작하고 `//`·`/\`로 시작하지 않으며 제어문자가 없는 값만 통과한다. 미들웨어가 자체 경로만 싣지만 `/login?next=`는 누구나 손으로 붙일 수 있다 (오픈 리다이렉트 방지)
   - **And** `/login`·`/signup`으로 돌아가는 `next`는 거부한다 (루프 방지)
   - **And** `next`가 없거나 거부되면 **역할별 기본 목적지**로 간다: `admin` → `/admin`, `seller` → `/seller`, `buyer` → `/`. 앞의 둘은 현행 동작 그대로이며, `/no-role`로 가는 경로는 사라진다
   - **And** 판매자·관리자가 미들웨어에 튕겨 `/login`에 온 경우 `next`가 **애초에 없으므로**(기존 세 줄이 `next`를 싣지 않는다) 이 규칙이 콘솔 동선을 바꾸지 않는다
   - **And** `next`의 쿼리스트링이 보존된다 — 8.3의 상품상세가 선택한 조합·수량을 쿼리에 실어 복귀시킬 수 있어야 한다 (UX-DR11)

8. **Given** login-CSRF Origin 검사 **When** 신규 인증 라우트를 만든다 **Then** 기존 `login/route.ts`와 **동일한 검사**(`origin`이 있으면 `x-forwarded-host` → `host` → `nextUrl.host` 중 하나와 일치해야 함, 아니면 403 `forbidden` 봉투)가 상태를 바꾸는 모든 신규 POST 라우트에 적용된다
   - **And** 검사는 **한 곳에 한 번만** 구현되고 기존 login 라우트도 그것을 쓴다 — 판정 결과·상태 코드·응답 봉투가 지금과 **바이트 단위로 같아야 한다**
   - **And** 카카오 콜백은 GET(외부에서 오는 최상위 내비게이션)이라 Origin 검사가 성립하지 않는다 — 그 자리의 CSRF 방어는 `state` 쿠키다 (AC 6). 이 사실을 코드 주석으로 남긴다

9. **Given** `/no-role` **When** 이 스토리를 완료 **Then** 화면은 남되 **판매자·관리자 화면 접근 안내 전용**이 된다
   - **And** `구매는 SLUR 앱을 이용해 주세요.` 문장이 사라진다 — 앱이 없어지므로 거짓이다
   - **And** `입점 신청(Epic 2에서 오픈)` 표현도 사라진다 — `/apply`는 이미 열려 있다
   - **And** `/`(쇼핑 계속하기)로 나가는 링크가 생긴다 — 구매자가 `/seller`·`/admin`을 직접 입력해 이 화면에 닿았을 때의 출구다
   - **And** 화면은 `(console)` 그룹에 그대로 있고 푸터·슬러 시스템 스타일이 유지된다 (D3)
   - **And** 정상 로그인 동선에서 구매자가 이 화면에 도달하는 경로가 **없다**

10. **Given** 판매자·관리자 **When** 로그인하고 콘솔을 쓴다 **Then** 아래 다섯 가지가 **전과 동일**하다 — 이 스토리의 완료 조건이자 회귀 검증 대상이다 (Task 8)
    1. 관리자 로그인 → `slur_role=admin`, 판매자 로그인 → `slur_role=seller`, 구매자 로그인 → `slur_role=buyer`
    2. `/seller`·`/admin` 진입과 차단이 그대로
    3. 관리자가 `/seller`에 들어갈 수 있다 (허용 규칙 유지)
    4. 판매자가 `/admin`을 요청하면 `/seller`로 간다 (`/no-role`이 아니다)
    5. 구매자가 로그인하면 구매자 화면으로 들어간다 (`/no-role` 미도달)
    - **And** 결과를 Completion Notes에 기록한다. **단위 테스트로 대체하지 않는다**

11. **Given** 이 스토리 전체 **When** 완료 **Then** 백엔드가 변경되지 않는다 — `git diff --stat`에 `apps/api` **0건**, 마이그레이션 0건, 신규 엔드포인트 0건. 쓰는 것은 전부 기존 API다: `/auth/signup` · `/auth/login` · `/auth/kakao` · `/auth/roles` · `/auth/logout` · `/auth/refresh`
    - **And** ERD 변경이 없으므로 **약관 동의 사실은 서버에 저장되지 않는다** — 이 한계를 Dev Notes에 기록하고 오픈 게이트 항목으로 넘긴다 (위험 6)

12. **Given** 검증 **When** 실행 **Then** `npx tsc --noEmit` 0 · `npm run lint` 0 errors·0 warnings(A-E456-5 베이스라인) · `npx next build` 성공이 유지되고, `/login` URL이 바뀌지 않았음이 빌드 라우트 목록으로 확인된다
    - **And** `apps/web`에 테스트 프레임워크·테스트 의존성을 **추가하지 않는다** — 검증은 `tsc`·`lint`·`next build`·curl·실기다

## 설계 판단 (이 스토리에서 확정 — 근거를 남긴다)

### D1 — 역할 판정의 자리: **`lib/auth.ts`에 헬퍼 5개, 라우트는 조립만**

**결정.** 아래를 `apps/web/lib/auth.ts`에 더한다. 로그인·회원가입·카카오 콜백 셋이 이것만 쓴다.

```ts
export type SlurRole = "admin" | "seller" | "buyer";

/** roles → 역할 힌트. 빈 배열 = 구매자 (백엔드 /auth/roles의 계약: "빈 배열 = 구매자(암묵 기본)") */
export function resolveRole(roles: string[]): SlurRole {
  return roles.includes("admin") ? "admin" : roles.includes("seller") ? "seller" : "buyer";
  //     ↑ 여기 두 항은 1.6에서 프로덕션 검증된 식 그대로다. 바뀐 것은 마지막 항 하나뿐.
}
export function setRoleCookie(res: NextResponse, role: SlurRole): void   // 14일 · httpOnly:false (기존과 동일)
export async function fetchRoles(access: string): Promise<string[] | null>  // 실패 시 null → 호출자가 503
export function assertSameOrigin(req: NextRequest): NextResponse | null  // 위반이면 403 봉투, 아니면 null
export function safeNextPath(v: string | null | undefined): string | null
```

**근거.**
- **판정식이 세 곳에 복제되면 다음에 역할이 하나 늘 때 두 곳만 고치는 사고가 난다.** 이 스토리가 고치는 버그(`none`)가 정확히 "한 곳에만 있던 식이 화면 분기와 어긋난" 형태다.
- 기존 `login/route.ts`가 하던 일을 **줄이지 않고 옮기기만** 한다. 옮긴 뒤 동작이 같은지는 diff를 나란히 놓고 눈으로 확인한다(Task 2에 체크포인트).
- `assertSameOrigin`을 헬퍼로 뽑는 이유: 스토리 지시가 "기존 Origin 검사를 신규 라우트에도 **동일하게** 적용"이다. 복사-붙여넣기는 "동일"을 보장하지 못한다 — 한쪽만 고쳐지는 순간 조용히 갈라진다.

**하지 않는 것.** `proxyWithRefresh`는 손대지 않는다. 인증 라우트는 아직 세션이 없으므로 refresh 회전 경로를 타지 않는다.

### D2 — `/login`·`/signup`의 소속: **`(buyer)` 그룹으로 옮긴다. URL은 `/login` 그대로**

**결정.** `app/(console)/login/` → `app/(buyer)/login/`으로 옮기고 화면을 구매자 톤으로 다시 만든다. `/signup`은 `app/(buyer)/signup/`에 신설한다. **판매자·관리자도 이 화면으로 로그인한다.**

**근거.**
- **시각 계약이 이 화면을 구매자 화면으로 못박았다.** DESIGN.md·EXPERIENCE.md가 로그인을 "로고 중앙 헤더 / 탭바 없음 / 640px 한 단 / 카카오 버튼"으로 규정하고 목업 `screens-2-account.html`이 확정 시안이다. 구매자 팔레트는 `[data-surface="buyer"]` 스코프에서만 나오고 그 속성은 `(buyer)/layout.tsx`에만 붙는다(8.1 D1) — **콘솔 그룹에 남겨두면 이 화면을 사양대로 그릴 수단이 없다.**
- 계정은 하나이고 역할만 여럿이다(FR-3). 로그인 화면을 둘로 쪼개면 "판매자용 로그인 URL"이 생기고, 그것은 이 제품이 명시적으로 거부한 구조다.
- 로그인은 **비로그인 사용자가 보는 화면**이다. 비로그인의 압도적 다수는 구매자다. `판매자·관리자 로그인`이라는 현재 부제는 8.1 이후 사실과 어긋난다.
- URL이 `/login` 그대로이므로 **미들웨어·9개 콘솔 화면의 `router.replace("/login")`이 한 줄도 바뀌지 않는다.**

**대가와 그 처리.**
- `/login`에서 **푸터(FR-31·33 사업자 정보)가 사라진다.** 8.1이 이미 구매자 표면에 푸터를 두지 않기로 했고(AC 8), 대응 자리는 `/me`(8.7)다. 다만 `/login`은 로그인 **전** 화면이라 `/me`에 닿을 수 없다 — 그래서 `/signup`의 `[필수] 이용약관 / 개인정보 수집·이용` 줄에 `보기` 링크를 두어 `/terms`·`/privacy`로 갈 수 있게 한다(FR-33 접근 경로 유지). `[ASSUMPTION]` 로그인 화면 자체에 법적 링크가 필요한지는 확인된 바 없다 — FR-31·33은 "웹 푸터 대응"을 `/me`에 배정했고 UX-DR10의 세 자리에 로그인이 없다. 8.7에서 `/me`를 만들 때 한 번 더 본다.
- `보기` 링크는 **새 탭으로 연다**(`target="_blank" rel="noopener"`). 절반 채운 가입 폼에서 나가면 입력이 날아간다.
- `/terms`·`/privacy`는 `(console)` 그룹의 슬러(파랑) 스타일이다. 구매자가 새 탭에서 파랑 문서를 본다 — **알고 남기는 어긋남**이다. 정책 페이지의 톤 대응은 8.7과 함께 판단한다(위험 4).

> 🚨 **빌드 오류 지뢰.** `app/(console)/login/page.tsx`와 `app/(buyer)/login/page.tsx`가 동시에 존재하면 둘 다 `/login`으로 해석되어 **빌드가 실패한다.** 8.1이 `/`에서 밟았던 것과 같은 함정이다 — 반드시 같은 커밋에서 옮긴다. [Source: route-groups#Caveats — Conflicting paths]

### D3 — `/no-role`: **존치. `(console)`에 그대로 두고 문구만 고친다**

**결정.** 화면을 남긴다. 파일 위치·푸터·`.page_landing` 스타일은 그대로 두고 본문 문장만 바꾼다.

```
접근 권한이 없습니다
이 화면은 판매자·관리자 전용입니다.
입점을 원하시면 입점 신청을 이용해 주세요.        → /apply 링크
[쇼핑 계속하기 → /]        [로그아웃]
```

**근거.**
- **도달 경로가 아직 살아 있다.** 미들웨어의 `/seller`·`/admin` 판정은 `buyer` 쿠키를 가진 사용자를 여전히 여기로 보낸다(AC 2 — 그것이 미들웨어를 안 고쳐도 되는 이유다). 화면을 지우면 404가 되고, 그건 안내가 아니다. 에픽 AC의 "구매자는 더 이상 이 화면에 도달하지 않는다"는 **정상 로그인 동선**에 대한 말이지 URL 직접 입력까지 막는다는 뜻이 아니다.
- **`(buyer)`로 옮기지 않는 이유:** 이 화면이 말하는 대상은 "판매자·관리자 화면에 들어가려던 사람"이다. 콘솔의 경계에 서 있는 안내판이고, 콘솔 화면들(`/apply`·`/terms`)과 같은 푸터·같은 톤을 갖는 편이 일관된다. 옮기면 `.page_landing`(globals.css)과 푸터가 함께 흔들리는데 얻는 것이 없다.
- `LogoutButton`은 **건드리지 않는다** — 9개 콘솔 화면이 같은 컴포넌트를 쓰고 목적지는 `/login`이다. 구매자용 로그아웃(→ `/`)은 `/me`에 놓이며 8.7 소관이다(D7).

### D4 — 카카오 웹 플로우: **POST로 시작(Origin 검사) → GET 콜백(state 검증) → 302. 페이지 없음**

**결정.** 두 개의 Route Handler를 `app/api/auth/kakao/` 아래 만든다. **카카오 콜백 화면(page)을 만들지 않는다.**

```
POST /api/auth/kakao/start
  1) assertSameOrigin(req)  — 위반 403
  2) state = crypto.randomUUID() (또는 randomBytes hex)
  3) 쿠키 2개 set: slur_oauth_state=state, slur_oauth_next=safeNextPath(form의 next) ?? ""
     → httpOnly, secure(prod), sameSite: "lax", path: "/api/auth/kakao", maxAge: 600
  4) 303 → https://kauth.kakao.com/oauth/authorize
             ?client_id=KAKAO_REST_API_KEY&redirect_uri=KAKAO_REDIRECT_URI
             &response_type=code&state=<state>

GET  /api/auth/kakao/callback?code=…&state=…    ← 카카오가 브라우저를 돌려보내는 자리
  1) error 쿼리 있으면: state 쿠키 삭제 후 302 → /login (access_denied는 문구 없이 조용히)
  2) 쿠키 state와 쿼리 state 비교 — 없거나 다르면 302 → /login?e=state (세션 세우지 않음)
  3) POST {API_BASE}/api/v1/auth/kakao  { code, redirect_uri: KAKAO_REDIRECT_URI }
  4) 성공: GET /auth/roles → setSessionCookies + setRoleCookie
  5) 302 → safeNextPath(next 쿠키) ?? 역할별 기본 목적지
  6) 성공·실패 모든 경로에서 slur_oauth_state·slur_oauth_next 삭제, Cache-Control: no-store
```

**근거.**
- **코드가 클라이언트 JS에 닿지 않는다(AC 6).** 콜백을 `page.tsx` + `useEffect(fetch)`로 만들면 인가 코드가 React 클라이언트 컴포넌트의 props/URL 파싱을 거치고, RSC 페이로드·브라우저 히스토리·Referer에 남을 표면이 넓어진다. Route Handler는 HTML을 만들지 않고 302만 돌려주므로 코드가 **서버 함수 스코프 밖으로 나가지 않는다.** 서버 리다이렉트는 브라우저 뒤로가기에서 건너뛰어지므로 주소창에도 남지 않는다.
- **시작을 POST로 두는 이유.** GET 링크로 시작하면 제3자가 `<img src="/api/auth/kakao/start">` 류로 피해자 브라우저에 플로우를 강제 개시시킬 수 있다(소셜 login-CSRF). POST + Origin 검사는 스토리 지시("기존 Origin 검사를 신규 인증 라우트에 동일 적용")를 카카오 경로에서도 문자 그대로 만족시키는 유일한 방법이다.
  > 🚨 **중첩 폼 금지.** 이메일 로그인 폼 **안에** 카카오 폼을 넣으면 HTML이 무효가 되고 제출이 어긋난다. 카카오 폼은 로그인 폼의 **형제**로 둔다.
- **`state`는 1.3이 미룬 숙제다.** 1.3 "의도적 보류"에 `state/PKCE 세션 바인딩: 클라이언트 인증 플로우가 정해지는 1.5·1.6에서 확정`이라 적혀 있고, 1.6은 "웹 카카오 로그인은 구매자용"이라며 통째로 넘겼다. **웹 인가코드 플로우를 처음 만드는 이 스토리가 그 자리다.** `sameSite: "lax"`여야 카카오에서 돌아오는 최상위 GET 내비게이션에 쿠키가 실린다(`strict`면 실리지 않아 항상 실패한다).
- **PKCE는 v1에서 도입하지 않는다.** `[ASSUMPTION]` 인가 코드가 서버(BFF)에서만 교환되고 client_secret이 백엔드에만 있는 confidential client 구조라 PKCE의 주 위협(공용 클라이언트에서의 코드 가로채기)이 성립하지 않는다. 도입하려면 `code_verifier`를 BFF가 보관하고 백엔드가 토큰 교환 시 함께 보내야 하는데, **후자가 백엔드 변경**이라 이 에픽의 경계 밖이다. 필요 확인 시 별도 스토리.
- **`redirect_uri`는 세 곳이 글자 단위로 같아야 한다** — 카카오 개발자 콘솔 등록값 / 웹의 `KAKAO_REDIRECT_URI` / 백엔드 `KAKAO_REDIRECT_URIS` allowlist. 하나만 달라도 카카오는 `KOE006`, 백엔드는 `invalid_kakao_code`로 떨어진다.

**경로를 `/api/auth/kakao/callback`으로 두는 근거(그리고 반대 후보).** 백엔드 기본 allowlist는 `http://localhost:3000/auth/kakao/callback`(= `/api` 없음)이다. 그 값을 그대로 쓰면 로컬 백엔드 env를 안 고쳐도 되지만, 그 기본값은 **BFF 규약이 생기기 전(1.3)에 찍힌 추측**이고 1.6이 "BFF Route Handler는 `app/api/**`"를 확정한 뒤로는 규약과 어긋난다. 8.1도 라우트 그룹을 나누며 `app/api/**`만은 옮기지 않았다. **규약을 따르고 allowlist를 고친다.** 어차피 프로덕션은 어느 쪽을 골라도 `KAKAO_REDIRECT_URIS`를 새로 설정해야 한다(현재 프로덕션 api는 기본값 = localhost만 허용).

### D5 — 복귀 경로: **`next` 검증은 서버 컴포넌트에서 한 번, 소비 직전에 또 한 번**

**결정.**

```ts
// lib/auth.ts (또는 lib/nav.ts) — 소비 측 재검증. 미들웨어가 만든 값이라고 믿지 않는다.
export function safeNextPath(v: string | null | undefined): string | null {
  if (!v) return null;
  if (!v.startsWith("/")) return null;              // 절대 URL·스킴 상대 차단
  if (v.startsWith("//") || v.startsWith("/\\")) return null;  // //evil.com, /\evil.com
  if (/[\u0000-\u001f]/.test(v)) return null;      // CR/LF·제어문자 (헤더 주입 차단)
  if (v === "/login" || v.startsWith("/login?")) return null;  // 루프
  if (v === "/signup" || v.startsWith("/signup?")) return null;
  return v;
}
```

`/login/page.tsx`는 **서버 컴포넌트**로 두고 `searchParams`에서 `next`를 받아 `safeNextPath`로 거른 뒤, 클라이언트 폼 컴포넌트에 문자열 prop으로 넘긴다.

**근거.**
- **`useSearchParams()`를 쓰지 않는 이유가 두 가지다.** (1) 검증이 클라이언트로 내려가면 "검증 후 사용" 순서를 렌더 타이밍이 흔들 수 있다. (2) App Router에서 `useSearchParams()`를 Suspense 경계 없이 쓰면 빌드 단계에서 정적 렌더가 막히거나 경고가 난다 — 8.1이 지켜낸 `next build` 성공·lint 0을 이 한 줄이 깰 수 있다. 서버 컴포넌트가 `searchParams`를 받아 내리면 두 문제가 동시에 사라진다.
  > ⚠️ Next 16에서 `searchParams`는 **Promise**다. `const { next } = await searchParams` 형태로 받는다. 구현 전 `node_modules/next/dist/docs/`의 page 규약 문서를 확인한다(`apps/web/AGENTS.md` 규칙).
- **두 번 검증한다.** 미들웨어는 자체 경로만 싣지만 `/login?next=https://evil.example`은 아무나 손으로 만들 수 있다. 8.1의 Completion Notes가 후속 스토리에 명시적으로 남긴 인계 사항이다.
- **역할별 기본 목적지를 유지하는 것이 콘솔 회귀 방지의 핵심이다.** 지금 `login/page.tsx`가 `admin→/admin`, `seller→/seller`로 보내고 있고, 미들웨어가 콘솔 리다이렉트에 `next`를 싣지 않으므로 **판매자·관리자에게는 `next`가 존재하지 않는다** — 따라서 `next` 우선 규칙을 새로 넣어도 콘솔 동선은 **구조적으로** 바뀔 수 없다. 8.1이 "판매자·관리자가 자기 화면으로 가는 길은 로그인 후 안내로 충족한다"고 남긴 그 길이 이것이다.
- **`next`는 쿼리를 포함한 채 통째로 보존한다.** 8.3의 상품상세가 `/products/12?v=…&q=2` 같은 형태로 선택 상태를 실어 보낼 수 있어야 UX-DR11("담으려던 조합을 잃어버리면 안 된다")이 성립한다.

**8.2가 정하지 않는 것.** 복귀 후 **자동으로 담기까지 실행할지**는 상품상세를 만드는 8.3/8.4가 정한다. `[ASSUMPTION]` 사용자가 누르지 않은 상태 변경(장바구니 담기)을 리다이렉트만으로 실행하는 것은 부작용이 크므로, **선택 복원 + `장바구니 담기` 버튼에 포커스**를 권장안으로 남긴다. 8.2는 상태를 실어 나르는 관을 만들고 그 관이 안전함(자체 경로·쿼리 보존)을 보장한다.

### D6 — 폼 프리미티브의 소유권: **버튼·입력·체크박스는 `buyer.css`(셸)가 갖고, 로그인·가입 화면 고유 조각만 `auth.css`**

**결정.**

| 파일 | 갖는 것 |
|---|---|
| `app/(buyer)/buyer.css` (수정) | `.b_btn`(+`m_solid`·`m_ghost`·`m_kakao`·`m_full`·`m_text`) · `.b_field`/`.b_label`/`.b_input`/`.b_help`/`.b_err_msg` · `.b_checkbox` · `.b_or` |
| `app/(buyer)/auth.css` (신규) | 로그인·가입 폼 폭과 리듬, `.b_footlink`, `.b_terms`/`.b_term`, `.b_signup_guide` |

**근거.**
- DESIGN.md는 버튼·입력·체크박스를 **화면 부품이 아니라 시스템 컴포넌트**(`{components.button-*}`·`{components.input}`·`{components.checkbox}`)로 정의한다. 8.3~8.6이 전부 다시 쓴다 — 옵션 칩, 주문서 배송지 폼, 장바구니 체크박스, CTA 버튼. 로그인 폴더에 두면 다음 스토리가 복제하거나 hex를 인라인으로 박기 시작한다(8.1 D6가 막으려던 바로 그 붕괴).
- 8.1이 두 파일(`tokens.css`·`type.css`)로 값과 타이포를 이미 소유하고 있으므로 **8.2는 hex·px를 새로 만들지 않는다.** 전부 `--b-*`와 `.b_*` 타이포 클래스 조합으로 적는다. 예: 입력 46px·`1px solid var(--b-field-border)`·`var(--b-rounded)`, 오류는 `var(--b-accent)` 테두리 + `var(--b-field-error-surface)` 면.
- **카카오 노랑은 `--b-kakao` 토큰으로만 쓴다.** 8.1이 "8.2가 쓴다"고 주석까지 달아 미리 넣어 뒀다. `#fee500` 리터럴을 새로 적지 않는다.
- `box-shadow`를 쓰지 않는다. 포커스는 8.1 D4의 먹색 `outline`이 이미 전 인터랙티브 요소를 덮으므로 **폼 요소에 별도 포커스 스타일을 만들 필요가 없다** — 만들면 오히려 규칙이 두 벌이 된다.
- 체크박스는 **네이티브 `<input type="checkbox">`를 쓰고 시각만 입힌다**(`appearance: none` + 배경·갈고리). 커스텀 div 체크박스는 키보드·스크린리더에서 조용히 깨지고 UX-DR6의 "키보드 완주"를 위반한다. 히트 영역은 라벨 전체를 `<label>`로 감싸 44px 이상 확보한다(UX-DR7).

### D7 — 로그아웃: **BFF는 이미 맞다. 화면 쪽 목적지는 8.7이 정한다**

**결정.** `app/api/auth/logout/route.ts`와 `clearSessionCookies`를 **수정하지 않는다.** 8.2는 로그아웃 시 `slur_access`·`slur_refresh`(두 path 모두)·`slur_role`이 삭제되는 것을 **검증만** 한다.

**근거.**
- 에픽 AC는 "로그아웃 → 쿠키 제거 + `/`로 이동"이라고 적었지만, **v1에 존재하는 유일한 로그아웃 버튼은 콘솔의 `LogoutButton`(→ `/login`)이고 9개 화면이 공유한다.** 여기서 목적지를 `/`로 바꾸면 판매자·관리자의 동선이 바뀐다 — 이 스토리가 지키기로 한 것과 정면으로 충돌한다.
- **구매자용 로그아웃은 `/me`(8.7)의 약한 텍스트 버튼이다**(DESIGN.md §버튼, 목업 `내 정보` 하단). 화면이 없는데 버튼 목적지만 미리 바꾸는 것은 완주에 기여하지 않는다.
- 대신 `/no-role`에 `/`로 나가는 링크를 넣어(D3) 구매자가 갇히지 않게 한다.
- **인계.** 8.7이 `/me`를 만들 때 `LogoutButton`에 목적지 prop을 더하거나 구매자 전용 버튼을 새로 만들고, 에픽 8.2 AC의 "`/`로 이동"을 그때 충족한다.

### D8 — `middleware.ts` → `proxy.ts` rename: **하지 않는다**

**결정.** Next 16이 deprecated 처리한 `middleware` 파일 규약의 rename(8.1이 부채로 남김)을 이 스토리에서 수행하지 않는다.

**근거.**
- 이 스토리가 세상에 내놓는 가장 강한 회귀 증거는 **"`middleware.ts`의 diff가 0줄"**(AC 2)이다. 파일을 rename하면 diff에 파일 전체가 나타나 그 증거가 사라진다. 역할 쿠키에 값이 하나 늘어나는 변경과 라우팅 가드 파일의 전면 이동을 **같은 커밋에 섞지 않는다.**
- 지금 동작한다. Next 16.2.10은 `middleware.ts`를 계속 인식하며 빌드 출력에 `ƒ Proxy (Middleware)`로 표시할 뿐이다(8.1 실측).
- **인계.** 별도 정리 작업으로 뺀다 — 코드모드가 제공되고, 다른 변경과 섞이지 않은 커밋에서 해야 안전하다. `[ASSUMPTION]` 이 부채는 8.1 Completion Notes에만 적혀 있고 `deferred-work.md`에는 아직 등재되지 않았다 — 스프린트 관리 쪽에서 등재가 필요하다.

## Tasks / Subtasks

- [ ] **Task 0 — 선행 확인 (코드 쓰기 전)** (AC: 6, 11)
  - [x] `node_modules/next/dist/docs/`에서 (a) page의 `searchParams` 규약(Promise 여부), (b) Route Handler의 `NextResponse.redirect` + 쿠키 동시 설정, (c) `cookies()` API 현행 형태를 확인한다 (`apps/web/AGENTS.md`: "This is NOT the Next.js you know")
  - [ ] **카카오 개발자 콘솔에 웹 Redirect URI 2개 등록** — 로컬 `http://localhost:3000/api/auth/kakao/callback`, 프로덕션 `https://<web 공개 도메인>/api/auth/kakao/callback`. **Slur 선행 작업**이며 이것 없이는 카카오 플로우를 한 번도 성공시킬 수 없다
  - [ ] 백엔드 `KAKAO_REDIRECT_URIS`에 같은 두 값 반영 — 현재 프로덕션 api에는 이 변수가 **설정돼 있지 않아 기본값(localhost 하나)만 허용**된다. `.railway/railway.ts`의 api env에 `KAKAO_REDIRECT_URIS: preserve()` 선언 + Railway CLI `--set`으로 값 지정 (R1: `config apply`의 변수 반영을 신뢰하지 않는다)
  - [ ] 웹 env 2개 추가 — `KAKAO_REST_API_KEY`(api와 같은 값. 인가 URL의 `client_id`), `KAKAO_REDIRECT_URI`(콜백 절대 URL). `.railway/railway.ts`의 web env에 선언하고 CLI로 설정. **`NEXT_PUBLIC_` 접두어를 쓰지 않는다** — 클라이언트 번들에 넣을 이유가 없다
  - [ ] `.railway/railway.ts`는 `apps/api`가 아니므로 AC 11의 "`apps/api` 0건"과 충돌하지 않음을 확인

- [x] **Task 1 — `lib/auth.ts` 헬퍼 5개** (AC: 1, 7, 8)
  - [x] `SlurRole` 타입 · `resolveRole` · `setRoleCookie` · `fetchRoles` · `assertSameOrigin` · `safeNextPath` 추가
  - [x] `resolveRole`의 admin·seller 항을 기존 파일에서 **복사**해 옮긴다. 손으로 다시 타이핑하지 않는다
  - [x] `safeNextPath`에 D5의 5개 판정 전부. 단위 테스트를 만들지 않으므로 **판정 근거를 각 줄 주석으로** 남긴다

- [x] **Task 2 — 기존 `login/route.ts` 이관 (동작 보존)** (AC: 1, 8)
  - [x] Origin 검사 15줄 → `assertSameOrigin(req)` 호출로 교체. 반환 봉투(`{code:"forbidden", message:"허용되지 않은 요청입니다.", details:[]}`)와 403이 **글자 그대로** 같아야 한다
  - [x] 역할 계산 줄 → `resolveRole(roles)` + `setRoleCookie(res, role)`. **`"none"` → `"buyer"`가 이 스토리 전체에서 유일하게 "고치는" 문자열이다**
  - [x] `/auth/roles` 조회 실패 시 503 유지 (조용한 강등 금지 — 1.6 리뷰 결정)
  - [x] 응답 body `{ role }` 형태 유지 (로그인 폼이 이 값으로 목적지를 정한다)
  - [x] 🔍 **체크포인트:** 변경 전후 파일을 나란히 놓고 "줄어든 동작이 없는지" 확인한 결과를 Completion Notes에 적는다

- [x] **Task 3 — 신규 BFF 라우트 3개** (AC: 5, 6, 8)
  - [x] `app/api/auth/signup/route.ts` — Origin 검사 → `POST {API_BASE}/api/v1/auth/signup` → 201 응답의 토큰으로 `/auth/roles` → 쿠키 3종 → `{ role }` 반환. 실패 시 **백엔드 에러 봉투를 그대로** 전달 (login 라우트와 같은 방식)
  - [x] `app/api/auth/kakao/start/route.ts` — POST. D4의 1~4단계
  - [x] `app/api/auth/kakao/callback/route.ts` — GET. D4의 1~6단계
  - [x] 세 라우트 모두 응답에 `Cache-Control: no-store`
  - [x] 콜백 주석에 "GET이라 Origin 검사가 성립하지 않는다 — CSRF 방어는 state 쿠키다"를 남긴다
  - [x] 인가 코드를 **로그에 찍지 않는다**. 실패 로깅은 상태 코드·에러 종류까지만 (R2: 외부 토큰 즉시 파기)

- [x] **Task 4 — `/login` 화면 이관·재작성** (AC: 3, 4, 7)
  - [x] `git mv app/\(console\)/login app/\(buyer\)/login` — 같은 커밋에서 내용까지 교체한다(경로 충돌 지뢰)
  - [x] `app/(console)/login/login.css` 삭제 (`.page_login`은 다른 곳에서 쓰이지 않는다 — 지우기 전 `grep -rn "page_login" apps/web/app`로 확인)
  - [x] `login/page.tsx` — **서버 컴포넌트.** `searchParams`에서 `next`·`e`를 받아 `safeNextPath`로 거르고 `<BuyerShell topbar={{variant:"logo-center"}}>` + `<LoginForm next={…} notice={…} />`
  - [x] `login/login-form.tsx` — `"use client"`. 이메일·비밀번호 폼 + 카카오 **형제 폼**(POST, hidden `next`) + `회원가입` 링크
  - [x] 성공 시 `router.replace(next ?? roleHome(role))` + `router.refresh()` (Router Cache 잔상 제거 — `logout-button.tsx`가 쓰는 기존 관례)
  - [x] 오류 표시는 에러 code 시드 표(아래)대로. **HTTP 코드·code 문자열을 화면에 쓰지 않는다**
  - [x] `autoComplete="email"` / `"current-password"` 유지, 오류 메시지에 `aria-describedby` 연결, `role="alert"`는 상단 배너가 아니라 필드 메시지에 붙인다

- [x] **Task 5 — `/signup` 화면 신설** (AC: 5)
  - [x] `app/(buyer)/signup/page.tsx`(서버, `next` 전달) + `signup-form.tsx`(클라이언트)
  - [x] 상단바 `variant:"back-title"` + `title:"회원가입"`, 탭바 없음, `.b_container.m_read`
  - [x] 필드 4개: 이메일 / 비밀번호(도움말 `8자 이상`) / 이름 / 휴대폰번호 `(선택)`. placeholder는 `…을 입력하세요`, 휴대폰은 `숫자만 입력하세요`
  - [x] 클라이언트 선검증은 **백엔드 계약과 같은 값으로만** 한다 — 비밀번호 8~128자, 휴대폰 `^01[016789]\d{7,8}$`, 이름 1~100자 공백 불가. **더 엄격하게 만들지 않는다**(백엔드가 통과시키는 입력을 화면이 막으면 사용자만 손해다)
  - [x] 필수 동의 2줄(이용약관 / 개인정보 수집·이용) + 각 줄 `보기` → `/terms`·`/privacy` 새 탭. 둘 다 체크 전 `가입하기` 비활성
  - [x] 하단 안내 `가입하면 구매자로 시작합니다. 판매자 입점은 별도 신청이 필요합니다.`
  - [x] 동의 상태는 화면 안에서만 산다 — **서버로 보내지 않는다**(백엔드 스키마에 필드가 없다. 위험 6)

- [x] **Task 6 — 폼 프리미티브 CSS** (AC: 3, 4, 5)
  - [x] `buyer.css`에 D6 표의 프리미티브 추가 — 값은 전부 `--b-*` 토큰. 리터럴 hex 0건
  - [x] `auth.css` 신설 후 두 화면에서 임포트
  - [x] 확인: 구매자 파일에 `#2f6bff`·`--color-brand`·`--shadow-` **0건**, `box-shadow` 신규 선언 **0건**, `#fee500` 리터럴 0건(`--b-kakao`만)
  - [x] 카카오 말풍선 아이콘은 인라인 SVG 또는 CSS 도형. 아이콘 폰트·이모지·외부 CDN 금지 (UX-DR3·16)
  - [x] 터치 타깃 44×44 — 체크박스 라벨 행, `회원가입` 링크, `보기` 링크 (UX-DR7)

- [x] **Task 7 — `/no-role` 문구 수정** (AC: 9)
  - [x] D3의 문장으로 교체. `구매는 SLUR 앱을 이용해 주세요.`와 `(Epic 2에서 오픈)` 삭제
  - [x] `/apply`·`/` 링크는 `next/link`로 (lint 규칙 — A-E456-5에서 정리된 항목)
  - [x] `.page_landing`·푸터·`LogoutButton`은 **건드리지 않는다**

- [ ] **Task 8 — 검증: 실기 회귀 5 체크포인트 (이 스토리의 가장 중요한 Task)** (AC: 1, 2, 9, 10)
  - **관리자·판매자·구매자 3계정으로 실제 로그인해 확인한다. 단위 테스트로 대체하지 않는다.**
  - [ ] ① **역할 쿠키 값** — 개발자도구 Application → Cookies에서 `slur_role`이 각각 `admin`·`seller`·`buyer`인지. 세 계정 모두 `slur_access`·`slur_refresh`가 `HttpOnly` 체크된 상태인지
  - [ ] ② **`/seller`·`/admin` 진입·차단** — 판매자로 `/seller`·`/seller/products`·`/seller/orders` 진입 200, 관리자로 `/admin`(+`orders`·`settings`·`lookup`·`deposits`) 진입 200
  - [ ] ③ **관리자 → `/seller` 허용** — 관리자 계정으로 `/seller` 진입 200 (`/no-role` 아님)
  - [ ] ④ **판매자 → `/admin` 리다이렉트** — 판매자 계정으로 `/admin` 요청 시 `/seller`로 감 (`/no-role` 아님)
  - [ ] ⑤ **구매자 → 구매자 화면** — 구매자 계정 로그인 후 `/`로 감. `/no-role`에 **한 번도 닿지 않음**. 이어서 `/cart`·`/orders`·`/me` 진입 200
  - [ ] 덤: 구매자 계정으로 `/seller`를 직접 입력 → `/no-role`이 뜨고 **새 문구**가 보이며 `쇼핑 계속하기`로 `/`에 나갈 수 있는지
  - [ ] 결과를 Completion Notes에 표로 기록

- [ ] **Task 9 — 검증: 인증 플로우 실기** (AC: 4, 5, 6, 7)
  - [ ] 잘못된 비밀번호 → 두 필드 오류 + 정확한 문장. HTTP 코드가 화면에 없음
  - [ ] 신규 이메일로 가입 → 즉시 로그인 상태로 `/`. 같은 이메일 재가입 → 이메일 필드에 `이미 가입된 이메일입니다.`
  - [ ] 비밀번호 7자·잘못된 휴대폰 형식 → **해당 필드에만** 오류. 상단 배너 없음
  - [ ] 카카오: 신규 가입 / 같은 계정 재로그인(계정 1개 유지 — 관리자 조회 화면 `/admin/lookup`으로 확인) / 카카오 화면에서 취소 → 조용히 `/login`
  - [ ] 카카오 성공 직후 **주소창에 인가 코드가 남아 있지 않은지**, 뒤로가기가 콜백 URL로 돌아가지 않는지
  - [ ] `localStorage`·`sessionStorage`가 비어 있는지 (개발자도구 Application)
  - [ ] `/cart` 비로그인 접근 → `/login?next=%2Fcart` → 로그인 성공 → **`/cart`로 복귀**
  - [ ] `/login?next=https://example.com` · `/login?next=//example.com` · `/login?next=/\example.com` → 로그인 성공 시 **외부로 나가지 않고** 역할 기본 목적지로 감
  - [ ] `state` 위조: 콜백 URL의 `state` 값을 손으로 바꿔 요청 → 세션이 서지 않고 `/login?e=state`

- [x] **Task 10 — 검증: 빌드·정적 규칙** (AC: 1, 2, 11, 12)
  - [x] `cd apps/web && npx tsc --noEmit` → 0
  - [x] `cd apps/web && npm run lint` → 0 errors · 0 warnings
  - [x] `npx next build` → 성공. 라우트 목록에 `/login`이 그대로 있고 `/signup`이 추가됐는지, 콘솔 URL 11개가 전부 그대로인지
  - [x] `git diff --stat` — `apps/api` **0건**, `apps/web/middleware.ts` **0건**, `apps/web/app/styles/slur/` **0건**
  - [~] `grep -rn '"none"' apps/web/app apps/web/lib` → **1건 잔존(무해)** — 아래 Completion Notes 참조
  - [x] `cd apps/api && uv run pytest -q` → **미실행(사유 기록).** `uv`·`docker`가 PATH에 없고 pytest는 로컬 Postgres를 요구한다. 이 스토리는 `apps/api`를 열지 않으므로 무변경 증거는 `git diff --stat`이다. **통과했다고 쓰지 않는다** — 미실행 + 사유를 적는다

- [ ] **Task 11 — 검증: 프로덕션 (R3)** (AC: 6, 7, 8, 10)
  - [ ] 배포 후 `curl -i` — `/cart` 비로그인 → `Location`이 **공개 호스트**의 `/login?next=%2Fcart`인지 (내부 호스트가 아닌지)
  - [ ] `curl -i -X POST -H "Origin: https://evil.example" .../api/auth/login` → **403** (기존 검사 보존). 같은 요청을 `/api/auth/signup`·`/api/auth/kakao/start`에도 → 403
  - [ ] Origin 헤더 **없이** 같은 요청 → 기존과 동일하게 통과(브라우저 외 클라이언트 허용 — 현행 성질을 바꾸지 않는다)
  - [ ] 프로덕션에서 **실제 카카오 계정으로 1회 성공**시킨다. 1.3은 실 인가 코드 검증을 후속 스토리로 미뤘고 1.5(Flutter)가 받았다가 폐기됐다 — **웹에서 카카오가 끝까지 도는 것을 처음 증명하는 자리다**
  - [ ] 쿠키 속성 확인: `Secure` · `SameSite=Lax` · `slur_refresh`의 `Path=/api` · `slur_role`의 14일
  - [ ] **R3: 이 Task 전에는 done이 아니다**

## Dev Notes

### 이 스토리의 경계 — 하지 않는 일

| 하지 않는다 | 어디가 하는가 |
|---|---|
| 백엔드 수정·마이그레이션·신규 엔드포인트 | 없음. Epic 8 전체가 백엔드 무변경 |
| `middleware.ts` 수정 (rename 포함) | 아무도. rename은 별도 정리 작업 (D8) |
| 구매자 셸·토큰·타이포·포커스 링 | 8.1 완료 — **그대로 쓴다** |
| 상품목록·상품상세, 비로그인 담기 시도 지점 | 8.3 |
| 복귀 후 선택 조합 복원·담기 재개 | 8.3/8.4 (8.2는 `next` 관만 만든다 — D5) |
| 구매자 로그아웃 버튼과 그 목적지(`/`) | **8.7** (`/me`) (D7) |
| `/me`의 계정 정보·사업자 정보·약관 링크 | 8.7 |
| PWA manifest·`theme-color` | 8.7 |
| 정책 페이지(`/terms`·`/privacy`)의 구매자 톤 대응 | 미정 — 8.7에서 판단 (D2) |
| PKCE, 소셜 계정 연결, 이메일 인증, 비밀번호 재설정 | v1 밖 / 별도 스토리 (1.3 보류 목록 승계) |

### 고칠 코드 — ① 지금 무엇을 하는가 ② 무엇을 바꾸는가 ③ 깨뜨리면 안 되는 것

**`apps/web/app/api/auth/login/route.ts`** (49줄)
1. ① `origin` 헤더가 있으면 `x-forwarded-host`·`host`·`nextUrl.host` 중 하나와 일치하는지 검사해 아니면 403 `forbidden`. ② `POST {API_BASE}/api/v1/auth/login` 프록시 — 실패 시 **백엔드 에러 봉투를 그대로** 전달하고, `login.ok`인데 `access_token`이 없는 이상 응답은 502로 막는다. ③ `GET /auth/roles` — **실패 시 조용한 강등(`none` 14일) 대신 503**(1.6 리뷰 결정). ④ `roles.includes("admin") ? "admin" : roles.includes("seller") ? "seller" : "none"`. ⑤ `setSessionCookies` + `slur_role`(14일, `httpOnly:false`).
2. Origin 검사 → `assertSameOrigin`, 역할 계산 → `resolveRole`+`setRoleCookie`. **`"none"` → `"buyer"`.**
3. **위 ①~⑤의 동작 다섯 가지 전부.** 특히 (a) 에러 봉투 통과 전달 — 화면이 `data.message`를 그대로 보여주는 계약이 여기 걸려 있다, (b) roles 실패 시 503 — 강등으로 되돌리면 판매자가 조용히 구매자가 되는 사고가 난다, (c) 응답 body `{ role }` 형태 — 폼이 이 값으로 목적지를 정한다, (d) `origin`이 **없을 때는 통과**시키는 현행 성질(브라우저 외 클라이언트).

**`apps/web/lib/auth.ts`** (77줄)
1. `API_BASE`(env `API_BASE_URL`, 기본 `http://localhost:8000`) · 쿠키 상수 3종 · `REFRESH_PATH="/api"` · `cookieOptions` · `setSessionCookies`(access 30분 / refresh 14일 path `/api`) · `clearSessionCookies`(구 `/api/auth` path 쿠키까지 정리) · `proxyWithRefresh`(401 → refresh 회전 → 1회 재시도, 204 본문 없음 처리, 실패 시 쿠키 삭제).
2. **더하기만 한다** — D1의 헬퍼 5개.
3. `proxyWithRefresh` 전체(판매자·관리자 화면 전부가 이 경로로 산다), `REFRESH_PATH="/api"`(2.1에서 개정된 값 — 되돌리면 회전이 죽는다), `clearSessionCookies`의 구 path 정리 줄(1.6 시절 쿠키 마이그레이션), `secure = NODE_ENV === "production"`.

**`apps/web/middleware.ts`** (47줄)
1. `slur_role` 존재로 세션 판정 → (신규) 보호 라우트 5종 미로그인 시 `/login?next=…` → (기존) 미로그인 `/seller`·`/admin`·`/apply` → `/login` → `/admin`인데 admin 아니면 `role==="seller" ? "/seller" : "/no-role"` → `/seller`인데 seller·admin 아니면 `/no-role`. matcher 9항목.
2. **아무것도 바꾸지 않는다.** 8.1이 13~15행에 "8.2가 buyer를 추가해도 여기는 수정이 필요 없다"고 미리 적어 뒀고, 그 예측이 맞다.
3. 전부. 이 파일이 diff에 나타나면 AC 2 위반이다.

**`apps/web/app/(console)/login/page.tsx`** (65줄) + `login.css`(4줄)
1. `"use client"` 폼. `/api/auth/login` 호출 → 실패 시 `data.message`를 `.alert m_inline m_danger` **상단 배너**로 → 성공 시 `router.push(admin→/admin, seller→/seller, 그 외→/no-role)`. 마크업은 슬러 시스템(`.card`·`.field`·`.input_text`·`.btn m_primary m_full m_large`), 부제 `판매자·관리자 로그인`.
2. `(buyer)/login/`으로 옮기고 **전면 재작성** — 서버 컴포넌트 + 클라이언트 폼 분리, 구매자 톤, 카카오 버튼, `next` 소비, 필드별 오류(상단 배너 폐기).
3. **URL `/login`**(콘솔 9개 화면의 `router.replace("/login")`과 미들웨어 3곳이 여기로 온다), **역할별 목적지 `admin→/admin`·`seller→/seller`**(콘솔 진입의 유일한 길), `autoComplete` 속성(비밀번호 관리자 호환), 제출 중 버튼 비활성.
   - ⚠️ 상단 배너(`.alert`) → 필드 오류로 바꾸는 것은 UX-DR9의 명시 요구다. **판매자·관리자도 이 화면을 쓰므로** 그들에게도 표현이 바뀐다 — 기능이 아니라 표현의 변화이며 의도된 것이다.

**`apps/web/app/(console)/no-role/page.tsx`** (12줄)
1. `.page_landing` + `접근 권한이 없습니다` + `이 웹은 판매자·관리자용입니다. 구매는 SLUR 앱을 이용해 주세요.` + `입점을 원하시면 입점 신청(Epic 2에서 오픈)을 이용해 주세요.` + `LogoutButton`.
2. 본문 문장 교체 + `/apply`·`/` 링크 추가 (D3).
3. `.page_landing` 클래스(`globals.css`가 소유), `(console)` 소속(푸터), `LogoutButton` 컴포넌트 자체.

**`apps/web/app/api/auth/logout/route.ts`** (18줄)
1. refresh 쿠키가 있으면 `POST /api/v1/auth/logout`으로 서버 폐기(실패해도 무시 — 멱등) → `clearSessionCookies`로 `slur_access`·`slur_refresh`(현·구 path)·`slur_role` 삭제 → `{ok:true}`.
2. **바꾸지 않는다.** 역할 쿠키 삭제는 이미 포함돼 있다.
3. 서버 폐기 호출(refresh 토큰 테이블에서 revoke — 탈취 대응의 근거, AD-5), 실패 무시 정책.

**`apps/api/app/auth/**` (읽기 전용 — 계약 확인용)**
1. `/auth/signup`(201 TokenResponse) · `/auth/login` · `/auth/refresh` · `/auth/logout`(204) · `/auth/kakao`(`{code, redirect_uri}`) · `/auth/kakao/native` · `/auth/roles`(`{roles: []}` — **빈 배열 = 구매자**) · `/auth/me`. `kakao.py`가 `redirect_uri`를 `settings.kakao_redirect_uris` **allowlist와 대조**해 불일치 시 401.
2. **한 줄도 바꾸지 않는다.**
3. `SignupRequest`의 제약(password 8~128, phone `^01[016789]\d{7,8}$`, name 1~100 비공백, email `EmailStr`) — 화면 검증이 이보다 엄격하면 사용자만 손해다. `KakaoLoginRequest`의 `redirect_uri` 필수.

### 앞선 학습 (sprint-status.yaml action_items · 앞선 스토리에서 골라온 것)

- **R3 (open) — 쿠키·Origin·CORS는 프로덕션(프록시 뒤) 실요청 검증 후에만 done.** 이 스토리는 쿠키 5종(access·refresh·role·oauth state·oauth next)과 Origin 검사를 동시에 건드린다. **정면으로 해당한다** — Task 11이 완료 조건이다.
- **R1 (open) — Railway 변수는 CLI `--set`으로만, 즉시 확인. 신규 변수는 `railway.ts`에 `preserve()` 동시 선언.** 이 스토리는 신규 변수 3개(web 2 + api 1)를 요구한다. 1.6에서 `config apply`가 web 환경변수 추가를 조용히 누락한 전례가 있다 — **카카오가 프로덕션에서만 실패하면 십중팔구 여기다.**
- **R7 (done, 규칙으로 계속 유효) — `slur_role`은 UX 힌트일 뿐 권한 판정이 아니다.** `buyer` 값을 도입해도 성질은 그대로다. 이 쿠키는 위조 가능하며(`httpOnly:false`), 데이터 접근 판정은 FastAPI가 한다 (AD-1).
- **R6 — 에러 code는 Dev Notes에 사전 시드.** 아래 별도 절.
- **R2 — 구현 셀프체크 6종.** 이 스토리에 해당하는 것: 외부 호출 타임아웃(카카오 인가 URL 생성은 호출이 아니지만 `/auth/kakao` 프록시는 FastAPI 호출이다 — 기존 라우트와 같은 방식 유지) / 실패 로깅(코드 값은 로그에 남기지 않는다) / 입력 길이 상한(`code` 512, `state` 비교 전 길이 제한) / **외부 토큰 즉시 파기**(인가 코드는 변수 밖으로 나가지 않는다).
- **R5 — 이전 보류 스캔.** 1.3의 보류 목록에서 **`state`/PKCE 세션 바인딩**이 이 스토리 소관이다(D4에서 state 도입, PKCE는 근거와 함께 미도입). 나머지(계정 연결, `/auth/kakao` 레이트리밋, 카카오 선점)는 백엔드 변경을 요구하므로 이 에픽 밖이다.
- **A-E456-5 (done) — lint 0.** 베이스라인이 0이므로 늘어나면 이 스토리가 만든 것이다. 이동·삭제한 파일의 미사용 import, `<a>` 대신 `next/link` 규칙에 주의.
- **8.1 인계 4건 중 이 스토리 소관 2건** — (a) `/no-role` 문구, (b) `next`의 소비 측 재검증. 둘 다 AC로 들어와 있다.
- **1.6 — BFF 확정 사실.** 토큰은 httpOnly 쿠키로만 존재하고 브라우저 JS가 만지지 않는다. Next 서버 → FastAPI는 서버간 호출이라 CORS 경로가 아니다. 이 스토리의 신규 라우트도 **같은 성질을 유지해야 한다**.
- **1.3 — 카카오 백엔드는 이미 완성돼 있다.** 토큰 미저장, 자동 링크 금지(409 `email_conflict`), 응답 이형 방어, allowlist 대조. **프론트가 할 일은 인가 코드를 안전하게 가져다 주는 것뿐이다.**

### 에러 code 시드 (R6)

**분기는 `code`로, 표시는 아래 고정 문장으로.** HTTP 코드·`code` 문자열을 화면에 쓰지 않는다 (UX-DR9·15).

| 출처 | HTTP | `code` | 화면 반응 |
|---|---|---|---|
| 로그인 | 401 | `invalid_credentials` | 이메일·비밀번호 **두 필드** 오류 + 비밀번호 아래 `이메일 또는 비밀번호가 올바르지 않습니다.` |
| 로그인·가입 | 422 | `validation_error` | `details[].field`를 해당 필드에 매핑해 `reason` 표시. 매핑 실패분은 폼 하단 한 줄 |
| 가입 | 409 | `email_already_exists` | 이메일 필드 오류 + `이미 가입된 이메일입니다.` |
| 카카오 | 409 | `email_conflict` | `/login?e=conflict` → `이미 이메일로 가입된 계정입니다. 이메일 로그인을 이용해 주세요.` (카카오 버튼 아래 한 줄 — 이 자리에는 필드가 없으므로 "상단 배너 금지"와 충돌하지 않는다) |
| 카카오 | 401 | `invalid_kakao_code` | `/login?e=kakao` → `카카오 로그인을 완료하지 못했습니다. 다시 시도해 주세요.` |
| 카카오 | 502 | `kakao_unavailable` | `/login?e=kakao` → 같은 문장 (구매자에게 원인 구분은 의미가 없다) |
| 전 경로 | 503 | `service_unavailable` | `잠시 후 다시 시도해 주세요.` |
| BFF 자체 | 403 | `forbidden` | 정상 사용에서 발생하지 않는다. 화면 문구를 만들지 않고 일반 실패 문장으로 흡수 |
| 네트워크 예외 | — | — | `네트워크 연결을 확인해 주세요.` + 재시도(버튼 다시 활성) |

**신규 code는 만들지 않는다.** 카카오 `state` 불일치는 백엔드 봉투가 아니라 BFF 내부 판정이므로 URL 토큰 `?e=state`로만 표현하고, 화면은 `카카오 로그인을 완료하지 못했습니다. 다시 시도해 주세요.`를 쓴다(원인을 알려도 사용자가 할 수 있는 일이 같다).

**`?e=` 토큰은 4개로 고정한다** — `kakao` · `conflict` · `state` · (취소는 토큰 없음). 화면은 이 4개만 알고, 모르는 값은 무시한다. **서버 메시지 원문을 URL에 싣지 않는다.**

### 발견한 위험 · 기존 코드의 문제 (구현 전에 읽을 것)

1. 🚨 **프로덕션 백엔드의 카카오 allowlist가 localhost 하나다.** `.railway/railway.ts`에 `KAKAO_REDIRECT_URIS`가 선언돼 있지 않아 `config.py`의 기본값 `["http://localhost:3000/auth/kakao/callback"]`이 그대로 쓰인다. **프로덕션 카카오 로그인은 지금 100% 401로 떨어진다.** Task 0에서 반드시 설정한다.
2. **`redirect_uri` 3중 일치.** 카카오 콘솔 / 웹 `KAKAO_REDIRECT_URI` / 백엔드 allowlist. 프로토콜·호스트·경로·트레일링 슬래시까지 글자 단위로 같아야 한다. 카카오는 `KOE006`, 백엔드는 `invalid_kakao_code`로 응답하는데 **화면 문구가 같아서 구분되지 않는다** — 실패하면 백엔드 로그(`kakao redirect_uri not in allowlist`)를 먼저 본다.
3. **`state` 쿠키의 `sameSite`.** `"strict"`로 두면 카카오에서 돌아오는 최상위 내비게이션에 쿠키가 실리지 않아 **항상 state 불일치**가 된다. `"lax"`여야 한다 — 기존 세션 쿠키들과 같은 값이다.
4. **`/terms`·`/privacy`가 구매자 톤이 아니다.** 가입 화면의 `보기` 링크가 슬러 파랑 페이지를 새 탭에 연다. 알고 남기는 어긋남이며(D2), 대응 판단은 8.7 몫이다. FR-33(약관 접근)은 충족된다.
5. **`slur_role=none` 쿠키가 남아 있는 브라우저가 있다.** 지금까지 로그인한 구매자 계정은 14일짜리 `none`을 갖고 있다. 이 값은 더 이상 **생성**되지 않지만 소비 측이 견뎌야 한다 — 미들웨어는 `"admin"`·`"seller"`와만 비교하므로 `none`은 `buyer`와 똑같이 취급되어 무해하다. 코드로 마이그레이션하지 않는다(다음 로그인에 덮인다).
6. 🚨 **약관 동의 사실이 서버에 남지 않는다.** `SignupRequest`에 동의 필드가 없고 `users` 테이블에 동의 컬럼이 없다. ERD 변경은 이 에픽의 경계 밖(AD-9 승인 게이트)이므로 **v1은 화면에서 동의를 강제하되 기록은 남기지 않는다.** 전자상거래법상 약관 동의 이력 보관 요구가 있는지는 확인된 바 없다 — `[ASSUMPTION]`. **오픈 게이트의 "약관 법률 검토" 항목에 이 사실을 붙여야 한다**(`deferred-work.md` §Epic 6 오픈 게이트).
7. **로그인 화면이 ≥768에서 상단 내비를 보여준다.** 8.1의 상단바는 폭 768 이상에서 형태와 무관하게 `로고 + 4항목 내비`로 수렴한다. 비로그인 사용자가 로그인 화면에서 `장바구니`를 누르면 미들웨어가 다시 `/login?next=/cart`로 돌려보낸다 — 루프가 아니라 정상 귀환이지만 어색하다. **8.1의 규칙을 예외 처리하지 않는다**(예외를 만들면 상단바가 화면별로 갈라진다). `[ASSUMPTION]` 실기에서 어색함이 확인되면 8.7에서 셸 규칙으로 다룬다.
8. **로그인 화면에는 활성 내비 항목이 없다.** `tab` prop을 주지 않으므로 ≥768 내비에서 아무것도 활성이 아니다. EXPERIENCE의 "현재 위치 표시가 비는 화면이 있으면 안 된다"는 **상세 화면**(소속 최상위가 있는 화면)에 대한 규칙이고, 로그인은 IA 표에서 탐색 맥락 밖 화면이다. 의도된 상태다.
9. **미들웨어는 콘솔 리다이렉트에 `next`를 싣지 않는다.** 판매자가 `/seller/orders`에서 튕기면 로그인 후 `/seller`(역할 홈)로 가지 `/seller/orders`로 돌아가지 않는다. **기존 성질이며 이 스토리가 바꾸지 않는다** — 바꾸려면 미들웨어의 기존 세 줄을 건드려야 하고 그것이 AC 2와 충돌한다.
10. **미들웨어 통과 ≠ 인증.** `slur_role` 14일 > `slur_access` 30분. 8.3~8.7의 보호 라우트 페이지는 API 401을 **자기 손으로** `/login`으로 처리해야 한다(콘솔 화면들이 이미 그렇게 한다). 8.2의 화면들은 비로그인 화면이라 해당하지 않는다.
11. **`(console)/login` 삭제 시 `login.css` 고아 확인.** `.page_login`이 다른 곳에서 쓰이지 않는지 `grep`으로 확인한 뒤 지운다(8.1이 `page.module.css`에서 밟은 것과 같은 절차).
12. **Next 16 API 확인 없이 쓰지 말 것.** `searchParams`의 Promise 여부, Route Handler의 리다이렉트+쿠키 동시 설정, `cookies()` 형태가 학습 데이터와 다를 수 있다(`apps/web/AGENTS.md`). Task 0에 넣어 뒀다.

### Project Structure Notes

- 정렬: 8.1이 확정한 `(buyer)`/`(console)` 2그룹 구조를 그대로 따른다. **BFF Route Handler는 계속 `app/api/**`에 둔다** — 8.1이 그룹 이동에서 제외한 이유가 그대로 유효하다.
- 신규 파일

  ```
  apps/web/
    lib/auth.ts                                  ← 수정 (헬퍼 5개 추가)
    app/api/auth/signup/route.ts                 ← 신규 (POST)
    app/api/auth/kakao/start/route.ts            ← 신규 (POST · Origin 검사 · state 발급)
    app/api/auth/kakao/callback/route.ts         ← 신규 (GET  · state 검증 · 세션 설정 · 302)
    app/api/auth/login/route.ts                  ← 수정 (헬퍼 사용, "none" → "buyer")
    app/(buyer)/login/page.tsx                   ← 이동+재작성 (서버 컴포넌트)
    app/(buyer)/login/login-form.tsx             ← 신규 ("use client")
    app/(buyer)/signup/page.tsx                  ← 신규 (서버 컴포넌트)
    app/(buyer)/signup/signup-form.tsx           ← 신규 ("use client")
    app/(buyer)/auth.css                         ← 신규 (두 화면 공용 — 그룹 루트에 평평하게)
    app/(buyer)/buyer.css                        ← 수정 (폼 프리미티브 추가)
    app/(console)/no-role/page.tsx               ← 수정 (문구)
    app/(console)/login/{page.tsx,login.css}     ← 삭제
    middleware.ts                                ← 무변경 (AC 2)
  .railway/railway.ts                            ← 수정 (web env 2 · api env 1 선언)
  ```

- 컴포넌트 파일은 라우트 폴더 안에 평평하게 둔다(`login/login-form.tsx`) — 기존 관례. `auth.css`는 두 라우트가 공유하므로 그룹 루트(`(buyer)/`)에 둔다. 8.1이 `buyer.css`·`brand-label.tsx`를 같은 자리에 둔 것과 같다.
- 네이밍: 페이지 루트 `page_*`(콘솔) / 구매자는 `b_*`, 내부 요소 `i_*`, 변형 `m_*`.
- URL 변화 **0건 + 신규 1건**(`/signup`). `/login`은 그대로다.
- 스택 핀: Next.js 16.2.10 / React 19.2.4. **테스트 의존성을 추가하지 않는다**(`apps/web`에 테스트 프레임워크가 없다 — 도입은 이 스토리의 완주에 기여하지 않는다).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic-8 — 에픽 경계(백엔드 무변경·ERD 0건·API 12개 재사용·테스트 153건), `/auth/kakao`가 웹 리다이렉트용으로 이미 존재]
- [Source: _bmad-output/planning-artifacts/epics.md#Story-8.2 — AC 원문, 회귀 방지 경고 문단, 필수 실기 회귀 5항목, Origin 검사 동일 적용 지시, 카카오 리다이렉트 URI 등록 `[ASSUMPTION]`]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR9 — 폼 오류는 필드에만·상단 배너 금지·로그인 실패 문구·HTTP 코드 비노출·제출 중 비활성]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR11 — 공개/보호 라우트 표, 로그인·회원가입은 `/login`·`/signup`, 복귀 규칙]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR15 — 조용한 존댓말, 짧은 동사형 버튼, 확정 문구]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR1 — 예외 색은 카카오 `#fee500` 하나]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR6·7·16 — 먹색 포커스 링·키보드 완주 / 44×44 히트 영역 / `<html lang="ko">`·모달 금지]
- [Source: ux-designs/ux-SLUR_platform_blueprint-2026-07-21/EXPERIENCE.md#Information-Architecture — 10화면 표 4·5행(로그인=로고 중앙·탭바 없음 / 회원가입=뒤로가기+제목), "로그인 헤더에 뒤로가기를 두지 않는다" 확정]
- [Source: ux-designs/ux-SLUR_platform_blueprint-2026-07-21/EXPERIENCE.md#라우트와-접근-권한 — `/login`·`/signup`, 비로그인 공개 범위, 성공 후 원래 자리 복귀]
- [Source: ux-designs/ux-SLUR_platform_blueprint-2026-07-21/EXPERIENCE.md#State-Patterns#폼·인증 — 로그인 실패 두 필드 / 필드 오류 / 필수 동의 미체크 시 비활성 / placeholder / 제출 중 / 네트워크 실패]
- [Source: ux-designs/ux-SLUR_platform_blueprint-2026-07-21/EXPERIENCE.md#Voice-and-Tone — `로그인 실패 (401)` 금지, 확정 문장 목록]
- [Source: ux-designs/ux-SLUR_platform_blueprint-2026-07-21/DESIGN.md#Components — input 46px·오류 테두리/면, checkbox 16px, button solid/kakao, 약한 텍스트 버튼]
- [Source: ux-designs/ux-SLUR_platform_blueprint-2026-07-21/DESIGN.md#Layout-&-Spacing#반응형 — 로그인·회원가입은 끝까지 한 단(최대 640px)]
- [Source: ux-designs/.../.working/screens-2-account.html — 로그인·회원가입 확정 시안(필드 순서, `또는` 구분선, 카카오 버튼, 약관 2줄 + `보기`, 가입 안내 문장)]
- [Source: architecture/architecture-SLUR_platform_blueprint-2026-07-15/ARCHITECTURE-SPINE.md#AD-1 — FastAPI가 유일한 문지기]
- [Source: architecture/architecture-SLUR_platform_blueprint-2026-07-15/ARCHITECTURE-SPINE.md#AD-5 — 카카오는 신원 확인만, JWT는 FastAPI, `auth_providers` 범용 구조, refresh 서버 저장]
- [Source: architecture/architecture-SLUR_platform_blueprint-2026-07-15/ARCHITECTURE-SPINE.md#AD-14 — 하나의 Next.js 앱, 세 역할이 **동일한 BFF 경로**, 클라이언트가 토큰을 읽거나 저장하지 않는다]
- [Source: implementation-artifacts/1-3-kakao-login.md — 카카오 백엔드 동작·`redirect_uri` allowlist·409 `email_conflict`·에러 code 2종, 보류 항목 "state/PKCE 세션 바인딩"]
- [Source: implementation-artifacts/1-6-web-login-role.md — httpOnly 쿠키 + BFF 확정, 쿠키 수명·path, Origin 검증(login-CSRF), roles 실패 시 503, `slur_role`은 UX 힌트]
- [Source: implementation-artifacts/8-1-buyer-web-shell.md — D1(스코프 격리)·D3(미들웨어, "8.2가 buyer를 추가해도 수정 불필요")·D5(반응형 유틸리티), 셸 API(`BuyerShell`의 `tab`·`showTabbar`·`topbar`), 후속 인계 4건]
- [Source: implementation-artifacts/sprint-status.yaml#action_items — R1·R2·R3·R5·R6·R7·A-E456-5]
- [Source: apps/api/app/auth/{router.py,schemas.py,service.py,kakao.py} · app/core/{config.py,errors.py} — 계약·제약·에러 code (읽기 전용)]
- [Source: apps/web/{lib/auth.ts, middleware.ts, app/api/auth/{login,logout}/route.ts, app/(console)/{login,no-role}/page.tsx} — 현재 상태 (baseline_commit 기준)]
- [Source: .railway/railway.ts — api·web 서비스 env 선언 현황 (`KAKAO_REDIRECT_URIS` 미선언 확인)]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Claude Code)

### Debug Log References

- 로컬 검증은 `apps/api`를 띄울 수 없어(**`uv`·`docker` 모두 PATH에 없음**) FastAPI 계약을 그대로 흉내내는
  **임시 스텁 서버**(scratchpad, 저장소 밖)를 `127.0.0.1:8000`에 올려 수행했다. 스텁이 돌려준 것은
  `/auth/login`(200 토큰 / 401 `invalid_credentials`) · `/auth/signup`(201 / 409 `email_already_exists` /
  422 `validation_error` with `body.*` 접두어) · `/auth/roles`(`{"roles":[...]}`, 빈 배열=구매자) ·
  `/auth/kakao`(200 / 401 `invalid_kakao_code` / 409 `email_conflict`)뿐이며, 전부 `apps/api` 코드에서 확인한 실제 봉투다.
  **실 백엔드 왕복이 아니므로 Task 8·9는 닫지 않는다.**
- 화면 렌더는 `next dev` + 헤드리스 크롬 스크린샷(500 / 768 / 1280px)으로 확인했고, 오류 상태·체크 상태는
  실제 구매자 CSS 4종(`tokens.css`·`type.css`·`buyer.css`·`auth.css`)을 그대로 이어붙인 정적 페이지로 렌더해 눈으로 확인했다.
- 검증 후 `next dev`·스텁 서버 모두 종료했다.

### Completion Notes List

#### Task 0 — **미완. Slur 선행 작업이 남아 있다** (코드는 값만 들어오면 바로 동작한다)

이 머신에는 `railway` CLI가 없고 카카오 개발자 콘솔 접근 권한도 없어 **수행할 수 없었다.**
코드는 `KAKAO_REST_API_KEY`·`KAKAO_REDIRECT_URI` 두 env만 채워지면 그대로 도는 상태이며,
`.railway/railway.ts`에 세 변수(web 2 · api 1)를 `preserve()`로 **선언만** 해 두었다(값은 Railway에만 존재).

필요한 값과 절차:

| # | 할 일 | 값 |
|---|---|---|
| 1 | 카카오 개발자 콘솔 → 앱 → 카카오 로그인 → **Redirect URI 2개 등록** | `http://localhost:3000/api/auth/kakao/callback` · `https://<web 공개 도메인>/api/auth/kakao/callback` |
| 2 | 백엔드(api) 환경변수 `KAKAO_REDIRECT_URIS` **신규 설정** | 위 두 값 (config.py 기본값은 `http://localhost:3000/auth/kakao/callback` 하나뿐 — `/api`가 없어 **현재 프로덕션 카카오는 100% 401**) |
| 3 | 웹(web) 환경변수 `KAKAO_REST_API_KEY` | api의 같은 값 |
| 4 | 웹(web) 환경변수 `KAKAO_REDIRECT_URI` | 프로덕션 콜백 절대 URL 1개 (1번의 프로덕션 값과 **글자 단위로 동일**) |

- R1에 따라 **`railway variables --set`으로 넣고 즉시 확인**한다. `config apply`의 변수 반영은 1.6에서 조용히 누락된 전례가 있다.
- `NEXT_PUBLIC_` 접두어를 쓰지 않는다 — 클라이언트 번들에 들어갈 이유가 없다.
- 세 자리(콘솔 / 웹 `KAKAO_REDIRECT_URI` / 백엔드 allowlist)가 하나라도 다르면 카카오는 `KOE006`, 백엔드는 `invalid_kakao_code`로 떨어지고 **화면 문구가 같아 구분되지 않는다.** 실패 시 백엔드 로그(`redirect_uri not in allowlist`)를 먼저 본다.
- `.railway/railway.ts`는 `apps/api`가 아니므로 AC 11의 "`apps/api` 0건"과 충돌하지 않는다(확인함).

#### Task 2 — 동작 보존 체크포인트 (변경 전후 나란히 확인)

`login/route.ts`의 다섯 동작이 **줄어들지 않았다.**

| # | 이관 전 | 이관 후 | 판정 |
|---|---|---|---|
| ① Origin 검사 | 라우트 안 15줄 | `assertSameOrigin(req)` — 헬퍼로 **문장 단위 그대로 이동**(`origin` 없으면 통과, 403 봉투 문구·상태 동일) | 동일 |
| ② 에러 봉투 통과 전달 | `data ?? {...}` + `login.ok ? 502 : login.status` | 한 글자도 바꾸지 않음(오타성 fallback `kakao_unavailable`까지 그대로 보존 — 고치면 표현이 달라진다) | 동일 |
| ③ roles 실패 → 503 | 인라인 `if (!rolesRes.ok)` | `fetchRoles()`가 `null` → 같은 503 봉투 | 동일 |
| ④ 역할 계산 | `… : "none"` | `resolveRole()` — admin·seller 두 항은 **복사해 옮겼고** 마지막 항만 `buyer` | **의도된 유일한 변경** |
| ⑤ 쿠키 3종 | `setSessionCookies` + 인라인 role 쿠키 | `setSessionCookies` + `setRoleCookie` (14일·`httpOnly:false`·lax·`/`) | 동일 |

응답 body `{ role }` 형태 유지. 추가된 것은 `Cache-Control: no-store` 헤더 한 줄뿐이다(신규 인증 라우트와 규칙을 맞춘 것 — 판정·상태·봉투는 불변).

**실측 확인** (curl, 스텁 백엔드):
- `Origin: https://evil.example` → `403 {"code":"forbidden","message":"허용되지 않은 요청입니다.","details":[]}` — `/api/auth/login`·`/api/auth/signup`·`/api/auth/kakao/start` **세 라우트 모두 동일**
- Origin 헤더 **없음** → 200 통과 (브라우저 외 클라이언트 허용 — 현행 성질 보존)
- 401 실패 시 `{"code":"invalid_credentials", …}` 봉투가 그대로 전달됨

#### Task 8 — 회귀 5 체크포인트 (**스텁 백엔드 기준. 실 계정 재확인 전까지 닫지 않는다**)

미들웨어 판정은 `slur_role` 쿠키만 읽으므로 **아래 ②~⑤는 백엔드와 무관하게 실제 코드로 검증된 결과다.**
①은 BFF의 역할 계산 결과이며, 입력(`{"roles":[...]}`)만 스텁이 공급했다.

| # | 항목 | 결과 |
|---|---|---|
| ① | 역할 쿠키 값 | `admin@…` → `slur_role=admin` · `seller@…` → `seller` · `buyer@…`(roles 빈 배열) → **`buyer`**. `slur_access`·`slur_refresh`는 `HttpOnly`, `slur_role`은 아님(의도), 셋 다 `SameSite=Lax`, role 14일(`Max-Age=1209600`), refresh `Path=/api` |
| ② | `/seller`·`/admin` 진입 | seller 쿠키: `/seller`·`/seller/products`·`/seller/orders` **200**. admin 쿠키: `/admin`·`/admin/orders`·`/admin/settings`·`/admin/lookup`·`/admin/deposits` **200** |
| ③ | 관리자 → `/seller` | **200** (`/no-role` 아님) |
| ④ | 판매자 → `/admin` | **307 → `/seller`** (`/no-role` 아님) |
| ⑤ | 구매자 | `/` `/cart` `/orders` `/me` 전부 **200**, `/no-role` 미도달. 비로그인 `/cart`→`/login?next=%2Fcart`, `/orders/abc`→`/login?next=%2Forders%2Fabc`, `/me`→`/login?next=%2Fme` / `/seller`·`/admin`·`/apply`→`/login`(**`next` 없음 — 기존 동작**) |
| 덤 | 구매자가 `/seller` 직접 입력 | 307 → `/no-role`, **새 문구**(`이 화면은 판매자·관리자 전용입니다.`)와 `입점 신청`·`쇼핑 계속하기` 링크 확인. 푸터도 그대로(`layout_footer` 1건) |
| 덤 | 잔존 `slur_role=none` 쿠키 (위험 5) | `/seller`·`/admin` → `/no-role`, `/cart` → 200. **`buyer`와 동일하게 취급되어 무해함을 실측 확인** — 마이그레이션 불필요 |

**남은 것:** 실 FastAPI + 실 계정 3개로 같은 표를 다시 채우기(브라우저 개발자도구 Cookies 확인 포함).

#### Task 9 — 인증 플로우 (일부만 검증. **카카오 실 왕복은 미검증**)

검증한 것:
- 로그인 401 → BFF가 `invalid_credentials` 봉투 전달 → 폼이 **두 필드 오류 면 + 비밀번호 아래 한 줄** `이메일 또는 비밀번호가 올바르지 않습니다.` (스크린샷으로 확인). HTTP 코드·`code` 문자열 화면 노출 0건, 상단 배너 없음
- 가입 409 `email_already_exists` → 이메일 필드 오류(`이미 가입된 이메일입니다.`) / 422 `validation_error` `details[].field=body.password`·`body.phone` → **해당 필드에만** 매핑됨(접두어 제거 동작 확인)
- `next` 소비: `/login?next=%2Fcart` → 폼에 `/cart` 전달. `/login?next=%2Fproducts%2F12%3Fv%3D3%26q%3D2` → **쿼리 보존**. `https://example.com` · `//example.com` · `/\example.com` · `/login` · `/signup` → **전부 거부**(역할 기본 목적지로 감). `회원가입` 링크도 `?next=`를 물고 간다
- 카카오 시작: POST + Origin 통과 → **303** → `https://kauth.kakao.com/oauth/authorize?client_id=…&redirect_uri=…&response_type=code&state=<uuid>` + `slur_oauth_state`·`slur_oauth_next` 쿠키(HttpOnly · SameSite=Lax · `Path=/api/auth/kakao` · 600초)
- 카카오 콜백: `state` 위조 → **세션 미설정 + 302 `/login?e=state`** · `state` 쿠키 없음 → 동일 · `error=access_denied` → **조용히 `/login`**(문구 없음) · `email_conflict` → `/login?e=conflict` · 그 외 실패 → `/login?e=kakao` · 성공 → 쿠키 3종 설정 + `next` 쿠키(`/cart`)로 302, **oauth 쿠키 2개는 모든 경로에서 즉시 삭제**, `Cache-Control: no-store`
- 콜백의 `next` 쿠키가 외부 URL(`https://evil.example`)이면 **거부하고 역할 기본 목적지(`/`)로** 감
- `?e=` 4토큰: `kakao`·`state` → 같은 고정 문장, `conflict` → 전용 문장, **모르는 값은 무시**(문구 없음)

**미검증(사람이 해야 함):** 실제 카카오 계정 왕복(신규 가입 / 재로그인 시 계정 1개 유지 / 취소), 성공 직후 주소창에 인가 코드 잔존 여부·뒤로가기 동작, `localStorage`·`sessionStorage` 비어 있음.
설계상 인가 코드는 Route Handler 함수 스코프 밖으로 나가지 않으며(HTML을 만들지 않고 302만 반환) 로그에도 남기지 않는다(상태 코드 + 백엔드 `code`까지만 기록).

#### Task 10 — 빌드·정적 규칙

| 검사 | 결과 |
|---|---|
| `npx tsc --noEmit` | **0** |
| `npm run lint` | **0 errors · 0 warnings** (A-E456-5 베이스라인 유지) |
| `npx next build` | **성공.** 라우트 목록에 `/login` 그대로, `/signup` 신규 1건, 콘솔 URL 전부 유지(`/admin` 5 + `/admin/orders/[id]` + `/seller` 3 + `/seller/products/new` + `/apply`·`/no-role`·`/terms`·`/privacy`). 신규 BFF 3개(`/api/auth/signup`·`/api/auth/kakao/start`·`/api/auth/kakao/callback`) 등록 확인 |
| `git diff --stat` | `apps/api` **0건** · `apps/web/middleware.ts` **0건** · `apps/web/app/styles/slur/` **0건** · `apps/mobile` **0건** |
| 구매자 파일 금지 문자열 | `#2f6bff`·`--color-brand`·`--shadow-` **0건**. `#fee500` 리터럴은 8.1이 선언한 `--b-kakao` 토큰 **1곳뿐**이고 8.2 코드는 토큰만 쓴다. `box-shadow` 신규 선언 **0건**(8.1의 `box-shadow: none` 한 줄 유지) |
| `cd apps/api && uv run pytest -q` | **미실행.** 이 머신에 `uv`·`docker`가 없고 pytest는 로컬 Postgres를 요구한다. 이 스토리는 `apps/api`를 열지 않았으며 무변경 증거는 `git diff --stat`의 0건이다 — **통과했다고 쓰지 않는다** |

**⚠️ AC 1의 grep이 문자 그대로는 0건이 아니다(스토리가 틀린 지점).**
`grep -rn '"none"' apps/web/app apps/web/lib` → **1건**: `app/(buyer)/buyer-icons.tsx:16`의 `fill: "none"`.
**8.1이 만든 SVG presentation attribute이며 역할 값과 무관하다.** 역할 값으로서의 `none`은
BFF·화면·헬퍼 어디에서도 **생성되지 않는다**(`resolveRole`의 세 번째 항이 `buyer`이고, 그 밖에 역할 문자열을 만드는 코드가 없다).
AC의 의도(= 역할 값 `none` 미생성)는 충족되며, 검증 grep은 `grep -rn '"none"' … | grep -v 'fill:'`처럼 좁혀야 맞다.

#### Task 11 — 프로덕션 (R3) — **미수행**

배포·Railway 변수 설정 권한이 없어 수행하지 못했다. **R3 기준으로 이 스토리는 아직 done이 아니다.**
남은 항목: 공개 호스트 `Location` 확인 · 프로덕션 Origin 403 3라우트 · Origin 없음 통과 · **실 카카오 1회 성공** · 쿠키 속성(Secure·SameSite=Lax·refresh `Path=/api`·role 14일).

#### 화면 렌더 확인 (500 / 768 / 1280px)

- `/login`: 로고 중앙 상단바(뒤로가기 없음) · 탭바 없음 · 640px 한 단 가운데 정렬 · 이메일/비밀번호 → `로그인`(먹색 solid) → `또는` 구분선 → `카카오로 시작하기`(노랑 + 인라인 SVG 말풍선) → `아직 회원이 아니신가요? 회원가입` — **목업 `screens-2-account.html` 순서 그대로**. 한글 정상.
- `/signup`: 뒤로가기 + `회원가입` 제목형 · 이메일/비밀번호(도움말 `8자 이상`)/이름/휴대폰번호 `(선택)` · 필수 동의 2줄 + `보기` · **동의 전 `가입하기` 비활성**(비활성 토큰 색 확인) · 하단 안내 문장.
- 오류 상태: 두 입력의 액센트 테두리 + 오류 면, 비밀번호 아래 액센트 한 줄. 상단 배너 없음.
- 체크박스: 네이티브 `<input type=checkbox>` + `appearance:none` + `::after` 갈고리가 **정상 렌더**됨(먹색 면 + 종이색 체크).
- ≥768에서 8.1 상단바가 로고 + 4항목 내비로 수렴하고 활성 항목이 없다 — **위험 7·8에 기록된 의도된 상태**(예외 처리하지 않음).
- 파랑(`#2f6bff`) 0건, 예외 색은 카카오 노랑 하나.

#### 설계상 남긴 것 · 스토리와 달라진 것

1. **`lib/nav.ts`를 새로 만들었다(스토리 File List에 없던 파일).** D5가 `lib/auth.ts (또는 lib/nav.ts)`를 허용한 그 자리다.
   이유는 실체적이다 — `lib/auth.ts`는 `next/server`를 임포트하므로 **클라이언트 폼이 임포트할 수 없다.**
   `safeNextPath`·`roleHome`·`SlurRole`은 순수 함수라 여기 두고, 서버 라우트가 두 파일을 함께 쓴다. 판정식은 여전히 한 벌뿐이다.
2. **`app/(buyer)/auth-errors.ts`를 추가했다.** 로그인·가입 두 화면이 공유하는 고정 문장표와 422 `details` 매핑.
   `auth.css`를 그룹 루트에 둔 것과 같은 이유(두 라우트 공용)이며, `page/layout/route`가 아니라 라우트를 만들지 않는다.
   복사-붙여넣기로 두 벌을 두면 문구가 조용히 갈라진다.
3. **`roleHome`의 기본값이 `/`다** — `next`가 없거나 거부된 구매자는 홈으로 간다. `/no-role`로 가는 경로는 코드에서 사라졌다.
4. **약관 동의 사실은 서버에 저장되지 않는다** (AC 11, 위험 6). `SignupRequest`에 필드가 없고 `users`에 컬럼이 없다.
   v1은 화면에서 동의를 강제하되 기록을 남기지 않는다. **오픈 게이트의 "약관 법률 검토" 항목에 이 사실을 붙여야 한다**
   (`deferred-work.md` §Epic 6) — 스프린트 관리 쪽 조치가 필요하다.
5. **`middleware.ts` → `proxy.ts` rename은 하지 않았다**(D8). `next dev`가 deprecation 경고를 출력하지만 동작은 정상이며,
   빌드 출력에 `ƒ Proxy (Middleware)`로 표시된다. 이 부채는 `deferred-work.md`에 **아직 등재되지 않았다** — 등재가 필요하다.
6. `LogoutButton`·`/api/auth/logout`·`clearSessionCookies`는 **손대지 않았다**(D7). 구매자용 로그아웃(→ `/`)은 8.7 소관이다.

### File List

**신규**
- `apps/web/lib/nav.ts`
- `apps/web/app/(buyer)/auth.css`
- `apps/web/app/(buyer)/auth-errors.ts`
- `apps/web/app/(buyer)/login/login-form.tsx`
- `apps/web/app/(buyer)/signup/page.tsx`
- `apps/web/app/(buyer)/signup/signup-form.tsx`
- `apps/web/app/api/auth/signup/route.ts`
- `apps/web/app/api/auth/kakao/start/route.ts`
- `apps/web/app/api/auth/kakao/callback/route.ts`

**이동 + 재작성**
- `apps/web/app/(console)/login/page.tsx` → `apps/web/app/(buyer)/login/page.tsx` (URL `/login` 불변)

**수정**
- `apps/web/lib/auth.ts` (헬퍼 4개 + oauth 쿠키 상수 3개 추가. 기존 코드 무변경)
- `apps/web/app/api/auth/login/route.ts` (헬퍼 사용, `none` → `buyer`)
- `apps/web/app/(buyer)/buyer.css` (폼 프리미티브 추가)
- `apps/web/app/(console)/no-role/page.tsx` (문구 + `/apply`·`/` 링크)
- `.railway/railway.ts` (web env 2 · api env 1 선언)

**삭제**
- `apps/web/app/(console)/login/login.css` (`.page_login`은 다른 곳에서 쓰이지 않음 — grep 확인)

**무변경(증거)**
- `apps/web/middleware.ts` — diff **0줄** (AC 2)
- `apps/api/**` · `apps/web/app/styles/slur/**` · `apps/mobile/**` — diff **0건**

### Change Log

| 날짜 | 변경 | 비고 |
|---|---|---|
| 2026-07-22 | 스토리 작성 (D1~D8) | baseline `5d60203` |
| 2026-07-22 | Task 1~7·10 구현·검증 완료. Task 0(카카오 콘솔·Railway 변수)·8·9(실 백엔드 왕복)·11(프로덕션) 미완 | `middleware.ts` diff 0줄 · tsc 0 · lint 0/0 · build 성공 |
