---
baseline_commit: 10a2c4a6d0c8e4be60575ad6c9d6a4f2984e79b6
---

# Story 8.4: 장바구니 (구매자 반응형 웹)

Status: done

> **선행 조건.** 이 스토리는 **8.2(로그인·`next` 복귀)와 8.3(상품상세·CTA 자리)이 끝난 뒤** 착수한다.
> 8.3이 만드는 `products/[id]/product-detail.tsx`·`buyer-feedback.tsx`·`format.ts`·하단 고정 CTA 바 CSS가
> 이 스토리의 입력이고, 8.2가 만드는 `/login?next=` 복귀와 `assertSameOrigin`이 담기 경로의 전제다.
> 순서를 바꿔 착수하면 8.4가 그 셋을 대신 만들게 되고 경계가 무너진다.

## Story

As a 구매자,
I want 여러 판매자의 물건을 한 장바구니에서 정리하는 것,
So that 배송비가 왜 따로 붙는지 알고 한 번에 주문할 수 있다.

## Acceptance Criteria

1. **Given** 로그인 상태의 `/cart` **When** 조회 **Then** 8.1이 둔 자리표시(`b_stub`)가 **한 줄도 남지 않고**, `GET /api/v1/carts`의 항목이 **판매자 묶음별로** 그룹되어 표시된다 (FR-14, UX-DR13)
   - **And** 묶음 헤더는 좌측 체크박스 + 브랜드 라벨(`<BrandLabel size="pack">`, 10.5px/`.14em`) + 우측 상태 슬롯이다
   - **And** 항목 행은 사진 74px → 상품명(13px/600) → 옵션 텍스트(11.5px `--b-ink-label`) → 행 금액(14px/800) → 수량 스테퍼 ↔ `삭제` 순서로 놓인다
   - **And** 옵션이 없는 조합(`option_text`가 빈 문자열)은 옵션 줄에 `—`를 놓아 행 높이가 흔들리지 않게 한다
   - **And** 상단바는 `title`(좌측 정렬 `장바구니`, **뒤로가기 없음**), 탭바는 `장바구니` 활성이다 — 8.1 셸 호출부(`tab="cart" showTabbar`)를 바꾸지 않는다

2. **Given** 응답 `items` **When** 묶음을 만든다 **Then** 묶음 키는 `brand_name`이고, 묶음 순서·묶음 안 항목 순서는 **응답이 내려온 순서 그대로**다 (서버 정렬 `created_at DESC, id DESC` — 클라이언트가 재정렬하지 않는다)
   - **And** `variant_id`가 `null`인 항목(판매 종료 — `brand_name`이 빈 문자열이고 `product_name`이 `판매 종료된 상품`)은 **`판매 종료` 라는 이름의 묶음 하나**로 모으고, 그 묶음은 항상 구매 불가 표기다
   - **And** 이미지가 없는 항목(`image_url: null`)은 같은 크기의 종이 그늘 면으로 자리를 지킨다

3. **Given** 금액 요약 **When** 렌더 **Then** 행 순서가 **상품 금액 · 배송비 · 도서산간 추가 · 합계**로 고정되고, 도서산간 추가 줄은 어떤 경우에도 사라지지 않는다 (UX-DR13)
   - **And** `상품 금액`과 합계 값은 응답의 `purchasable_total` **하나에서만** 온다 — 클라이언트가 행 금액을 더해 합계를 만들지 않는다 (AD-12)
   - **And** 배송비·도서산간 추가는 **숫자를 내지 않고** `주문서에서 확인`으로 표시된다 — 공개·장바구니 응답 어디에도 판매자 배송비가 없고, 배송지 없이는 도서산간 판정이 성립하지 않는다 (D2, 위험 1)
   - **And** 합계 행 라벨은 `상품 금액 합계`이며 값은 21px/800 액센트다. **목업의 `결제 예정 금액`을 쓰지 않는다** — 배송비가 빠진 값에 그 이름을 붙이면 거짓말이 된다
   - **And** 요약 아래 한 줄: `배송비는 판매자마다 다르며 배송지를 입력하면 주문서에서 확정됩니다.` `[ASSUMPTION]`
   - **And** 묶음 헤더의 배송비 자리에도 금액을 쓰지 않는다 (같은 이유)

4. **Given** 상품 행의 수량 스테퍼 **When** `−`·`+`를 누름 **Then** 화면의 수량과 그 행의 금액이 **즉시** 바뀌고 `PATCH /api/v1/carts/items/{id}`가 호출된다 (FR-35)
   - **And** 수량 1에서 `−`는 `disabled`다 — 삭제와 구분한다
   - **And** 수량 999에서 `+`는 `disabled`다 (서버 계약 `1~999`와 대칭)
   - **And** 요청이 도는 동안 **그 행의** 스테퍼·`삭제`가 비활성이고 다른 행은 계속 조작할 수 있다
   - **And** 성공하면 `GET /api/v1/carts`를 조용히 다시 불러 합계·구매 가능 여부를 서버 값으로 갈아끼운다 — 화면이 skeleton으로 되돌아가거나 스크롤이 튀지 않는다
   - **And** 실패하면 **직전 수량으로 되돌리고** 그 행 아래에 응답 `message` 한 줄 + `새로고침` 버튼을 놓는다. **실패 시에는 재조회하지 않는다** — 자동 재조회가 오류 문장을 덮어쓰는 것이 Flutter판의 부채였다 (D6, 앞선 학습)
   - **And** 스테퍼 버튼과 `삭제`의 히트 영역은 시각 크기와 무관하게 44 × 44px 이상이다 (UX-DR7)

5. **Given** `삭제` **When** 누름 **Then** 그 행이 `삭제할까요?` + `삭제`·`취소` 인라인 확인 줄로 바뀌고, `삭제`를 다시 눌러야 `DELETE /api/v1/carts/items/{id}`가 실행된다 (UX-DR16 — 확인 후 실행)
   - **And** **모달·다이얼로그·`window.confirm`을 쓰지 않는다.** 확인 줄이 열리면 포커스가 `삭제` 버튼으로 옮겨가고, `Esc`·`취소`로 닫으면 원래 `삭제`로 돌아온다
   - **And** 스와이프 삭제를 만들지 않는다
   - **And** 삭제 성공 후 재조회한다. 마지막 항목이 지워지면 빈 장바구니 상태로 바뀐다

6. **Given** 담은 뒤 품절·숨김·삭제된 항목 **When** 장바구니 조회 **Then** **응답의 `purchasable`을 그대로** 표시에 쓴다 — 클라이언트가 재고·상태를 보고 자체 판단하지 않는다 (AD-10, FR-35)
   - **And** 구매 불가 **항목 행**은 사진 `grayscale(.85) brightness(1.06)`, 글자 `--b-ink-unavailable`, 금액 취소선, 스테퍼 비활성으로 표시된다 — 숨기지 않는다 (UX-DR8)
   - **And** 묶음의 항목이 **전부** 구매 불가일 때만 헤더에 `구매 불가 · 품절` 태그(9.5px/700/`.09em`, `--b-accent-soft` 면 + 액센트 글자)와 묶음 하단 안내 상자(`--b-accent-wash` 면, `담은 뒤 품절된 상품입니다. 주문에서 제외됩니다.`)가 붙는다 (D4)
   - **And** 한 묶음에 가능·불가가 섞여 있으면 헤더 태그를 붙이지 않고 **행 단위로만** 표기한다 — 살 수 있는 물건이 있는 묶음을 통째로 죽은 것처럼 그리지 않는다
   - **And** 구매 불가 항목은 합계(`purchasable_total`)와 `주문하기 (N건)`에서 제외된다 — 제외는 서버가 이미 했고 화면은 그 결과를 표시한다
   - **And** `삭제`는 구매 불가 항목에서도 계속 동작한다 — 지워지지도, 몰래 결제되지도 않는다

7. **Given** 묶음 헤더의 체크박스 **When** 렌더 **Then** 구매 가능 항목이 하나라도 있는 묶음은 **체크됨**, 전부 구매 불가인 묶음은 **해제됨**으로 표시되고, **둘 다 조작할 수 없다**(`disabled`) — v1의 체크박스는 "이 묶음이 주문에 들어가는가"를 알리는 **상태 표시**이지 선택 수단이 아니다 (D3, 위험 2)
   - **And** 각 체크박스에 `aria-label`로 상태를 준다(`주문에 포함` / `구매 불가 — 주문에서 제외`) — 색과 모양에만 의존하지 않는다 (UX-DR8)
   - **And** "선택 해제해서 일부만 주문하기"를 만들지 않는다 — `POST /api/v1/orders/preview`가 장바구니 전체를 전제하므로(항목 선택 파라미터가 없다) 부분 선택은 주문서 금액과 어긋난다

8. **Given** 탭바·상단 내비의 장바구니 배지와 CTA **When** 구매 불가 항목이 섞여 있음 **Then** 배지는 **`items.length`**(담긴 항목 수 전체, 구매 불가 포함)를, CTA `주문하기 (N건)`의 N은 **`items.filter(purchasable).length`**(주문 가능 항목만)를 센다 (UX-DR13)
   - **And** 둘 다 **수량의 합이 아니라 행의 수**다 — 머그 2개 + 테이블보 1개는 `2건`이다 (EXPERIENCE.md Flow 1·2가 이 셈을 쓴다)
   - **And** 두 숫자가 다른 것은 정상이며, 화면 어디에도 "왜 다른가"를 설명하는 장치를 두지 않는다 — 구매 불가 묶음의 태그와 안내 문장이 이미 답한다
   - **And** 주문 가능 항목이 0건이면 `주문하기 (0건)` 버튼이 `disabled`다

9. **Given** 장바구니 배지 값 **When** 구매자 라우트를 이동 **Then** 8.1이 만든 배지 슬롯이 실제 개수로 채워진다 — 값은 `(buyer)` 레이아웃의 컨텍스트 하나가 소유하고, 장바구니 응답을 받은 곳이 밀어 넣는다 (D5)
   - **And** 비로그인 상태에서는 배지를 그리지 않는다 — 개수 조회는 역할 힌트 쿠키(`slur_role`)가 있을 때만 시도하고, 401을 받으면 조용히 배지를 지운다. **여기서 `/login`으로 보내지 않는다** (배지는 UX 장식이지 보호 동작이 아니다)
   - **And** 담기·수량 변경·삭제 성공 후 배지가 갱신된다 — 페이지 새로고침을 요구하지 않는다
   - **And** 새 npm 의존성을 추가하지 않는다 (`package.json` diff 0건)

10. **Given** 상품상세의 `장바구니 담기` **When** 로그인 상태에서 누름 **Then** `POST /api/v1/carts/items {variant_id, quantity: 1}`이 호출되고, 성공하면 CTA 아래에 `장바구니에 담았습니다.` + `장바구니 보기` 링크가 표시되며 배지가 늘어난다 (FR-14)
    - **And** 제출 중에는 버튼이 비활성이고 중복 제출이 차단된다 (UX-DR9)
    - **And** 담기 수량은 항상 1이다 — 상품상세에 수량 스테퍼를 만들지 않는다(목업·DESIGN.md에 없다). 수량 조정은 장바구니가 소유한다 `[ASSUMPTION]`
    - **And** 같은 조합을 다시 담으면 **서버가 수량을 합산**한다(999 캡). 화면은 응답 결과만 반영하고 합산을 흉내 내지 않는다
    - **And** 토스트·모달·스낵바를 만들지 않는다 — 표시는 CTA 근처의 인라인 한 줄이다

11. **Given** 비로그인 상태로 `장바구니 담기` **When** 누름 **Then** 401 응답을 받고 `/login?next=<현재 pathname + search + &add=1>`로 이동한다 — 쿠키를 읽어 미리 판정하지 않는다 (AD-1, R7)
    - **And** 로그인 후 복귀하면 8.3이 URL에 남긴 `?variant=`로 조합이 복원된 상태에서 **담기가 자동으로 한 번 실행되고**, 실행 직후 `add` 파라미터를 `replace`로 지운다 — 새로고침·뒤로가기로 같은 담기가 반복되지 않는다 (D8, UX-DR11)
    - **And** 복귀 시점에 `variant`가 없거나 그 조합이 구매 불가면 자동 실행하지 않고 버튼만 그대로 둔다
    - **And** `next` 값은 자체 경로만 실린다 — 8.2가 세운 검증을 우회하는 경로를 새로 만들지 않는다

12. **Given** 상품상세의 `바로 구매` **When** 누름 **Then** 담기를 먼저 실행하고 성공 시 **`/cart`로 이동**한다 — `/checkout` 직행을 만들지 않는다 (D9, 위험 3)
    - **And** 이 동작이 "이 상품만 주문한다"가 아님을 화면이 오해시키지 않는다 — 장바구니가 무엇이 주문에 들어가는지 보여주는 자리다
    - **And** 비로그인이면 `장바구니 담기`와 같은 복귀 경로를 탄다(`&add=1`) — 복귀 후에는 담기까지만 하고 `/cart`로 보내지 않는다 `[ASSUMPTION]`

13. **Given** 빈 장바구니 **When** 조회 **Then** `장바구니가 비어 있습니다.` + `쇼핑 계속하기`(→ `/`) 가 표시되고, 금액 요약과 하단 고정 CTA 바가 **사라진다** (UX-DR9)
    - **And** 탭바는 그대로 서 있다(최상위 화면이므로)

14. **Given** 폭에 따른 배치 **When** < 768 / ≥ 768로 렌더 **Then** < 768은 하단 고정 CTA 바(`주문하기 (N건)`) + 탭바 **2단**이고(이 화면만의 예외), ≥ 768은 **좌 묶음 목록 62% / 우 금액 요약 34%** 2단이며 CTA가 우측 칼럼 안으로 승격되고 고정 바·탭바가 사라진다 (UX-DR3·4)
    - **And** < 768에서 본문 아래 여백이 `CTA 바 높이 + 탭바 높이`만큼 확보되어 마지막 묶음이 가려지지 않는다
    - **And** ≥ 768 우측 칼럼은 1px hairline 테두리 상자다 (DESIGN.md 반응형의 "2단 우측 칼럼에 한해 허용"되는 유일한 예외 — 그림자는 여전히 금지)
    - **And** **묶음이 하나뿐이면 sticky를 걸지 않는다** (UX-DR4)
    - **And** 폭을 390 ↔ 1280으로 바꿔도 화면이 다시 마운트되지 않고 상태(열린 삭제 확인 줄·진행 중 요청·오류 문장)가 초기화되지 않는다 — `matchMedia`·`innerWidth`·`resize` 사용 0건, CSS로만 배치를 바꾼다 (AD-14)
    - **And** 하단 고정 바는 DOM 순서상 콘텐츠 뒤다 (UX-DR6)

15. **Given** 로딩·오류·세션 만료 **When** 각 상황 **Then**
    - 최초 로딩: **묶음 골격(skeleton)** — 화면 중앙 스피너를 쓰지 않는다 (UX-DR9)
    - 조회 실패: 응답 `message` + `다시 시도` 버튼
    - 봉투 없는 실패(네트워크 예외): `연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요.`
    - `GET /carts`가 401: `/login?next=%2Fcart`로 `replace` — 미들웨어 통과는 인증이 아니다(`slur_role` 14일 > `slur_access` 30분, AD-1)
    - **And** HTTP 상태 코드와 에러 `code` 문자열이 화면 어디에도 나타나지 않는다 (분기는 `code`, 표시는 `message`)

