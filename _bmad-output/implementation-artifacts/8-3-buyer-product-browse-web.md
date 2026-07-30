---
baseline_commit: 5d60203dfdf672162e547ffc042f5d52fafaa6fd
---

# Story 8.3: 상품목록·상품상세 (구매자 반응형 웹)

Status: done

## Story

As a 구매자,
I want 로그인하지 않고도 무엇을 파는지 보고 옵션을 고르는 것,
So that 계정을 만들기 전에 살 물건을 정할 수 있다.

## Acceptance Criteria

1. **Given** 루트 라우트 `/` **When** 비로그인 상태로 접근 **Then** 카테고리 칩 행과 상품 그리드가 표시되고, 8.1이 둔 자리표시 블록 6개는 **한 개도 남지 않는다** (`b_ph`·`b_placeholder` 마크업 0건)
   - **And** 숨김(`hidden`) 상품은 목록에 없다 — 서버가 제외하며 클라이언트가 상태로 거르지 않는다 (FR-12)
   - **And** 판매자·관리자 계정으로 로그인한 상태에서도 같은 화면이 보인다 (역할로 분기하지 않는다, FR-3)
   - **And** 상단바는 로고형 + 장바구니 아이콘, 탭바는 `홈` 활성이다 (8.1 셸 그대로)

2. **Given** 카테고리 칩 행 **When** 렌더 **Then** 첫 칩은 `전체`이고 그 뒤로 `GET /api/v1/products/categories` 응답이 **내려온 순서 그대로** 놓인다 — 이름·순서·개수를 코드에 하드코딩하지 않는다 (FR-34)
   - **And** 단일 선택이며 선택은 먹색 면(`--b-ink`), 999px 라운드다 (UX-DR12: `full`은 카테고리 칩과 개수 배지 둘에만)
   - **And** 칩을 누르면 즉시 목록이 갈아끼워지고 페이지가 1로 되돌아간다
   - **And** 선택된 카테고리는 `?category=<uuid>` 쿼리로 URL에 남아 새로고침·공유·상세에서 뒤로 오기에 보존된다 (`replace`로 히스토리를 늘리지 않는다)
   - **And** 응답에 없는 `category` 값이 URL에 있으면 조용히 `전체`로 되돌리고 쿼리를 정리한다 (삭제된 카테고리 링크)
   - **And** < 768에서만 우측 34px 종이색 페이드가 보이고 ≥ 768에서는 사라진다
   - **And** 카테고리 조회가 실패하면 칩 행을 감추고 **상품 목록은 정상 표시한다** — 목록 전체를 오류 화면으로 덮지 않는다

3. **Given** 상품 카드 **When** 렌더 **Then** 사진 → 브랜드 라벨(11px/800/`.15em`) → 상품명(13px/400 `--b-product-name`) → 가격(13px/800 먹색, `tabular-nums`) 순서로 놓인다 (UX-DR2)
   - **And** 카드 전체가 `/products/[id]`로 가는 하나의 링크다 (사진·글자 어디를 눌러도 같은 곳)
   - **And** 열 수는 2 / 3 / 3(< 640 / 640~767 / ≥ 768), 간격은 26·14 / 26·14 / 36·20px이다 — 값은 8.1의 `.b_grid`와 토큰이 이미 갖고 있고 이 스토리가 다시 선언하지 않는다 (UX-DR5)
   - **And** 카드 이미지 높이는 < 768에서 **160~216px**, ≥ 768에서 **200~260px 고정** 범위 안에서 품목마다 다르며 `object-fit: cover`다 — 카드 폭을 따라가지 않는다 (DESIGN.md 반응형이 정본)
   - **And** `main_image_url`이 `null`인 상품은 같은 높이의 종이 그늘 면으로 자리를 지킨다 (레이아웃이 무너지지 않는다)
   - **And** 금액은 `32,000원` 형식이다 — `₩`·소수점·축약 없음 (UX-DR15)

4. **Given** `sold_out: true` 상품 **When** 목록에 표시 **Then** **숨기지 않고** 사진 `filter: saturate(.45) brightness(1.04)`, 좌상단 먹색 `품절` 태그, 상품명·가격 `--b-ink-muted`, 가격 취소선으로 표기된다 — 색 + 텍스트를 항상 함께 쓴다 (FR-10 확장, UX-DR8)
   - **And** 품절 카드도 눌러 상품상세로 들어간다 (어떤 조합이 남았는지 볼 수 있어야 한다)
   - **And** 스크린리더에 `품절`이 상품명과 함께 전달된다 (태그를 장식으로 숨기지 않는다)

5. **Given** 목록의 로딩·빈 상태·오류 **When** 각 상황 **Then** 다음이 표시된다 (UX-DR9 — 목업에 없는 화면이며 이 스토리가 처음 만든다)
   - 로딩: **카드 골격(skeleton) 6개**가 그리드 자리에 — 화면 중앙 스피너를 쓰지 않는다
   - 카테고리에 상품 없음: `이 카테고리에는 아직 상품이 없습니다.`
   - `전체`에 상품 없음: `아직 등록된 상품이 없습니다.` `[ASSUMPTION]`
   - 조회 실패: 응답 봉투의 `message` + `다시 시도` 버튼
   - **And** HTTP 상태 코드와 에러 `code` 문자열이 화면 어디에도 나타나지 않는다 (분기는 `code`로, 표시는 `message`로)
   - **And** 봉투가 없는 실패(네트워크 예외)는 `연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요.`로 표시한다

6. **Given** 21개째 이후의 상품 **When** 목록 하단 **Then** `더 보기` 버튼이 있고 누르면 다음 페이지가 **누적**된다 — 스크롤에 반응하는 자동 로드를 만들지 않는다 (UX-DR16 금지 목록)
   - **And** 누적 개수가 `total`에 도달하면 버튼이 사라진다 — 페이지 크기를 클라이언트가 가정하지 않는다(응답에 `size`가 없다)
   - **And** 카테고리를 바꾸면 누적이 초기화된다

7. **Given** `/products/[id]` **When** 비로그인 상태로 접근 **Then** 이미지 갤러리(hero + 썸네일) · 브랜드 라벨(11.5px/`.17em`) · 상품명(23px/800) · 가격(20px/800 액센트) · 설명(13px/1.85)이 표시된다
   - **And** 썸네일을 누르면 hero가 그 이미지로 바뀌고 선택된 썸네일에 1.6px 액센트 테두리가 선다
   - **And** 이미지가 1장이면 썸네일 행을 그리지 않는다
   - **And** 상단바는 뒤로가기 + 장바구니 아이콘이고 탭바는 없다(하단 고정 CTA가 있는 화면), ≥ 768에서는 뒤로가기가 사라지고 `홈`이 활성으로 표시된다 (8.1 셸 규칙)
   - **And** 없는 상품·잘못된 id는 셸을 유지한 채 `상품을 찾을 수 없습니다.` + `상품목록으로` 링크를 보여준다 (숨김 상품도 404다)

8. **Given** 옵션 축 칩 **When** 한 축의 값을 선택 **Then** **다른 축** 칩의 상태가 즉시 갱신되고, 그 선택과 함께 성립하지 않는 조합의 칩은 `--b-disabled-surface` 면 + 취소선 + `품절` 서브라벨로 **비활성 표기**된다 — 숨기지 않는다 (FR-9·10, UX-DR8)
   - **And** 방금 만진 축(기준축)의 칩은 **전역 판정**(그 값이 들어간 조합 중 `purchasable`이 하나라도 있는가)으로 남는다 — 어떤 값도 영원히 고를 수 없게 되는 막다른 골목이 생기지 않는다 (D6)
   - **And** 그 값의 조합 중 일부만 구매 가능하면 `일부 품절` 서브라벨(10px, 액센트)이 붙는다
   - **And** 비활성 칩은 `aria-disabled="true"`이고 `품절`이 이름과 함께 읽힌다 — 시각적으로 숨기지 않는 이유가 낭독에서 사라지면 안 된다
   - **And** 축이 0개인 상품(옵션 없음 — 백엔드가 조합 1개로 만든다)은 축 UI를 그리지 않고 그 조합이 자동 선택된다
   - **And** 축 이름·값의 순서는 응답 `variants` 배열이 내려온 순서를 그대로 쓴다 (판매자가 만든 순서, 클라이언트 재정렬 금지)

9. **Given** 축 선택이 끝남 **When** 선택 결과 줄을 확인 **Then** 좌측 2px 액센트 세로선 + `--b-surface-inset` 면 위에 `선택` 라벨 · 조합(`살구 / 240ml`) · 우측 끝 상태(`구매 가능` 또는 `품절`)가 **한 줄**로 표시되고, 조합 목록을 따로 나열하지 않는다
   - **And** 품절 조합이 선택되면 `장바구니 담기`·`바로 구매` 두 버튼이 모두 비활성이다 — 선택을 자동 해제하지 않는다
   - **And** 축이 남아 있어 조합이 특정되지 않았으면 CTA가 비활성이고 결과 줄이 `옵션을 선택해 주세요.`를 말한다 `[ASSUMPTION]`
   - **And** 모든 조합이 품절이면 CTA가 비활성이고 `현재 구매할 수 있는 옵션이 없습니다.`가 표시된다
   - **And** 가격은 조합이 특정되면 그 조합의 `final_price`, 특정 전에는 `price_from`이며 활성 조합 가격이 갈리는 상품에서는 `32,000원부터`로 쓴다 — **조합별 추가금액을 클라이언트가 더하지 않는다** (AD-10·AD-12)
   - **And** 재고 수량을 화면에 쓰지 않는다 — 응답에 없고(단일 술어 `purchasable`만 내려온다) 만들어내지 않는다

10. **Given** 상품상세 하단 **When** 스크롤 **Then** `판매자 정보` 접이식 영역이 **기본 펼침**으로 6항목(상호·대표자·사업자등록번호·통신판매업 신고번호·사업장 주소·연락처)을 보이고, 그 아래 중개자 고지가 놓인다 — 둘 다 청약 버튼(`장바구니 담기`·`바로 구매`)보다 **위**다 (FR-32, UX-DR10)
    - **And** 고지 문구는 `app/config/company.ts`의 `BROKER_NOTICE` 상수 하나에서 온다 — 화면에 문자열을 다시 쓰지 않는다 (D10, 위험 3)
    - **And** ≥ 768에서도 이 영역은 우측 칼럼이 아니라 **2단 아래 전체 폭**에 있다 — sticky 칼럼 안에서 스크롤 밖으로 사라질 수 있는 자리에 두지 않는다
    - **And** 모달·별도 페이지·`더보기` 뒤에 숨기지 않는다
    - **And** `seller_info.company_name`이 빈 값이면 6항목 상자를 렌더하지 않고 중개자 고지만 남긴다 (6.2 리뷰 패치와 같은 규칙 — 빈 6행 상자 노출 금지)
    - **And** 상품상세에는 `임시 정보` 태그를 두지 않는다 — 여기 6항목은 판매자 실데이터이고, placeholder인 것은 플랫폼 사업자 정보(`/me`, 8.7)다

11. **Given** 폭 ≥ 768의 상품상세 **When** 렌더 **Then** 좌측 이미지 갤러리 **50%** / 우측 정보 **50%** 2단이 되고, **sticky는 짧은 좌측(이미지)** 에 걸린다 (UX-DR4 — 62/34·우측 sticky는 폐기된 값이다)
    - **And** 하단 고정 CTA 바가 사라지고 두 버튼이 우측 칼럼 안으로 승격된다 — 화면 밖으로 밀려나지 않는다
    - **And** < 768에서는 하단 고정 CTA 바(패딩 13/20/20px, 버튼 2개 균등 gap 9px)가 서고 탭바는 서지 않는다
    - **And** 폭을 390 ↔ 1280으로 바꿔도 **선택한 축·현재 썸네일·접이식 열림 상태가 초기화되지 않는다** — 폭에 따라 컴포넌트를 조건부 렌더/언마운트하지 않고 CSS로만 배치를 바꾼다 (AD-14)
    - **And** sticky 상단 오프셋은 54px 상단바를 피한다