16. **Given** 이 스토리의 모든 CSS **When** 작성 **Then** 8.1의 `--b-*` 토큰과 `.b_*` 타이포 역할 클래스만 쓴다 — **새 hex·새 px 스케일을 만들지 않는다** (UX-DR1)
    - **And** 구매자 파일에 `#2f6bff`·`--color-brand`·`--shadow-`·`box-shadow` 선언이 0건이다 (UX-DR12)
    - **And** `app/styles/slur/**`을 수정하지 않는다. `app/styles/buyer/**`도 수정하지 않는다 — 새 토큰이 필요하면 스토리에 근거를 적고 추가한다(무단 추가 금지)
    - **And** 판매자·관리자 화면의 색·레이아웃·포커스 링이 한 픽셀도 바뀌지 않는다

17. **Given** 이 스토리 전체 **When** 완료 **Then** 백엔드가 변경되지 않는다 — `git diff --stat`에 `apps/api` **0건**, 마이그레이션 0건, 신규 엔드포인트 0개. 소비하는 API는 기존 4개(`GET /carts` · `POST /carts/items` · `PATCH /carts/items/{id}` · `DELETE /carts/items/{id}`)뿐이다

18. **Given** 검증 **When** 실행 **Then** `npx tsc --noEmit` 0 · `npm run lint` **0 errors · 0 warnings**(A-E456-5 베이스라인) · `npx next build` 성공이 유지되고, 390/700/768/1280 네 폭에서 장바구니를 실제로 렌더한 결과가 스토리에 기록된다
    - **And** `apps/web`에 테스트 프레임워크를 도입하지 않는다 — 의존성 추가 0건

## 설계 판단 (이 스토리에서 확정 — 근거를 남긴다)

### D1 — 판매자 묶음은 **`brand_name`으로 만든다** (응답에 `seller_id`가 없다)

**결정.** `GET /carts`의 `items`를 등장 순서대로 훑으며 `brand_name`을 키로 묶는다. 처음 등장한 순서가 묶음 순서다.

```
items(created_at DESC) → [토림도예: [머그], 곳간: [촛대], 온실: [테이블보]]
```

**근거.**
- **`CartItemResponse`에 `seller_id`가 없다.** 있는 것은 `brand_name` 문자열뿐이다(`apps/api/app/carts/schemas.py`). 주문서 미리보기(`PreviewSellerGroup`)에는 `seller_id`가 있지만 그 응답은 배송지 우편번호를 요구하고 구매 불가 항목을 아예 빼버리므로 장바구니의 묶음 소스가 될 수 없다.
- 응답 순서를 그대로 쓰면 **장바구니 화면 순서 = 주문서 순서 = 주문 스냅샷 순서**가 유지된다(`get_purchasable_entries`가 `get_cart`와 같은 정렬을 쓴다고 주석에 못 박혀 있다). 클라이언트가 브랜드명 가나다순 따위로 재정렬하면 그 대응이 깨진다.
- **`variant_id`가 `null`인 항목**은 `brand_name`이 빈 문자열이므로 자연스럽게 한 묶음으로 모인다. 이 묶음의 표시명만 `판매 종료`로 바꾼다 — 빈 브랜드 라벨을 그리면 헤더가 비어 보인다.

⚠️ **알려진 한계.** `sellers.brand_name`에 UNIQUE 제약이 없다(`apps/api/app/sellers/models.py`). 서로 다른 두 판매자가 같은 브랜드명을 쓰면 한 묶음으로 합쳐지고, 배송비가 둘인데 하나처럼 보인다. 현재 판매자는 운영자가 직접 초청·승인하므로(큐레이션형) 실무상 발생 가능성이 낮다고 보고 v1에서 수용한다. **백엔드에 `seller_id`를 한 필드 추가하면 근본 해소되지만 Epic 8의 경계(응답 필드 추가 금지) 밖**이다 — 위험 목록에 올린다.

### D2 — 장바구니는 **배송비 숫자를 내지 않는다** (금액 요약의 미확정 표시)

**결정.** 금액 요약의 네 행은 그대로 두되 값이 갈린다.

| 행 | 값 | 출처 |
|---|---|---|
| 상품 금액 | `118,000원` | `purchasable_total` |
| 배송비 | `주문서에서 확인` | — |
| 도서산간 추가 | `주문서에서 확인` | — |
| **상품 금액 합계** | `118,000원` (21px/800 액센트) | `purchasable_total` |

그 아래 한 줄: `배송비는 판매자마다 다르며 배송지를 입력하면 주문서에서 확정됩니다.` 묶음 헤더의 배송비 자리도 비운다.

**근거.**
- **어떤 API도 장바구니 시점에 배송비를 주지 않는다.** 판매자 배송비(`base_shipping_fee`·`jeju_extra_fee`·`island_extra_fee`)는 `PUT /sellers/me/shipping-fees`로 저장되지만 공개·장바구니 응답 어디에도 실리지 않는다. 유일한 계산 경로 `POST /orders/preview`는 **5자리 우편번호를 필수로 요구**하고(`OrderPreviewRequest.postal_code`) 장바구니 화면에는 주소 입력이 없다(DESIGN.md·목업에도 없다). v1에 배송지 주소록도 없다.
- 임의의 우편번호로 미리보기를 부르는 대안은 **틀린 금액을 청약 전에 보여주는 사고**다. 도서산간 구매자에게는 실제보다 싸게 나오고, `remote_area_kind` 판정이 통째로 거짓이 된다. AD-12(파생 값은 백엔드 계산)의 취지는 "백엔드에 물어보라"가 아니라 "지어내지 말라"다.
- 8.3이 상품상세에서 같은 문제를 D11로 처리했다(`배송비는 판매자마다 다르며 주문서에서 확인할 수 있습니다.`). **두 화면이 같은 규칙을 쓰는 편이 낫다** — 한 화면만 숫자를 내면 사용자는 어느 쪽이 진짜인지 모른다.
- 행 순서를 지키는 이유는 UX-DR13이다. 도서산간 줄은 "배송지에 따라 늘어날 자리가 있다"를 미리 보여주기 위해 존재하므로, 값이 미정일 때야말로 지우면 안 된다.
- 합계 라벨을 `결제 예정 금액`(목업)이 아니라 **`상품 금액 합계`** 로 바꾼 것이 이 결정의 핵심이다. 배송비가 빠진 값에 "결제 예정"이라는 이름을 붙이면 화면이 거짓말을 한다. 액센트 21px 총액이 화면당 한 번이라는 규칙(UX-DR13)은 유지된다.

`[ASSUMPTION]` 이 문구·라벨 세 개(`주문서에서 확인`, `상품 금액 합계`, 요약 아래 한 줄)는 스파인 Voice·Tone 표에 없다. **Slur 확인 항목.** 근본 해소는 백엔드가 (a) 장바구니 응답에 `seller_id` + 판매자 기본 배송비를 싣거나 (b) `preview`가 우편번호 없이 기본 배송비만 계산하는 모드를 갖는 것이며, 둘 다 Epic 8 경계 밖이다.

### D3 — 체크박스는 **조작이 아니라 상태 표시**다

**결정.** 묶음 헤더 체크박스는 `<input type="checkbox" disabled>`로 렌더한다. 구매 가능 항목이 하나라도 있으면 `checked`, 전부 불가면 해제. 사용자가 켜고 끌 수 없다.

**근거.**
- **`POST /orders/preview`에 항목 선택 파라미터가 없다.** `preview_order`는 `carts_service.get_purchasable_entries(user_id)`로 **장바구니의 구매 가능 항목 전체**를 계산한다. 반면 `POST /orders`는 `cart_item_ids`를 받는다. 즉 부분 선택으로 주문을 만들 수는 있지만 **그 부분 선택을 미리 볼 수는 없다.**
- 그래서 체크를 풀 수 있게 만들면: 주문서는 전체 금액을 보여주고(preview), 주문 생성은 부분 금액을 계산해(quote) `expected_grand_total`과 어긋나 **409 `price_changed`** 로 실패한다. 클라이언트가 부분 합계를 직접 계산해 우회하는 것은 AD-12 위반이자 배송비 재계산이라 불가능하다.
- 목업의 장바구니도 **가능한 묶음은 전부 체크된 상태**이고 구매 불가만 해제돼 있다. 에픽 AC 어디에도 "선택 해제"라는 동작이 없다 — AC가 요구하는 것은 "구매 불가 항목의 체크박스가 **해제·잠금**된다"뿐이며, 이 결정은 그 문장을 그대로 구현한 것이다.
- **기각한 대안**: (a) 체크박스를 아예 그리지 않는다 — 구매 불가 묶음의 꺼진 체크박스가 "이건 안 나간다"를 말하는 장치이므로 UX-DR8(색 + 텍스트 + 형태)을 약화시킨다. (b) 체크를 풀면 그 항목을 **삭제**한다 — 파괴적 동작을 체크박스에 숨기는 것은 UX-DR16 위반이다.
- `disabled` 요소는 탭 순서에서 빠지지만, 같은 정보를 `구매 불가 · 품절` 태그와 안내 문장이 **텍스트로** 전달하므로 낭독에서 사라지지 않는다. `aria-label`도 함께 준다.

**후속 조건.** 선택 주문이 필요해지면 `POST /orders/preview`가 `cart_item_ids`를 받도록 백엔드를 바꾸는 것이 선행이다. 8.5 착수 시 다시 확인한다.

### D4 — 구매 불가의 **진실 단위는 항목**, 묶음 표기는 전부 불가일 때만

**결정.**

| 무엇 | 조건 | 표기 |
|---|---|---|
| 항목 행 | `purchasable === false` | 사진 `grayscale(.85) brightness(1.06)`, 글자 `--b-ink-unavailable`, 금액 취소선(`--b-strike-line`), 스테퍼 비활성. `삭제`는 살아 있다 |
| 묶음 헤더 태그 · 하단 안내 상자 | 묶음의 **모든** 항목이 불가 | `구매 불가 · 품절` 태그 + `담은 뒤 품절된 상품입니다. 주문에서 제외됩니다.` |
| 묶음 체크박스 | 가능 항목 ≥ 1 | `checked` (disabled) |

**근거.**
- **`purchasable`은 항목별 값이다.** 한 판매자가 두 조합을 팔고 하나만 품절되는 상황은 흔하다. 그때 묶음 전체를 회색으로 칠하면 **살 수 있는 물건이 죽은 것처럼 보이고**, 합계에는 포함돼 있어 화면과 숫자가 어긋난다.
- 에픽 AC와 목업이 "묶음이 회색조"라고 쓴 것은 목업의 `곳간` 묶음이 항목 하나짜리이기 때문이다. 항목이 하나면 두 규칙이 같은 결과를 낸다 — **이 결정은 AC를 어기지 않고 AC가 말하지 않은 경우를 채운다.**
- 안내 문장("주문에서 제외됩니다")은 묶음 전체가 빠질 때만 참이다. 일부만 빠지는 묶음에 붙이면 틀린 말이 된다.

### D5 — 배지 값은 **`(buyer)` 레이아웃의 컨텍스트 하나**가 소유한다

**결정.** `(buyer)/cart-count.tsx`에 `"use client"` 프로바이더를 만들고 `(buyer)/layout.tsx`가 `children`을 감싼다. `CartBadge`는 prop 대신 이 컨텍스트에서 값을 읽는다 — **탭바·상단 내비·상단바의 호출부는 한 글자도 바뀌지 않는다**(셋 다 `<CartBadge />`로 부르고 있다).

```
(buyer)/layout.tsx
  └ <CartCountProvider>            ← 담긴 항목 수 전체(구매 불가 포함) · setter
      └ {children}                 ← 각 page가 BuyerShell을 렌더 → CartBadge가 값을 읽는다
```

- **읽기 시점**: 프로바이더 마운트 시 1회. 단 `document.cookie`에 `slur_role`이 있을 때만 부른다 — 비로그인 방문자에게 401을 만들지 않기 위한 **UX 힌트 용도**이며 권한 판정이 아니다 (R7 준수: 틀려도 401을 받고 조용히 배지를 지울 뿐이다).
- **쓰기 시점**: 장바구니 응답을 받은 곳이 밀어 넣는다 — `/cart`의 매 `GET /carts` 성공, 담기 성공(낙관적 +1이 아니라 **재조회 후 서버 값**), 삭제 성공. 한 응답에 한 writer.
- 401을 받으면 `undefined`로 되돌린다(배지 미표시). **리다이렉트하지 않는다.**

**근거.**
- **새 의존성이 0이다.** 상태 관리 라이브러리를 넣지 않는다(AC 9). React Context는 이미 있는 도구다.
- **기각한 대안 (a) 서버에서 세어 셸에 내리기** — `(buyer)/layout.tsx`는 클라이언트 내비게이션에서 다시 실행되지 않는다(레이아웃은 유지된다). 담은 직후 배지가 그대로여서 UX-DR13이 요구하는 "담으면 배지가 붙는다"(Flow 1 9단계)가 성립하지 않는다.
- **기각한 대안 (b) 매 변경마다 `router.refresh()`** — 라우트 전체를 서버에서 다시 받아온다. 장바구니 화면이 통째로 갱신되며 스크롤·열린 확인 줄이 날아간다(D6가 막으려는 바로 그 튐).
- **기각한 대안 (c) `localStorage` + 커스텀 이벤트** — 서버 진실과 갈라진다. 다른 탭에서 주문을 넣으면 영원히 틀린 숫자가 남는다.
- 하이드레이션: 초기값이 서버·클라이언트 모두 `undefined`이고 `CartBadge`가 그때 아무것도 그리지 않으므로 마크업 불일치가 없다.

### D6 — 낙관적 갱신의 범위와 **성공에만 재조회**

**결정.**

| | 낙관적으로 바꾸는 것 | 서버에서 다시 받는 것 | 실패했을 때 |
|---|---|---|---|
| 수량 `±` | 그 행의 수량·행 금액 | 성공 직후 `GET /carts` (합계·`purchasable` 전부) | 직전 수량 복원 + 그 행 아래 `message` + `새로고침`. **재조회하지 않는다** |
| 삭제 | 없음(확인 줄이 진행 표시를 겸한다) | 성공 직후 `GET /carts` | 확인 줄 유지 + `message`. 재조회하지 않는다 |

재조회 중에도 skeleton으로 되돌리지 않는다 — 현재 데이터를 계속 그린 채 값만 갈아끼운다.

**근거.**
- **Flutter판이 남긴 부채를 여기서 갚는다.** `cart_screen.dart`의 `guard()`는 `finally`에서 성공·실패 무관하게 `invalidate`를 불러, 실패 스낵바가 뜨는 즉시 화면이 다시 로딩되며 튀었다. `deferred-work.md`가 그 항목을 `[소멸]` 처리하면서 **"웹 장바구니(8.4)에서 수량 변경·삭제 실패 시의 재조회가 오류 표시를 덮어쓰지 않게 할 것"** 을 후속으로 남겼다. 성공에만 재조회하면 이 트레이드오프가 사라진다 — 실패한 요청은 서버 상태를 바꾸지 않았으므로 재조회할 이유도 없다.
- **합계는 반드시 서버에서 온다.** `PATCH` 응답은 `{id, variant_id, quantity}`뿐이라 합계가 없고, `purchasable_total`은 서버 계산이다(AD-12). 그래서 성공 후 `GET /carts` 한 번이 필요하다. 행 금액(`final_price × quantity`)만 클라이언트가 곱한다 — 응답에 `line_total`이 없기 때문이며, **이것이 클라이언트가 하는 유일한 산술이다**(D12).
- **진행 중 요청의 경합은 "그 행 잠그기"로 막는다.** 스테퍼를 빠르게 여러 번 누를 때 요청 순서가 뒤집히면 서버 수량과 화면이 갈린다. 디바운스·시퀀스 번호 대신 **in-flight 동안 그 행의 스테퍼·삭제를 비활성**으로 둔다 — UX-DR9의 "제출 중 버튼 비활성"과 같은 규칙이고, 구현이 한 줄이며, 틀릴 여지가 없다.
- 사용자가 화면을 떠난 뒤의 실패가 **무음이 되지 않게** 한다(`deferred-work.md`의 또 다른 후속). 웹에는 Flutter의 `context.mounted` 문제가 없다 — 컴포넌트가 언마운트되면 그 화면 자체가 없으므로, 오류는 항상 살아 있는 화면 안에 남는다. 단 **오류 상태를 타이머로 자동 소거하지 않는다**(사용자가 읽기 전에 사라지면 같은 부채가 재발한다).

### D7 — 삭제 확인은 **인라인 확인 줄** (에픽의 `[ASSUMPTION]` 해소)

**결정.** `삭제`를 누르면 그 행의 조작 영역이 `삭제할까요?` + `삭제`(강조) + `취소`로 바뀐다. 한 번에 하나의 행만 확인 상태일 수 있다(다른 행의 `삭제`를 누르면 이전 확인 줄이 닫힌다).

**근거.**
- UX-DR16이 **모달을 금지**하고(예외는 우편번호 검색 하나) 동시에 **파괴적 동작은 확인 후 실행**을 요구한다. 둘을 동시에 만족시키는 방법은 같은 자리에서 확인받는 것뿐이다.
- `window.confirm`은 스타일을 못 입히고 브라우저마다 다르게 뜨며 지면 톤을 깬다. "모달을 만들지 않는다"의 취지를 우회하는 꼼수다.
- 두 번 탭(같은 버튼을 두 번) 방식은 되돌릴 기회를 주지 않고, 무엇이 지워지는지 말하지 않는다.
- **이 패턴이 8.6의 `주문 취소` 확인에도 그대로 쓰인다.** 8.4가 먼저 만들되 장바구니 전용 클래스로 가두지 말고 `buyer.css`에 공용 규칙(`.b_confirm_row`)으로 둔다.
- 접근성: 확인 줄이 열리면 포커스를 `삭제` 버튼으로 옮기고, `Esc`로 닫으면 원래 `삭제`로 되돌린다. 확인 줄은 `role="group"` + `aria-label`로 무엇을 지우는지(상품명) 말한다.

### D8 — 담기의 로그인 복귀는 **`&add=1` 한 번 실행 후 쿼리 정리**

**결정.**

```
비로그인 담기 클릭
  → POST /api/carts/items  → 401
  → router.replace(`/login?next=${encodeURIComponent(pathname + search + "&add=1")}`)
로그인 성공 → 8.2가 next로 복귀 → /products/{id}?variant=xyz&add=1
  → 상세가 마운트되며 add=1을 보고 담기 1회 실행
  → 즉시 router.replace(`/products/{id}?variant=xyz`)   ← add 제거
```

**근거.**
- **8.3이 이미 조합을 URL에 저장해 두었다**(D4: `?variant=`). 복귀만 하면 조합이 살아나므로, 남은 것은 "담기까지 이어진다"(에픽 8.2 AC·UX-DR11·Flow 1 9단계)뿐이다. 별도 저장소(sessionStorage·전역 상태)를 만들지 않는다.
- **쿼리를 즉시 지우는 것이 이 결정의 안전장치다.** 지우지 않으면 새로고침·뒤로가기·북마크로 같은 담기가 반복된다. `replace`이므로 히스토리도 늘지 않는다.
- 401을 받고 나서 이동한다 — **쿠키를 읽어 미리 판정하지 않는다.** `slur_role`은 UX 힌트일 뿐이고(R7) 만료된 세션에서도 존재한다. 서버가 답하게 두면 판정이 한 곳(FastAPI)에 남는다 (AD-1).
- 담기 자동 실행은 **사용자가 방금 명시적으로 누른 동작의 연장**이며, 실패해도 되돌릴 수 있고(삭제 가능) 금전 이동이 없다. 주문 생성 같은 되돌릴 수 없는 동작이라면 이 방식을 쓰지 않았을 것이다.
- `[ASSUMPTION]` `바로 구매`로 시작한 복귀는 담기까지만 하고 `/cart`로 자동 이동하지 않는다 — 로그인 직후 화면이 두 번 튀는 것보다 상세에 머무는 편이 낫다고 본다. Slur 확인 항목.

### D9 — `바로 구매`는 **담기 후 `/cart`** (`/checkout` 직행을 만들지 않는다)

**결정.** `바로 구매` = `POST /carts/items` → 성공 시 `router.push("/cart")`.

**근거.**
- **백엔드에 단품 주문 경로가 없다.** `POST /orders`는 `cart_item_ids` 기반이고 `POST /orders/preview`는 장바구니 전체를 전제한다(`get_purchasable_entries`). `deferred-work.md`에 이미 등재된 제약이다.
- 그래서 `/checkout` 직행은 **"이 상품만 산다"는 약속을 지킬 수 없다.** 장바구니에 다른 물건이 남아 있으면 주문서에 전부 실리고, 사용자는 의도하지 않은 항목까지 결제하게 된다. **돈이 걸린 오해라 감수할 수 없다.**
- 장바구니를 거치면 무엇이 주문에 들어가는지 사용자가 눈으로 보고, `주문하기 (N건)`가 한 번의 탭 거리에 있다. 화면 하나가 늘지만 거짓이 없다.
- 장바구니가 비어 있을 때만 `/checkout` 직행이 안전하지만, **상황에 따라 목적지가 갈리는 버튼은 예측할 수 없다.** 언제나 `/cart`로 간다.
- 이 결정으로 v1의 주문 모델이 한 문장으로 정리된다: **주문은 언제나 장바구니 전체다.** D3(체크박스 비조작)와 같은 사실의 다른 얼굴이다.

`[ASSUMPTION]` 버튼 문구 `바로 구매`는 UX 계약(DESIGN.md CTA 2버튼)이라 바꾸지 않는다. 문구와 동작의 간극이 문제가 되면 백엔드에 `preview`의 항목 선택을 추가하는 것이 정공법이다 — Epic 8 경계 밖.

### D10 — 2단·고정 바는 **CSS만으로**, sticky 판정은 **묶음 수**

**결정.**

```
< 768   : 한 칼럼. 묶음 목록 → 8px 종이 접기 띠 → 금액 요약
          하단: [고정 CTA 바(m_stack)] 위에 [탭바]  ← 2단 (이 화면만의 예외)
          <main> 아래 여백 = CTA 바 높이 + 탭바 높이
≥ 768   : grid 62fr / 34fr (column-gap 4%)
          우: 금액 요약 + 주문하기 버튼, 1px hairline 테두리 상자, top = 54px + 20px
          고정 CTA 바·탭바는 CSS로 사라진다
```

- **sticky는 `묶음 수 >= 2`일 때만 건다.** 컨테이너에 `data-sticky="on"`을 얹고 CSS가 그것을 본다.
- CTA 바 사본은 **하나만** 만든다 — 8.3의 상품상세와 달리 장바구니의 `주문하기` 버튼은 좌우 어디에도 중복 렌더하지 않고, 같은 노드를 `<768`에서는 고정 바 안에, `≥768`에서는… **두 자리에 렌더하고 `display`로 전환한다**(8.3 D9와 같은 패턴). 단일 노드를 `fixed ↔ static`으로 바꾸면 그 노드가 우측 칼럼 안에 있어야 하는데, 그러면 `<768`에서 고정 바가 금액 요약보다 DOM 앞에 와 UX-DR6를 어긴다.

**근거.**
- UX-DR4가 "두 칼럼 길이가 비슷해지면(묶음이 하나뿐일 때 등) sticky를 걸지 않는다"고 쓰면서 **스스로 판정 기준을 예시로 준다.** 실측(`ResizeObserver`로 칼럼 높이 비교)은 폭 변화·이미지 로드마다 다시 재는 장치가 필요하고, 그 복잡도가 완주에 기여하지 않는다. 묶음 수는 결정적이고 서버 데이터에서 바로 나온다.
- **폭 전환에 JS를 쓰지 않는다.** `matchMedia`로 조건부 렌더하면 폭이 바뀔 때 언마운트되어 열린 삭제 확인 줄·진행 중 요청·오류 문장이 날아간다 (AC 14). 8.1이 탭바/상단 내비에, 8.3이 상세 CTA에 쓴 것과 같은 규칙이다.
- 하단 여백은 8.1 셸의 `.b_main[data-tabbar="on"]`이 탭바 높이만 준다. **셸을 고치지 않고** 장바구니 페이지가 자기 콘텐츠 아래에 CTA 바 높이만큼을 더한다 — 다른 화면의 여백을 건드리지 않는 쪽이 회귀 표면이 작다.
- CTA 바가 탭바 위에 얹히므로 아래쪽 패딩은 20px이 아니라 **13px**이다(목업 `.bottombar.stack`). 홈 인디케이터 여백은 아래에 있는 탭바가 맡는다.
- 묶음의 좌우 여백: `<768`에서는 8.1의 `.b_seller_pack { padding: 18px var(--b-gutter) }`가 그대로 맞다(hairline이 화면 끝까지 그어져야 한다). `≥768`에서는 컨테이너가 여백을 갖고 묶음은 `padding-inline: 0`이 된다. **`.b_seller_pack`의 기본 규칙을 고치지 말고 장바구니 목록 안에서만 덮는다.**

### D11 — BFF 라우트 4개와 상태 변경 라우트의 Origin 검사

**결정.**

```
app/api/carts/route.ts             GET    → /api/v1/carts
app/api/carts/items/route.ts       POST   → /api/v1/carts/items
app/api/carts/items/[id]/route.ts  PATCH  → /api/v1/carts/items/{id}
                                   DELETE → /api/v1/carts/items/{id}
```

전부 `proxyWithRefresh`를 쓴다. **`POST`·`PATCH`·`DELETE`는 먼저 `assertSameOrigin(req)`를 통과해야 한다.**

**근거.**
- 장바구니는 **인증 경로**다. 8.3의 공개 GET이 `proxyWithRefresh`를 피한 이유(401 시 `clearSessionCookies` 부작용)는 여기서는 반대로 작용한다 — 세션이 정말 끝났으면 쿠키를 지우고 `/login`으로 보내는 것이 맞다. **`lib/public-api.ts`를 쓰지 않는다.**
- `proxyWithRefresh`는 access 만료 시 refresh를 회전하고 1회 재시도하므로, 30분마다 로그인이 풀리는 사고가 나지 않는다. 회전된 쿠키가 응답에 실려 오므로 **반환된 `NextResponse`를 그대로 응답해야 한다**(가공 금지).
- `assertSameOrigin`은 8.2가 `lib/auth.ts`에 도입하며 "상태를 바꾸는 모든 신규 POST 라우트가 이 한 벌을 쓴다"고 규약을 세웠다. 장바구니의 POST/PATCH/DELETE가 정확히 그 대상이다. **8.4는 이 함수를 import만 하고 `lib/auth.ts`를 수정하지 않는다.**
- **`DELETE`는 204를 돌려준다.** `proxyWithRefresh`가 `status === 204`를 본문 없이 통과시키므로(그 분기가 이미 있다) **클라이언트가 `res.json()`을 부르면 TypeError가 난다.** 204는 본문을 읽지 않는다.
- `[id]`는 Next 16에서 **`ctx.params`가 Promise**다(`app/api/admin/orders/[id]/route.ts`의 선례). `await` 후 36자 UUID 형식을 검사하고, 아니면 상류를 부르지 않고 `not_found` 404 봉투를 돌려준다(8.3 D2와 같은 규칙).
- 라우트 경로 주의: `app/api/carts/items/route.ts`(정적)와 `app/api/carts/items/[id]/route.ts`(동적)는 서로 다른 깊이라 충돌하지 않는다.

### D12 — 금액 함수는 **하나**, 클라이언트 산술은 **행 금액 곱셈 하나뿐**

**결정.**
- 금액 표기는 기존 `formatWon` **하나**만 쓴다. 🚨 현재 이 함수는 **두 곳에 존재할 수 있다** — 8.1이 `(buyer)/amount-summary.tsx`에서 export했고, 8.3의 D13이 `(buyer)/format.ts` 신설을 지시했다. **구현 전에 실제 상태를 확인하고, 남아 있는 하나를 import한다. 세 번째를 만들지 않는다.** 둘 다 있으면 `format.ts`를 정본으로 삼고 `amount-summary.tsx`가 그것을 re-export하도록 정리한다(호출부 변경 최소화).
- 클라이언트가 하는 산술은 **행 금액 = `final_price × quantity`** 하나뿐이다. 응답에 `line_total`이 없기 때문이며, 두 인수 모두 서버 값이다.
- **합계는 절대 더하지 않는다.** `purchasable_total`을 그대로 쓴다. 구매 불가 항목의 제외도 서버가 이미 했다.
- 수량 상한 `999`는 `(buyer)/cart/` 안의 상수 **한 곳**에만 둔다(`MAX_CART_QTY`). `deferred-work.md`가 "같은 상한이 웹 장바구니·상품상세에 다시 놓이므로 확산 자체는 해소되지 않는다"고 예고한 자리다 — **최소한 웹에서는 리터럴을 흩뿌리지 않는다.**

**파일 배치.**

```
apps/web/
  app/api/carts/route.ts                 ← 신설 (GET)
  app/api/carts/items/route.ts           ← 신설 (POST)
  app/api/carts/items/[id]/route.ts      ← 신설 (PATCH · DELETE)
  app/(buyer)/
    cart/page.tsx            ← 대체 (8.1 자리표시 → 셸 + CartView)
    cart/cart-view.tsx       ← 신설 "use client" 본체 (조회·묶음·수량·삭제·CTA)
    cart/cart-pack.tsx       ← 신설 (묶음 하나 = SellerPack 슬롯 채우기 + 항목 행)
    cart/cart.css            ← 신설 (장바구니 전용)
    cart/constants.ts        ← 신설 (MAX_CART_QTY 등)
    cart-count.tsx           ← 신설 "use client" (CartCountProvider · useCartCount)
    cart-api.ts              ← 신설 (담기·수량·삭제·조회의 fetch 래퍼 — 상세와 장바구니가 공유)
    layout.tsx               ← 수정 (CartCountProvider로 감싼다)
    buyer-icons.tsx          ← 수정 (CartBadge가 컨텍스트에서 값을 읽는다)
    amount-summary.tsx       ← 수정 (미확정 값 표시 지원)
    buyer.css                ← 수정 (하단 고정 CTA 바·인라인 확인 줄·스테퍼 공용 규칙)
    products/[id]/product-detail.tsx  ← 수정 (8.3 산출물 — 담기·바로 구매 실제 동작)
```