12. **Given** `장바구니 담기`·`바로 구매` **When** 이 스토리 범위 **Then** 8.3은 **버튼의 자리·문구·활성 판정·클릭 시 갈 곳의 규칙**까지만 소유하고, 담기 API 호출과 장바구니 반영은 8.4, 로그인 후 복귀는 8.2가 소유한다
    - **And** 선택한 조합은 `?variant=<uuid>` 쿼리로 URL에 남는다 — `/login?next=<현재 경로+쿼리>`로 갔다 돌아오면 조합이 그대로 복원된다 (UX-DR11 "담으려던 조합을 잃어버리면 안 된다"의 저장 수단을 8.3이 만든다)
    - **And** 8.3은 로그인 여부를 판정하지 않는다 — 미들웨어 통과가 인증이 아니듯 쿠키 존재도 아니다 (AD-1). 401 처리는 호출자(8.4)가 한다
    - **And** `바로 구매`의 목적지는 이 스토리에서 정하지 않는다 — 백엔드에 직구매 경로가 없어(주문은 `cart_item_ids` 기반) 담기를 거쳐야 하며, 그 설계는 8.4·8.5 소관이다 (위험 2)

13. **Given** 이 스토리의 모든 CSS **When** 작성 **Then** 8.1이 만든 `--b-*` 토큰과 `.b_*` 타이포 역할 클래스, `.b_container`·`.b_grid`·`.b_row`만 쓴다 — **새 hex·새 px 스케일을 만들지 않는다** (UX-DR1: 값을 새로 만들지 말고 이 안에서 고른다)
    - **And** 구매자 파일에 `#2f6bff`·`--color-brand`·`--shadow-`·`box-shadow` 선언이 0건이다 (UX-DR12)
    - **And** `app/styles/slur/**`과 `app/styles/buyer/**`을 수정하지 않는다 — 새 토큰이 필요하면 스토리에 근거를 적고 `tokens.css`에 추가한다(무단 추가 금지)
    - **And** 판매자·관리자 화면의 색·레이아웃·포커스 링이 한 픽셀도 바뀌지 않는다

14. **Given** 이 스토리 전체 **When** 완료 **Then** 백엔드가 변경되지 않는다 — `git diff --stat`에 `apps/api` **0건**, 마이그레이션 0건, 신규 엔드포인트 0개. 소비하는 API는 기존 3개(`GET /products/categories` · `GET /products` · `GET /products/{id}`)뿐이다

15. **Given** 검증 **When** 실행 **Then** `npx tsc --noEmit` 0 · `npm run lint` **0 errors · 0 warnings**(A-E456-5 베이스라인) · `npx next build` 성공이 유지되고, 390/700/768/1280 네 폭에서 목록·상세를 실제로 렌더한 결과가 스토리에 기록된다
    - **And** `apps/web`에 테스트 프레임워크를 도입하지 않는다 — 의존성 추가 0건 (`package.json` 무변경)

## 설계 판단 (이 스토리에서 확정 — 근거를 남긴다)

### D1 — 공개 라우트도 **BFF Route Handler를 거친다** (브라우저가 FastAPI를 직접 부르지 않는다)

**결정.** `/`·`/products/[id]`는 인증이 필요 없지만, 데이터는 같은 오리진의 Route Handler를 통해 받는다.

```
app/api/products/route.ts             → GET /api/v1/products?category=&page=
app/api/products/categories/route.ts  → GET /api/v1/products/categories
app/api/products/[id]/route.ts        → GET /api/v1/products/{id}
```

**근거.**
- **FastAPI 주소가 서버 전용 환경변수다.** `lib/auth.ts`의 `API_BASE = process.env.API_BASE_URL`에는 `NEXT_PUBLIC_` 접두사가 없다. 브라우저에서 직접 부르려면 공개 환경변수를 새로 만들고 Railway에 등록해야 하는데, **회고 R1이 정확히 그 지점의 사고**다 — `config apply`가 web 환경변수를 조용히 누락한 적이 있다. 이 스토리는 새 환경변수를 요구하지 않는다.
- **CORS를 건드리지 않는다.** FastAPI에 `CORSMiddleware`가 있지만 허용 오리진은 설정값이고 `allow_credentials=True`다. 같은 오리진으로 부르면 프리플라이트도 오리진 목록 관리도 없다. 브라우저에 API 호스트를 노출하지도 않는다.
- AD-14가 "하나의 Next.js 앱, 동일 BFF 경로"를 못 박았다. 공개 화면만 예외를 만들면 8.4~8.6이 두 가지 호출 방식을 갖게 된다.

**기각한 대안.** (a) 서버 컴포넌트에서 `API_BASE`를 직접 `fetch` — 첫 화면은 빨라지지만 카테고리 전환·`더 보기`·축 선택이 전부 클라이언트 상태라 결국 클라이언트 경로가 또 필요하고, 두 경로가 같은 응답을 다르게 해석할 여지가 생긴다. SEO·OG 미리보기는 v1 완주 항목이 아니다(PRD 화면 목록 밖). (b) 브라우저 → FastAPI 직접 — 위 두 근거로 기각.

### D2 — 공개 프록시는 **`proxyWithRefresh`를 쓰지 않는다** (`lib/public-api.ts` 신설)

**결정.** `apps/web/lib/public-api.ts`에 토큰을 붙이지 않는 얇은 프록시를 만들고, `API_BASE`만 `@/lib/auth`에서 가져다 쓴다.

```ts
// 개념 — 실제 시그니처는 구현자가 정한다
export async function proxyPublic(path: string): Promise<NextResponse>
// · Authorization 헤더를 붙이지 않는다
// · refresh 회전을 하지 않는다
// · 어떤 경우에도 세션 쿠키를 건드리지 않는다
// · cache: "no-store" + 응답에 Cache-Control: no-store
```

**근거.**
- `proxyWithRefresh`는 상류가 401이면 **`clearSessionCookies(res)`를 호출한다.** 공개 GET 경로가 어떤 이유로든 401을 받으면(상류 장애·경로 오타·게이트웨이) **로그인한 사용자의 세션 쿠키가 삭제된다.** 공개 화면이 세션을 파괴할 수 있는 구조를 만들지 않는다.
- 공개 엔드포인트는 토큰을 무시하므로 붙일 이유가 없고, 붙이지 않으면 access 토큰이 불필요하게 한 홉 더 돌아다니지 않는다.
- `lib/auth.ts`를 수정하지 않는다 — 그 파일은 1.6·2.1에서 프로덕션 검증된 인증 경로이며, 이 스토리가 손댈 이유가 없다.

**캐시.** 재고·품절은 보는 사이에 움직인다(EXPERIENCE.md State Patterns). `no-store`로 두고 `revalidate`·ISR을 쓰지 않는다.

**입력 화이트리스트.** 목록 프록시는 `category`·`page` 두 쿼리만 상류로 넘긴다(그 외는 버린다). 상세 프록시는 id가 36자 UUID 형식이 아니면 상류를 부르지 않고 `{code:"not_found", message:"상품을 찾을 수 없습니다.", details:[]}` 404를 돌려준다 — 사용자가 만든 잘못된 URL과 없는 상품을 화면에서 구별할 이유가 없고, 분기가 하나로 줄어든다.

### D3 — 화면은 **클라이언트 컴포넌트 + `useSearchParams`**, 그리고 `<Suspense>` 경계

**결정.** `page.tsx`는 서버 컴포넌트로 두고 `<Suspense>`로 감싼 클라이언트 본체를 렌더한다. 본체가 BFF를 부르고 상태를 갖는다.

```
(buyer)/page.tsx                    → BuyerShell + <Suspense fallback={<목록 skeleton/>}><ProductList/></Suspense>
(buyer)/products/[id]/page.tsx      → BuyerShell + <Suspense fallback={<상세 skeleton/>}><ProductDetail/></Suspense>
```

**근거.**
- **`useSearchParams`를 쓰는 클라이언트 컴포넌트는 프리렌더 시 Suspense 경계가 필요하다** — 없으면 `next build`가 깨진다. 이 저장소에 이미 선례가 둘 있다: `(console)/seller/orders/page.tsx:411`, `(console)/admin/orders/page.tsx:217` (둘 다 주석까지 `useSearchParams는 프리렌더 시 Suspense 경계가 필요 (Next 16 규약)`라고 남겨 두었다). **그 패턴을 그대로 복제한다.**
- fallback을 스피너가 아니라 **skeleton**으로 두면 UX-DR9의 "화면 중앙 스피너 금지"가 프리렌더 단계에서도 자동으로 지켜진다.
- 동적 세그먼트 `[id]`는 Next 16에서 `params`가 **Promise**다(`app/api/admin/orders/[id]/route.ts:8`이 `ctx.params: Promise<{id:string}>`를 `await`한다). 클라이언트 본체에서는 `useParams<{id:string}>()`를 쓴다 — `(console)/admin/orders/[id]/page.tsx:102`의 선례와 같다.
- ⚠️ `apps/web/AGENTS.md`: "This is NOT the Next.js you know. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code." **Suspense·params·Route Handler 규약은 번들된 문서를 먼저 확인한다.**

### D4 — URL이 화면 상태의 저장소다 (`?category` / `?variant`)

**결정.** 목록의 선택 카테고리와 상세의 선택 조합을 URL 쿼리에 둔다. 갱신은 `router.replace`(히스토리 미증가).

| 화면 | 쿼리 | 없을 때 |
|---|---|---|
| `/` | `?category=<uuid>` | `전체` |
| `/products/[id]` | `?variant=<uuid>` | 선택 없음 (축이 0개면 유일 조합 자동) |

**근거.**
- **8.2의 복귀가 공짜로 풀린다.** 미들웨어와 8.2가 만드는 `next` 값은 `pathname + search`다. 선택 조합이 URL에 있으면 `/login?next=%2Fproducts%2Fabc%3Fvariant%3Dxyz`로 갔다 돌아오는 것만으로 **UX-DR11의 "담으려던 조합을 잃어버리면 안 된다"가 충족된다.** 별도 저장소(sessionStorage·전역 상태)를 만들지 않는다.
- App Router의 뒤로가기는 클라이언트 컴포넌트 상태를 복원하지 않는다. 상세에서 뒤로 눌렀을 때 보던 카테고리가 살아 있어야 하는데, 순수 컴포넌트 상태로는 매번 `전체`로 돌아간다.
- `push`가 아니라 `replace`인 이유: 칩을 다섯 번 누르면 히스토리가 다섯 칸 쌓여 뒤로가기가 상품목록을 벗어나지 못한다. UX-DR16 "헤더 뒤로가기는 브라우저 히스토리와 항상 일치"의 정신에 `replace`가 맞다.
- `variant`는 **표시 상태이지 권위가 아니다.** 응답에 없는 variant id가 오면 무시하고 선택 없음으로 시작한다. 가격·구매 가능 여부는 언제나 응답 값으로 다시 판정한다 (AD-10·AD-12).

### D5 — 페이지네이션은 **`더 보기` 버튼 + `total` 기준 종료 판정**

**결정.** 하단에 `더 보기` 버튼을 두고, 누적 개수가 응답의 `total`에 도달하면 버튼을 없앤다.

**근거.**
- UX-DR16이 **무한 스크롤 자동 로드를 금지**한다. 스크롤 관찰자를 만들지 않는다.
- **응답에 `size`가 없다.** `PublicProductList`는 `{items, total, page}`뿐이고 페이지 크기(20)는 서버 설정(`page_size`)이다. 클라이언트가 20을 상수로 박으면 서버 설정이 바뀌는 날 조용히 틀린다. `누적 길이 >= total`이면 끝 — 페이지 크기를 몰라도 성립한다.
- 이것으로 **3.5의 명시 이월(“Flutter 페이지네이션 — 21개째부터 비노출”)이 웹에서 해소된다.** Flutter판이 남긴 유일한 기능 결손이며, 여기서 갚지 않으면 상품이 21개가 되는 날 그대로 재발한다.
- 상품목록 끝에는 문구를 두지 않는다 — 스파인의 목록 끝 문구(`최근 주문부터 보입니다.`)는 주문내역 전용이다.

### D6 — 옵션 축 판정: **기준축은 전역, 상대축은 기준축 선택 기준** (막다른 골목 방지)

**결정.** 마지막으로 사용자가 만진 축을 **기준축(pivot)** 으로 삼는다.

| | 판정 | 표기 |
|---|---|---|
| 기준축의 칩 | 그 값이 들어간 조합 중 `purchasable`이 **하나라도** 있는가 | 전부 불가 → 비활성 + `품절` / 일부만 가능 → 활성 + `일부 품절` |
| 상대축의 칩 | 기준축의 선택값과 **짝지은 조합 하나**의 `purchasable` | 불가 → 비활성 + `품절` |
| 선택 유지 | 상대축 선택이 불가능해져도 **해제하지 않는다** | 결과 줄에 `품절`, CTA 두 개 비활성 |