CSS를 라우트 옆에 두고 컴포넌트가 임포트하는 것은 이 저장소의 관례다. 클래스 접두사는 `b_*`/`i_*`/`m_*`.

## Tasks / Subtasks

- [x] **Task 0 — 착수 전 확인 (선행 산출물의 실제 상태)** (AC: 전부)
  - [x] 8.2·8.3이 머지됐는지 확인한다. `(buyer)/products/[id]/product-detail.tsx`·`buyer-feedback.tsx`가 없으면 **이 스토리를 시작하지 않는다**
  - [x] `formatWon`이 어디 있는지 확인한다 (`grep -rn "formatWon" apps/web/app`) — D12의 정리 규칙 적용
  - [x] `assertSameOrigin`이 `lib/auth.ts`에 있는지 확인한다 (8.2 산출물)
  - [x] 하단 고정 CTA 바 CSS가 8.3에 의해 `browse.css`에 만들어졌다면 **값을 복제하지 말고** `buyer.css`로 승격하고 `browse.css`의 선언을 지운다 — 8.5(주문서)도 같은 바를 쓴다. 승격 후 상품상세 렌더가 동일한지 눈으로 확인한다

- [x] **Task 1 — BFF Route Handler 4개** (AC: 1, 4, 5, 10, 17)
  - [x] `app/api/carts/route.ts` — `GET` → `proxyWithRefresh(req, "/api/v1/carts", { method: "GET" })`
  - [x] `app/api/carts/items/route.ts` — `POST`. **`assertSameOrigin` 먼저**. 본문은 `{variant_id, quantity}`만 상류로 넘긴다(화이트리스트)
  - [x] `app/api/carts/items/[id]/route.ts` — `PATCH`(본문 `{quantity}`만) · `DELETE`. 둘 다 `assertSameOrigin` 먼저
    - [x] `ctx.params`는 **Promise다** — `await`. 36자 UUID 형식이 아니면 상류를 부르지 않고 `not_found` 404 봉투
  - [x] `lib/auth.ts`를 **수정하지 않는다** (import만)
  - [x] `proxyWithRefresh`가 돌려준 `NextResponse`를 **그대로 반환**한다 — 본문을 다시 감싸면 회전된 세션 쿠키가 유실된다

- [x] **Task 2 — 클라이언트 API 래퍼와 배지 컨텍스트** (AC: 9, 15)
  - [x] `(buyer)/cart-api.ts` — `getCart()` · `addItem(variantId)` · `setQuantity(itemId, qty)` · `removeItem(itemId)`
    - [x] 반환은 `{ ok: true, data } | { ok: false, code, message }` 형태로 통일한다. **`code`는 분기에만, `message`는 표시에만**
    - [x] `DELETE`는 **204라 본문이 없다** — `res.json()`을 부르지 않는다
    - [x] fetch가 throw하면 `{ ok:false, code:"network", message:"연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요." }`
    - [x] 에러 봉투 타입은 새로 만들지 않는다 — 8.2의 `(buyer)/auth-errors.ts` 또는 8.3이 만든 타입을 재사용한다
  - [x] `(buyer)/cart-count.tsx` — `CartCountProvider` + `useCartCount()`(값 + setter)
    - [x] 마운트 시 `slur_role` 쿠키가 있을 때만 `getCart()` 1회. 401이면 `undefined`로 되돌리고 **리다이렉트하지 않는다**
    - [x] 값은 **`items.length`** (구매 불가 포함). 수량 합이 아니다
  - [x] `(buyer)/layout.tsx` — `children`을 프로바이더로 감싼다. `data-surface="buyer"` 래퍼·CSS 임포트는 손대지 않는다
  - [x] `(buyer)/buyer-icons.tsx` — `CartBadge`가 컨텍스트에서 값을 읽는다. **탭바·상단 내비·상단바의 `<CartBadge />` 호출부는 바꾸지 않는다**. `count` prop은 제거하거나 override로 남긴다(타입 변경이 tsc를 깨지 않게)

- [x] **Task 3 — 장바구니 화면 골격과 조회** (AC: 1, 2, 13, 15)
  - [x] `(buyer)/cart/page.tsx` — 8.1 자리표시를 **통째로 대체**. `BuyerShell tab="cart" showTabbar topbar={{ variant:"title", title:"장바구니" }}` 세 값은 그대로 둔다
  - [x] `cart-view.tsx` — `getCart()` 호출, 로딩/오류/빈 상태/정상 4갈래
    - [x] 로딩: **묶음 골격 skeleton**(중앙 스피너 금지). 8.3의 `buyer-feedback.tsx`를 재사용하고 없으면 그 파일에 묶음용 변형을 추가한다
    - [x] 401 → `router.replace("/login?next=%2Fcart")`
    - [x] 빈 장바구니 → `장바구니가 비어 있습니다.` + `쇼핑 계속하기`(→ `/`). 금액 요약·CTA 바를 렌더하지 않는다
    - [x] 성공 시 배지 컨텍스트에 `items.length`를 밀어 넣는다
  - [x] 묶음 만들기 — `brand_name` 키, 등장 순서 유지. `brand_name`이 빈 문자열인 묶음의 표시명은 `판매 종료`
  - [x] `cart-pack.tsx` — 8.1의 `<SellerPack>` 슬롯을 채운다: `headStart`=체크박스, `headEnd`=상태 태그 자리, `children`=항목 행들, `foot`=구매 불가 안내
    - [x] **`seller-pack.tsx`를 수정하지 않는다** — 슬롯으로 충분한지 먼저 확인하고, 부족하면 그 사실을 스토리에 적고 최소 변경만 한다

- [x] **Task 4 — 항목 행: 수량 스테퍼와 삭제** (AC: 4, 5, 6)
  - [x] 행 구성 — 사진 74px(없으면 종이 그늘 면) · 상품명(`b_product_name_row`) · 옵션(`b_meta`, 빈 값이면 `—`) · 행 금액(`b_price_item`, `final_price × quantity`) · 스테퍼 ↔ `삭제`
    - [x] 조작 행은 `.b_row`(최대 560px) 안에서 좌측 정렬 — 넓은 칼럼에서 `space-between`으로 500px 벌어지지 않게 한다 (UX-DR5)
    - [x] `<img>` 위에 `/* eslint-disable-next-line @next/next/no-img-element */` (lint 베이스라인 0 warnings)
  - [x] 스테퍼 — `−` `n` `+`. 1에서 `−` `disabled`, `MAX_CART_QTY`에서 `+` `disabled`, 구매 불가 항목은 둘 다 `disabled`
    - [x] 히트 영역 44×44 이상(시각 크기 26px은 유지하고 패딩으로 넓힌다)
    - [x] 낙관적 갱신 → 성공 시 `getCart()` 재조회 → 실패 시 직전 값 복원 + `message` + `새로고침`. **실패에는 재조회하지 않는다** (D6)
    - [x] in-flight 동안 **그 행만** 비활성
  - [x] 삭제 — 인라인 확인 줄(D7). `.b_confirm_row`는 `buyer.css`에 공용으로 둔다(8.6이 쓴다)
    - [x] 확인 줄 열림 시 포커스를 `삭제`로, `Esc`·`취소`로 닫으면 원래 버튼으로 되돌린다
    - [x] 한 번에 한 행만 확인 상태
    - [x] 성공 → 재조회 + 배지 갱신. 마지막 항목이면 빈 상태로 전환
  - [x] **스와이프 삭제·롱프레스 메뉴를 만들지 않는다** (UX-DR16)

- [x] **Task 5 — 구매 불가 표기와 체크박스** (AC: 6, 7)
  - [x] 항목 행 — 사진 `grayscale(.85) brightness(1.06)`, 글자 `--b-ink-unavailable`, 금액 취소선(`--b-strike-line`), 스테퍼 비활성
  - [x] 묶음 — **전부 불가일 때만** 헤더 `구매 불가 · 품절` 태그(`.b_tag` + `--b-accent-soft`/`--b-accent`) + 하단 `--b-accent-wash` 안내 상자
  - [x] 체크박스 — `disabled`. 가능 항목 ≥ 1이면 `checked`. `aria-label`로 상태를 말한다
  - [x] **재고 수량·품절 원인을 화면에 쓰지 않는다** — 응답에 없고(`purchasable` 단일 술어) 만들어내지 않는다 (AD-10)
  - [x] `판매 종료` 묶음도 같은 규칙을 탄다(항상 전부 불가)

- [x] **Task 6 — 금액 요약과 CTA** (AC: 3, 8, 14)
  - [x] `amount-summary.tsx` 수정 — `shippingFee`·`remoteAreaFee`가 `number | null`을 받고, `null`이면 값 자리에 문구(prop으로 받는다, 기본 `주문서에서 확인`)를 `--b-ink-muted`로 놓는다. **행을 조건부로 지우지 않는다**
    - [x] 합계 라벨도 prop으로 받는다(장바구니 `상품 금액 합계` / 주문서 `결제 예정 금액`) — 8.5가 같은 컴포넌트를 쓴다
  - [x] 요약 아래 `b_notice` 한 줄: `배송비는 판매자마다 다르며 배송지를 입력하면 주문서에서 확정됩니다.`
  - [x] CTA — `주문하기 (N건)`, N = 구매 가능 **항목 수**. 0건이면 `disabled`
    - [x] 클릭 시 `/checkout`으로 이동한다. **주문서 화면은 8.5가 만든다** — 없으면 404가 나므로 8.5 전에는 이 링크가 죽어 있음을 Completion Notes에 적는다
    - [x] 버튼을 **두 자리에 렌더**하고 CSS `display`로 전환한다(<768 고정 바 / ≥768 우측 칼럼). 상태는 `cart-view`가 갖고 두 사본에 같은 값을 넘긴다
    - [x] 고정 바는 DOM 순서상 **금액 요약 뒤**(콘텐츠 뒤)에 둔다

- [x] **Task 7 — 반응형 배치** (AC: 14)
  - [x] `cart.css` — `<768` 한 칼럼 + 하단 CTA 바(`m_stack`, 패딩 `13px 20px 13px`) / `≥768` grid `62fr 34fr`, column-gap 4%
  - [x] `≥768` 우측 칼럼: 1px hairline 테두리 상자, `position: sticky; top: calc(var(--b-topbar-h) + var(--b-space-5))`
  - [x] sticky는 `묶음 수 >= 2`일 때만 — 컨테이너 `data-sticky="on"`
  - [x] `<768` 본문 하단 여백 = CTA 바 높이 + 탭바 높이. **8.1 셸(`.b_main[data-tabbar="on"]`)을 고치지 않고** 장바구니 페이지가 자기 여백을 더한다
  - [x] 묶음 좌우 여백: `<768`은 8.1 기본(`padding-inline: var(--b-gutter)`), `≥768`은 컨테이너가 갖고 묶음은 0
  - [x] 금액 요약 앞 8px 종이 접기 띠(`--b-paper-shade`)는 `<768`에서만 — 옆으로 놓인 2단에서는 쓰지 않는다(DESIGN.md 깊이 예외)
  - [x] `matchMedia`·`innerWidth`·`resize` 사용 0건

- [x] **Task 8 — 상품상세의 담기·바로 구매** (AC: 10, 11, 12)
  - [x] `product-detail.tsx`(8.3) 수정 — `// TODO(8.4)` 주석 자리를 실제 호출로 바꾼다. **선택 상태·활성 판정·버튼 배치는 8.3의 것을 그대로 쓴다**
  - [x] `장바구니 담기` → `addItem(variantId)` (수량 1 고정). 제출 중 두 버튼 비활성
  - [x] 성공 → 인라인 `장바구니에 담았습니다.` + `장바구니 보기`(→ `/cart`) + 배지 갱신. **토스트·모달을 만들지 않는다**
  - [x] 401 → `router.replace("/login?next=" + encodeURIComponent(pathname + search + "&add=1"))`
  - [x] 마운트 시 `add=1`이면 담기 1회 실행 후 즉시 `router.replace`로 `add` 제거. `variant`가 없거나 구매 불가면 실행하지 않는다
    - [x] React StrictMode의 개발 모드 이중 마운트에서 **두 번 담기지 않도록** 실행 여부를 ref로 가둔다
  - [x] `바로 구매` → 담기 성공 후 `router.push("/cart")` (D9). `/checkout` 직행을 만들지 않는다
  - [x] `not_purchasable` 422 → 담기 실패 문구는 응답 `message`. 상세 데이터를 다시 불러 옵션 상태를 갱신할지는 구현자 판단(사용자 주도 재시도 수단만 있으면 된다)

- [x] **Task 9 — 검증: 정적 규칙과 빌드** (AC: 16, 17, 18)
  - [x] `cd apps/web && npx tsc --noEmit` → 0
  - [x] `cd apps/web && npm run lint` → **0 errors · 0 warnings**
  - [x] `cd apps/web && npx next build` → 성공. 기존 라우트 URL이 그대로이고 신규는 `/api/carts/**` 셋뿐인지 확인
  - [x] `grep -rn "#2f6bff\|--color-brand\|--shadow-\|box-shadow" apps/web/app/\(buyer\)` → 0건
  - [x] `git diff --stat`에 `apps/api` **0건** · `package.json`·`package-lock.json` **0건** · `app/styles/slur/**` **0건** · `app/styles/buyer/**` **0건**
  - [ ] `cd apps/api && uv run pytest -q` → **환경이 있을 때만.** 이 머신에는 `uv`·`docker`가 없다. 실행하지 못했으면 Completion Notes에 **"미실행 + 사유"** 를 적는다 — 통과했다고 쓰지 않는다

- [x] **Task 10 — 검증: 실데이터로 화면 확인** (AC: 1~15, 18)
  - [x] **데이터 확보** — 다음 순서로 시도하고 무엇을 썼는지 기록한다
    1. 프로덕션 API를 `API_BASE_URL`로 가리켜 로컬 웹만 띄우고 **테스트 계정**으로 로그인한다. ⚠️ 이 스토리는 8.3과 달리 **쓰기(담기·수량 변경·삭제)를 한다** — 반드시 테스트 계정의 장바구니만 쓰고, 확인이 끝나면 **담은 항목을 전부 삭제한다**(R8: 테스트 데이터 즉시 정리)
    2. 실상품이 부족하면 판매자 계정으로 `/seller/products/new`에서 옵션 상품을 등록하고, `구매 불가` 케이스는 판매자 화면에서 해당 조합을 품절 처리해 만든다(4.1의 E2E 시나리오와 같은 방법)
    3. 둘 다 불가하면 `[ASSUMPTION]` **스크래치패드에** 응답 스키마를 흉내 내는 스텁 서버를 띄우고 `API_BASE_URL`을 거기로 돌린다 — 저장소에 남기지 않는다. 스텁으로만 확인한 항목은 그 사실을 함께 적는다
  - [x] **확인 케이스**
    - 판매자 2인 이상이 섞인 장바구니 (묶음 분리·순서)
    - 한 묶음에 **가능 + 불가가 섞인** 경우 (헤더 태그가 붙지 **않고** 행만 흐려지는지 — D4)
    - 한 묶음이 **전부 불가**인 경우 (태그 + 안내 상자 + 체크 해제 + 합계 제외)
    - `variant_id: null` (판매 종료 묶음)
    - 이미지 없는 항목 · 옵션 없는 항목(`—`)
    - 수량 1(`−` 비활성) · 999(`+` 비활성)
    - 빈 장바구니
  - [x] **배지 vs CTA 카운트** — 구매 불가가 섞인 상태에서 배지 숫자 > CTA `(N건)`인지 확인하고 두 값을 기록한다
  - [x] 390 / 700 / 768 / 1280 네 폭에서 렌더 확인 — `<768` CTA 바 + 탭바 2단(마지막 묶음이 가려지지 않는지), `≥768` 62/34 + 우측 sticky + 고정 바·탭바 소멸, 묶음 1개일 때 sticky 없음
  - [x] **폭을 바꿔도** 열린 삭제 확인 줄·오류 문장이 유지되는지 확인
  - [x] 키보드만으로 완주 — 묶음 → 스테퍼 → 삭제 → 확인 줄 → CTA. 하단 고정 바가 콘텐츠보다 먼저 포커스되지 않는지, 확인 줄 열림 시 포커스가 옮겨가는지
  - [x] 먹색 포커스 링이 모든 새 컨트롤에 보이고 파랑이 0회인지 확인
  - [x] 결과를 Completion Notes에 기록한다 — 단위 테스트로 대체하지 않는다(`apps/web`에 테스트 프레임워크가 없고 도입하지 않는다)

- [x] **Task 11 — 검증: 실패 경로와 담기 복귀** (AC: 4, 5, 10, 11, 12, 15)
  - [x] **수량 변경 실패** — 판매자 화면에서 해당 조합을 품절로 바꾼 뒤 `+`를 누른다 → 수량이 되돌아오고 `message` + `새로고침`이 뜨는지, **화면이 자동 재조회로 튀지 않는지** 확인 (D6 — 이 스토리가 갚는 부채)
  - [x] **상류 중단** (API를 끄고) — 조회·수량·삭제 각각에서 문장형 메시지 + 재시도 수단. **화면에 숫자·`code` 문자열이 없는지 확인**
  - [x] **세션 만료** — `slur_access`·`slur_refresh` 쿠키만 지우고(`slur_role`은 남긴 채) `/cart` 진입 → 미들웨어는 통과하지만 `GET`이 401 → `/login?next=%2Fcart`로 가는지 확인
  - [x] **비로그인 담기 → 복귀** — 로그아웃 상태로 상품상세에서 조합을 고르고 `장바구니 담기` → `/login?next=…&add=1` → 로그인 → 상세로 돌아와 **담기가 한 번만** 실행되고 URL에서 `add`가 사라지는지 확인
    - [x] 복귀 직후 **새로고침**해서 같은 담기가 반복되지 않는지 확인
  - [x] **바로 구매** — 담기 후 `/cart`로 가는지, 장바구니에 기존 항목이 있으면 그것도 함께 보이는지(약속을 어기지 않았는지) 확인
  - [x] **같은 조합 재담기** — 수량이 합산되는지(서버 동작) 확인. 합산 후 총량이 재고를 넘으면 장바구니에서 **구매 불가로 표시**되는 것이 정상임을 기록한다(4.1의 확정 policy)
  - [x] **테스트 데이터 정리** — 담은 항목·등록한 테스트 상품을 전부 지운다 (R8)

## Dev Notes

### 이 스토리의 경계 — 하지 않는 일

| 하지 않는다 | 어디가 하는가 |
|---|---|
| 백엔드 수정·마이그레이션·신규 엔드포인트·응답 필드 추가 | 없음. Epic 8 전체가 백엔드 무변경 |
| 로그인·회원가입 화면, `next` 값의 **소비**(복귀 실행), 역할 쿠키 계산 | **8.2** |
| 상품목록·상품상세의 **렌더**(갤러리·옵션 축·판매자 정보·CTA 자리) | **8.3**. 8.4는 그 CTA의 **동작만** 채운다 |
| `/checkout` 화면·`POST /orders/preview`·우편번호 검색·주문 생성 | **8.5** |
| 주문내역·주문상세·묶음 취소 | **8.6** |
| `/me`·PWA·플랫폼 사업자 정보 | **8.7** |
| `apps/mobile` 제거 | **8.8** |
| 부분 선택 주문(체크 해제) · 배송비 표시 | v1 밖 (D2·D3 — 백엔드 변경이 선행 조건) |
| 찜·재입고 알림·비회원 장바구니 보관 | v1 밖 (UX-DR16 금지 목록, UX-DR11 `[ASSUMPTION]`) |
| `apps/web` 테스트 프레임워크 도입 | 하지 않는다 (의존성 추가 금지) |

### 소비하는 백엔드 API — 계약 (읽기만, 수정 금지)

네 엔드포인트 모두 **인증 필수**(`get_current_user_id`). 경로 접두사는 `/api/v1`. 구매자 역할 검사는 없다 — 로그인만 요구한다.

**① `GET /api/v1/carts`** → `200 CartResponse`

```jsonc
{ "items": [
    { "id": "uuid",                  // cart_item_id — 수량 변경·삭제의 키
      "variant_id": "uuid" | null,   // null = 조합이 삭제됨(SET NULL) → 판매 종료
      "quantity": 2,
      "product_id": "uuid" | null,
      "product_name": "유광 도자 머그",   // variant_id가 null이면 "판매 종료된 상품"
      "brand_name": "토림도예",           // variant_id가 null이면 ""
      "option_text": "색상: 살구 / 용량: 240ml",  // 서버가 조립 (AD-12). 옵션 없으면 ""
      "final_price": 32000 | null,       // base + extra, 단가. null이면 판매 종료
      "image_url": "https://…" | null,
      "purchasable": true }              // 단일 술어 결과 (AD-10)
  ],
  "purchasable_total": 118000 }          // 구매 가능 항목만의 상품 합계 — 배송비 미포함
```
- 정렬은 `created_at DESC, id DESC` 고정. **`get_purchasable_entries`(주문서·주문 생성)와 같은 정렬**이라 화면 순서가 주문서 순서와 일치한다
- ⚠️ **`seller_id`가 없다.** 묶음은 `brand_name`으로 만든다 (D1, 위험 4)
- ⚠️ **`line_total`이 없다.** 행 금액은 `final_price × quantity`로 클라이언트가 곱한다 (D12)
- ⚠️ **배송비·도서산간·재고 수량이 없다.** 지어내지 않는다 (D2, 위험 1)
- `purchasable` = `product.status == "active" ∧ variant.is_active ∧ variant.stock >= quantity`. **수량이 판정에 들어간다** — 수량을 올리면 같은 항목이 구매 불가가 될 수 있다
- 빈 장바구니는 `{"items": [], "purchasable_total": 0}` (에러 아님)

**② `POST /api/v1/carts/items`** `{variant_id, quantity}` → `201 CartItemBrief {id, variant_id, quantity}`
- `quantity`는 `1 ≤ n ≤ 999`. 범위 밖은 `422 validation_error`
- 없는 조합 → `404 not_found` / 술어 실패 → `422 not_purchasable` (`지금은 구매할 수 없는 상품입니다.`)
- **같은 `(user, variant)`는 원자적 upsert로 수량이 합산되고 999에서 잘린다**(`LEAST`). 응답의 `quantity`가 합산 결과다 — 화면이 더하지 않는다
- ⚠️ **술어 검증은 "요청 수량" 기준이다** — 이미 3개 담긴 상태에서 2개를 더 담으면 성공하지만, 총 5개가 재고를 넘으면 `GET`에서 `purchasable: false`로 내려온다. **4.1에서 확정된 policy이며 버그가 아니다**(`deferred-work.md` 등재)

**③ `PATCH /api/v1/carts/items/{item_id}`** `{quantity}` → `200 CartItemBrief`
- **합산이 아니라 절대값 지정**이다
- 남의 항목·없는 항목 → `404 not_found` (403이 아니다 — 존재 노출 방지)
- 술어 실패(그 수량으로는 살 수 없음) → `422 not_purchasable`
- **응답에 합계가 없다** → 성공 후 `GET /carts` 재조회가 필요하다 (D6)

**④ `DELETE /api/v1/carts/items/{item_id}`** → **`204 No Content` (본문 없음)**
- 남의 항목·없는 항목 → `404 not_found`
- 🚨 클라이언트가 `res.json()`을 부르면 TypeError. `proxyWithRefresh`는 204를 본문 없이 통과시킨다

**에러 봉투 (공통)** — `{code, message, details}`. 분기는 `code`, 표시는 `message`. **HTTP 코드·`code` 문자열은 화면에 나타나지 않는다.**

### 참고로만 읽는 API (이 스토리는 부르지 않는다)

- **`POST /api/v1/orders/preview`** — `{postal_code}` 필수, 응답에 `seller_groups[].seller_id`·`shipping_fee`·`remote_extra_fee`·`grand_total`. **장바구니 전체를 전제하며 항목 선택 파라미터가 없다.** D2·D3의 근거이자 8.5의 입력이다
- **`POST /api/v1/orders`** — `{cart_item_ids, expected_grand_total, postal_code, …}`. 부분 주문은 만들 수 있지만 미리볼 수 없다 (D3)

### 고칠 코드 — ① 지금 무엇을 하는가 ② 무엇을 바꾸는가 ③ 깨뜨리면 안 되는 것

**`apps/web/app/(buyer)/cart/page.tsx`**
1. 8.1의 자리표시. `BuyerShell tab="cart" showTabbar topbar={{variant:"title", title:"장바구니"}}` + `.b_stub` 안내 두 줄.
2. **본문을 통째로 대체.** 셸 호출부 세 값은 그대로 두고 그 아래를 장바구니 본체로 바꾼다.
3. **셸 호출부.** `showTabbar`가 켜져 있고 상단바가 `title`(좌측 정렬, 뒤로가기 없음)인 것이 8.1이 검증한 상태이며 EXPERIENCE.md IA 표의 확정 사항이다("장바구니 헤더에 뒤로가기를 두지 않는다 — 목업의 뒤로가기는 스파인이 이긴다"). **여기를 바꾸면 8.1의 AC 1·2가 깨진다.**
   - `.b_stub`은 `/orders`·`/me`가 아직 쓴다 — **`buyer.css`에서 지우지 않는다.**

**`apps/web/app/(buyer)/buyer-icons.tsx`**
1. 22px 인라인 SVG 5종 + `CartBadge({count})`(값이 없으면 아무것도 그리지 않는다) + `BUYER_NAV_ITEMS`. 탭바·상단 내비·상단바가 `<CartBadge />`를 **prop 없이** 부르고 있다.
2. `CartBadge`가 컨텍스트에서 값을 읽게 한다. **세 호출부는 그대로 둔다.**
3. `BUYER_NAV_ITEMS`(단일 배열 상수)와 `stroke-width: var(--b-tab-stroke)` 규약. 아이콘에 폰트·이모지·CDN을 쓰지 않는다. 배지는 **개수 배지 = 액센트 원 + 종이색 숫자 9.5px/700 + 1.5px 종이색 링**이며 `full` 라운드가 허용되는 두 곳 중 하나다.

**`apps/web/app/(buyer)/amount-summary.tsx`**
1. `AmountSummaryData {itemsTotal, shippingFee, remoteAreaFee, total}` 네 숫자를 받아 **상품 금액 · 배송비 · 도서산간 추가 · 합계** 순서로 렌더. 0원 값은 `.m_zero`로 물러난다. `formatWon`도 여기서 export한다.
2. `shippingFee`·`remoteAreaFee`가 `number | null`을 받고, `null`이면 문구를 놓는다. 합계 라벨을 prop으로 받는다.
3. 🚨 **행 순서와 "도서산간 0원이어도 줄을 지우지 않는다"** — 파일 상단 주석이 이 두 가지를 못 박고 있다. `null` 처리를 "행을 지운다"로 구현하면 이 스토리가 UX-DR13을 깬다. 🚨 `formatWon`을 여기서 지우면 다른 화면이 깨진다 — D12의 정리 규칙을 먼저 확인한다.

**`apps/web/app/(buyer)/seller-pack.tsx`**
1. 뼈대 컴포넌트. `brand`·`headStart`·`headEnd`·`children`·`foot`·`unavailable` 슬롯과 `.b_seller_pack` 마크업.
2. **가능하면 수정하지 않는다** — 장바구니가 필요한 것(체크박스·상태 태그·항목 행·안내 상자)이 전부 슬롯으로 들어간다.
3. `m_unavailable` 변형과 "주문 전체에 걸리는 상태·전체 취소 버튼을 두지 않는다"(FR-15·18)는 8.5·8.6도 쓰는 계약이다. 장바구니 전용 prop을 추가해 다른 화면이 못 쓰게 만들지 않는다.

**`apps/web/app/(buyer)/buyer.css`**
1. 셸(컨테이너·그리드·상단바·탭바·배지·포커스 링) + 폼 프리미티브(`.b_btn`·`.b_input`·`.b_checkbox`) + 공유 컴포넌트(`.b_amount_summary`·`.b_seller_pack`·`.b_status_label`) + 자리표시(`.b_stub`).
2. 공용 규칙만 추가한다 — 하단 고정 CTA 바(`.b_cta_bar`, `m_stack` 변형), 인라인 확인 줄(`.b_confirm_row`), 수량 스테퍼(`.b_stepper`). **장바구니 전용 배치는 `cart.css`로.**
3. 🚨 `.b_container`·`.b_row`·`.b_seller_pack`·`.b_amount_summary`·`.b_checkbox`·포커스 링 블록은 8.1·8.2가 실측 검증한 것이다. **값을 다시 선언하거나 덮어쓰지 않는다.** 🚨 `.b_stub`은 `/orders`·`/me`가 아직 쓴다. 🚨 스코프 없는 태그 셀렉터(`img`·`button`·`input`)를 쓰지 않는다 — 격리의 근거는 임포트 위치가 아니라 셀렉터다(8.1의 학습).

**`apps/web/app/(buyer)/layout.tsx`**
1. `data-surface="buyer"` 래퍼 + 구매자 CSS 임포트 3줄. 서버 컴포넌트.
2. `children`을 `CartCountProvider`로 감싼다. 클라이언트 프로바이더를 서버 레이아웃 안에서 쓰는 것은 정상 패턴이다.
3. 🚨 **`data-surface="buyer"`와 CSS 임포트.** 구매자 팔레트·먹색 포커스 링의 스코프가 전부 이 속성에서 나온다(8.1 D1). 래퍼를 하나 더 끼우거나 속성을 옮기면 판매자·관리자 격리가 아니라 **구매자 스타일 전체**가 죽는다. `"use client"`를 이 파일에 붙이지 않는다 — 레이아웃 전체가 클라이언트 컴포넌트가 된다.