**근거.**
- **양쪽 축을 서로 기준으로 삼으면 막다른 골목이 생긴다.** `살구/240` 선택 상태에서 색상 칩 `먹`을 용량 240 기준으로 판정하면, `먹/240`이 품절이고 `먹/320`만 가능한 상품에서 `먹`은 영영 비활성이다 — 존재하는 조합을 고를 방법이 사라진다. 기준축만 전역 판정하면 이 구멍이 닫힌다.
- 이 규칙은 에픽 AC 원문("**한 축을 고르면 다른 축 칩의 상태가 즉시 갱신**")과 목업 주석("`먹`을 고르면 용량 축의 `320ml`이 이렇게 비활성됩니다")을 그대로 따른 것이다 — 갱신 대상은 언제나 **다른 축**이다.
- **선택을 자동 해제하지 않는 이유**는 AC가 "품절 조합이 선택되면 두 버튼이 모두 비활성"을 요구하기 때문이다. 자동 해제하면 품절 조합은 선택될 수 없고 그 AC가 성립할 수 없다. 칩은 선택 표시(먹색 면)를 우선하고 취소선 + `품절` 서브라벨을 함께 단다.
- 축이 1개면 `일부 품절`이 나올 수 없다(값 하나 = 조합 하나). 축이 2개일 때 상대축에서도 나올 수 없다(조합이 특정된다). **`일부 품절`은 기준축에만 나타난다** — 구현 시 이 사실이 판정을 단순하게 만든다.

**축을 만드는 규칙.** `option1_name`·`option2_name`은 백엔드가 **전 행 동일**을 강제한다(`VariantsReplace.within_cap_and_unique`). 그러므로 첫 조합에서 축 이름을 읽고, 값 목록은 `variants` 등장 순서대로 중복 제거해 만든다. 이름이 빈 문자열이면 그 축은 없다.

### D7 — 상세의 가격 표시: 조합 전 `price_from`(+갈리면 `부터`), 조합 후 `final_price`

**결정.** 조합이 특정되기 전에는 `price_from`을 쓰되, **응답 `variants` 중 `final_price`가 서로 다르면 `32,000원부터`** 로 쓴다. 조합이 특정되면 그 조합의 `final_price`로 갈아끼운다.

**근거.**
- `price_from`은 3.5가 "~부터 표기용 최저가"로 정의한 값이다. 32,000~45,000원인 상품에서 `32,000원`만 보이면 청약 전에 잘못된 인상을 준다.
- **목록 카드에는 `부터`를 쓰지 않는다** — 목록 응답에는 조합별 가격 분포가 없어(`price_from` 하나) 갈리는지 판단할 수단이 없다. 백엔드를 바꾸지 않는 것이 에픽 경계이므로 목록은 값 그대로 표기한다. 목록과 상세의 표기가 갈리는 것은 알고 있는 비대칭이다 (위험 5).
- `[ASSUMPTION]` `…원부터` 문구는 스파인 Voice·Tone 표에 없다 — 금액 형식(`121,000원`)은 지키되 접미어는 이 스토리가 처음 쓴다. Slur 확인 항목.

### D8 — 반응형 상세는 **CSS Grid 영역 하나**로 세 요구를 동시에 만족시킨다

**결정.** 상세 본문을 grid로 짜고 DOM 순서는 `이미지 → 정보 → 법적 고지`로 고정한다.

```
< 768   : 한 칼럼 흐름 (이미지 → 정보 → 법적 고지), CTA는 화면 하단 고정 바
≥ 768   : "media info"
          "legal legal"     ← 고지는 2단 아래 전체 폭
          좌측(media) sticky, CTA는 info 칼럼 안
```

**근거.**
- UX-DR10의 "**고지는 청약 버튼보다 위**"(< 768)와 "**≥768에서 2단 아래 전체 폭**"이 DOM 순서 하나로 동시에 만족된다 — 폭에 따라 노드를 옮기지 않는다.
- 50/50 · 좌측 sticky는 DESIGN.md 반응형 절이 정본이다. **목업 `responsive-768-1280.html`의 62/34·우측 sticky는 결함으로 확인돼 폐기된 값이다** (위험 1).
- sticky 오프셋은 상단바 54px을 피한다: `top: calc(var(--b-topbar-h) + var(--b-space-5))`.
- 두 칼럼 길이가 비슷해지면 sticky를 걸지 않는다는 규칙(UX-DR4)은 **장바구니·주문서의 규칙**이다. 상품상세는 이미지 칼럼이 구조적으로 짧으므로(hero + 썸네일에서 끝난다) 조건 분기를 만들지 않는다.

### D9 — CTA는 **두 자리에 렌더하고 CSS `display`로 전환한다**

**결정.** `장바구니 담기`·`바로 구매` 버튼 쌍을 (a) 정보 칼럼 안(≥768 표시)과 (b) 하단 고정 바(<768 표시) 두 곳에 렌더하고, 각각 미디어쿼리로 감춘다. 선택 상태는 페이지 컴포넌트가 갖는다.

**근거.**
- 8.1이 탭바/상단 내비에 쓴 것과 **같은 패턴, 같은 근거**다: `matchMedia`로 조건부 렌더하면 폭이 바뀔 때 언마운트되어 선택 상태가 날아간다 (AC 11).
- `display: none`인 쪽은 접근성 트리에서도 제외되므로 스크린리더에 `장바구니 담기`가 두 번 읽히지 않는다.
- **하단 고정 바는 DOM 순서상 콘텐츠(법적 고지 포함) 뒤**에 둔다 (UX-DR6). 정보 칼럼 안의 사본은 고지보다 앞이지만 ≥768에서는 고정 바가 아니므로 포커스 함정이 아니다.
- 단일 노드를 `position: fixed ↔ static`으로 전환하는 대안은 기각했다 — 그 노드가 정보 칼럼 안에 있어야 하는데 그러면 <768에서 고정 바가 법적 고지보다 DOM 앞에 오게 되어 UX-DR6를 어긴다.

### D10 — 중개자 고지 문구의 정본은 **코드 상수(`BROKER_NOTICE`)** 다

**결정.** 상품상세의 고지는 `app/config/company.ts`의 `BROKER_NOTICE`를 그대로 렌더한다. 화면 코드에 문장을 다시 쓰지 않는다.

**근거.**
- 6.1·6.2가 세운 규약이 "고지 문구 단일 소스"다. 상수는 `COMPANY.name`에서 파생되므로 **실사업자 정보 교체(오픈 게이트)가 한 줄 수정으로 전 표면에 반영된다** — 웹 푸터·상품상세·주문서·내 정보가 함께 바뀐다. 화면마다 문장을 박으면 그날 네 군데를 찾아다녀야 하고 하나를 빼먹으면 법적 고지 회귀다.
- ⚠️ **에픽 AC와 스파인이 요구하는 문장과 상수의 문장이 다르다** (위험 3). 이 스토리는 상수를 정본으로 삼고 차이를 위험 목록에 올린다 — 문장을 어느 쪽으로 통일할지는 실사업자 정보 교체와 함께 결정될 사안이고, 화면 코드가 임의로 갈라놓을 사안이 아니다.

### D11 — 상세의 **배송비 줄은 숫자 대신 문장으로 자리를 지킨다**

**결정.** 목업과 UX-DR4가 상세 정보 칼럼에 두라고 한 `배송비` 행을, 금액 대신 다음 한 줄로 채운다.

> `배송비는 판매자마다 다르며 주문서에서 확인할 수 있습니다.` `[ASSUMPTION]`

**근거.**
- **공개 상품 API에 배송비가 없다.** 판매자 배송비(`base_shipping_fee`·`jeju_extra_fee`·`island_extra_fee`)는 `PUT /sellers/me/shipping-fees`로 저장되지만 공개 응답 어디에도 실리지 않는다. 실제 금액은 배송지 우편번호가 있어야 정해지며 `POST /orders/preview`가 계산한다 (AD-12).
- 응답에 없는 값을 화면이 만들어내면 AD-12 위반이고, 도서산간 추가비까지 얽혀 **틀린 금액을 청약 전에 보여주는 사고**가 된다.
- 백엔드에 필드를 추가하는 대안은 **Epic 8의 경계(백엔드 무변경·ERD 0건·API 12개 재사용)** 를 깬다. 필요하다고 판단되면 별도 스토리로 올린다.

### D12 — 이미지는 `<img>` + lazy, `next/image`를 도입하지 않는다

**결정.** 평범한 `<img loading="lazy" decoding="async">`에 `object-fit: cover`. `next/image`를 쓰지 않는다.

**근거.**
- `next.config.ts`에 `images.remotePatterns`가 없다. `next/image`로 Supabase 공개 URL을 쓰려면 전역 설정을 바꿔야 하고, 그 설정은 판매자 화면 빌드까지 함께 탄다. 완주에 기여하지 않는 전역 변경이다.
- API가 **완성형 URL**(`main_image_url`·`image_urls`)을 내려준다. 클라이언트가 경로를 조립하지 않는다 (AD-12 정신). ⚠️ `(console)/seller/products/page.tsx:12`가 하드코딩한 `IMG_BASE` 상수를 **구매자 화면으로 복사하지 않는다** — 공개 API는 이미 완성형이다.
- 🚨 **lint 함정**: `@next/next/no-img-element`가 경고를 낸다. 기존 코드가 쓰는 것과 같은 `/* eslint-disable-next-line @next/next/no-img-element */`를 각 `<img>` 위에 단다. **lint 베이스라인이 0 warnings라 하나라도 새면 이 스토리가 깬 것이다.**
- `alt`는 상품명. 장식 아이콘이 아니라 상품 그 자체이므로 빈 `alt`를 쓰지 않는다.

### D13 — 금액 포맷은 **공용 함수 하나**(`formatWon`)로 낸다

**결정.** `app/(buyer)/format.ts`에 `formatWon(n: number): string`을 두고 `n.toLocaleString("ko-KR") + "원"`을 돌려준다. 8.4~8.6이 같은 함수를 쓴다.

**근거.**
- **로케일을 생략한 `toLocaleString()`은 서버와 브라우저의 기본 로케일이 다르면 하이드레이션 불일치를 만든다.** `"ko-KR"`을 명시해 못 박는다.
- 형식이 `121,000원` 하나로 고정돼야 한다(UX-DR15). 화면마다 다시 쓰면 어딘가에서 `₩`나 축약이 생긴다.
- 자릿수 정렬(`tabular-nums`)은 이미 `type.css`의 금액 역할 클래스가 갖고 있다 — CSS는 다시 쓰지 않는다.

### D14 — 8.1 셸의 **최소 수정 두 곳**과 죽은 CSS 정리

**결정.**

1. `buyer-topbar.tsx` — `back-title` 형태에서 (a) `title`이 없으면 제목 노드를 렌더하지 않고, (b) `showCart`가 참이면 광학 중앙 정렬용 `i_spacer`를 렌더하지 않는다.
   **근거**: 상품상세의 상단바는 **뒤로가기 + 장바구니**(제목 없음)인데 8.1의 네 형태에 그 조합이 없다. 지금 `back-title`을 쓰는 화면이 **하나도 없으므로**(`/`·`/cart`·`/orders`·`/me`가 각각 `logo`·`title`·`title`·`title`) 회귀 표면이 0이다. 8.5·8.6이 제목 있는 `back-title`을 쓸 때도 그대로 동작한다.
2. `buyer.css` — `/`를 대체하면서 **고아가 되는 자리표시 규칙을 지운다**: `.b_ph`, `.b_placeholder`, `.b_ph:nth-child(...)` 6줄, `.b_section .i_eyebrow`/`.i_display`(대체 규칙을 `browse.css`가 갖는다면). `.b_stub`은 `/cart`·`/orders`·`/me`가 아직 쓰므로 **남긴다.** 지우기 전에 `grep -rn "b_ph\|b_placeholder" apps/web/app`이 0건인지 확인한다.

**그 밖의 8.1 산출물은 읽기만 한다.** `tokens.css`·`type.css`·`buyer-shell.tsx`·`buyer-tabbar.tsx`·`buyer-topnav.tsx`·`buyer-icons.tsx`·`brand-label.tsx`는 수정하지 않는다.

**파일 배치.**

```
apps/web/
  lib/public-api.ts                        ← 신설 (D2)
  app/api/products/route.ts                ← 신설 (목록)
  app/api/products/categories/route.ts     ← 신설 (정적 세그먼트가 [id]보다 먼저 매칭된다)
  app/api/products/[id]/route.ts           ← 신설 (상세)
  app/(buyer)/
    page.tsx                 ← 대체 (셸 + Suspense + ProductList)
    product-list.tsx         ← 신설 "use client" 목록 본체
    category-chips.tsx       ← 신설
    product-card.tsx         ← 신설
    products/[id]/page.tsx   ← 신설 (셸 + Suspense + ProductDetail)
    products/[id]/product-detail.tsx ← 신설 "use client" 상세 본체
    option-axes.tsx          ← 신설 (축 칩 + 선택 결과 줄)
    seller-info.tsx          ← 신설 (6항목 + 중개자 고지 — 8.5가 고지만 재사용할 수 있게 분리)
    buyer-feedback.tsx       ← 신설 (Skeleton · EmptyState · ErrorState — 8.4~8.7 공용)
    format.ts                ← 신설 (formatWon)
    browse.css               ← 신설 (목록·상세 전용)
    buyer.css                ← 수정 (공용 3종 스타일 추가 + 죽은 자리표시 규칙 제거)
    buyer-topbar.tsx         ← 수정 (D14-1)
```

CSS를 라우트 옆에 두고 컴포넌트가 임포트하는 것은 이 저장소의 관례다. 클래스 접두사는 `b_*`/`i_*`/`m_*`를 따른다.

## Tasks / Subtasks

- [x] **Task 1 — BFF Route Handler 3개와 공개 프록시 헬퍼** (AC: 1, 7, 14)
  - [x] `lib/public-api.ts` 신설 — `API_BASE`를 `@/lib/auth`에서 import. 토큰 미첨부·refresh 미회전·쿠키 미변경. `cache: "no-store"` + 응답 헤더 `Cache-Control: no-store`
  - [x] 상류 응답이 JSON이 아니면 `{code:"service_unavailable", message:"일시적인 오류입니다.", details:[]}`로 감싼다 (`proxyWithRefresh`의 폴백과 같은 봉투)
  - [x] `app/api/products/route.ts` — `category`·`page`만 화이트리스트로 전달. 그 외 쿼리는 버린다
  - [x] `app/api/products/categories/route.ts`
  - [x] `app/api/products/[id]/route.ts` — `ctx.params`는 **Promise다**(`await`). 36자 UUID 형식이 아니면 상류를 부르지 않고 404 `not_found` 봉투
  - [x] `lib/auth.ts`를 **수정하지 않는다** (import만 한다)

- [x] **Task 2 — 공용 표현 컴포넌트와 포맷 함수** (AC: 5, 13)
  - [x] `(buyer)/format.ts` — `formatWon(n)` = `n.toLocaleString("ko-KR") + "원"`. 로케일을 생략하지 않는다
  - [x] `(buyer)/buyer-feedback.tsx` — `CardSkeleton`(그리드용) · `EmptyState`(문구 + 선택적 액션) · `ErrorState`(문구 + `다시 시도`)
    - [x] **HTTP 코드·`code` 문자열을 렌더하지 않는다.** 표시는 봉투의 `message`, 분기만 `code`
    - [x] 봉투가 없는 실패(fetch throw)는 `연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요.`
    - [x] skeleton은 애니메이션을 최소로 두고 `prefers-reduced-motion`에서 끈다 (UX-DR16)
  - [x] 세 컴포넌트의 CSS는 `buyer.css`에 추가한다(8.4~8.7이 함께 쓴다). 목록·상세 전용 스타일만 `browse.css`

- [x] **Task 3 — 상품목록 `/`** (AC: 1, 2, 3, 5, 6)
  - [x] `(buyer)/page.tsx` — 8.1 자리표시를 **통째로 대체**. `BuyerShell tab="home" showTabbar topbar={{variant:"logo", showCart:true}}` 유지, 본문을 `<Suspense fallback={<목록 skeleton/>}>`로 감싼다
  - [x] `category-chips.tsx` — `GET /api/products/categories` 응답 순서 그대로 + 맨 앞 `전체`. `<button aria-pressed>`, 999px 라운드, 가로 스크롤, <768에서만 우측 34px 페이드
    - [x] 이름·순서·개수 하드코딩 0건. 조회 실패 시 칩 행만 감추고 목록은 계속 보여준다
    - [x] 응답에 없는 `?category` 값은 무시하고 `전체`로 되돌리며 쿼리를 정리한다
  - [x] `product-card.tsx` — 사진 → 브랜드 라벨(`<BrandLabel size="card">`) → 상품명 → 가격. 카드 전체가 `<Link href={/products/${id}}>`
    - [x] `sold_out`이면 `saturate(.45) brightness(1.04)` + 좌상단 `품절` 태그 + 이름·가격 `--b-ink-muted` + 가격 취소선. **숨기지 않는다**
    - [x] `main_image_url`이 null이면 같은 높이의 종이 그늘 면
    - [x] `<img>` 위에 `/* eslint-disable-next-line @next/next/no-img-element */`
  - [x] `product-list.tsx` — 카테고리 상태(URL 쿼리) · 누적 items · `total` · 로딩/오류. `더 보기` 버튼(누적 길이 >= total이면 감춤). 카테고리 변경 시 page=1·누적 초기화
    - [x] 스크롤 관찰자·자동 로드를 만들지 않는다 (UX-DR16)
    - [x] 큐레이션 머리글(eyebrow + display 문장)은 8.1이 쓴 문구를 그대로 이어받는다. `[ASSUMPTION]` 이 문장은 운영자가 바꿀 수단이 없다(하드코딩) — FR-34가 금지한 것은 카테고리 이름이므로 v1에서 수용한다
  - [x] `browse.css` — 카드 이미지 높이 리듬 두 세트: <768 `160~216px` 6단계, ≥768 `200~260px` 6단계. `nth-child(6n+k)` 문법은 8.1 `.b_ph` 선례를 따른다

- [x] **Task 4 — 상품상세 `/products/[id]` 골격과 갤러리** (AC: 7, 11, 13)
  - [x] `(buyer)/products/[id]/page.tsx` — `BuyerShell tab="home"`(≥768에서 `홈`이 활성), `showTabbar` **없음**, `topbar={{variant:"back-title", showCart:true}}`
  - [x] `product-detail.tsx` — `useParams<{id:string}>()`로 id를 읽고 `GET /api/products/{id}` 호출. 404·422는 `상품을 찾을 수 없습니다.` + `상품목록으로`(셸 유지, `notFound()`를 쓰지 않는다)
  - [x] 갤러리 — hero(현재 인덱스) + 썸네일 행(52px, 선택 1.6px 액센트 테두리). 이미지 1장이면 썸네일 행 미표시
    - [x] `[ASSUMPTION]` **좌우 스와이프 제스처를 만들지 않는다.** UX-DR16의 기본은 "스와이프를 만들지 않는다"이고 상품상세는 *허용*이지 의무가 아니다. 썸네일 탭으로 전 이미지에 닿는다
  - [x] 정보 칼럼 — 브랜드 라벨(`size="detail"`) · 상품명(`b_title`) · 가격(`b_price_hero`, 액센트) · 설명(`b_body`)
  - [x] D8의 grid 배치 — <768 한 칼럼 / ≥768 `"media info" / "legal legal"`, 좌측 sticky(`top: calc(54px + 20px)`)
  - [x] **폭에 따라 컴포넌트를 조건부 렌더하지 않는다** — `matchMedia`·`innerWidth`·`resize` 사용 0건

- [x] **Task 5 — 옵션 축 칩과 선택 결과 줄** (AC: 8, 9)
  - [x] `option-axes.tsx` — `variants`에서 축 이름 2개와 값 목록(등장 순서, 중복 제거)을 파생. 이름이 빈 문자열이면 그 축은 없다
  - [x] D6의 판정 구현 — 기준축(마지막으로 만진 축)은 전역 판정, 상대축은 기준축 선택과 짝지은 조합 판정
  - [x] 칩 상태 3종: 선택(먹색 면 + 종이색 글자 + 700) / `일부 품절`(10px 액센트 서브라벨) / 비활성(`--b-disabled-surface` 면 + `--b-disabled-ink` 글자 + 취소선 + `품절` 서브라벨)
  - [x] 비활성 칩은 `aria-disabled="true"` — `disabled` 속성으로 포커스에서 빼지 않는다(품절 사실이 낭독돼야 한다)
  - [x] 선택 결과 줄 — 좌측 2px 액센트 세로선 + `--b-surface-inset` 면, `선택` 라벨 · `살구 / 240ml` · 우측 끝 상태. **조합 목록을 나열하지 않는다**
  - [x] 축이 0개면 축 UI 없이 유일 조합 자동 선택. 모든 조합 품절이면 `현재 구매할 수 있는 옵션이 없습니다.`
  - [x] 선택 조합을 `?variant=<uuid>`에 `replace`로 반영하고, 진입 시 쿼리에서 복원한다(응답에 없는 값은 무시)
  - [x] 가격은 D7 규칙 — **클라이언트가 `base + extra`를 계산하지 않는다.** 재고 수량을 화면에 쓰지 않는다

- [x] **Task 6 — 판매자 신원정보와 중개자 고지** (AC: 10)
  - [x] `seller-info.tsx` — `<details open>` 기반 접이식(기본 펼침). 6항목을 라벨-값 행(`b_row`, 최대 560px)으로. 상자는 `--b-surface-inset` 면 + 1px hairline + 4px 라운드
  - [x] 중개자 고지는 `BROKER_NOTICE`(`@/app/config/company`) 상수 그대로. `b_notice` 클래스, 위에 1px hairline. 문장을 화면 코드에 다시 쓰지 않는다
  - [x] `company_name`이 빈 값이면 6항목 상자를 렌더하지 않고 고지만 남긴다 (6.2 리뷰 패치와 같은 규칙)
  - [x] **위치 검증** — <768: 하단 고정 CTA **위**의 본문 마지막. ≥768: 2단 **아래 전체 폭**. 두 폭 모두에서 청약 버튼보다 위에 보이는지 눈으로 확인
  - [x] `임시 정보` 태그를 두지 않는다 (플랫폼 사업자 정보는 8.7 소관)

- [x] **Task 7 — CTA 두 자리와 8.4 접점** (AC: 9, 11, 12)
  - [x] 버튼 쌍(`장바구니 담기` ghost / `바로 구매` solid)을 정보 칼럼 안과 하단 고정 바 **두 곳에 렌더**하고 CSS `display`로 전환 (D9)
  - [x] 하단 고정 바는 DOM 순서상 **법적 고지 뒤**에 둔다 (UX-DR6)
  - [x] 비활성 조건을 한 곳(선택 상태 파생)에서 계산해 두 사본에 같은 값을 넘긴다: 조합 미특정 / 선택 조합 `purchasable=false` / 전 조합 품절
  - [x] 클릭 핸들러 자리를 만들되 **담기 API를 부르지 않는다** — `// TODO(8.4)` 주석에 다음을 명시: 호출 대상 `POST /api/v1/carts/items {variant_id, quantity}`, 401이면 `/login?next=` + 현재 `pathname + search`(조합이 쿼리에 있으므로 복귀만으로 복원된다), `바로 구매`의 목적지는 8.4·8.5가 정한다
  - [x] 8.3은 로그인 여부를 판정하지 않는다 — `slur_role` 쿠키를 읽지 않는다

- [x] **Task 8 — 8.1 셸 최소 수정과 죽은 CSS 정리** (AC: 7, 13)
  - [x] `buyer-topbar.tsx` — D14-1의 두 조건만. 그 외 한 줄도 바꾸지 않는다
  - [x] `buyer.css` — `.b_ph`·`.b_placeholder`·`nth-child` 6줄 제거. **제거 전** `grep -rn "b_ph\|b_placeholder" apps/web/app`이 0건인지 확인. `.b_stub`은 남긴다
  - [x] `app/styles/buyer/**`·`app/styles/slur/**`에 diff가 **0건**인지 확인. 새 토큰이 꼭 필요하면 이 스토리에 근거를 적고 `tokens.css`에 추가한다