**`apps/web/lib/auth.ts` (수정하지 않는다)**
1. 쿠키 상수·`setSessionCookies`·`clearSessionCookies`·`proxyWithRefresh`. 8.2가 `resolveRole`·`setRoleCookie`·`assertSameOrigin`·카카오 단명 쿠키를 추가하는 중이다.
2. **아무것도 바꾸지 않는다.** `proxyWithRefresh`와 `assertSameOrigin`을 import한다.
3. 🚨 `proxyWithRefresh`의 401 경로가 `clearSessionCookies`를 호출한다 — **장바구니에서는 이것이 올바른 동작이다**(세션이 정말 끝났다). 8.3이 공개 GET에서 이 함수를 피한 이유와 혼동하지 않는다. 🚨 refresh 회전 쿠키가 반환 응답에 실려 있으므로 **응답을 다시 감싸면 세션이 유실된다.**

**`apps/web/app/(buyer)/products/[id]/product-detail.tsx` (8.3 산출물)**
1. 옵션 축 선택·가격·판매자 정보·CTA 두 자리 렌더. CTA 클릭 핸들러는 `// TODO(8.4)` 주석 자리다. 선택 조합은 `?variant=`에 `replace`로 저장된다.
2. 클릭 핸들러만 실제 호출로 바꾸고 성공·실패 표시 자리를 만든다.
3. 🚨 **비활성 판정**(조합 미특정 / 선택 조합 `purchasable=false` / 전 조합 품절)은 8.3이 한 곳에서 계산해 두 사본에 넘긴다 — 그 구조를 유지한다. 🚨 `?variant=` 저장은 D8의 복귀가 통째로 의존하는 장치다. 🚨 **폭에 따라 CTA를 조건부 렌더하지 않는다**(8.3 D9).

**`apps/api/app/carts/**` (읽기만, 수정 금지)**
1. 라우터 4개 + `service.py`(원자적 upsert·`check_purchasable`·`purchasable_total`·SET NULL 분기) + `schemas.py`.
2. **한 줄도 바꾸지 않는다.**
3. 이 도메인은 4.1에서 프로덕션 검증됐고 `test_carts.py`가 동시 담기·999 캡·경계 수량·타인 항목 404를 봉인하고 있다. Epic 8은 프론트 전용이며 **API 테스트 153건이 그대로 통과하는 것이 백엔드 무변경의 증거**다.

### 앞선 학습 (sprint-status.yaml action_items · 앞선 스토리에서 골라온 것)

- **R3 (open) — 쿠키·Origin·CORS는 프로덕션(프록시 뒤) 실요청 검증 후에만 done.** 이 스토리는 미들웨어를 건드리지 않지만 **인증 BFF 라우트 4개를 신설**하고 그중 셋이 `assertSameOrigin`을 탄다. Railway 프록시 뒤에서 `x-forwarded-host` 비교가 통과하는지 **프로덕션 배포 후 담기 1회로 확인**한다 — 로컬에서만 확인하고 done으로 넘기지 않는다.
- **R6 (done) — 에러 code는 Dev Notes에 사전 시드 선언.** 아래 별도 절.
- **R7 (done) — `slur_role`은 UX 힌트일 뿐 권한 판정이 아니다.** 이 스토리가 쿠키를 읽는 곳은 **배지 조회를 시도할지 말지** 한 곳뿐이며, 틀려도 401을 받고 배지를 지울 뿐이다. **담기·장바구니 조회는 쿠키를 보지 않는다** — 서버가 401로 답하면 그때 `/login`으로 보낸다 (AD-1).
- **R8 (in-progress) — 프로덕션 E2E 시나리오를 Task에 사전 명시하고 테스트 데이터 즉시 정리.** Task 10·11이 그것이며, **이 스토리는 8.3과 달리 쓰기를 한다** — 정리를 빼먹으면 프로덕션 계정에 테스트 장바구니가 남는다.
- **A-E456-5 (done) — 웹 lint 베이스라인 0 errors · 0 warnings.** 항목 사진 `<img>`가 `@next/next/no-img-element` 후보다. 하나만 빠져도 베이스라인이 깨진다.
- **4.1의 확정 policy — 담기 술어는 요청 수량 기준.** 합산 총량이 재고를 넘으면 담기는 성공하고 조회에서 구매 불가로 정직하게 드러난다. **화면이 이 policy를 숨기려 들지 않는다**(담기 전에 총량을 계산해 막는 것은 재고를 클라이언트가 판정하는 일이라 AD-10 위반이다).
- **4.1의 부채 — `guard()` finally 무조건 invalidate.** `deferred-work.md`가 `[소멸]` 처리하면서 **"웹 장바구니(8.4)에서 수량 변경·삭제 실패 시의 재조회가 오류 표시를 덮어쓰지 않게 할 것"** 을 후속으로 남겼다. D6이 이 숙제의 답이다.
- **4.1의 부채 — 이탈 후 실패의 무음.** 같은 문서가 **"웹 장바구니에서도 화면을 떠난 뒤의 실패가 무음이 되지 않도록"** 을 남겼다. 웹에는 `context.mounted` 문제가 없지만, **오류 문장을 타이머로 자동 소거하지 않는 것**이 같은 취지의 이행이다.
- **AD-13 — `999` 리터럴 확산.** `deferred-work.md`가 "같은 상한이 웹 장바구니·상품상세에 다시 놓이므로 확산 자체는 해소되지 않는다"고 예고했다. 최소한 **웹 안에서는 상수 한 곳**으로 가둔다 (D12).
- **8.1의 학습 — Chrome 헤드리스는 최소 500px 폭을 강제한다.** `<640` 구간은 500px으로 확인하고 390 고유 수치는 미디어쿼리 값과 대조한다.
- **8.3의 학습 — `params`는 Promise, `useSearchParams`는 Suspense 경계.** 장바구니 페이지 자체는 `useSearchParams`를 쓰지 않으므로 Suspense가 필요 없지만, **BFF의 `[id]`는 `await ctx.params`** 다. `apps/web/AGENTS.md`: "이건 네가 아는 Next.js가 아니다 — `node_modules/next/dist/docs/`를 먼저 읽어라."

### 에러 code 시드 (R6)

이 스토리가 만나는 `code`는 전부 **기존 백엔드 코드**이며 새로 만들지 않는다.

| code | HTTP | 언제 | 화면 처리 |
|---|---|---|---|
| `unauthorized` | 401 | 세션 만료·비로그인 | **조회**: `/login?next=%2Fcart`로 `replace` / **담기**: `/login?next=<상세 경로>&add=1` / **배지**: 조용히 배지 제거(이동 없음) |
| `not_purchasable` | 422 | 담기·수량 변경 술어 실패 | 낙관적 변경 되돌리기 + `message`(`지금은 구매할 수 없는 상품입니다.`) + `새로고침` 버튼. **자동 재조회 금지** |
| `not_found` | 404 | 없는 조합 / 남의·없는 cart item / BFF의 잘못된 id | `message` + 재조회로 목록을 서버와 맞춘다(이미 지워진 항목이므로 재조회가 오류를 덮어써도 손해가 없다 — **이 code만 예외**) |
| `validation_error` | 422 | `quantity` 범위 밖 | 스테퍼가 1~999를 강제하므로 방어적. `message` 표시 |
| `forbidden` | 403 | BFF `assertSameOrigin` 위반 | `message` + 재시도 (정상 브라우저 사용에서는 나오지 않는다) |
| `service_unavailable` | 503 · BFF 폴백 | 상류 장애, JSON 아닌 응답 | `message` + `다시 시도` |
| `internal_error` | 500 | 상류 미처리 예외 | `message` + `다시 시도` |
| `http_error` | 그 외 | 매핑 없는 상태 | `message` + `다시 시도` |
| (봉투 없음) | — | fetch throw(네트워크 단절) | `연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요.` |