- [x] **Task 9 — 검증: 정적 규칙과 빌드** (AC: 13, 14, 15)
  - [x] `cd apps/web && npx tsc --noEmit` → 0
  - [x] `cd apps/web && npm run lint` → **0 errors · 0 warnings**. `<img>`마다 eslint-disable 주석이 붙었는지 확인
  - [x] `cd apps/web && npx next build` → 성공. `/`·`/products/[id]` 라우트가 나오고 기존 35개 라우트의 URL이 그대로인지 확인
  - [x] `grep -rn "#2f6bff\|--color-brand\|--shadow-\|box-shadow" apps/web/app/\(buyer\)` → 0건
  - [x] `git diff --stat`에 `apps/api` **0건** · `package.json`·`package-lock.json` **0건** (테스트 프레임워크·의존성 미도입의 증거)
  - [ ] `cd apps/api && uv run pytest -q` → **미실행.** 이 머신에 `uv`·`docker`가 없다(8.1과 같은 사유). 이 스토리는 `apps/api`를 열지 않았고 diff 0건이다 — **통과했다고 쓰지 않는다.** / 원문: **환경이 있을 때만.** 이 머신에는 `uv`·`docker`가 없어 실행할 수 없다. 실행하지 못했으면 Completion Notes에 **"미실행 + 사유"** 를 적는다 — 통과했다고 쓰지 않는다

- [x] **Task 10 — 검증: 실데이터로 화면 확인** (AC: 1~11, 15)
  - [x] **데이터 확보** — 다음 순서로 시도하고 무엇을 썼는지 기록한다
    1. 프로덕션 API를 `API_BASE_URL`로 가리켜 로컬 웹만 띄운다. **이 스토리는 공개 GET 3개만 부르므로 쓰기가 없고 데이터를 오염시키지 않는다**
    2. 실상품이 없으면 판매자 계정으로 `/seller/products/new`에서 옵션 2축·일부 품절 상품을 등록한다 (3.2·3.3의 기존 화면)
    3. 둘 다 불가하면 `[ASSUMPTION]` **스크래치패드에** 응답 스키마를 그대로 흉내 내는 스텁 서버를 띄우고 `API_BASE_URL`을 거기로 돌린다 — 저장소에 남기지 않는다(8.1의 Debug Log 규약과 동일). 스텁으로만 확인한 항목은 그 사실을 함께 적는다
  - [x] **확인 케이스** — 다음이 각각 재현되는 데이터가 필요하다
    - 옵션 2축 · 일부 조합만 품절 (`일부 품절` 서브라벨과 상대축 비활성)
    - 전 조합 품절 상품 (목록 `품절` 카드 + 상세 CTA 비활성 + 문구)
    - 옵션 없는 상품 (축 UI 없음, 자동 선택)
    - 이미지 1장 상품 (썸네일 행 미표시) · 이미지 없는 상품 (`main_image_url: null`)
    - 상품 21개 이상 (`더 보기`) · 상품 0개 카테고리 (빈 상태)
  - [x] 390 / 700 / 768 / 1280 네 폭에서 `/`·`/products/[id]` 렌더 확인 — 열 수 2/3/3, 여백 20/20/32, 카드 이미지 높이 범위, 상세 50/50 + 좌측 sticky, <768 하단 고정 CTA, ≥768 CTA 승격
  - [x] **폭을 바꿔도 선택한 축·썸네일·접이식 상태가 유지되는지** 확인
  - [x] 키보드만으로 목록 → 카테고리 → 카드 → 상세 → 축 선택 → CTA까지 완주. 비활성 칩에서 `품절`이 함께 읽히는지, 하단 고정 바가 콘텐츠보다 먼저 포커스되지 않는지
  - [x] 상단바·탭바·먹색 포커스 링이 8.1과 동일한지(구매자 화면에 파랑 0회) 확인
  - [x] 결과를 Completion Notes에 기록한다 — 단위 테스트로 대체하지 않는다(`apps/web`에 테스트 프레임워크가 없고 이 스토리는 도입하지 않는다)

- [x] **Task 11 — 검증: 실패 경로** (AC: 5, 7)
  - [x] 없는 상품 id → `상품을 찾을 수 없습니다.` + `상품목록으로`
  - [x] 잘못된 형식의 id(`/products/abc`) → 같은 화면 (BFF가 404 봉투로 통일)
  - [x] 상류 중단(API를 끄고) → 목록·상세 모두 문장형 메시지 + `다시 시도`. **화면에 숫자·code가 없는지 확인**
  - [x] 카테고리만 실패시키기 → 칩 행은 사라지고 목록은 정상
  - [x] 삭제된 카테고리 uuid를 `?category=`에 넣기 → `전체`로 복귀 + 쿼리 정리

## Dev Notes

### 이 스토리의 경계 — 하지 않는 일

| 하지 않는다 | 어디가 하는가 |
|---|---|
| 백엔드 수정·마이그레이션·신규 엔드포인트·응답 필드 추가 | 없음. Epic 8 전체가 백엔드 무변경 |
| 담기 API 호출·장바구니 반영·배지 숫자 | **8.4** |
| 로그인 화면·`next` 복귀 처리·역할 쿠키 `buyer` | **8.2** |
| `바로 구매`의 목적지 설계(직구매 경로가 백엔드에 없다) | **8.4·8.5** |
| 주문서의 중개자 고지 | **8.5** (`seller-info.tsx`의 고지 부분을 재사용할 수 있게 분리해 둔다) |
| 플랫폼 사업자 정보 · `임시 정보` 태그 · 약관 링크 | **8.7** (`/me`) |
| PWA manifest · `theme-color` · 오프라인 | **8.7** |
| 검색·정렬·찜·리뷰·별점·재입고 알림 | v1 밖 (UX-DR16 금지 목록) |
| `apps/web` 단위 테스트 프레임워크 도입 | 하지 않는다 (의존성 추가 금지) |
| `apps/mobile` 제거 | **8.8** |

### 소비하는 백엔드 API — 계약 (읽기만, 수정 금지)

세 엔드포인트 모두 **인증 불요**. 경로 접두사는 `/api/v1`(`main.py:69`).

**① `GET /api/v1/products/categories`** → `200 CategoryResponse[]` — **봉투가 아니라 배열이다**

```jsonc
[{ "id": "uuid", "name": "테이블웨어", "sort_order": 0 }]
```
- 서버가 `sort_order, created_at`으로 이미 정렬해 내려준다. **클라이언트가 재정렬하지 않는다.** 빈 배열 가능

**② `GET /api/v1/products?category=<uuid>&page=<int>`** → `200 PublicProductList`

```jsonc
{ "items": [ { "id":"uuid", "name":"유광 도자 머그", "brand_name":"토림도예",
               "price_from": 32000, "main_image_url": "https://…/product-images/…jpg" /* 또는 null */,
               "sold_out": false, "category_id":"uuid" } ],
  "total": 37, "page": 1 }
```
- `page` 기본 1, `ge=1`. **응답에 `size`가 없다** — 페이지 크기는 서버 설정(`page_size=20`)이며 클라이언트가 가정하면 안 된다. 종료 판정은 `누적 길이 >= total`
- 정렬은 `created_at DESC, id DESC` 고정. 정렬 파라미터가 없다
- `status != "hidden"`만 내려온다. **품절 상품은 내려온다** (`sold_out: true`)
- `sold_out` = "구매 가능한 조합이 하나도 없다"(`not any(check_purchasable)`). **판매자 수동 품절(`status="soldout"`)과 재고 0을 구분하지 않는다** — 화면도 구분하지 않는다
- `price_from` = 활성 조합의 `min(base_price + extra_price)`. 조합이 0개인 비정상 데이터는 `base_price` 폴백
- 존재하지 않는 `category` uuid → **빈 목록**(에러 아님). 범위 밖 `page`도 빈 목록
- `category`가 uuid 형식이 아니면 `422 validation_error`

**③ `GET /api/v1/products/{id}`** → `200 PublicProductDetail` (②의 항목 + 아래)

```jsonc
{ /* …PublicProductItem 전 필드… */
  "description": "유약이 고르게 앉도록 …",
  "image_urls": ["https://…1.jpg", "https://…2.jpg"],
  "variants": [ { "id":"uuid", "option1_name":"색상", "option1_value":"살구",
                  "option2_name":"용량", "option2_value":"240ml",
                  "final_price": 32000, "purchasable": true } ],
  "seller_info": { "brand_name":"", "company_name":"", "representative_name":"",
                   "business_registration_number":"", "mail_order_number":"",
                   "business_address":"", "contact_phone":"" } }
```
- **404** `{"code":"not_found","message":"상품을 찾을 수 없습니다.","details":[]}` — 숨김 상품도 404다(존재를 노출하지 않는다)
- id가 uuid 형식이 아니면 `422 validation_error` (BFF가 404로 통일한다 — D2)
- `variants` 정렬은 `created_at, id` — **판매자가 만든 순서**. 축 값 순서의 정본이다
- `option1_name`·`option2_name`은 **전 행 동일**이 백엔드에서 강제된다(`VariantsReplace` 검증). 이름이 빈 문자열이면 그 축은 없다. 옵션 없는 상품은 조합 1개이고 네 필드가 모두 빈 문자열
- `final_price` = `base_price + extra_price`(백엔드 계산, AD-12). **클라이언트가 더하지 않는다**
- `purchasable` = 단일 술어 결과(AD-10): 상품 `active` ∧ 조합 `is_active` ∧ `stock >= 1`. **재고 수량은 내려오지 않는다**
- `image_urls`는 `sort_order` 순, `[0]`이 대표. 완성형 공개 URL이다 — **클라이언트가 경로를 조립하지 않는다**
- `seller_info`는 인증 없이 공개된다(법 취지, 6.2). 판매자 부재는 비정상 데이터라 **빈 문자열 방어**가 걸려 있다 → `company_name`이 비면 상자를 그리지 않는다
- ⚠️ **배송비·재고·상품 status·조합 가격 분포는 이 응답에 없다** (위험 4·5, D7·D11)

**에러 봉투 (전 엔드포인트 공통)** — `{code, message, details}`. `details`는 `[{field, reason}]`.
분기는 `code`로, 표시는 `message`로. **HTTP 코드와 `code` 문자열은 화면에 나타나지 않는다.**

### 고칠 코드 — ① 지금 무엇을 하는가 ② 무엇을 바꾸는가 ③ 깨뜨리면 안 되는 것

**`apps/web/app/(buyer)/page.tsx`**
1. 8.1의 자리표시 홈. `BuyerShell` + eyebrow/display + `.b_grid` 위 `.b_ph` 블록 6개(높이를 달리해 리듬 확인용).
2. **통째로 대체.** 셸 호출부(`tab="home" showTabbar topbar={{variant:"logo", showCart:true}}`)와 큐레이션 머리글 두 줄은 그대로 두고, 그 아래를 카테고리 칩 + 그리드로 바꾼다. 본체는 `<Suspense>` 안의 클라이언트 컴포넌트로 내린다.
3. **셸 호출부의 세 값.** 탭바가 서고 `홈`이 활성이며 상단바가 로고형이라는 것이 8.1이 검증한 상태다. 여기를 바꾸면 8.1의 AC 1·2가 깨진다.

**`apps/web/app/(buyer)/buyer.css`**
1. 셸 CSS(컨테이너·그리드·상단바·탭바·포커스 링) + 공유 컴포넌트(상태 라벨·금액 요약·판매자 묶음) + **자리표시 규칙**(`.b_ph`·`.b_placeholder`·`nth-child` 6줄·`.b_stub`).
2. 자리표시 중 `.b_ph`·`.b_placeholder` 계열만 제거하고, 공용 피드백(skeleton·빈 상태·오류) 스타일을 추가한다.
3. 🚨 **`.b_stub`은 `/cart`·`/orders`·`/me`가 아직 쓴다** — 지우면 세 화면의 여백이 사라진다. 🚨 `.b_container`·`.b_grid`·`.b_row`·`.b_topbar`·`.b_tabbar`·포커스 링 블록은 8.1이 실측 검증한 것이다. **값을 다시 선언하거나 덮어쓰지 않는다** — `browse.css`에서 `.b_grid`의 열 수·간격을 재정의하면 8.1의 반응형 계약이 두 곳으로 갈라진다.

**`apps/web/app/(buyer)/buyer-topbar.tsx`**
1. 네 형태(`logo`·`logo-center`·`back-title`·`title`)를 <768용 `i_compact`와 ≥768용 `i_wide`로 이중 렌더하고 CSS `display`로 전환. `back-title`은 뒤로가기 + 제목 + 22px `i_spacer`를 그린다.
2. `back-title`에서 (a) `title`이 없으면 제목 노드 미렌더, (b) `showCart`면 `i_spacer` 미렌더 — **두 조건뿐.**
3. **`i_wide` 블록과 ≥768 수렴 규칙**(형태와 무관하게 로고 + 상단 내비, 뒤로가기 없음)은 8.1의 AC 2다. `router.back()` 동작도 UX-DR16(브라우저 히스토리와 일치)이라 바꾸지 않는다. `logo`·`title` 두 형태는 현재 네 화면이 쓰고 있으므로 손대지 않는다.

**`apps/web/lib/auth.ts`**
1. 서버 전용 인증 헬퍼 — 쿠키 상수, `setSessionCookies`, `clearSessionCookies`, `proxyWithRefresh`(access 첨부 → 401이면 refresh 회전 후 1회 재시도 → 실패 시 세션 쿠키 삭제).
2. **수정하지 않는다.** `API_BASE`만 import한다.
3. 🚨 `proxyWithRefresh`의 401 경로가 `clearSessionCookies`를 호출한다 — 공개 GET에 이 함수를 쓰면 상류 장애 한 번이 **로그인 사용자의 세션을 지운다.** D2가 별도 헬퍼를 만드는 이유이며, 이것이 이 스토리에서 가장 조용한 사고 가능성이다.

**`apps/web/app/(console)/seller/products/page.tsx` (관례 참조용 — 수정하지 않는다)**
1. `"use client"` + `useEffect` 로더 + `try/catch` + 401→`/login`·403→`/no-role`, 상태별 문구 상수, `<img>` + eslint-disable 주석, `IMG_BASE` 하드코딩.
2. 없음.
3. **관례 두 가지만 가져온다**: (a) 로더를 `useCallback`으로 만들고 effect 안에서 async IIFE로 호출, (b) `<img>` 위 `/* eslint-disable-next-line @next/next/no-img-element */`. **`IMG_BASE` 상수는 가져오지 않는다** — 공개 API가 완성형 URL을 준다.

**`apps/web/app/config/company.ts` (수정하지 않는다)**
1. `COMPANY` placeholder 7필드 + `COMPANY.name`에서 파생한 `BROKER_NOTICE`.
2. 없음 — 상품상세가 `BROKER_NOTICE`를 **읽기만** 한다.
3. 오픈 게이트 항목(실사업자 정보 교체)이 여기 한 곳에 모여 있다는 성질. 화면이 문장을 복제하면 그 성질이 깨진다.

### 앞선 학습 (sprint-status.yaml action_items · 8.1 Completion Notes에서 골라온 것)

- **R6 — 에러 code는 Dev Notes에 사전 시드 선언.** 아래 별도 절.
- **R7 — `slur_role`은 UX 힌트일 뿐 권한 판정이 아니다.** 8.3은 아예 읽지 않는다. 공개 화면이므로 인증 상태를 알 필요가 없고, 알려고 하면 8.2가 쿠키 값을 바꿀 때 여기가 함께 깨진다.
- **R1 — Railway `config apply`가 web 환경변수를 조용히 누락한 적이 있다.** 이 스토리는 **새 환경변수를 요구하지 않는다**(D1). 요구했다면 프로덕션에서만 목록이 비는 사고가 났을 것이다.
- **R3 — 쿠키·Origin·리다이렉트는 프로덕션 실요청 검증 전에는 done이 아니다.** 이 스토리는 쿠키·미들웨어를 건드리지 않으므로 R3 대상이 아니다. 단 **8.1의 Task 11(프로덕션 미들웨어 재확인)이 아직 미완**이며, 그것이 `/`·`/products/*`의 공개 통과를 보증한다 — 8.3의 화면이 프로덕션에서 처음 열릴 때 함께 확인하면 한 번에 끝난다.
- **A-E456-5 — 웹 lint 베이스라인 0 errors · 0 warnings.** `<img>` 3~4곳이 전부 `@next/next/no-img-element` 후보다. 하나만 빠져도 이 스토리가 베이스라인을 깬 것이 된다.
- **8.1의 학습 — 격리의 근거는 임포트 위치가 아니라 셀렉터다.** `browse.css`에도 **스코프 없는 태그 셀렉터(`img`·`button`·`a`)를 쓰지 않는다.** 전부 `.b_*` 클래스에 건다.
- **8.1의 학습 — Chrome 헤드리스는 최소 500px 폭을 강제한다.** 390px은 정확히 재현되지 않으므로 `<640` 구간은 500px으로 확인하고 390 고유 수치는 미디어쿼리 값과 대조한다(브레이크포인트가 640이라 같은 구간이다).
- **3.5의 명시 이월 — 페이지네이션 미구현(21개째부터 비노출).** D5가 갚는다. **이 스토리가 끝나면 `deferred-work.md`에서 해소로 기록될 항목이다**(기록 자체는 스프린트 관리가 한다 — 이 스토리는 `sprint-status.yaml`을 건드리지 않는다).

### 에러 code 시드 (R6)

이 스토리가 만나는 `code` 값은 전부 **기존 백엔드 코드**이며 새로 만들지 않는다.

| code | HTTP | 언제 | 화면 처리 |
|---|---|---|---|
| `not_found` | 404 | 없는·숨김 상품, BFF가 만든 잘못된 id | `상품을 찾을 수 없습니다.` + `상품목록으로` (셸 유지) |
| `validation_error` | 422 | uuid 형식 아님, `page < 1` | 상세는 `not_found`와 같은 화면. 목록은 쿼리를 정리하고 재조회 |
| `service_unavailable` | 503 · BFF 폴백 | 상류 장애, JSON 아닌 응답 | `message` + `다시 시도` |
| `internal_error` | 500 | 상류 미처리 예외 | `message` + `다시 시도` |
| `http_error` | 그 외 | 매핑 없는 상태 | `message` + `다시 시도` |
| (봉투 없음) | — | fetch throw(네트워크 단절) | `연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요.` |