**표시 규약**: 분기는 `code`, 표시는 `message`. **HTTP 코드·`code` 문자열을 화면에 렌더하지 않는다** (UX-DR9·15 — `로그인 실패 (401)`이 Don't 예시다).

### 발견한 위험 · 기존 코드의 문제 (구현 전에 읽을 것)

1. 🚨 **장바구니에 배송비를 실을 데이터가 없다 — UX 계약과 API 계약이 가장 크게 어긋나는 지점.** 목업의 장바구니는 묶음 헤더에 `배송비 3,000원`·`무료배송`을, 요약에 `배송비 3,000원`과 `결제 예정 금액 121,000원`을 그리고 있고 EXPERIENCE.md Flow 2의 절정("화면이 조용히 계산을 끝내 두었다")이 통째로 그 숫자 위에 서 있다. **그런데 `GET /carts`에는 배송비가 없고, 유일한 계산 경로 `POST /orders/preview`는 우편번호를 필수로 요구한다.** D2가 문장으로 자리를 지키지만, **Flow 2의 서사는 v1에서 완전히 재현되지 않는다.** Slur가 알아야 할 사실이며, 근본 해소는 백엔드 변경(Epic 8 경계 밖)이다.

2. 🚨 **체크박스가 조작 가능해 보이는데 조작할 수 없다.** UX-DR13은 "장바구니에서는 체크박스·수량 스테퍼·`삭제`를 갖는다"고 써서 체크박스가 선택 수단인 것처럼 읽히지만, `POST /orders/preview`에 항목 선택 파라미터가 없어 부분 선택은 주문서 금액과 어긋난다(D3). 잠긴 체크박스는 사용자가 눌러보고 반응이 없어 혼란스러울 수 있다 — **`aria-label`과 태그·안내 문장이 이유를 말하도록** 구현하고, 그래도 남는 위화감은 알려진 절충으로 기록한다.

3. 🚨 **`바로 구매`의 목적지가 없다.** 주문 생성은 `cart_item_ids` 기반이고 미리보기는 장바구니 전체를 전제한다. D9가 `/cart` 경유로 결정했지만 **버튼 문구와 동작 사이에 간극이 남는다.** `deferred-work.md`에 이미 등재된 제약이며 8.5 착수 시 다시 확인한다.

4. **`sellers.brand_name`에 UNIQUE 제약이 없다.** 두 판매자가 같은 브랜드명을 쓰면 장바구니에서 한 묶음으로 합쳐진다(D1). 큐레이션형 운영이라 실무 발생 가능성은 낮지만, **관리자 승인 시 브랜드명 중복을 막는 규칙이 어디에도 없다** — 별도 항목으로 기록한다.

5. **`purchasable` 판정에 수량이 들어간다.** `check_purchasable(product, variant, qty)`는 `stock >= qty`를 본다. 즉 **수량을 올리는 것만으로 같은 항목이 구매 불가가 될 수 있고**, 그 사실은 `PATCH`의 `422 not_purchasable`로 드러난다. "왜 3개는 되는데 4개는 안 되는가"를 화면이 설명할 방법은 없다(재고 수량이 응답에 없다). `message`를 그대로 보여주는 것이 v1의 답이다.

6. **담기 직후 구매 불가로 보일 수 있다.** 4.1의 확정 policy(요청 수량 기준 검증) 때문이며 버그가 아니다. 담기 성공 → 장바구니 진입 → 그 항목이 흐리게 보이는 시나리오가 실제로 존재한다. 사용자에게는 이상해 보이지만 **정직한 표시**이고, 최종 진실은 주문 생성의 조건부 UPDATE가 갖는다 (AD-4).

7. **`DELETE`가 204라 본문이 없다.** `res.json()`을 부르면 TypeError. `proxyWithRefresh`에 이미 204 분기가 있지만 **클라이언트 래퍼가 같은 실수를 할 수 있다**.

8. **CTA `주문하기`가 8.5 전에는 죽은 링크다.** `/checkout` 페이지가 아직 없다. 미들웨어 matcher에는 이미 등록돼 있어(8.1) 로그인 상태에서는 404가 뜬다. **8.4 완료 시점의 알려진 상태**로 기록하고, 버튼을 비활성으로 만들지는 않는다(8.5가 붙으면 바로 살아난다).

9. **8.2가 `buyer.css`·`lib/auth.ts`·`(buyer)/layout.tsx` 주변을 동시에 만지고 있다.** 이 스토리의 baseline(`10a2c4a`) 시점에는 8.2의 산출물이 커밋되지 않은 상태다. **착수 전에 `git pull` 후 실제 파일을 다시 읽는다** — 특히 `assertSameOrigin`·`auth-errors.ts`·`.b_checkbox`·`.b_btn`의 존재 여부.

10. **`middleware.ts`는 Next 16에서 deprecated이며 `proxy`로 이름이 바뀌었다**(8.1이 발견해 부채로 남긴 항목). 이 스토리는 미들웨어를 건드리지 않는다.

11. **이 머신에서 백엔드를 띄울 수 없다.** `uv`·`docker`가 PATH에 없어 `apps/api` pytest도 로컬 API도 불가능하다. Task 10이 대안 세 가지를 순서대로 지시한다. **"통과했다"고 쓰지 않는 것**이 8.1이 세운 규약이다.

12. **`--b-tab-stroke` 전역 규칙 주의.** `buyer.css`의 `[data-surface="buyer"] svg { stroke-width: var(--b-tab-stroke, 1.4px) }`가 **구매자 라우트의 모든 SVG**에 걸린다. 장바구니에서 새 인라인 SVG(스테퍼의 `−`·`+`를 도형으로 그리는 등)를 만들면 이 선 굵기를 물려받는다. **글자(`−`·`+`)로 만들면 이 문제가 없다** — 목업도 글자다.

### Project Structure Notes

- 정렬: `Consistency Conventions`의 "프론트 = Next.js App Router + 슬러 시스템 CSS", 그 위에 8.1이 얹은 구매자 스코프 확장 층. 8.4는 그 층을 **소비하고 공용 부품 셋(CTA 바·확인 줄·스테퍼)을 보탠다.** [Source: ARCHITECTURE-SPINE.md#Consistency-Conventions]
- 신규 라우트: `app/api/carts/**`(BFF 3파일). **페이지 URL 변경 0건** — `/cart`는 이미 존재하고 내용만 바뀐다.
- `app/api/carts/items`(정적)와 `app/api/carts/items/[id]`(동적)는 깊이가 달라 충돌하지 않는다.
- 컴포넌트 파일은 라우트 폴더 안에 평평하게 둔다. 여러 화면이 공유하는 것(`cart-count.tsx`·`cart-api.ts`)은 `(buyer)/` 바로 아래, 장바구니 전용은 `(buyer)/cart/` 안.
- `page.tsx`·`layout.tsx`·`route.ts`가 아닌 파일은 라우트를 만들지 않는다.
- 스택 핀: Next.js 16.2.10 / React 19.2.4. **의존성을 추가하지 않는다** — `package.json`·`package-lock.json` diff 0건이 AC 18의 증거다.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic-8 — 에픽 경계: 백엔드 무변경·ERD 0건·구매자 API 12개 재사용·테스트 153건]
- [Source: _bmad-output/planning-artifacts/epics.md#Story-8.4 — AC 원문(판매자 묶음·스테퍼·담은 뒤 품절·배지 vs CTA·삭제 확인·빈 상태·2단) 및 Dev Notes(API 4개·재담기 합산·확인 UI `[ASSUMPTION]`)]
- [Source: _bmad-output/planning-artifacts/epics.md#Story-8.2 — 담기 복귀(`next`) 계약, 역할 쿠키 `buyer`, Origin 검사 규약]
- [Source: _bmad-output/planning-artifacts/epics.md#Story-8.5 — 주문서가 구매 불가 항목을 받지 않는다, 미리보기·주문 생성 경계]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR3 — 탭바 56px·배지·장바구니만 CTA + 탭바 2단 예외·상단바 형태]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR4 — 장바구니 62/34 우측 sticky, 묶음이 하나면 sticky 없음, ≥768 CTA 승격, 폭 변경 시 상태 유지]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR5 — 여백 20/20/32, 본문 1080px, 행 내부 최대 폭 560px]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR7 — 터치 타깃 44×44, 스테퍼·`삭제`가 현재 미달]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR8 — 색 + 텍스트, 구매 불가 묶음 회색조 + 태그 + 안내 문장]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR9 — 빈 상태·skeleton·오류 표(HTTP 코드·code 미노출), 제출 중 버튼 비활성]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR12 — box-shadow 금지, 라운드 스케일, `full`은 카테고리 칩·개수 배지 둘만]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR13 — 판매자 묶음 뼈대, 금액 요약 행 순서·도서산간 0원 줄 유지, 배지 vs CTA 카운트]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR16 — 스와이프 삭제 금지, 모달 금지(우편번호만 예외), 확인 후 실행, `prefers-reduced-motion`]
- [Source: ux-designs/ux-SLUR_platform_blueprint-2026-07-21/DESIGN.md#frontmatter — colors·typography·rounded·spacing·components(seller-pack·amount-summary·checkbox·count-badge·tag·cta-bar·button) 값의 정본]
- [Source: ux-designs/…/DESIGN.md#Layout-&-Spacing — 8px 띠·hairline 3단 구획, CTA 바 + 탭바 112px 예산, 장바구니만 2단]
- [Source: ux-designs/…/DESIGN.md#Layout-&-Spacing#반응형 — 폭별 표, 장바구니 62/34 우측 sticky, 행 내부 560px, **2단 우측 칼럼에 한해 1px 테두리 상자 허용**]
- [Source: ux-designs/…/DESIGN.md#Components#판매자-묶음-카드 — 헤더/행/푸터 구조, 장바구니의 체크박스·스테퍼·`삭제`, 구매 불가 묶음의 grayscale·태그·안내 상자]
- [Source: ux-designs/…/DESIGN.md#Components#금액-요약 — 행 색·합계 21px/800 액센트·화면당 한 번]
- [Source: ux-designs/…/EXPERIENCE.md#Information-Architecture — 장바구니 헤더는 제목(좌측)·뒤로가기 없음, 목업의 뒤로가기는 스파인이 이긴다]
- [Source: ux-designs/…/EXPERIENCE.md#Component-Patterns — 수량 스테퍼(1에서 `−` 비활성·구매 불가는 비활성), 금액 요약 행 순서, 탭 배지 vs CTA 카운트]
- [Source: ux-designs/…/EXPERIENCE.md#State-Patterns — **담은 뒤 품절**(회색조·체크 해제·잠금·합계와 CTA에서 제외·`삭제`는 계속 눌림), 주문 생성 재검증 실패]
- [Source: ux-designs/…/EXPERIENCE.md#Flow-2 — 담아둔 물건이 품절됐을 때의 서사(배지 3 → 삭제 후 2, 합계는 그대로)]
- [Source: ux-designs/…/EXPERIENCE.md#Accessibility-Floor — 44×44 히트 영역, 상태의 프로그램적 전달, 포커스 순서]
- [Source: ux-designs/….working/screens-1-browse.html — 390px 확정본 장바구니 프레임: `.group` 20/20/18 패딩·`.chk` 16px·`.citem .ph` 74px·`.qty` 26px·`.del` 밑줄·`.group.dead` grayscale(.85)·`.deadtag`·`.deadnote`·`.summary` 8px 띠·`.bottombar.stack` 패딩 13px·`주문하기 (2건)`]
- [Source: ux-designs/….working/responsive-768-1280.html — 참고만. **카드 높이·비율은 고치기 전 값이라 DESIGN.md가 이긴다**]
- [Source: architecture/architecture-SLUR_platform_blueprint-2026-07-15/ARCHITECTURE-SPINE.md#AD-1 — FastAPI가 유일한 문지기, 미들웨어·쿠키는 판정이 아니다]
- [Source: …#AD-10 — 구매 가능 단일 술어(`check_purchasable`), 클라이언트 재판단 금지]
- [Source: …#AD-12 — 파생 값은 백엔드 계산(`final_price`·`purchasable_total`·배송비·`option_text`)]
- [Source: …#AD-14 — 클라이언트 표면 단일화, 하나의 Next.js 앱, 동일 BFF 경로, DESIGN/EXPERIENCE가 목업을 이긴다]
- [Source: implementation-artifacts/8-1-buyer-web-shell.md — D1~D6(토큰 스코프·라우트 그룹·포커스 링·반응형 유틸리티), 셸 컴포넌트 API, `CartBadge` 슬롯, 미실행 검증의 기록 규약]
- [Source: implementation-artifacts/8-3-buyer-product-browse-web.md — D1·D2(BFF 경계와 `proxyWithRefresh`의 401 부작용), D4(`?variant=`), D9(CTA 두 자리 렌더), D13(`formatWon`), Task 7의 8.4 접점]
- [Source: implementation-artifacts/4-1-cart.md — carts 백엔드 원 설계, SET NULL·upsert 근거, 요청 수량 기준 검증 policy, 에러 code 시드]
- [Source: implementation-artifacts/deferred-work.md — `guard()` invalidate·이탈 후 무음의 **8.4 후속 지정**, AD-13 `999` 확산, `바로 구매` 목적지 부재]
- [Source: implementation-artifacts/sprint-status.yaml#action_items — R3·R6·R7·R8·A-E456-5]
- [Source: apps/api/app/carts/router.py · schemas.py · service.py — 응답 필드·정렬·`purchasable`·`purchasable_total`·204 (읽기만)]
- [Source: apps/api/app/orders/service.py `preview_order`·`quote`·`create_order` — 미리보기가 장바구니 전체를 전제하고 우편번호를 요구한다는 사실 (D2·D3·D9의 근거, 읽기만)]
- [Source: apps/api/app/core/errors.py · core/security.py — 에러 봉투 `{code, message, details}`, `unauthorized` 401]
- [Source: apps/web/lib/auth.ts — `proxyWithRefresh`(401 시 `clearSessionCookies`·204 분기·쿠키 회전), `assertSameOrigin`(8.2 도입)]
- [Source: apps/web/app/api/sellers/products/route.ts · admin/orders/[id]/route.ts — BFF Route Handler 관례(uuid 검증·`await ctx.params`·봉투 그대로 전달)]
- [Source: apps/web/AGENTS.md — Next 16은 학습 데이터와 다르다. `node_modules/next/dist/docs/`를 먼저 읽는다]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Claude Code)

### Debug Log References

스크래치패드 전용 도구 2개 — **저장소에 커밋하지 않았고 확인 후 프로세스(스텁·dev 서버·헤드리스 크롬)를 전부 종료했다.**

| 도구 | 하는 일 |
|---|---|
| `cart-stub.mjs` | 장바구니 4개 + 상품상세 1개만 흉내 내는 Node 스텁(포트 8788). 응답 스키마·정렬·204·합산·999 캡은 `apps/api/app/carts/{schemas,service,router}.py`를 읽어 그대로 맞췄다. `/__mode`(full·single·empty·down·unauth) · `/__failpatch` · `/__delay` · `/__reset`로 실패·지연·빈 상태를 브라우저 재기동 없이 전환 |
| `cart-drive.mjs` | 최소 CDP 드라이버(Node 22 내장 WebSocket). `Network.setCookie`로 `slur_role`을 심고, `Emulation.setDeviceMetricsOverride`로 390·1280을 강제하며, 클릭·Tab·Esc·리사이즈·computed style 조회를 한다 |

로컬 웹은 `API_BASE_URL=http://localhost:8788 npx next dev -p 3010`으로 띄웠다 — **환경변수를 새로 만들지 않았고** 저장소 설정도 바꾸지 않았다.

### Completion Notes List

**Task 0~11 구현 완료.** 미실행 2건은 아래 "미실행" 절에 따로 적었다.

#### Task 0 — 선행 산출물의 실제 상태

- 8.2(`4399ef7`)·8.3(`bd5a52e`) 모두 머지돼 있다. `product-detail.tsx`·`buyer-feedback.tsx`·`format.ts` 존재 확인.
- **`formatWon`이 두 곳에 있었다** (`amount-summary.tsx` export + `format.ts`). D12대로 **`format.ts`를 정본**으로 두고 `amount-summary.tsx`가 `export { formatWon }`로 다시 내보내게 정리했다 — 기존 호출부(`product-card`·`product-detail`)는 한 줄도 바뀌지 않았다. 세 번째 구현은 만들지 않았다.
- `assertSameOrigin`은 `lib/auth.ts`에 있다(8.2). **`lib/auth.ts` diff 0건** — import만 했다.
- **하단 고정 CTA 바를 `browse.css` → `buyer.css`로 승격**하고 `browse.css`의 선언을 지웠다(값 복제 0건). 승격 후 상품상세를 1280/500에서 다시 확인: `≥768` 바 `none`·인라인 `block`, `<768` 바 `fixed; bottom: 0; padding: 13px 20px 20px` — **8.3과 동일**하다.
  - 담기 결과 한 줄을 CTA 위에 놓기 위해 `CtaPair`가 `.b_cta_slot` 래퍼를 갖게 바뀌었고, 그에 맞춰 `.b_cta_pair.m_inline` → `.b_cta_slot.m_inline`으로 토글 셀렉터가 옮겨갔다. 두 사본 렌더·CSS display 전환이라는 8.3 D9의 구조는 그대로다.

#### 데이터 확보 (Task 10) — 3번 경로를 썼다

프로덕션 API 호스트가 저장소에 없고(서버 전용 환경변수), **이 스토리는 쓰기(담기·수량·삭제)를 하므로** 프로덕션 계정 장바구니를 건드리는 것이 R8상 더 위험하다. 그래서 **스크래치패드 스텁**(경로 3)으로 확인했다. **아래 화면 확인 결과는 전부 스텁 데이터 기준**이며, 실서버 응답으로의 재확인은 프로덕션 배포 후 한 번 필요하다(R3와 함께). 프로덕션 데이터를 만들지 않았으므로 **정리할 테스트 데이터도 없다.**

#### 확인 케이스 (Task 10)

스텁 장바구니 구성: 토림도예 2행(가능 1 + 불가 1) · 곳간 1행(전부 불가) · 온실 2행(수량 1 · 수량 999) · `variant_id: null` 1행.

| 케이스 | 결과 |
|---|---|
| 판매자 2인 이상 묶음 | `토림도예:2 \| 곳간:1[dead] \| 온실:2 \| 판매 종료:1[dead]` — 응답 순서 그대로, 재정렬 0건 |
| **가능+불가 혼재 묶음** (D4) | 토림도예에 **헤더 태그가 붙지 않고** 2번째 행만 흐림·취소선·스테퍼 비활성. 체크박스는 `checked` |
| **전부 불가 묶음** | 곳간·판매 종료에 `구매 불가 · 품절` 태그 + `--b-accent-wash` 안내 상자 + 체크 해제. 합계에서 제외됨 |
| `variant_id: null` | 브랜드 라벨 `판매 종료`, 상품명 `판매 종료된 상품`, 행 금액 `—` |
| 이미지 없는 항목 | 같은 74px 종이 그늘 면으로 자리 유지 |
| 옵션 없는 항목 | 옵션 줄에 `—` — 행 높이가 흔들리지 않는다 |
| 수량 1 / 999 | 스테퍼 disabled 배열 `[true,false]` / `[false,true]` — 1에서 `−`, 999에서 `+`가 잠긴다. 구매 불가 행은 `[true,true]` |
| 빈 장바구니 | `장바구니가 비어 있습니다.` + `쇼핑 계속하기`(→`/`). **금액 요약 0개 · CTA 바 0개 · 탭바는 유지 · 배지 미표시** |

- 체크박스 4개 전부 `disabled`이고 `aria-label`이 `주문에 포함` / `구매 불가 — 주문에서 제외`다 (D3).
- 금액 요약: `상품 금액 6,112,000원 / 배송비 주문서에서 확인 / 도서산간 추가 주문서에서 확인 / **상품 금액 합계** 6,112,000원` — **배송비 숫자 0건, 도서산간 줄 유지, 목업의 `결제 예정 금액` 미사용** (D2).
- 요약 아래 한 줄: `배송비는 판매자마다 다르며 배송지를 입력하면 주문서에서 확정됩니다.`

#### 배지 vs CTA 카운트 (AC 8)

같은 화면에서 **배지 `6`(담긴 행 전체) vs CTA `주문하기 (3건)`(구매 가능 행)** — 두 값이 다른 것이 정상이며 화면에 "왜 다른가" 설명 장치를 두지 않았다. 항목 하나를 삭제하니 **배지 5 · CTA 2건**으로 함께 갱신됐다(새로고침 없이). 둘 다 수량 합이 아니라 행 수다(수량 999 항목이 1건으로 센다).

#### 폭별 렌더 (390 / 700 / 768 / 1280)

390·1280은 CDP `Emulation.setDeviceMetricsOverride`로 강제했다(헤드리스 크롬 500px 최소 폭 제약 우회 — 8.1의 학습).

| 폭 | 확인 결과 |
|---|---|
| **390** | 한 칼럼 · 묶음이 화면 끝까지(`padding-inline: 20px`) · 금액 요약 앞 8px 종이 접기 띠 · 하단 `CTA 바(bottom: 56px)` 위 `탭바` **2단** |
| **700** | 390과 같은 한 칼럼 · `.b_cart display: block` · CTA 바 `block`, `bottom: 56px` · 탭바 `flex` · 요약 띠 8px |
| **768** | 2단 전환 · 우측 칼럼 1px hairline 상자 · CTA가 우측 칼럼 안으로 승격 · **고정 바·탭바 `none`** · 상단 내비 등장 |
| **1280** | 본문 1080px 가운데 · grid `629.9px / 345.5px` = **62% / 34%**, gap 4% · 우측 `position: sticky; top: 74px`(54+20) · 고정 바 `none` |

- **<768 하단 여백**: 스크롤 최하단에서 마지막 콘텐츠 bottom 607 → CTA 바 top 611 → 바 bottom 684 = 탭바 top 684 → 뷰포트 740. **마지막 묶음·요약이 가려지지 않는다.**
- **묶음이 하나뿐이면 sticky 없음**: `mode=single`(온실 1묶음)에서 `data-sticky` 속성 자체가 없고 `position: static`이다 (UX-DR4).
- 768~900 구간에서 우측 칼럼이 240px 남짓이라 `상품 금액 합계`가 두 줄로 꺾이는 것을 캡처에서 발견해, **장바구니 요약에 한해** 합계 라벨·값에 `white-space: nowrap`을 걸었다(새 수치·새 색 아님).

#### 폭 변경 시 상태 유지 (AC 14) — 결정적으로 확인됨

390에서 (a) 수량 변경 실패 문장, (b) 열린 삭제 확인 줄을 각각 만든 뒤 **1280 → 다시 390**으로 바꿨더니 둘 다 그대로 살아 있었다(`err: "지금은 구매할 수 없는 상품입니다.새로고침"`, `confirm: "유광 도자 머그 삭제 확인"`). 같은 시점에 CTA 바 `display`와 grid만 바뀐다. **`matchMedia`·`innerWidth`·`resize` 사용 0건**(구매자 문서 전체 grep — 주석 4줄만 매치).

#### 수량 스테퍼 (AC 4, D6)

| 시점 | 관측 |
|---|---|
| `+` 클릭 직후 | 수량 2→**3 즉시**, 행 금액 64,000→**96,000원 즉시** |
| 요청 중(스텁 1.2s 지연) | **그 행**의 `−`·`+`·`삭제` 전부 `disabled`, **다른 행은 조작 가능**, skeleton 0개 |
| 성공 후 | 합계가 서버 값으로 교체(6,112,000→6,144,000원), 배지·CTA 갱신, **skeleton 없음·`scrollY` 불변** |
| 실패(`422 not_purchasable`) | 수량 **2로 복원** · 행 금액 복원 · 합계 불변 · 그 행 아래 `지금은 구매할 수 없는 상품입니다.` + `새로고침` · **2.5초 뒤에도 문장이 그대로**(자동 재조회·자동 소거 0건) |

**Flutter판 `guard()` finally-invalidate 부채가 갚혔다** — 실패가 화면을 다시 로딩시키지 않고 오류 문장을 덮어쓰지도 않는다.

#### 삭제 (AC 5, D7)

- `삭제` → 그 행이 `삭제할까요? · 삭제 · 취소` 인라인 줄로 바뀐다. `role="group"`, `aria-label="유광 도자 머그 삭제 확인"`. **모달·`window.confirm`·스와이프 0건.**
- 확인 줄이 열리면 **포커스가 `삭제`로 이동**(`activeElement` = `.i_btn.m_yes`), **`Esc`로 닫으면 원래 `삭제` 버튼으로 되돌아온다**(먹색 포커스 링 `rgb(31, 29, 26)`).
- 다른 행의 `삭제`를 누르면 **확인 줄은 항상 1개**다.
- 확인 후 실행 → 항목 5개로 줄고 배지 6→5, CTA 3건→2건, 합계 갱신, 확인 줄 닫힘. 마지막 항목까지 지우면 빈 상태로 전환된다.

#### 담기·바로 구매·로그인 복귀 (Task 8·11)

| 시나리오 | 결과 |
|---|---|
| 로그인 상태 `장바구니 담기` | 제출 중 **두 버튼 `disabled`** → 성공 시 CTA 위 인라인 `장바구니에 담았습니다.` + `장바구니 보기`(→`/cart`). **`[role=dialog]` 0개, 토스트 0개** |
| 같은 조합 재담기 | 서버가 2→3으로 **합산**(화면은 합산을 흉내 내지 않는다). 배지는 행 수라 6 그대로 |
| `바로 구매` | 담기 후 **`/cart`로 이동**, 기존 4묶음이 함께 보인다(약속을 어기지 않는다). `/checkout` 직행 0건 |
| **비로그인 담기** | 401 → `/login?next=%2Fproducts%2F…%3Fvariant%3D…%26add%3D1`. 쿠키 사전 판정 0건 |
| **복귀(`&add=1`)** | 담기가 **정확히 한 번**(수량 2→3) 실행되고 URL이 `?variant=…`로 정리된다. `history.length` 2 — `replace`라 히스토리가 늘지 않는다. **개발 StrictMode 이중 마운트에서도 한 번**(ref 가드) |
| 복귀 직후 **새로고침** | `add`가 이미 없으므로 **재담기 0건**(수량 3 유지) |
| `add=1` + **구매 불가 조합** | 자동 실행하지 않고 `add`만 제거, CTA 두 개 비활성 유지 |

#### 실패 경로 · 세션 (Task 11)

| 상황 | 화면 |
|---|---|
| 상류 중단(503) | `일시적인 오류입니다.` + `다시 시도`. 문서에 `service_unavailable`·HTTP 숫자 0건 |
| `GET /carts` 401 | `slur_role`이 남아 미들웨어는 통과하지만 **`/login?next=%2Fcart`로 `replace`** |
| 담기 401 | `/login?next=<상세 경로>&add=1` (위 표) |
| 수량 실패 | 되돌리기 + `message` + `새로고침`, 재조회 없음 |

문서 전체 텍스트 스캔에서 `not_purchasable`·`unauthorized`·`http_error`·HTTP 상태 코드 **0건**(매치된 세 자리 숫자는 전부 금액 자릿수였다).

#### 접근성 · 색

- **Tab 순서(390)**: `− > + > 삭제 > 삭제 > 삭제 > + > 삭제 > − > 삭제 > 삭제 > 주문하기 (3건) > 홈 > 장바구니 > 주문내역 > 내 정보`. **하단 고정 바가 콘텐츠보다 먼저 걸리지 않는다**(UX-DR6). 잠긴 체크박스는 탭에서 빠지지만 태그·안내 문장·`aria-label`이 같은 사실을 텍스트로 전달한다.
- 스테퍼 `−`·`+`는 **글자**다(위험 12의 `svg { stroke-width }` 전역 규칙을 물려받지 않는다). 시각 26px을 유지하고 `::before` 오버레이로 히트 영역만 44×44로 넓혔다. `삭제`도 `min-height: 44px`.
- 1280 문서 전체 computed style 스캔: **파랑 `rgb(47,107,255)` 0건 · `box-shadow` 0건.**
- 포커스 링은 전부 먹색 `rgb(31, 29, 26)`.

#### 정적 검증

| 항목 | 결과 |
|---|---|
| `npx tsc --noEmit` | **0** |
| `npm run lint` | **0 errors · 0 warnings** (A-E456-5 베이스라인 유지) |
| `npx next build` | **성공** — 43 라우트. 신규는 `/api/carts` · `/api/carts/items` · `/api/carts/items/[id]` **셋뿐**이고 페이지 URL 변경 0건 |
| `grep #2f6bff\|--color-brand\|--shadow-\|box-shadow` in `(buyer)` | 실제 선언 **0건**(주석 4줄 + 8.1의 포커스 링 `box-shadow: none` 1줄만 매치 — 기존 코드) |
| `git diff --stat` | `apps/api` **0건** · `apps/mobile` **0건** · `app/styles/slur/**` **0건** · `app/styles/buyer/**` **0건** · `package.json`·`package-lock.json` **0건** · `lib/auth.ts` **0건** · `seller-pack.tsx` **0건** |

#### 구현 중 내린 작은 판단 (D1~D12 밖, 근거를 남긴다)

1. **`buyer-icons.tsx`에 `"use client"`를 붙였다.** `CartBadge`가 컨텍스트를 읽어야 하는데, 이 모듈의 값 소비자(탭바·상단 내비·상단바)는 원래부터 전부 클라이언트 컴포넌트였고 서버 컴포넌트(`buyer-shell`)는 `import type`으로 타입만 가져간다(컴파일에서 지워진다). **세 호출부 `<CartBadge />`는 한 글자도 바뀌지 않았다.** `count` prop은 override로 남겨 타입 변경이 tsc를 깨지 않게 했다.
2. **`GENERIC_MESSAGE`를 `buyer-feedback.tsx`에서 export했다.** `cart-api.ts`가 같은 최후 문장을 쓰는데 상수를 복제하면 두 화면의 문장이 갈린다. 값·용도는 그대로다.
3. **`.b_seller_pack.m_unavailable .b_brand_label`에 `--b-ink-unavailable`을 추가했다.** 목업의 `.group.dead .brandline`이 그렇게 돼 있는데 8.1의 규칙은 `.i_items`만 덮고 있어 브랜드 라벨만 먹색으로 남았다. 기존 선언을 고치지 않고 한 줄 추가했다.
4. **`.b_tag.m_unavailable`(면 있는 태그)을 `buyer.css`에 뒀다.** `type.css`의 `.b_tag`는 글자 규격만 갖는다. 8.6의 상태 태그가 같은 면을 쓸 것이므로 장바구니 전용 클래스로 가두지 않았다. 값(`--b-accent-soft` 면 + `--b-accent` 글자 + `rounded-xs`)은 전부 기존 토큰이다.
5. **`.b_seller_pack .i_foot`의 구획선을 장바구니 안에서만 덮었다.** 8.1의 `i_foot`은 배송비·액션용 상단 구획선을 갖는데, 구매 불가 안내 상자에는 그 선이 필요 없다. `.b_cart .b_seller_pack .i_foot`로만 덮어 8.5·8.6의 푸터 계약을 건드리지 않았다.
6. **조작 행은 `space-between`이 아니라 좌측 정렬 + 20px 간격**이다. 목업은 270px 칼럼 기준이라 `space-between`이 자연스럽지만, ≥768 좌측 칼럼(≈630px)에서는 스테퍼와 `삭제`가 500px 벌어진다(UX-DR5). `.b_row`(560px)와 함께 스토리 Task 4의 지시를 그대로 따랐다.
7. **`not_found`(404)만 실패 후 재조회한다.** 이미 지워진 항목이라 재조회가 오류를 덮어써도 손해가 없다 — R6 에러 code 표가 명시한 유일한 예외다. 나머지 code는 재조회하지 않는다.
8. **로딩·오류·빈 상태를 `result === null` 파생으로 만들었다.** `react-hooks/set-state-in-effect`가 effect 본문의 동기 `setState`를 **error**로 잡는다(8.3의 학습). 자동 담기 실행도 `setTimeout(…, 0)` 뒤로 밀어 같은 규칙을 지켰다.

#### 미실행 (통과했다고 쓰지 않는다)

- **`cd apps/api && uv run pytest -q` — 미실행.** 이 머신의 PATH에 `uv`도 `docker`도 없다. **이 스토리는 `apps/api`를 한 파일도 열지 않았고 `git diff --stat`에 `apps/api` 0건**이므로 153건에 영향을 줄 경로가 없다. 실행 환경이 있는 곳에서 한 번 확인해 주기 바란다.
- **프로덕션 실데이터 확인 — 미실행.** 위 "데이터 확보" 참조. **R3(프록시 뒤 Origin 검사)도 여기 걸린다** — `assertSameOrigin`을 타는 신규 라우트가 셋(POST·PATCH·DELETE) 생겼으므로 **배포 후 담기·수량 변경·삭제를 각각 1회씩** 프로덕션에서 눌러 봐야 done이다. 로컬 확인만으로 넘기지 않는다.
- **봉투 없는 실패(네트워크 단절) — 코드 경로만 확인.** 상류가 죽어도 BFF가 봉투를 만들어 주므로 브라우저↔BFF 단절을 재현하지 못했다(8.3과 같은 한계).

#### 사람이 판단할 것

- **`주문하기 (N건)`는 8.5 전까지 죽은 링크다.** `/checkout` 페이지가 없고 미들웨어 matcher에는 이미 등록돼 있어 로그인 상태에서 **404**가 뜬다. 스토리 위험 8의 지시대로 버튼을 비활성으로 만들지 않았다 — 8.5가 붙으면 그대로 살아난다.
- **문구 `[ASSUMPTION]` 4개** — `주문서에서 확인` · `상품 금액 합계` · `배송비는 판매자마다 다르며 배송지를 입력하면 주문서에서 확정됩니다.` · `삭제할까요?`. 스파인 Voice·Tone 표에 없다. **Slur 확인 항목** (D2).
- **위험 1 재확인** — 장바구니에 배송비를 실을 데이터가 없어 EXPERIENCE.md Flow 2의 절정("화면이 조용히 계산을 끝내 두었다")이 v1에서 재현되지 않는다. 근본 해소는 백엔드 변경(장바구니 응답에 `seller_id` + 기본 배송비, 또는 우편번호 없는 `preview` 모드)이며 Epic 8 경계 밖이다.
- **위험 2 재확인** — 잠긴 체크박스는 눌러도 반응이 없다. `aria-label` + 태그 + 안내 문장으로 이유를 말하게 했지만 위화감은 남는다(D3의 알려진 절충).
- **위험 4 재확인** — `sellers.brand_name`에 UNIQUE 제약이 없어 두 판매자가 같은 브랜드명을 쓰면 한 묶음으로 합쳐진다. 관리자 승인 시 브랜드명 중복을 막는 규칙이 어디에도 없다.

### File List

**신규 (10)**

```
apps/web/app/api/carts/route.ts                    GET  → /api/v1/carts
apps/web/app/api/carts/items/route.ts              POST → /api/v1/carts/items          (assertSameOrigin)
apps/web/app/api/carts/items/[id]/route.ts         PATCH · DELETE                       (assertSameOrigin)
apps/web/app/(buyer)/cart-api.ts                   조회·담기·수량·삭제 fetch 래퍼 (204 분기 포함)
apps/web/app/(buyer)/cart-count.tsx                CartCountProvider · useCartCount (D5)
apps/web/app/(buyer)/cart/cart-view.tsx            본체 — 조회·묶음·수량·삭제·요약·CTA
apps/web/app/(buyer)/cart/cart-pack.tsx            묶음 하나 + 항목 행 + 확인 줄
apps/web/app/(buyer)/cart/cart.css                 장바구니 전용 배치·구매 불가 표기·골격
apps/web/app/(buyer)/cart/constants.ts             MAX_CART_QTY 등 (D12)
```

**수정 (8)**

```
apps/web/app/(buyer)/cart/page.tsx                 자리표시 → CartView (셸 호출부 3값 불변)
apps/web/app/(buyer)/layout.tsx                    CartCountProvider로 children을 감쌈
apps/web/app/(buyer)/buyer-icons.tsx               "use client" + CartBadge가 컨텍스트를 읽음
apps/web/app/(buyer)/amount-summary.tsx            null 값 미확정 문구 · totalLabel prop · formatWon 재export
apps/web/app/(buyer)/buyer-feedback.tsx            GENERIC_MESSAGE export (문장 복제 방지)
apps/web/app/(buyer)/buyer.css                     .b_cta_bar 승격(+m_stack) · .b_confirm_row · .b_stepper · .b_tag.m_unavailable · i_value.m_pending
apps/web/app/(buyer)/browse.css                    .b_cta_bar 선언 제거 · .b_cta_slot 토글로 이동
apps/web/app/(buyer)/products/[id]/product-detail.tsx  TODO(8.4) → 담기·바로 구매·복귀 자동 담기
```

**변경 없음(의도적)**: `apps/api/**` · `apps/mobile/**` · `apps/web/lib/auth.ts` · `app/styles/slur/**` · `app/styles/buyer/**` · `seller-pack.tsx` · `middleware.ts` · `package.json` · `package-lock.json`

### Change Log

| 날짜 | 변경 | 비고 |
|---|---|---|
| 2026-07-22 | 스토리 작성 (D1~D12, Task 0~11) | baseline `10a2c4a` |
| 2026-07-22 | 구현 — BFF 3파일·장바구니 화면·배지 컨텍스트·상품상세 담기 연결. tsc 0 / lint 0·0 / build 성공. 390·700·768·1280 렌더 확인(스텁) | Status → review. pytest·프로덕션 확인은 미실행 |