**표시 규약**: 분기는 `code`, 표시는 `message`. **HTTP 코드·`code` 문자열을 화면에 렌더하지 않는다** (UX-DR9·15 — `로그인 실패 (401)`은 Don't 예시다).

### 발견한 위험 · 기존 코드의 문제 (구현 전에 읽을 것)

1. **목업 `responsive-768-1280.html`은 "고치기 전" 상태다.** 카드 이미지 높이가 279·411px, 상품상세 2단이 62/34·우측 sticky로 그려져 있는데 **바로 그것이 결함으로 발견돼 DESIGN.md에서 200~260px · 50/50 · 좌측 sticky로 고쳐진** 화면이다. `epics.md`의 UX-DR4·UX-DR5 표도 2026-07-21에 개정됐다. **DESIGN.md 반응형 절이 정본이고 목업이 진다** (AD-14).

2. **`바로 구매`가 갈 곳이 백엔드에 없다.** 주문 생성은 `OrderCreateRequest.cart_item_ids` 기반이고 미리보기(`POST /orders/preview`)도 장바구니를 전제한다. **직구매 경로가 없으므로** `바로 구매`는 (담기 → `/checkout`) 또는 (담기 → `/cart`) 중 하나로 구현될 수밖에 없다. 8.3은 버튼만 놓고 목적지를 정하지 않는다 — **8.4·8.5가 이 사실을 알고 설계해야 한다.** 백엔드에 직구매 엔드포인트를 만드는 것은 Epic 8 경계 밖이다.

3. **중개자 고지 문장이 두 개다.** 스파인·에픽 AC가 "글자 그대로" 쓰라는 문장과 코드 상수가 다르다.

   | 출처 | 문장 |
   |---|---|
   | `EXPERIENCE.md`·`epics.md` 8.3 AC | `SLUR는 통신판매중개자이며 통신판매의 당사자가 아닙니다. 상품 정보와 거래에 관한 책임은 판매자에게 있습니다.` |
   | `app/config/company.ts` `BROKER_NOTICE` (6.1, 프로덕션 가동 중) | `(주)슬러는 통신판매중개자이며 통신판매의 당사자가 아닙니다. 상품, 상품정보, 거래에 관한 의무와 책임은 판매자에게 있습니다.` |

   D10은 **코드 상수를 정본**으로 삼는다(주어가 실상호이고, 오픈 게이트의 실정보 교체가 한 지점에서 일어나야 하며, 웹 푸터가 이미 그 문장을 쓰고 있다). **어느 문장이 법적으로 정본인지는 Slur·법률 검토가 정할 사안**이며, 지금 화면 코드가 갈라놓지 않는 것이 이 결정의 목적이다. `deferred-work.md`의 "사업자 실정보 교체(오픈 게이트)"와 한 묶음으로 다뤄야 한다.

4. **상품상세에 배송비를 실을 데이터가 없다.** UX-DR4의 우측 칼럼 항목 목록과 목업에는 `3,000원 · 제주·도서산간 +3,000원` 줄이 있지만, 공개 API에 판매자 배송비가 없다. D11이 문장으로 대체한다. **이것이 UX 계약과 API 계약이 어긋나는 가장 뚜렷한 지점이다.**

5. **목록과 상세의 가격 표기가 비대칭이다.** 상세는 조합 가격이 갈리면 `…원부터`를 쓸 수 있지만(`variants` 전체가 있다) 목록은 `price_from` 하나뿐이라 갈리는지 알 수 없다. 같은 상품이 목록에서 `32,000원`, 상세에서 `32,000원부터`로 보인다. 백엔드를 바꾸지 않는 한 해소되지 않으며, 거짓은 아니다.

6. **`sold_out`은 원인을 말하지 않는다.** 판매자가 수동으로 품절 처리한 상품(`status="soldout"`)과 재고가 0인 상품이 같은 값으로 내려온다. 화면도 구분하지 않는 것이 맞다 — 구매자에게 원인은 의미가 없다.

7. **비활성 옵션 칩에 `disabled` 속성을 쓰면 안 된다.** `<button disabled>`는 포커스에서 빠지고 많은 스크린리더가 건너뛴다. **숨기지 않는 이유(그 조합이 원래 있었다는 사실)가 낭독에서 사라진다.** `aria-disabled="true"` + 클릭 무시로 구현한다 (EXPERIENCE.md Accessibility Floor가 명시적으로 요구한다).

8. **`useSearchParams`에 Suspense 경계를 빠뜨리면 `next build`가 깨진다.** tsc·lint는 잡아주지 않는다. 저장소의 두 선례(`seller/orders`·`admin/orders`)를 그대로 복제한다.

9. **`params`는 Promise다 (Next 16).** Route Handler에서 `await ctx.params`. 클라이언트 컴포넌트에서는 `useParams()`. `apps/web/AGENTS.md`가 "이건 네가 아는 Next.js가 아니다 — `node_modules/next/dist/docs/`를 먼저 읽어라"라고 못 박고 있다.

10. **`middleware.ts`는 Next 16에서 deprecated이며 `proxy`로 이름이 바뀌었다** (8.1이 발견해 부채로 남긴 항목). 이 스토리는 미들웨어를 건드리지 않으므로 그대로 둔다 — `/`·`/products/*`는 matcher에 없어 미들웨어가 아예 실행되지 않는다.

11. **이 머신에서 백엔드를 띄울 수 없다.** `uv`·`docker`가 PATH에 없어 `apps/api` pytest도, 로컬 API도 불가능하다. Task 10이 대안 세 가지를 순서대로 지시한다. **"통과했다"고 쓰지 않는 것**이 8.1이 세운 규약이다.

12. **`/products`(목록 라우트)를 만들지 않는다.** 스파인의 라우트 표에 없다(`/`가 상품목록이다). 만들면 같은 화면이 두 URL을 갖고 카테고리 쿼리·공유 링크가 갈린다.

### Project Structure Notes

- 정렬: `Consistency Conventions`의 "프론트 = Next.js App Router + 슬러 시스템 CSS", 그 위에 8.1이 얹은 구매자 스코프 확장 층. 8.3은 그 층을 **소비만** 한다. [Source: ARCHITECTURE-SPINE.md#Consistency-Conventions]
- 신규 라우트 2개: `(buyer)/products/[id]`(페이지), `app/api/products/**`(BFF 3개). **URL 변경 0건** — `/`는 이미 존재하고 내용만 바뀐다.
- `app/api/products/categories`(정적)와 `app/api/products/[id]`(동적)가 같은 깊이에 있다. Next는 정적 세그먼트를 먼저 매칭하므로 `/api/products/categories`가 `[id]`로 새지 않는다 — 8.1이 `orders/complete` vs `orders/[id]`에서 남긴 것과 같은 성질이다.
- 컴포넌트 파일은 라우트 폴더 안에 평평하게 둔다(`(buyer)/product-card.tsx`). `page.tsx`·`layout.tsx`·`route.ts`가 아닌 파일은 라우트를 만들지 않는다.
- `lib/public-api.ts`는 `lib/auth.ts` 옆에 둔다 — 서버 전용 모듈 자리다. 클라이언트에서 import하지 않는다.
- 스택 핀: Next.js 16.2.10 / React 19.2.4. **의존성을 추가하지 않는다** — `package.json`·`package-lock.json` diff 0건이 AC 15의 증거다.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic-8 — 에픽 경계: 백엔드 무변경·ERD 0건·구매자 API 12개 재사용·테스트 153건]
- [Source: _bmad-output/planning-artifacts/epics.md#Story-8.3 — AC 원문(카테고리 칩·품절 카드·옵션 축·선택 결과 줄·판매자 정보·2단 50/50) 및 Dev Notes(담기 경계·이미지 스와이프·품절 카드 `[ASSUMPTION]`)]
- [Source: _bmad-output/planning-artifacts/epics.md#Story-8.4 — 담기·배지·CTA 카운트 경계]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR2 — 브랜드 라벨 11px/800/.15em, 상품명 13px/400 `#605b53`, 금액 형식·tabular-nums]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR4 — 2단 3화면 표(상품상세 50/50·좌측 sticky), ≥768 CTA 승격, 폭 변경 시 상태 유지]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR5 — 여백 20/20/32, 본문 1080px, 열 2/3/3, 간격 26·14 / 36·20, 카드 이미지 높이 160~216 / 200~260]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR8 — 색 + 텍스트, 품절 카드 `saturate(.45)`·태그·취소선, 품절 조합 `aria-disabled` + `품절`]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR9 — 빈 상태·skeleton·오류 표 (HTTP 코드·code 문자열 미노출)]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR10 — 법적 고지 배치 3자리, ≥768 2단 아래 전체 폭, 고지 문구 원문]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR12 — box-shadow 금지, 라운드 스케일, `full`은 카테고리 칩·개수 배지 둘만]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR16 — 스와이프 미제작(상세 이미지만 예외), 무한 스크롤 자동 로드 금지, 모달 금지, `prefers-reduced-motion`]
- [Source: ux-designs/ux-SLUR_platform_blueprint-2026-07-21/DESIGN.md#frontmatter — colors·typography·rounded·spacing·components 값의 정본 (option-chip·category-chip·product-card·tag·notice)]
- [Source: ux-designs/…/DESIGN.md#Layout-&-Spacing#반응형 — 폭별 표, 카드 이미지 200~260px, 2단 3화면 비율·sticky 대상, 행 내부 560px, 2단 우측 테두리 상자 예외, 고지는 2단 아래 전체 폭]
- [Source: ux-designs/…/DESIGN.md#Components — 상품 카드·브랜드 라벨·옵션 축 칩·선택 결과 줄·카테고리 칩·태그·알림 문구 수치]
- [Source: ux-designs/…/EXPERIENCE.md#Component-Patterns — 카테고리 칩(하드코딩 금지)·상품 카드(품절도 탭 가능)·옵션 축 칩(조합 목록 나열 금지)]
- [Source: ux-designs/…/EXPERIENCE.md#State-Patterns — 상품 품절·옵션 조합 품절·선택 조합 확정·상품 전체 품절, 빈 상태·로딩 표]
- [Source: ux-designs/…/EXPERIENCE.md#법적-고지-배치-규칙 — "청약 전"이 규칙의 전부, 모달·별도 페이지·더보기 뒤 금지]
- [Source: ux-designs/…/EXPERIENCE.md#Responsive-&-Platform — 카테고리 칩 페이드는 <768만, ≥768 뒤로가기 없음·소속 최상위 활성, sticky는 짧은 칼럼]
- [Source: ux-designs/…/EXPERIENCE.md#Accessibility-Floor — 44×44 히트 영역, `aria-disabled` + `품절` 동시 낭독, 금액 낭독, 포커스 순서]
- [Source: ux-designs/…/.working/screens-1-browse.html — 390px 확정본: 칩 행·큐레이션 머리글·카드(높이 212/166/216…)·품절 카드·hero 330px·썸네일 52px·축 칩·`.pick` 선택 결과 줄·판매자 정보 상자·CTA 2버튼]
- [Source: ux-designs/…/.working/responsive-768-1280.html — 참고만. **카드 높이·2단 비율은 고치기 전 값이라 DESIGN.md가 이긴다**]
- [Source: architecture/architecture-SLUR_platform_blueprint-2026-07-15/ARCHITECTURE-SPINE.md#AD-1 — FastAPI가 유일한 문지기]
- [Source: …#AD-10 — 구매 가능 단일 술어(`check_purchasable`), 클라이언트 재판단 금지]
- [Source: …#AD-12 — 파생 값은 백엔드 계산(`final_price`·`price_from`·배송비)]
- [Source: …#AD-14 — 클라이언트 표면 단일화, 하나의 Next.js 앱, 동일 BFF 경로, DESIGN/EXPERIENCE가 목업을 이긴다]
- [Source: implementation-artifacts/8-1-buyer-web-shell.md — D1~D6(토큰 스코프·라우트 그룹·포커스 링·반응형 유틸리티·타이포 역할 클래스), 셸 컴포넌트 API, 미실행 검증의 기록 규약]
- [Source: implementation-artifacts/3-5-buyer-product-browse.md — 공개 API 3종의 원 설계, 대표가 정의, 명시 이월(페이지네이션)]
- [Source: implementation-artifacts/6-2-seller-info-disclosure.md — `seller_info` 공개 근거, 고지 문구 단일 소스, 빈 값이면 상자 숨김 패치]
- [Source: implementation-artifacts/deferred-work.md — 사업자 실정보 교체(오픈 게이트), AD-13 `999` 리터럴이 웹 상세·장바구니에 재현될 예정]
- [Source: apps/api/app/products/router.py · schemas.py · service.py — 응답 필드·페이지네이션·정렬·`sold_out` 정의 (읽기만)]
- [Source: apps/api/app/core/errors.py — 에러 봉투 `{code, message, details}`와 상태별 기본 code]
- [Source: apps/web/lib/auth.ts — `API_BASE`, `proxyWithRefresh`의 401 시 `clearSessionCookies` 부작용]
- [Source: apps/web/app/api/sellers/products/route.ts — BFF Route Handler 관례(uuid 검증·봉투 그대로 전달)]
- [Source: apps/web/app/(console)/seller/orders/page.tsx:411 · admin/orders/page.tsx:217 — `useSearchParams` + Suspense 선례]
- [Source: apps/web/app/(console)/admin/orders/[id]/page.tsx:102 — `useParams<{id:string}>()` 선례]
- [Source: apps/web/AGENTS.md — Next 16은 학습 데이터와 다르다. `node_modules/next/dist/docs/`를 먼저 읽는다]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Claude Code)

### Debug Log References

스크래치패드 전용 도구 2개 — **저장소에 커밋하지 않았고 확인 후 프로세스를 전부 종료했다.**

| 도구 | 하는 일 |
|---|---|
| `stub-api.mjs` | 공개 GET 3개만 흉내 내는 Node 스텁(포트 8787). 응답 스키마는 `apps/api/app/products/schemas.py` 그대로. 상품 25개(품절 2·이미지 null 1)·카테고리 8개(빈 카테고리 1)·2축 일부 품절/전 조합 품절/옵션 없음/이미지 1장/이미지 0장 상세. `STUB_DOWN=1`·`STUB_CATEGORIES_DOWN=1`로 실패 경로 재현 |
| `drive.mjs` | 최소 CDP 드라이버(Node 22 내장 WebSocket). 클릭·Tab·폭 변경·computed style 조회. 헤드리스 크롬이 스크린샷만으로는 못 보는 상호작용(칩 클릭·`더 보기`·리사이즈·포커스 링)을 확인하는 데 썼다 |

로컬 웹은 `API_BASE_URL=http://localhost:8787 npx next dev`로 띄웠다 — **환경변수를 새로 만들지 않았고**(D1) 저장소 설정도 바꾸지 않았다.

### Completion Notes List

**Task 1~11 전부 구현·검증 완료.** 미실행 1건은 아래 "미실행" 절에 따로 적었다.

#### 데이터 확보 (Task 10) — 3번 경로를 썼다

프로덕션 API의 호스트가 저장소에 없고(서버 전용 환경변수), 이 스토리가 요구하는 데이터(2축 일부 품절·전 조합 품절·이미지 0장·21개 이상)를 프로덕션에서 만들려면 쓰기가 필요하다. 그래서 **스크래치패드 스텁**(경로 3)으로 확인했다. **아래 화면 확인 결과는 전부 스텁 데이터 기준이다** — 응답 스키마·필드 의미·정렬은 `schemas.py`·`service.py`를 읽어 그대로 맞췄지만, 실서버 응답으로 다시 확인하는 것은 프로덕션 배포 후에 한 번 해야 한다.

#### 폭별 렌더 (390 / 700 / 768 / 1280)

390·1280은 CDP `Emulation.setDeviceMetricsOverride`로 강제했다 — 헤드리스 크롬의 500px 최소 폭 제약(8.1의 학습)을 우회한다. 700·768은 `--window-size`로 캡처했다.

| 폭 | 확인 결과 |
|---|---|
| **390** | 그리드 `168px 168px`(2열) · 여백 20px · 탭바 `flex` · 상단 내비 `none`. 상세: 하단 고정 CTA 바, 판매자 정보·중개자 고지가 그 **위**에 |
| **700** | 3열 · 여백 20px · 탭바 유지 · 카드 이미지 160~216px 세트 |
| **768** | 3열 · 여백 32px · 탭바 사라지고 상단 내비 등장 · 카드 이미지 200~260px 세트 |
| **1280** | 본문 1080px 가운데 정렬 · 칩 행도 같은 축(`.b_container` 동반) · 상세 2단 `492px 492px`(50/50) · 좌측 `position: sticky; top: 74px`(54+20) · 하단 고정 바 `none`, 정보 칼럼 안 CTA `flex` |

- 카드 이미지 높이는 `nth-child(6n+k)` 6단계 — <768 `212/168/200/176/216/160`, ≥768 `250/208/238/220/260/200`. 전부 규정 범위 안이며 `object-fit: cover`다.
- `main_image_url: null` 상품은 같은 높이의 종이 그늘 면으로 자리를 지킨다(레이아웃 무너짐 없음).

#### 폭 변경 시 상태 유지 (AC 11) — 결정적으로 확인됨

390에서 `먹`·`240ml` 선택 + 4번째 썸네일 선택 + 판매자 정보 접기 → **1280 → 다시 390**으로 두 번 바꾼 뒤 세 상태가 모두 그대로였다(`sel:["먹","240ml"], thumb:3, open:false`). 같은 시점에 CTA 바/인라인의 `display`와 미디어 칼럼의 `position`만 바뀌었다 — `matchMedia`·`innerWidth`·`resize` 사용 0건이며 CSS만으로 배치가 바뀐다.

#### 옵션 축 판정 (D6) — 목업 주석 시나리오 그대로 재현

| 조작 | 결과 |
|---|---|
| 진입 | `먹`·`320ml`에 `일부 품절`(전역 판정) · 결과 줄 `옵션을 선택해 주세요.` · CTA 4개(두 사본) 전부 비활성 |
| `살구` → `240ml` | 결과 줄 `선택 · 살구 / 240ml · 구매 가능` · CTA 활성 · `?variant=…501` |
| `먹` 클릭(기준축 = 색상) | **용량 축 `320ml`이 `품절[aria-disabled]`로 비활성** · `먹`은 선택 표시를 유지한 채 `일부 품절`(전역 판정 — 막다른 골목 없음) · 결과 줄 `먹 / 240ml · 구매 가능` · `?variant=…503` |
| `?variant=…504`(먹/320ml, 품절)로 진입 | 두 칩 선택 표시 유지 · 결과 줄 우측 `품절` · **CTA 두 개 모두 비활성** · 가격은 그 조합의 `36,000원` |

- 비활성 칩은 `disabled`가 아니라 `aria-disabled="true"`다 — **Tab 이동에서 포커스를 받고 `품절`이 이름과 함께 읽힌다**(전 조합 품절 상품에서 확인: `낮은 것품절[aria-dis] > 높은 것품절[aria-dis]`).
- 축이 0개인 상품: 축 UI 없음 + 조합 자동 선택 → CTA 활성, 가격 `142,000원`(접미어 없음).
- 전 조합 품절: 두 칩 비활성 + `현재 구매할 수 있는 옵션이 없습니다.` + CTA 비활성.
- 가격 표기(D7): 조합 미특정 + 조합 가격이 갈리면 `32,000원부터`, 조합 특정 시 그 조합의 `final_price`. 조합 가격이 하나뿐이면 접미어 없음. **클라이언트가 `base + extra`를 더한 곳은 0건이다.**

#### `더 보기` (D5)

상품 25개 / 서버 페이지 크기 20 → 첫 화면 카드 20개 + `더 보기`. 클릭 후 **카드 25개, 버튼 사라짐**(`누적 25 >= total 25`). 스크롤 관찰자·자동 로드 0건. 카테고리를 바꾸면 누적이 초기화된다(`가구` 선택 시 4개).

#### 카테고리 칩

- 응답 순서 그대로 + 맨 앞 `전체`(`전체|테이블웨어|가구|조명|리빙 소품|패브릭|문구|주방|빈 카테고리`). 이름·순서·개수 하드코딩 0건.
- 칩 클릭 → `?category=<uuid>` 반영, 목록 즉시 교체, **`history.length` 불변**(`replace`).
- `?category=<없는 uuid>` · `?category=not-a-uuid&junk=1` → 둘 다 **조용히 `전체`로 복귀 + 쿼리 정리**. 상세에서 뒤로 와도 선택 카테고리가 보존된다(URL이 저장소).
- < 768에서만 우측 34px 페이드, ≥ 768에서는 `display: none`.
- **카테고리 조회만 실패**(`STUB_CATEGORIES_DOWN=1`): 칩 행 0개, 상품 카드 20개 정상 — 목록을 오류 화면으로 덮지 않는다.

#### 실패 경로 (Task 11)

| 상황 | 화면 |
|---|---|
| 없는 상품 id | 셸 유지 + `상품을 찾을 수 없습니다.` + `상품목록으로` |
| `/products/abc`(형식 오류) | 같은 화면 — BFF가 상류를 부르지 않고 404 `not_found` 봉투로 통일 |
| 상류 전면 중단 | 목록·상세 모두 `일시적인 오류입니다.` + `다시 시도` |
| 문서 전체 스캔 | `/[0-9]{3}|not_found|service_unavailable|http_error|validation_error/` **0건** — HTTP 코드·code 문자열이 화면에 없다 |

봉투 없는 실패(브라우저 ↔ BFF 네트워크 단절 → `연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요.`)는 **코드 경로만 확인했고 재현하지 못했다** — 상류가 죽어도 BFF가 봉투를 만들어 주기 때문이다(`proxyPublic`의 fetch throw → 503 봉투).

#### 접근성 · 색

- 포커스 링: `outline: rgb(31,29,26) 2px solid`, `box-shadow: none` — 먹색이며 8.1과 같다.
- 구매자 문서 전체 computed style 스캔: **파랑 `rgb(47,107,255)` 0건, `box-shadow` 0건.**
- Tab 순서(상세, <768): `뒤로가기 → 장바구니 → 썸네일 5 → 옵션 칩 5 → 판매자 정보 → 장바구니 담기 → 바로 구매`. **하단 고정 바가 콘텐츠보다 먼저 걸리지 않는다**(UX-DR6). CTA는 보이는 사본 하나만 접근성 트리에 있어 **두 번 낭독되지 않는다**(`display:none`이 다른 사본을 뺀다).
- 카드 이미지 `alt` = 상품명, 상세 hero `alt` = 상품명, 썸네일 `alt` = `유광 도자 머그 이미지 3` — 빈 `alt` 0건(D12). 썸네일 버튼의 접근 가능한 이름도 이 `alt`에서 나온다.
- 칩·옵션 칩은 시각 크기를 목업대로 두고 `::before` 오버레이로 히트 영역만 44px로 넓혔다.

#### 역할 분기 없음 (AC 1)

`slur_role` 쿠키를 읽는 코드가 이 스토리 산출물에 0건이다(주석 언급 1곳뿐). `slur_role=admin`·`seller` 쿠키를 실어 `/`를 요청해도 **200 · 같은 구매자 셸**이 나온다. `/`·`/products/*`는 미들웨어 matcher에 없어 미들웨어가 아예 실행되지 않는다.

#### 정적 검증

| 항목 | 결과 |
|---|---|
| `npx tsc --noEmit` | **0** |
| `npm run lint` | **0 errors · 0 warnings** (A-E456-5 베이스라인 유지) |
| `npx next build` | **성공** — 41 라우트. 신규는 `/products/[id]`·`/api/products`·`/api/products/[id]`·`/api/products/categories` 4개뿐이고 **기존 URL 변경 0건** |
| `grep #2f6bff\|--color-brand\|--shadow-\|box-shadow` in `(buyer)` | 실제 선언 **0건**(주석 2줄만 매치) |
| `git diff --stat` | `apps/api` **0건** · `apps/mobile` **0건** · `app/styles/slur/**` **0건** · `app/styles/buyer/**` **0건** · `package.json`·`package-lock.json` **0건** · `lib/auth.ts` **0건** |

#### 구현 중 내린 작은 판단 (D1~D14 밖, 근거를 남긴다)

1. **카테고리 조회를 `category-chips.tsx`가 아니라 `product-list.tsx`가 한다.** URL의 `?category`가 응답에 없는 값일 때 "조용히 정리하고 재조회"하는 판정과 목록 적재가 한 곳에 있어야 순서가 흔들리지 않는다. 칩 컴포넌트는 순수 표현으로 남고, 조회 실패 시 목록 본체가 아예 렌더하지 않는다(= 칩 행만 사라진다).
2. **칩 행에 `.b_container`를 함께 건다.** 없으면 ≥768에서 칩만 화면 왼쪽 끝에서 시작해 본문(1080px 가운데 정렬)과 축이 어긋난다 — 1280 캡처에서 발견해 고쳤다.
3. **로딩을 상태로 두지 않고 파생한다.** `react-hooks/set-state-in-effect`(Next 16 lint 기본값)가 effect 본문의 동기 `setState`를 **error**로 잡는다. `loading` 플래그 대신 `적재 스냅샷.key !== 지금 카테고리`(목록) · `결과 === null`(상세)로 파생해 effect 안 setState를 전부 `await` 뒤로 옮겼다. **베이스라인 0을 지키기 위한 형태 변경이며 동작은 같다.**
4. **판매자 정보 상자에 `max-width: calc(--b-row-max + 26px)`.** 행은 `.b_row`가 560px로 잡지만 상자가 1000px 칼럼 전체를 덮으면 좌측 560px만 채워진 빈 상자가 남는다. 값은 기존 토큰 + 상자 좌우 패딩(13×2)에서 나온 것이고 새 스케일이 아니다.
5. **선택 결과 줄과 옵션 서브라벨에 새 타이포를 만들지 않았다.** `선택`=`.b_section_label`, 조합=`.b_product_name_row`, 상태=`.b_status_label.m_waiting|.m_finished`, 서브라벨=`.b_tag`. AC 13의 "새 px 스케일 금지"를 지키면서 DESIGN.md 수치와 1~2px 안에서 일치한다.
6. **`전체` 칩과 `더 보기`의 문구·자리는 목업 그대로**이고, 목록 끝 문구는 두지 않았다(주문내역 전용, D5).

#### 미실행 (통과했다고 쓰지 않는다)

- **`cd apps/api && uv run pytest -q` — 미실행.** 이 머신의 PATH에 `uv`도 `docker`도 없다(pytest는 docker compose로 띄운 로컬 Postgres를 요구한다). **이 스토리는 `apps/api`를 한 파일도 열지 않았고 `git diff --stat`에 `apps/api` 0건**이므로 153건에 영향을 줄 경로가 없다. 실행 환경이 있는 곳에서 한 번 확인해 주기 바란다. (Task 9의 유일한 미체크 항목이다.)
- **프로덕션 실데이터 렌더 확인 — 미실행.** 위 "데이터 확보" 참조. 배포 후 8.1 Task 11의 프로덕션 재확인과 함께 한 번에 하면 된다.

#### 사람이 판단할 것 (스토리가 이미 위험으로 올려 둔 것)

- **위험 3 — 중개자 고지 문장이 둘이다.** D10대로 `BROKER_NOTICE` 상수를 정본으로 삼아 렌더했다(화면에 문장을 복제하지 않았다). 어느 문장이 법적 정본인지는 실사업자 정보 교체와 함께 결정될 사안이다.
- **`…원부터` 접미어**(D7)와 **배송비 문장**(D11), **`옵션을 선택해 주세요.`·`아직 등록된 상품이 없습니다.`**는 스파인 Voice·Tone 표에 없는 `[ASSUMPTION]` 문구다 — Slur 확인 항목.
- **`바로 구매`의 목적지 미정**(위험 2). 버튼은 놓았고 클릭 핸들러 자리에 `TODO(8.4)`로 호출 대상·401 복귀 규칙을 적어 두었다. 8.3은 담기 API를 부르지 않고 로그인 여부도 판정하지 않는다.

### File List

**신설 (13)**

```
apps/web/lib/public-api.ts                              공개 GET 프록시 (D2)
apps/web/app/api/products/route.ts                      BFF 목록 (category·page 화이트리스트)
apps/web/app/api/products/categories/route.ts           BFF 카테고리
apps/web/app/api/products/[id]/route.ts                 BFF 상세 (uuid 아니면 404 not_found)
apps/web/app/(buyer)/format.ts                          formatWon (D13)
apps/web/app/(buyer)/buyer-feedback.tsx                 골격·빈 상태·오류 + getPublicJson (8.4~8.7 공용)
apps/web/app/(buyer)/category-chips.tsx                 카테고리 칩 행
apps/web/app/(buyer)/product-card.tsx                   상품 카드 + ProductItem 타입
apps/web/app/(buyer)/product-list.tsx                   목록 본체 ("use client")
apps/web/app/(buyer)/option-axes.tsx                    축 칩 + 선택 결과 줄 (D6)
apps/web/app/(buyer)/seller-info.tsx                    6항목 + BrokerNotice (8.5가 고지만 재사용)
apps/web/app/(buyer)/products/[id]/page.tsx             상세 셸 + Suspense
apps/web/app/(buyer)/products/[id]/product-detail.tsx   상세 본체 ("use client")
apps/web/app/(buyer)/browse.css                         목록·상세 전용 스타일
```

**수정 (3)**

```
apps/web/app/(buyer)/page.tsx           자리표시 6개 → 셸 + Suspense + ProductList (통째로 대체)
apps/web/app/(buyer)/buyer.css          .b_ph·.b_placeholder·nth-child 6줄 제거(.b_stub 유지) + 피드백 3종 스타일 추가
apps/web/app/(buyer)/buyer-topbar.tsx   D14-1 두 조건만 (제목 없으면 미렌더 / showCart면 i_spacer 미렌더)
```

**수정하지 않음(확인)**: `apps/api/**` · `apps/mobile/**` · `app/styles/slur/**` · `app/styles/buyer/**` · `lib/auth.ts` · `lib/nav.ts` · `app/config/company.ts` · `middleware.ts` · `package.json` · `package-lock.json` · `(console)/**`

### Change Log

| 날짜 | 변경 | 비고 |
|---|---|---|
| 2026-07-22 | 스토리 작성 (D1~D14, Task 1~11) | baseline `5d60203` |
| 2026-07-22 | 구현 — BFF 3 + 공개 프록시, 목록(칩·카드·`더 보기`), 상세(갤러리·축 칩·선택 결과 줄·판매자 정보·CTA 2자리), 피드백 3종, 셸 최소 수정 2곳 | tsc 0 · lint 0/0 · build 성공 · `apps/api` diff 0건 |
| 2026-07-22 | 검증 — 390/700/768/1280 렌더, 폭 변경 상태 유지, D6 판정 시나리오, `더 보기` 누적, 실패 경로 5종, 포커스·파랑·그림자 스캔 | 스텁 데이터 기준 (프로덕션 실데이터 재확인은 배포 후) |
</content>
</invoke>
