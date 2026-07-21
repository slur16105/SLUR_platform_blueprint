---
baseline_commit: bd5a52e22099afc7d659b10ffb2ef96da872b191
---

# Story 8.5: 주문서·주문완료 (구매자 반응형 웹)

Status: ready-for-dev

> **선행 조건.** 이 스토리는 **8.4(장바구니)가 끝난 뒤** 착수한다.
> 8.4가 만드는 `app/api/carts/**`(BFF) · `(buyer)/cart-api.ts` · `cart-count.tsx`(배지 컨텍스트) ·
> `buyer.css`의 하단 고정 CTA 바(`.b_cta_bar`) · `amount-summary.tsx`의 **미확정 값 지원**이 이 스토리의 입력이다.
> 8.4의 `주문하기 (N건)` 링크가 가리키는 `/checkout`이 바로 이 스토리의 산출물이며, 8.4 완료 시점에는 그 링크가 404다.
> 순서를 바꿔 착수하면 8.5가 위 다섯을 대신 만들게 되고 경계가 무너진다.

## Story

As a 구매자,
I want 배송지를 넣고 최종 금액을 확인한 뒤 주문하는 것,
So that 얼마를 어디로 입금해야 하는지 알고 끝낼 수 있다.

## Acceptance Criteria

1. **Given** 로그인 상태의 `/checkout` **When** 진입 **Then** **배송지 · 배송 요청사항 · 주문 상품(판매자 묶음, 읽기 전용) · 결제 금액 · 결제 수단** 다섯 구획이 **8px 종이 접기 띠**와 1px hairline으로 구분되어 이 순서로 표시된다 (FR-16, UX-DR12·13)
   - **And** 상단바는 `back-title`(뒤로가기 + `주문서`)이고 **탭바가 서지 않는다** — 셸 호출은 `tab="cart"`, `showTabbar` 없음 (EXPERIENCE IA 표: 주문서는 소속 최상위가 `장바구니`다)
   - **And** 구획 제목은 `b_section_label`(10.5px/800/`.16em`)로 `배송지` · `배송 요청사항` · `주문 상품 · 판매자 N곳` · `결제 금액` · `결제 수단`이다
   - **And** **구매 불가 항목은 주문서에 나타나지 않는다** — 필터는 서버가 이미 했고(`get_purchasable_entries`) 화면은 그 결과만 그린다 (FR-35, AD-10)

2. **Given** 주문서 진입 직후(아직 우편번호 없음) **When** 렌더 **Then** `GET /api/v1/carts`의 **구매 가능 항목만**으로 판매자 묶음과 `상품 금액`이 먼저 그려지고, 배송비·도서산간·합계 줄은 **값 자리에 `배송지 입력 후 계산`**(`--b-ink-muted`)이 놓인다 — **줄을 지우지 않는다** (D12, UX-DR13)
   - **And** 이때 하단 CTA는 금액 없이 `주문하기`이고 `disabled`다
   - **And** 우편번호가 확정되면 묶음·금액이 `POST /api/v1/orders/preview` 결과로 **통째로 교체**된다 — 두 소스를 섞어 계산하지 않는다

3. **Given** 배송지 구획 **When** 렌더 **Then** `수령인` · `연락처` · `우편번호`(+ `우편번호 검색` small 버튼) · `주소` · `상세주소` 다섯 필드와 그 아래 `배송 요청사항` 한 필드가 46px 고정 높이 입력으로 놓인다 (DESIGN.md `{components.input}` — 목업의 패딩 방식이 아니라 **46px로 통일**)
   - **And** `우편번호`·`주소`는 검색 결과로 채워지되 **직접 입력도 항상 가능하다** (외부 스크립트가 죽어도 주문이 막히지 않아야 한다 — D1)
   - **And** `상세주소`·`배송 요청사항`은 `(선택)`을 라벨에 덧붙인다
   - **And** 폼 오류는 **해당 필드에만** 오류 테두리(`--b-accent`) + 면(`--b-field-error-surface`) + 아래 한 줄 메시지로 표시한다. **상단 요약 배너를 쓰지 않는다** (UX-DR9)
   - **And** 라벨-필드-오류가 `htmlFor`/`id`/`aria-describedby`로 프로그램적으로 묶인다

4. **Given** `우편번호 검색` **When** 누름 **Then** **< 768은 전체 화면 오버레이, ≥ 768은 가운데 모달**로 열린다 — **이 제품의 유일한 모달 예외다** (UX-DR16)
   - **And** 오버레이는 `role="dialog"` `aria-modal="true"` `aria-label="우편번호 검색"`이고, 열리면 포커스가 안으로 들어가 **갇히며**, `Esc`·`닫기`로 닫으면 **원래 `우편번호 검색` 버튼으로 포커스가 돌아온다**
   - **And** 열려 있는 동안 뒤 본문이 스크롤되지 않는다
   - **And** 주소를 고르면 `우편번호`(zonecode)와 `주소`(도로명/지번 — 사용자가 고른 쪽)가 채워지고 오버레이가 닫히며 **포커스가 `상세주소` 필드로 간다** — 상세주소는 직접 입력이다
   - **And** 스크립트 로드에 실패하면 오버레이 안에 `우편번호 검색을 불러오지 못했습니다. 우편번호를 직접 입력해 주세요.` + `다시 시도` · `닫기`가 놓이고, **우편번호·주소 필드는 계속 직접 입력할 수 있다**
   - **And** 새 npm 의존성을 추가하지 않는다 (`react-daum-postcode` 같은 래퍼 금지 — `package.json` diff 0건)

5. **Given** 우편번호가 정해지거나 바뀜 **When** 금액을 갱신 **Then** `POST /api/v1/orders/preview {postal_code}` 재조회 결과로 **판매자별 배송비 · 도서산간 추가비 · 합계**가 갱신된다 — **클라이언트가 배송비를 계산하지 않는다** (AD-11, AD-12)
   - **And** 재조회는 **이벤트 핸들러에서만** 시작한다(검색 완료 / 5자리 직접 입력 완성 / `다시 시도`). **`useEffect`가 우편번호를 감시해 부르지 않는다** — `react-hooks/set-state-in-effect`가 lint error이고(8.3의 학습) 이 화면은 재조회가 가장 잦다
   - **And** 요청마다 순번을 매기고 **응답 도착 시점의 순번이 최신이 아니면 결과를 버린다** — 이전 우편번호의 금액이 화면에 남는 Flutter판 경합을 재현하지 않는다 (D2)
   - **And** 재조회 중에도 이전 금액을 지우지 않고 요약 구획에만 진행 표시를 둔다. 화면이 skeleton으로 되돌아가거나 스크롤이 튀지 않는다
   - **And** **도서산간 추가 줄은 0원이어도 사라지지 않는다** (FR-17, UX-DR13)

6. **Given** 금액 요약 **When** 렌더 **Then** 행 순서가 **상품 금액 · 배송비 · 도서산간 추가 · 결제 예정 금액**으로 고정되고, 값은 응답의 `item_total` · `shipping_total` · `remote_extra_total` · `grand_total`에서 **각각 하나씩** 온다 — 클라이언트가 더하거나 빼지 않는다 (AD-12)
   - **And** 합계 라벨은 **`결제 예정 금액`**이다 (장바구니의 `상품 금액 합계`와 다르다 — 여기서는 배송비가 확정되므로 이 이름이 참이다)
   - **And** 합계 값은 21px/800 액센트이며 **화면당 한 번만** 나타난다 — 하단 CTA의 금액은 `b_price_total`을 쓰지 않는다
   - **And** 요약 아래 한 줄: 일반 지역(`remote_area_kind === null`)이면 `배송지가 제주·도서산간이면 이 자리에 추가 배송비가 더해집니다.`, 제주·도서면 각각 `제주 지역 추가 배송비가 포함되었습니다.` · `도서산간 추가 배송비가 포함되었습니다.` `[ASSUMPTION]`
   - **And** 묶음 헤더 우측 배송비는 그 묶음의 `shipping_total`(기본 + 도서산간)이고 `0`이면 `무료배송`이다

7. **Given** 결제 수단 구획 **When** 렌더 **Then** **무통장입금 하나뿐인 라디오**가 선택된 상태로 놓이고, 그 아래 `입금 확인 후 배송이 시작됩니다. 주문 후 3일 안에 입금하지 않으면 자동 취소됩니다.`가 표시된다 (FR-18, UX-DR15)
   - **And** 결제 수단은 **API로 전송하지 않는다** — `OrderCreateRequest`에 그런 필드가 없다. 화면에만 존재하는 사실 표기다
   - **And** 라디오는 16px 원 + 먹색 점이며 키보드로 포커스된다

8. **Given** 주문서 하단 **When** `주문하기` 직전 화면 **Then** **중개자 고지가 청약 버튼 바로 위, 같은 스크롤 흐름 안**에 놓인다 — 스크롤 끝·별도 페이지·모달·"더보기" 뒤가 아니다 (FR-32, UX-DR10)
   - **And** 문구는 `app/config/company.ts`의 **`BROKER_NOTICE` 상수를 임포트**해 렌더한다 — 문자열을 복사하지 않는다 (8.3 D10이 세운 규약, 정본은 코드 상수)
   - **And** **≥ 768 2단에서도 고지는 우측 sticky 칼럼이 아니라 2단 아래 전체 폭**에 놓인다 (UX-DR10)
   - **And** 표기는 `b_notice`(11px/1.75 `--b-ink-quiet`, 위 1px hairline). 아이콘도 색 면도 없다 — 법적 고지는 경고가 아니라 인쇄된 사실이다

9. **Given** `주문하기` **When** 누름 **Then** `POST /api/v1/orders`가 **preview가 준 `cart_item_id` 전부**와 **화면이 보여준 `grand_total`**(`expected_grand_total`)로 호출되고, 제출 중에는 버튼이 비활성이며 중복 제출이 차단된다 (UX-DR9)
   - **And** 항목을 고르는 수단을 만들지 않는다 — preview는 장바구니 전체를 전제하므로 부분 주문은 금액과 어긋난다 (8.4 D3와 같은 사실)
   - **And** 우편번호가 미확정이거나 필수 배송지 필드가 비어 있으면 버튼이 `disabled`다
   - **And** 전화번호는 전송 직전 숫자만 남긴다(`replace(/\D/g, "")`) — 서버 계약이 `^\d{9,11}$`이고 하이픈을 받지 않는다 (위험 4)

10. **Given** 주문 직전 어떤 항목이 구매 불가로 바뀜 **When** 주문 요청 **Then** **주문이 생성되지 않고**, 응답 `code`가 `out_of_stock`이면 봉투 `details`의 `product_name` · `option_text`를 **항목별로 나열**해 무엇이 문제인지 알린다 (FR-35, UX-DR9)
    - **And** 그 자리에 `장바구니로 이동`(→ `/cart`) 버튼을 둔다. **자동으로 이동하지 않는다** — 사용자가 무엇이 빠지는지 읽을 시간을 준다
    - **And** 장바구니로 돌아가면 8.4가 `GET /carts`의 `purchasable`을 그대로 표시하므로 해당 묶음이 구매 불가 상태로 갱신되어 보인다 — 8.5가 장바구니 상태를 따로 조작하지 않는다
    - **And** **HTTP 상태 코드와 `code` 문자열이 화면 어디에도 나타나지 않는다** (분기는 `code`, 표시는 `message`)

11. **Given** 주문 실패의 나머지 갈래 **When** 각 `code` **Then**
    - `price_changed`(409): `message` 표시 + **미리보기를 자동 재조회해 새 금액으로 갱신**하고, **주문을 자동 재제출하지 않는다** — 사용자가 새 금액을 보고 다시 누른다
    - `empty_cart`(422) / `not_found`(404): `message` + `장바구니로 이동`
    - `duplicate_request`(409): `이미 처리된 주문 요청입니다.` + `주문내역 보기`(→ `/orders`) — 같은 주문이 두 번 만들어진 것이 아니라 **이미 만들어졌다**는 뜻이다
    - `validation_error`(422): 봉투 `details`를 **필드로 매핑**해 해당 입력 아래에 표시한다
    - `unauthorized`(401): `/login?next=%2Fcheckout`로 `replace`
    - 봉투 없는 실패: `연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요.`

12. **Given** 주문 성공 **When** `/orders/complete`로 이동 **Then** 이동은 `router.replace("/orders/complete?order=<order_id>")`이고, 완료 화면은 **`GET /api/v1/orders/{id}`로 주문을 다시 조회해** 그린다 (D3)
    - **And** **새로고침·북마크·뒤로가기에서 깨지지 않는다** — 화면이 자기 데이터를 스스로 가져오며, 생성 응답을 메모리로 나르지 않는다
    - **And** `replace`이므로 뒤로가기는 `/checkout`이 아니라 그 이전(`/cart`)으로 간다 — 주문 성공으로 장바구니가 비었기 때문에 `/checkout`으로 되돌아가면 `empty_cart`가 된다
    - **And** `order` 파라미터가 없거나 UUID 형식이 아니거나 404면 `주문을 찾을 수 없습니다.` + `주문내역 보기`를 표시한다 — 빈 화면이 되지 않는다

13. **Given** `/orders/complete` **When** 렌더 **Then** `주문이 접수되었습니다` + `주문번호` + **입금 안내 상자**가 놓이고, **이 화면의 중심은 축하가 아니라 입금 안내 상자다** (FR-23, UX-DR14)
    - **And** 입금 안내 상자는 종이 면 + **1.5px 액센트 테두리** + 5px 라운드 + 상단 노치 캡션 `입금 안내`(10px/800/`.2em`/액센트), `입금 금액` **27px/800 액센트**, 그 아래 `입금 계좌` · `입금 기한`, 그 아래 `--b-paper-shade` 메모 상자
    - **And** 금액·계좌·기한은 전부 `deposit_info`의 서버 값이다 — **하드코딩하지 않는다** (AD-13). 계좌는 관리자 설정(`settings.deposit_account`)에서 온 **한 문자열**이며 화면이 은행/번호/예금주로 쪼개지 않는다 (위험 1)
    - **And** 기한은 `deposit_due_at`을 **`Asia/Seoul` 고정 타임존**으로 `2026년 7월 24일까지` 형식으로 낸다 — 브라우저·서버 로컬 타임존에 맡기면 날짜가 하루 어긋나고 하이드레이션이 불일치한다 (D10)
    - **And** 주문번호는 응답 `order_no`를 **그대로** 쓴다 — 목업의 `20260721-0037`은 존재하지 않는 형식이다 (위험 6)
    - **And** 상자 아래 한 줄: `기한까지 입금이 확인되지 않으면 주문은 자동 취소됩니다.`
    - **And** `deposit_info`가 `null`이면(이미 입금 확인·취소된 주문을 다시 열었을 때) 입금 안내 상자를 **그리지 않는다** — 상태값이 아니라 **객체의 존재 여부로만** 분기한다 (AD-12, 5.1의 확정 규약)

14. **Given** 주문완료 화면 **When** 렌더 **Then** 상단바는 **로고 중앙형**, **하단 고정 CTA·탭바가 없고**, 본문 버튼 두 개(`주문 상세 보기` solid → `/orders/{id}` · `쇼핑 계속하기` ghost → `/`)가 놓이며, 컨테이너는 **최대 폭 560px 한 단**(`.b_container.m_narrow`)이다 (UX-DR4)
    - **And** `주문 상세 보기`의 목적지 `/orders/[id]`는 **8.6이 만든다** — 8.5 완료 시점에는 죽은 링크이며 버튼을 비활성으로 만들지 않는다
    - **And** 셸 호출은 `tab="orders"`, `showTabbar` 없음, `topbar={{ variant: "logo-center" }}`

15. **Given** 폭에 따른 배치 **When** < 768 / ≥ 768로 렌더 **Then** 주문서는 **< 768에서 한 칼럼 + 하단 고정 CTA 바(`121,000원 · 주문하기`)**이고 **탭바가 없으며**, **≥ 768에서 좌 62% / 우 34% 2단**으로 갈라져 우측이 금액 요약 + `주문하기`가 되고 고정 바가 사라진다 (UX-DR3·4)
    - **And** ≥ 768 우측 칼럼은 **1px hairline 테두리 상자**이며 `position: sticky; top: calc(var(--b-topbar-h) + var(--b-space-5))`다 (DESIGN.md 반응형의 유일한 테두리 상자 예외 — 그림자는 여전히 금지)
    - **And** **중개자 고지는 2단 안이 아니라 2단 아래 전체 폭**이다 (AC 8)
    - **And** 폭을 390 ↔ 1280으로 바꿔도 화면이 다시 마운트되지 않고 **입력 중인 배송지·열린 오버레이·진행 중 요청·오류 문장이 초기화되지 않는다** — `matchMedia`·`innerWidth`·`resize` 사용 **0건**, CSS로만 배치를 바꾼다 (AD-14, UX-DR4)
    - **And** 하단 고정 바는 DOM 순서상 콘텐츠 뒤다 (UX-DR6)
    - **And** `주문하기` 버튼을 **두 자리에 렌더하고 `display`로 전환**한다(8.3 D9·8.4 D10과 같은 패턴). 상태는 한 곳이 갖고 두 사본에 같은 값을 넘긴다

16. **Given** 로딩·오류·세션 만료 **When** 각 상황 **Then**
    - 최초 로딩: **묶음 골격(skeleton)** — 화면 중앙 스피너를 쓰지 않는다 (UX-DR9)
    - `GET /carts`·`GET /orders/{id}` 실패: `message` + `다시 시도`
    - `GET /carts`가 401 → `/login?next=%2Fcheckout`로 `replace` / 주문완료가 401 → `/login?next=<현재 경로+쿼리>`로 `replace`
    - 구매 가능 항목이 0건: `주문할 수 있는 상품이 없습니다.` + `장바구니로 이동` (주문 상품·금액·CTA를 그리지 않는다)
    - 제출 중: 버튼 비활성 + 텍스트 유지. 스피너를 쓰지 않는다

17. **Given** 이 스토리의 모든 CSS **When** 작성 **Then** 8.1의 `--b-*` 토큰과 `.b_*` 타이포 역할 클래스만 쓴다 — **새 hex·새 px 스케일을 만들지 않는다** (UX-DR1)
    - **And** 구매자 파일에 `#2f6bff`·`--color-brand`·`--shadow-`·`box-shadow` 선언이 0건이다 (UX-DR12)
    - **And** `app/styles/slur/**`·`app/styles/buyer/**`을 수정하지 않는다
    - **And** 판매자·관리자 화면의 색·레이아웃·포커스 링이 한 픽셀도 바뀌지 않는다
    - **And** 새로 만드는 모든 컨트롤(입력·버튼·라디오·오버레이 닫기)에 **먹색 포커스 링**이 보이고 파랑이 한 번도 나타나지 않는다 (UX-DR6)

18. **Given** 이 스토리 전체 **When** 완료 **Then** 백엔드가 변경되지 않는다 — `git diff --stat`에 `apps/api` **0건**, 마이그레이션 0건, 신규 엔드포인트 0개. 소비하는 API는 기존 4개(`GET /carts` · `POST /orders/preview` · `POST /orders` · `GET /orders/{id}`)뿐이다

19. **Given** 검증 **When** 실행 **Then** `npx tsc --noEmit` 0 · `npm run lint` **0 errors · 0 warnings**(A-E456-5 베이스라인) · `npx next build` 성공이 유지되고, 390/700/768/1280 네 폭에서 주문서·주문완료를 실제로 렌더한 결과가 스토리에 기록된다
    - **And** `apps/web`에 **테스트 프레임워크를 도입하지 않는다** — 의존성 추가 0건

## 설계 판단 (이 스토리에서 확정 — 근거를 남긴다)

스파인 Consistency Conventions의 `[ASSUMPTION]` "주소 입력 — 제공자는 구매자 웹 주문서 구현 시 확정"을 **D1이 해소한다.**
에픽 Story 8.5 Dev Notes의 `[ASSUMPTION]` "주문완료 화면의 주문 정보 전달 방식 미정"을 **D3이 해소한다.**
[Source: ARCHITECTURE-SPINE.md#Consistency-Conventions, epics.md#Story-8.5]

### D1 — 우편번호 검색: **다음(카카오) 우편번호 서비스 v2를, 클릭 시점에 동적 로드해 우리 오버레이 안에 `embed`한다**

**결정.**

| 항목 | 값 |
|---|---|
| 제공자 | **다음(카카오) 우편번호 서비스 v2** — 무료, API 키 불요, 사용량 제한 없음 |
| 스크립트 | `https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js` |
| 로드 시점 | **`우편번호 검색`을 처음 누른 순간**. 모듈 스코프 `Promise` 하나로 캐시해 두 번 로드하지 않는다 |
| 표시 방식 | `new window.daum.Postcode({ oncomplete, width:"100%", height:"100%" }).embed(el, { autoClose: true })` — **우리가 만든 오버레이 `<div>` 안에 임베드한다** |
| 결과 매핑 | `zonecode` → `postal_code`, `userSelectedType === "R" ? roadAddress : jibunAddress` → `address1`. 상세주소는 직접 입력 |
| 실패 시 | 오버레이 안에 문장 + `다시 시도`. **우편번호·주소 필드는 언제나 직접 입력 가능** |

**근거 — 왜 이것이 설계 판단인가.** 이 스토리는 **제3자 스크립트를 청약 경로에 들인다.** 그 자체가 세 가지를 건드린다.

- **CSP.** 현재 이 앱에는 CSP 헤더가 없다(`apps/web/next.config.ts`에 `headers()`가 없고 저장소 전체에 `Content-Security-Policy` 문자열이 0건이다). 따라서 **지금은 막히지 않는다.** 다만 나중에 CSP를 도입하면 `script-src`에 `https://t1.daumcdn.net`, `frame-src`·`img-src`·`connect-src`에 `*.daumcdn.net`·`*.daum.net` 허용이 필요하다. **이 사실을 부채로 남긴다** — CSP를 켜는 사람이 주문서를 깨뜨리지 않도록.
- **번들.** 스크립트를 `<head>`나 루트 레이아웃에서 로드하면 **주문서를 열지 않는 구매자 전원**이 외부 요청 하나를 더 낸다. 클릭 시점 로드는 그 비용을 실제로 쓰는 사람에게만 지운다. `next/script`를 쓰지 않고 순수 DOM 로더(`document.createElement("script")`)를 쓰는 이유는 렌더 트리와 결합하지 않고 로드 완료·실패를 한 곳에서 다루기 위해서다.
- **오프라인.** PWA(8.7)의 서비스워커는 **이 스크립트를 캐시하지 않는다.** 오프라인에서 주문서를 열 수는 있어도 우편번호 검색은 되지 않는다 — 그래서 **직접 입력 폴백이 선택이 아니라 필수**다. 검색이 유일한 입력 수단이면 스크립트 장애가 곧 매출 정지다.

**`.open()`이 아니라 `.embed()`인 이유.** `.open()`은 새 창(팝업)을 띄운다 — 모바일 브라우저에서 팝업 차단에 걸리고, 뜨더라도 우리가 만든 오버레이 규격(<768 전체 화면 / ≥768 가운데 모달)을 따르지 않는다. `.embed()`는 우리 DOM 안에 `<iframe`을 넣으므로 **UX-DR16이 허용한 "유일한 모달"의 모양을 우리가 통제한다.**

**4.4의 선례.** Flutter판은 같은 서비스의 래퍼 패키지(`daum_postcode_search`)를 승인받아 썼다. 웹은 **원본 스크립트를 직접 쓴다** — 래퍼 npm 패키지를 넣으면 의존성 0건 규칙(AC 4)을 깨고, 얻는 것은 타입 선언 몇 줄뿐이다. `window.daum` 타입은 그 파일 안 `declare global`로 좁게 선언한다(`any` 금지 — lint 베이스라인).

`[ASSUMPTION]` **제공자 확정은 Slur 확인 항목이다.** 스파인이 카카오(다음)를 유력하게 적어 두었고 4.4가 같은 서비스를 실제로 썼으므로 그 연장선으로 확정하지만, 제3자 스크립트를 청약 경로에 넣는 것은 **개인정보처리방침의 제3자 스크립트 고지** 검토 대상이다 — 오픈 게이트(약관 법률 검토)에 함께 올린다.

### D2 — 미리보기 재조회의 경합: **요청 순번으로 늦은 응답을 버린다. 그리고 effect에서 부르지 않는다**

**결정.**

```ts
const seq = useRef(0);

async function refreshPreview(postal: string) {
  const my = ++seq.current;
  setQuote({ status: "reloading", data: quote.data });   // 이전 금액을 지우지 않는다
  const r = await postPreview(postal);
  if (my !== seq.current) return;        // ← 늦게 도착했다. 결과를 버린다
  setQuote(r.ok ? { status: "ready", data: r.data } : { status: "error", error: r.error });
}
```

`refreshPreview`를 부르는 곳은 **이벤트 핸들러 셋뿐**이다: ① 우편번호 검색 완료 ② 우편번호를 직접 입력해 5자리가 완성된 순간 ③ 요약의 `다시 시도`.

**근거.**
- **경합은 실제로 일어난다.** 사용자가 `04044`를 넣었다가 곧바로 `63001`(제주)로 바꾸면 두 요청이 뜬다. 느린 네트워크에서 첫 응답이 나중에 도착하면 **제주 우편번호 옆에 서울 배송비**가 남는다. 그 화면에서 `주문하기`를 누르면 `expected_grand_total`이 서버 재계산과 어긋나 **409 `price_changed`**로 튕긴다 — 사용자는 자기가 무엇을 잘못했는지 알 수 없다. Flutter 주문서가 겪은 자리이며 여기서 갚는다.
- **순번 하나면 충분하다.** `AbortController`는 네트워크를 실제로 끊어 주지만, 끊긴 요청도 `catch`로 돌아와 상태를 만질 수 있어 **어차피 도착 시점 판정이 필요하다.** 순번 비교는 그 판정 자체이고, 디바운스와 달리 "마지막 값이 반드시 이긴다"를 보장한다. (`AbortController` 병행은 구현자 재량이되, **순번 비교를 대체하지 않는다.**)
- 🚨 **`useEffect`가 `postalCode`를 감시해 재조회하는 구조를 만들지 않는다.** `react-hooks/set-state-in-effect`가 이 저장소에서 **lint error**이고(빌드가 아니라 lint가 깨진다 — A-E456-5 베이스라인 0), 8.3이 같은 벽에 부딪혀 **로딩 상태를 파생시켜** 해결했다. 주문서는 재조회가 가장 잦은 화면이라 이 규칙이 특히 중요하다.
- **최초 `GET /carts` 한 번만 effect가 필요하다.** 그때도 **effect 본문에서 동기적으로 `setState`하지 않는다** — `setLoading(true)`를 쓰지 말고 `loading = data === undefined && error === undefined`로 **파생**시키고, 상태 갱신은 `await` 이후의 비동기 연속에서만 한다. React StrictMode의 개발 모드 이중 마운트를 대비해 실행 여부를 `ref`로 가둔다(GET이라 부작용은 없지만 요청 2회는 낭비다).

### D3 — 주문완료는 **주문번호를 쿼리로 받고 서버에서 다시 조회한다** (에픽 `[ASSUMPTION]` 해소)

**결정.** `POST /orders` 성공 → `router.replace("/orders/complete?order=" + order_id)` → 완료 화면이 `GET /api/v1/orders/{order_id}`로 **다시 조회**해 그린다.

**근거 — 재조회 말고는 선택지가 없다.**

- 🚨 **`OrderCreateResponse`에 `order_no`가 없다.** 필드는 `{order_id, grand_total, deposit_account, deposit_due_at}` 넷뿐이다. 그런데 화면은 **주문번호를 표시해야 한다**(AC 13, FR-23). `order_no`는 `GET /orders/{id}`·`GET /orders`에만 있다. **생성 응답만으로는 이 화면을 그릴 수 없다.**
- **새로고침·북마크·뒤로가기에서 깨지지 않는다.** 생성 응답을 메모리(전역 상태·`sessionStorage`)로 나르는 방식은 새로고침 한 번에 빈 화면이 된다. 에픽이 `[ASSUMPTION]`에 못 박은 조건이 정확히 이것이다.
- **URL에 싣는 것은 주문 UUID 하나뿐이다.** 금액·계좌를 쿼리에 실으면 조작된 화면을 만들 수 있고(공유된 링크가 거짓 금액을 보여준다), 남의 UUID를 넣어도 **서버가 소유자를 검증해 404**를 준다(`get_my_order`). 화면은 그 404를 `주문을 찾을 수 없습니다.` + `주문내역 보기`로 받는다.
- **`push`가 아니라 `replace`인 이유.** 주문 성공으로 장바구니가 비워졌으므로(`create_order`가 같은 트랜잭션에서 삭제한다) 뒤로가기로 `/checkout`에 돌아가면 `preview`가 **422 `empty_cart`**를 준다. `replace`로 `/checkout`을 히스토리에서 치우면 뒤로가기가 `/cart`(빈 장바구니 화면)로 가서 이야기가 맞는다.
- **부수 효과 하나.** `deposit_info`는 `pending_payment`일 때만 내려온다. 관리자가 그 사이 입금 확인을 하면 상자가 사라진 완료 화면이 보인다 — **정직한 표시이며 AD-12의 "객체 존재로만 분기"를 따른 결과다.** 상태 문자열로 분기하지 않는다(5.1의 확정 규약).

**기각한 대안.** (a) 생성 응답을 컨텍스트에 담아 완료 화면이 읽기 — 새로고침에서 죽고 `order_no`가 없어 애초에 부족하다. (b) 금액·계좌를 쿼리에 싣기 — 위 참조. (c) `/orders/[id]`(주문상세)로 바로 보내기 — 주문완료 화면이 UX 계약(UX-DR14의 두 변형 중 하나)이라 없앨 수 없다.

### D4 — 라우트와 파일: **`/orders/complete`는 정적 세그먼트라 `/orders/[id]`를 이긴다**

**결정.**

```
apps/web/
  app/api/orders/preview/route.ts     ← 신설 POST → /api/v1/orders/preview
  app/api/orders/route.ts             ← 신설 POST → /api/v1/orders          (GET은 8.6이 더한다)
  app/api/orders/[id]/route.ts        ← 신설 GET  → /api/v1/orders/{id}     (8.6 주문상세가 그대로 쓴다)
  app/(buyer)/
    checkout/page.tsx                 ← 신설 (셸 + CheckoutView)
    checkout/checkout-view.tsx        ← 신설 "use client" 본체
    checkout/address-form.tsx         ← 신설 (배송지 5필드 + 요청사항 + 필드 오류)
    checkout/postcode-overlay.tsx     ← 신설 "use client" (유일한 모달 예외 — D1)
    checkout/checkout.css             ← 신설
    orders/complete/page.tsx          ← 신설
    orders/complete/complete-view.tsx ← 신설 "use client"
    orders/complete/complete.css      ← 신설
    deposit-box.tsx                   ← 신설 ((buyer) 루트 — 8.6이 detail 변형을 더한다)
    orders-api.ts                     ← 신설 (preview·create·getOrder 래퍼. 8.6이 목록·취소를 더한다)
    format.ts                         ← 수정 (formatDepositDue 추가)
    amount-summary.tsx                ← 수정 (합계 미확정 지원 — 8.4의 null 지원 위에)
    buyer.css                         ← 수정 (오버레이·입금 안내 상자·폼 행 공용 규칙)
```

**근거·주의.**
- 🚨 **페이지 경로 경합.** `(buyer)/orders/complete/page.tsx`와 (8.6이 만들) `(buyer)/orders/[id]/page.tsx`는 둘 다 `/orders/complete`로 해석될 수 있다. Next는 **정적 세그먼트를 동적보다 먼저 매칭**하므로 `complete`가 이긴다. 8.1이 위험 목록 9번으로 미리 기록해 둔 자리다. **`[id]` 쪽에서 `id === "complete"`를 걸러내는 코드를 쓰지 않는다** — 라우터가 이미 판정한다.
- 🚨 **BFF 경로 경합.** `app/api/orders/preview/route.ts`(정적)와 `app/api/orders/[id]/route.ts`(동적)도 같은 깊이다. 같은 이유로 `preview`가 이기며, 게다가 메서드가 다르다(POST vs GET). 그래도 **`[id]` 핸들러는 36자 UUID 형식을 검사하고 아니면 상류를 부르지 않고 `not_found` 404 봉투를 돌려준다**(8.3 D2·8.4 D11과 같은 규칙).
- **`app/api/orders/route.ts`에 POST만 넣는다.** 8.6이 같은 파일에 GET(주문내역)을 더한다 — 파일을 새로 만들지 말고 export를 추가하도록 주석으로 남긴다.
- `[id]`의 `ctx.params`는 **Next 16에서 Promise다** — `await`한다.

### D5 — 주문서는 **두 단계로 그린다**: 장바구니로 뼈대, 미리보기로 확정

**결정.**

| 단계 | 소스 | 무엇을 그리는가 |
|---|---|---|
| ① 진입 직후 | `GET /api/v1/carts` (**`purchasable === true`만 필터**) | 판매자 묶음(브랜드·상품명·옵션·수량·행 금액·사진) · `상품 금액`(= `purchasable_total`) |
| ② 우편번호 확정 후 | `POST /api/v1/orders/preview` | 묶음을 **통째로 교체** + 배송비·도서산간·`결제 예정 금액` |

**근거.**
- **진입 즉시 무엇을 사는지 보여야 한다.** 우편번호를 넣기 전까지 주문 상품 구획이 비어 있으면 "내가 뭘 주문하려는 거지"를 화면이 답하지 못한다. 그렇다고 미리보기를 임의의 우편번호로 부를 수는 없다 — **틀린 금액을 청약 전에 보여주는 사고**다(8.4 D2가 세운 규칙).
- 🚨 **`OrderPreviewResponse`에 상품 이미지가 없다.** `PreviewItem`은 `{cart_item_id, variant_id, product_name, option_text, quantity, final_price, line_total}`뿐이다. 주문서 묶음에는 사진이 들어간다(목업·DESIGN.md `{components.seller-pack}` 66~74px). **`GET /carts`의 `image_url`을 `cart_item_id` 키로 매핑해 붙이는 것 말고 방법이 없다** — 이것만으로도 ①단계가 필요하다. 이미지가 없는 항목은 같은 크기의 종이 그늘 면으로 자리를 지킨다.
- **묶음 키가 단계마다 다르다.** ①은 `brand_name`(장바구니 응답에 `seller_id`가 없다 — 8.4 D1), ②는 `seller_id`(preview가 준다). **두 단계의 항목 순서는 같다** — `get_purchasable_entries`가 `get_cart`와 같은 정렬(`created_at DESC, id DESC`)을 쓰고 `quote()`가 그 순서대로 그룹을 만들기 때문이다. 동명 브랜드가 두 팀 있으면 ①에서만 한 묶음으로 합쳐졌다가 ②에서 갈라진다 — **알려진 한계**(deferred-work에 등재된 `brand_name` UNIQUE 부재)이며 v1 규모에서 수용한다.
- **금액의 진실은 언제나 ②다.** ①의 `purchasable_total`은 배송비 없는 상품 합계일 뿐이고, `expected_grand_total`로 보내는 값은 **반드시 ②의 `grand_total`**이다.

### D6 — 주문 대상은 **preview가 준 `cart_item_id` 전부**다 (고르는 수단을 만들지 않는다)

**결정.** `POST /orders`의 `cart_item_ids`는 `seller_groups.flatMap(g => g.items.map(i => i.cart_item_id))` — preview 응답에서 그대로 뽑는다. 화면에 선택 체크박스를 두지 않는다.

**근거.**
- `POST /orders/preview`에는 **항목 선택 파라미터가 없다**(장바구니 전체를 전제). `POST /orders`는 `cart_item_ids`를 받는다. 즉 **부분 주문은 만들 수 있지만 미리 볼 수 없다** — 8.4 D3가 체크박스를 상태 표시로 못 박은 것과 **같은 사실의 다른 얼굴**이다.
- 4.4가 `cart_item_ids`를 받도록 설계한 목적은 부분 선택이 아니라 **"주문서에 표시된 항목만 주문된다"는 보증**이다(4.4 Task 2: "본 것과 다른 주문이 조용히 생성되는 일이 없다"). 미리보기와 주문 사이에 장바구니가 늘어나도 **방금 본 것만** 주문된다. 화면은 그 설계를 그대로 쓴다.
- `expected_grand_total`도 같은 계열의 보증이다 — **화면이 보여준 그 숫자**를 보내고, 서버 재계산과 다르면 409로 막힌다. 클라이언트가 다시 더해 만든 값을 보내면 이 보증이 무의미해진다 (AD-12).

### D7 — 재검증 실패(FR-35)는 **머무르며 알린다**. 자동 이동하지 않는다

**결정.**

| code | HTTP | 화면 |
|---|---|---|
| `out_of_stock` | 422 | 오류 블록에 **`details`의 항목을 줄 단위로 나열**(`상품명` + `옵션`) + `장바구니로 이동` 버튼. 주문서는 그대로 남는다 |
| `price_changed` | 409 | `message` + **미리보기 자동 재조회**로 새 금액 갱신. **주문은 자동 재제출하지 않는다** |
| `empty_cart` · `not_found` | 422 · 404 | `message` + `장바구니로 이동` |
| `duplicate_request` | 409 | `message` + `주문내역 보기`(→ `/orders`) |

**근거.**
- **자동으로 `/cart`로 튕기면 사용자는 무엇이 문제였는지 못 읽는다.** EXPERIENCE.md State Patterns가 이 자리를 `[ASSUMPTION]`으로 남기며 "장바구니로 되돌리고 해당 묶음을 구매 불가 상태로 갱신"을 권장하는데, **되돌리는 것과 이유를 삼키는 것은 다르다.** Flutter판은 다이얼로그를 띄우고 복귀했지만 웹에는 모달이 없다(UX-DR16) — 그래서 **머무르며 인라인으로 알리고, 이동은 사용자가 누른다.**
- **장바구니 상태를 8.5가 조작할 필요가 없다.** `/cart`로 가면 8.4가 `GET /carts`를 새로 불러 `purchasable`을 그대로 표시한다 — 그 항목은 서버가 이미 구매 불가로 판정하고 있다 (AD-10). 화면이 "구매 불가로 만드는" 코드를 따로 쓰면 서버와 갈라진다.
- **`price_changed`에서 자동 재제출은 금지다.** 금액이 오른 상태에서 사용자 동의 없이 다시 청약하는 것이므로 **돈이 걸린 오해**다. 새 금액을 보여주고 버튼을 다시 누르게 한다. 4.4가 `expected_grand_total`을 필수화한 취지("조용한 금액 변경 방지")를 화면이 지킨다.
- **`duplicate_request`는 실패가 아니다.** `delete_items`의 rowcount 가드가 "먼저 커밋된 트랜잭션이 이미 처리했다"를 알리는 것이므로 주문은 **존재한다.** `/orders`로 안내하는 것이 정확하다. (`order_id`를 모르므로 완료 화면으로 보낼 수 없다.)
- 🚨 **HTTP 코드·`code` 문자열을 렌더하지 않는다.** 분기는 `code`, 표시는 `message` (UX-DR9, R6).

### D8 — 폼 검증: **클라이언트는 형식만, 진실은 서버 `details`**

**결정.**

| 필드 | 클라이언트 검사 | 서버 계약 |
|---|---|---|
| 수령인 | 1~50자 | `min_length=1, max_length=50` |
| 연락처 | **숫자만 남긴 뒤** 9~11자리 | `^\d{9,11}$` |
| 우편번호 | 숫자 5자리 | `^\d{5}$` |
| 주소 | 1~255자 | `min_length=1, max_length=255` |
| 상세주소 | 0~255자 | `max_length=255` (선택) |
| 배송 요청사항 | 0~500자 | `max_length=500` (선택) |

- 클라이언트 검사는 **제출 버튼 비활성 판정과 즉시 피드백**에만 쓴다. 422 `validation_error`가 오면 봉투 `details`를 필드에 매핑해 표시한다 — 두 판정이 어긋나면 **서버가 이긴다**.
- 🚨 **연락처의 하이픈.** 목업은 `010-2847-3391`로 그렸지만 서버는 `^\d{9,11}$`라 **하이픈이 들어가면 422**다. 입력은 자유롭게 두되 **전송 직전에 `replace(/\D/g, "")`** 한다. 입력 중 자동 하이픈 삽입(마스킹)은 만들지 않는다 — 커서 위치·붙여넣기·IME에서 잔버그가 나고 완주에 기여하지 않는다.
- **상단 요약 배너를 쓰지 않는다** (UX-DR9). 오류는 필드 아래 한 줄이고 `aria-describedby`로 묶는다.

### D9 — 금액 요약 컴포넌트의 **최소 확장**과 합계 라벨

**결정.** 8.4가 `shippingFee`·`remoteAreaFee`를 `number | null`로 받게 만들어 두었다. 8.5는 여기에 **`total`도 `number | null`**을 더하고, 미확정 문구를 prop으로 받는다(`pendingText`, 주문서는 `배송지 입력 후 계산`).

| 행 | 우편번호 전 | 우편번호 후 |
|---|---|---|
| 상품 금액 | `118,000원` (`purchasable_total`) | `118,000원` (`item_total`) |
| 배송비 | `배송지 입력 후 계산` | `3,000원` (`shipping_total`) |
| 도서산간 추가 | `배송지 입력 후 계산` | `0원` (`remote_extra_total`) — **0이어도 줄을 지우지 않는다** |
| **결제 예정 금액** | `배송지 입력 후 계산` | `121,000원` (`grand_total`, 21px/800 액센트) |

**근거.**
- 🚨 **행을 조건부로 지우는 구현은 이 컴포넌트를 통째로 무효로 만든다.** 파일 상단 주석이 "행 순서 고정 · 도서산간 0원이어도 줄을 지우지 않는다"를 못 박고 있고, 그것이 UX-DR13의 요구다. 미확정도 **값 자리의 문구**로 표현한다.
- 합계 라벨을 `결제 예정 금액`으로 두는 것은 **여기서만 참이기 때문**이다. 장바구니는 배송비를 모르므로 `상품 금액 합계`를 쓴다(8.4 D2). 같은 컴포넌트, 다른 라벨 — prop으로 갈린다.
- **21px/800 액센트 합계는 화면당 한 번**이다(UX-DR13). 그래서 하단 CTA의 금액(`121,000원 · 주문하기`)은 CTA 자체의 타이포를 쓰고 `b_price_total`을 재사용하지 않는다.

### D10 — 날짜·금액 포맷은 **`format.ts` 한 곳**, 기한은 **`Asia/Seoul` 고정**

**결정.** `(buyer)/format.ts`에 다음을 더한다.

```ts
/** `2026년 7월 24일까지` — 입금 기한. 타임존을 고정하지 않으면 날짜가 하루 어긋난다. */
export function formatDepositDue(iso: string): string { /* Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", … }) */ }
```

**근거.**
- **`deposit_due_at`은 UTC로 내려온다**(`datetime.now(timezone.utc) + timedelta(days=days)`). `toLocaleDateString()`을 로케일·타임존 없이 부르면 (a) 서버 렌더와 브라우저 렌더가 다른 타임존을 써 **하이드레이션 불일치**가 나고, (b) 해외·다른 TZ 브라우저에서 **기한이 하루 앞뒤로 어긋난다.** 입금 기한은 어긋나면 주문이 자동취소되는 값이라 반올림 사고가 허용되지 않는다.
- `formatWon`이 같은 이유로 `"ko-KR"`을 명시하고 있다(8.3 D13의 주석이 그 사고를 이미 기록했다). **같은 파일, 같은 규칙**으로 둔다.
- 🚨 **`formatWon`이 두 곳에 있을 수 있다** — `(buyer)/format.ts`(8.3 D13)와 `(buyer)/amount-summary.tsx`(8.1). 8.4 D12가 "남아 있는 하나를 import하고 세 번째를 만들지 않는다"를 지시했다. **착수 시 실제 상태를 확인한다**(Task 0).
- 8.6이 주문 목록·상세에서 `2026.07.21` 형식을 쓸 것이다 — **8.5는 자기가 쓰는 기한 포맷만** 추가하고 8.6의 것을 미리 만들지 않는다.

### D11 — 입금 안내 상자는 **공용 컴포넌트로 만들되 `placed` 변형만 구현한다**

**결정.** `(buyer)/deposit-box.tsx`를 `(buyer)` 루트에 둔다(`orders/complete/` 안이 아니다). props는 `{ variant: "placed"; amount: number; account: string; dueAt: string; expired?: boolean }`. **8.6이 `"detail"` 변형을 타입·CSS에 더한다.**

**근거.**
- DESIGN.md가 **두 변형을 확정**했고(주문완료 = 1.5px 액센트 테두리·종이 면·27px 금액 / 주문상세 = `accent-wash` 면·1px `accent-line`·20px 금액), "무게가 같으면 주문상세에서 시선을 다툰다"까지 근거를 적었다. **두 변형이 하나의 컴포넌트라는 사실을 파일 위치로 표현**해 두면 8.6이 복제하지 않는다.
- 그렇다고 8.5가 `detail`까지 구현하지 않는 이유는 **눈으로 검증할 화면이 없기 때문**이다. 렌더되지 않는 CSS를 커밋하면 8.6이 "이미 있다"고 믿고 검증을 건너뛴다.
- 🚨 **`예금주` 줄을 만들지 않는다.** 목업은 `입금 계좌` / `예금주` / `입금 기한` 세 줄인데, **백엔드에는 `deposit_account` 문자열 하나뿐**이다(`settings` 단일 key, 시드값 `은행/계좌번호/예금주 미설정`). 없는 필드를 쪼개 만들 수 없다 — **`입금 계좌`에 관리자가 넣은 문자열을 그대로** 놓고, 예금주는 그 문자열 안에 포함되도록 운영에 맡긴다. 위험 1에 올린다.
- **`expired`는 5.1이 `deposit_info.expired`로 서버 파생해 둔 값이다.** 주문 직후에는 항상 `false`지만, 완료 화면을 나중에 다시 열면 `true`일 수 있다. `true`면 기한 줄 아래 `기한이 지나 곧 자동 취소됩니다.`를 덧붙인다 `[ASSUMPTION]`.
- 메모 상자 문구는 **`입금자명을 주문자 이름과 같게 해주세요.`** — 목업의 괄호 이름(`(김소연)`)을 **넣지 않는다.** 주문에는 `recipient_name`(수령인)만 있고 **주문자 이름 필드가 없다.** 선물처럼 수령인과 주문자가 다르면 화면이 거짓말을 한다. `[ASSUMPTION]` Slur 확인 항목.

### D12 — 2단·고정 바는 **CSS만으로**, 고지는 **2단 밖**

**결정.**

```
< 768   : 한 칼럼
          배송지 → hairline → 요청사항 → 8px 띠 → 주문 상품 → 8px 띠 → 결제 금액
          → 8px 띠 → 결제 수단 → hairline → 중개자 고지
          하단: [고정 CTA 바 `121,000원 · 주문하기`]   ← 탭바 없음. 패딩 13px 20px 20px

≥ 768   : grid 62fr / 34fr (column-gap 4%)
            좌: 배송지 · 요청사항 · 주문 상품 · 결제 수단
            우: 결제 금액(금액 요약) + `주문하기`, 1px hairline 테두리 상자,
                position: sticky; top: calc(var(--b-topbar-h) + var(--b-space-5))
          2단 **아래 전체 폭**: 중개자 고지
          고정 CTA 바는 CSS로 사라진다
```

- `주문하기` 버튼은 **두 자리에 렌더**하고 `display`로 전환한다(<768 고정 바 안 / ≥768 우측 칼럼 안). 상태는 `checkout-view`가 갖고 두 사본에 같은 값을 넘긴다.
- 8px 종이 접기 띠는 **`<768`에서만** 쓴다 — 옆으로 놓인 2단에서는 위아래를 가르는 장치가 성립하지 않는다(DESIGN.md 깊이 예외).
- `<768` 본문 하단 여백은 **CTA 바 높이**만큼이다(탭바가 없으므로 8.4처럼 두 겹이 아니다). 셸의 `.b_main[data-tabbar="on"]`을 건드리지 않는다.

**근거.**
- 🚨 **고지를 우측 sticky 칼럼에 넣으면 규제 요건이 깨진다.** UX-DR10이 "≥768 2단에서도 고지는 우측 sticky 칼럼이 아니라 2단 아래 전체 폭"이라고 명시했다. sticky 칼럼은 스크롤에 따라 화면 밖으로 나갈 수 있는 자리이고, FR-32의 요구는 **청약 전에 읽을 수 있는 자리**다. 디자인 취향이 아니라 규제 요건이다.
- **폭 전환에 JS를 쓰지 않는다.** `matchMedia`로 조건부 렌더하면 폭이 바뀔 때 **입력 중인 배송지가 날아간다** — UX-DR4가 명시적으로 금지한 사고이며(“입력 중인 배송지가 초기화되지 않아야 한다”) 8.1·8.3·8.4가 같은 규칙을 지켰다.
- **주문서에는 탭바가 없다.** 하단 고정 CTA가 있는 화면에는 탭바를 두지 않는 것이 규칙이고 **장바구니만 예외**다 (UX-DR3).

### D13 — BFF 세 라우트와 Origin 검사

**결정.**

```
app/api/orders/preview/route.ts   POST  → proxyWithRefresh(req, "/api/v1/orders/preview", …)
app/api/orders/route.ts           POST  → proxyWithRefresh(req, "/api/v1/orders", …)
app/api/orders/[id]/route.ts      GET   → proxyWithRefresh(req, `/api/v1/orders/${id}`, …)
```

- **POST 둘은 `assertSameOrigin(req)`를 먼저 통과해야 한다.** `preview`는 읽기 전용이지만 POST이므로 같은 규약을 탄다 — "상태를 바꾸는 신규 POST 라우트가 이 한 벌을 쓴다"(8.2 D1)를 메서드 기준으로 단순하게 지키는 편이 갈라질 여지가 없다.
- **본문은 화이트리스트로 넘긴다.** `preview`는 `{postal_code}`, `create`는 `{cart_item_ids, expected_grand_total, postal_code, recipient_name, recipient_phone, address1, address2, order_note}` 여덟 개만. 클라이언트 본문을 통째로 상류에 흘리지 않는다.
- **인증 경로이므로 `lib/public-api.ts`를 쓰지 않는다.** 세션이 정말 끝났으면 `proxyWithRefresh`의 401 경로가 쿠키를 지우는 것이 맞다(8.4 D11과 같은 판단).
- `proxyWithRefresh`가 돌려준 `NextResponse`를 **그대로 반환**한다 — 다시 감싸면 회전된 세션 쿠키가 유실된다.
- `lib/auth.ts`는 **import만 한다. 수정하지 않는다.**

### D14 — 배송지에는 **초기값이 없다**. 주소록·자동저장을 만들지 않는다

**결정.** 주문서 폼은 항상 빈 상태로 시작한다. 지난 주문의 배송지를 불러오지 않고, 입력 중인 값을 `localStorage`·`sessionStorage`에 저장하지 않는다.

**근거.**
- **v1에 배송지 주소록이 없다**(PRD 화면 목록 밖). `GET /orders`의 최근 주문에서 배송지를 끌어오는 방법은 있지만, 그것은 **화면 하나가 요구사항에 없는 기능을 몰래 만드는 것**이고(작업 규칙: PRD 화면 목록 밖 기능은 임의 추가하지 않는다) 배송지는 개인정보라 보관·표시 규칙이 따로 필요하다.
- 브라우저 저장소에 배송지를 남기는 것은 **공용 기기에서 남의 주소가 뜨는 사고**를 만든다. 폼 하나 다시 채우는 비용이 그 위험보다 싸다.
- **알려진 성질 하나**: 주문서에서 새로고침하면 입력이 사라진다. 폭 변경·회전에서는 살아 있다(D12 — CSS만으로 재배치). 이 차이를 Completion Notes에 남긴다.

## Tasks / Subtasks

- [ ] **Task 0 — 착수 전 확인 (선행 산출물의 실제 상태)** (AC: 전부)
  - [ ] **8.4가 머지됐는지 확인한다.** `app/api/carts/route.ts` · `(buyer)/cart-api.ts` · `(buyer)/cart-count.tsx`가 없으면 **이 스토리를 시작하지 않는다**
  - [ ] `buyer.css`에 하단 고정 CTA 바(`.b_cta_bar`)가 승격돼 있는지 확인한다 (8.4 Task 0) — 없으면 8.4가 어디에 두었는지 찾아 **복제하지 말고** 승격한다
  - [ ] `amount-summary.tsx`가 `number | null`을 받는지 확인한다 (8.4 Task 6). 받는다면 `total`만 확장하고, 아직이면 이 스토리가 두 확장을 함께 한다
  - [ ] `formatWon`이 어디 있는지 확인한다 (`grep -rn "formatWon" apps/web/app`) — 8.4 D12의 정리 규칙 적용, **세 번째를 만들지 않는다**
  - [ ] `assertSameOrigin`·`proxyWithRefresh`가 `lib/auth.ts`에 있는지 확인한다
  - [ ] `(buyer)/buyer-feedback.tsx`의 export(`BlockSkeleton` · `EmptyState` · `ErrorState` · `ApiFailure` · `NETWORK_MESSAGE`)를 확인하고 **재사용한다** — 오류·빈 상태 컴포넌트를 새로 만들지 않는다

- [ ] **Task 1 — BFF Route Handler 3개** (AC: 5, 9, 12, 18)
  - [ ] `app/api/orders/preview/route.ts` — `POST`. **`assertSameOrigin` 먼저.** 본문은 `{postal_code}`만 상류로
  - [ ] `app/api/orders/route.ts` — `POST`. **`assertSameOrigin` 먼저.** 본문 8필드 화이트리스트. 파일 상단에 `// GET(주문내역)은 8.6이 이 파일에 추가한다` 주석
  - [ ] `app/api/orders/[id]/route.ts` — `GET`. `await ctx.params` 후 **36자 UUID 형식 검사**, 아니면 상류를 부르지 않고 `not_found` 404 봉투. 파일 상단에 `// 8.6 주문상세가 이 라우트를 그대로 쓴다` 주석
  - [ ] 셋 다 `proxyWithRefresh`가 돌려준 `NextResponse`를 **그대로 반환**한다
  - [ ] `lib/auth.ts`를 **수정하지 않는다** (import만)

- [ ] **Task 2 — 클라이언트 API 래퍼와 포맷** (AC: 5, 9, 11, 12, 13, 16)
  - [ ] `(buyer)/orders-api.ts` — `postPreview(postalCode)` · `createOrder(payload)` · `getOrder(orderId)`
    - [ ] 반환은 `{ ok: true, data } | { ok: false, error: ApiFailure & { details?: unknown } }` — **`code`는 분기에만, `message`는 표시에만**
    - [ ] `out_of_stock`의 `details`는 `{cart_item_id, product_name, option_text}[]` 형태로 타입을 좁힌다. **형식이 어긋나면 항목 나열 없이 `message`만** 보여준다(외부 응답 이형 방어, R2)
    - [ ] `price_changed`의 `details`는 `[{grand_total}]` — **이 값을 화면 금액으로 쓰지 않는다.** 미리보기를 다시 불러 정본을 받는다
    - [ ] fetch가 throw하면 `NETWORK_MESSAGE`. 에러 봉투 타입은 `buyer-feedback.tsx`/`auth-errors.ts`의 것을 재사용한다 — **새로 만들지 않는다**
    - [ ] 파일 상단에 `// 8.6이 목록(list)·묶음 취소(cancel)를 이 파일에 추가한다` 주석
  - [ ] `(buyer)/format.ts` — `formatDepositDue(iso)` 추가. **`timeZone: "Asia/Seoul"` 명시** (D10)

- [ ] **Task 3 — 주문서 골격과 1단계 렌더** (AC: 1, 2, 16)
  - [ ] `(buyer)/checkout/page.tsx` — `BuyerShell tab="cart" topbar={{ variant: "back-title", title: "주문서" }}` (**`showTabbar` 없음**)
  - [ ] `checkout-view.tsx` — 마운트 시 `getCart()` 1회
    - [ ] 🚨 **effect 본문에서 동기 `setState` 금지.** 로딩은 `data === undefined && error === undefined`로 **파생**시킨다 (D2, `react-hooks/set-state-in-effect`)
    - [ ] StrictMode 이중 마운트 대비 `ref` 가드
    - [ ] 401 → `router.replace("/login?next=%2Fcheckout")`
    - [ ] `purchasable === true`만 남기고, **0건이면** `주문할 수 있는 상품이 없습니다.` + `장바구니로 이동`
    - [ ] 로딩은 묶음 골격 skeleton (`BlockSkeleton` 재사용, 중앙 스피너 금지)
  - [ ] 구획 구조 — 배송지 / hairline / 요청사항 / 8px 띠 / 주문 상품 / 8px 띠 / 결제 금액 / 8px 띠 / 결제 수단 / hairline / 중개자 고지 (D12의 순서 그대로)
  - [ ] 묶음 렌더 — `<SellerPack>` 슬롯을 채운다: `headEnd`=배송비 자리, `children`=읽기 전용 항목 행. **`seller-pack.tsx`를 수정하지 않는다**(가능하면)
    - [ ] 항목 행 = 사진 66~74px(없으면 종이 그늘 면) · 상품명(`b_product_name_row`) · `옵션 텍스트 · N개`(`b_meta`, 옵션이 빈 문자열이면 `N개`만) · 행 금액
    - [ ] **체크박스·수량 스테퍼·`삭제`를 두지 않는다** — 주문서 묶음은 읽기 전용이다 (UX-DR13)
    - [ ] `<img>` 위에 `/* eslint-disable-next-line @next/next/no-img-element */`

- [ ] **Task 4 — 배송지 폼** (AC: 3, 8, 9)
  - [ ] `address-form.tsx` — 6필드. 입력은 46px 고정 높이(`b_input`), 라벨 11.5px/600, 선택 항목은 라벨에 `(선택)`
  - [ ] `우편번호` 행 = 좁은 입력 + `우편번호 검색`(small 버튼: 12px/700, 1.4px 테두리, 좌우 14px). 히트 영역 **44 × 44 이상** (UX-DR7)
  - [ ] 조작 행은 `.b_row`(최대 560px) 안에서 좌측 정렬 — 넓은 칼럼에서 벌어지지 않게 (UX-DR5)
  - [ ] 필드 오류 — 해당 필드에만 테두리·면 + 아래 한 줄. `htmlFor`/`id`/`aria-describedby`로 묶는다. **상단 배너 금지**
  - [ ] 클라이언트 형식 검사(D8 표)와 **전송 직전 전화번호 숫자만 남기기**
  - [ ] `order_note`에 `maxLength={500}`

- [ ] **Task 5 — 우편번호 검색 오버레이 (유일한 모달 예외)** (AC: 4)
  - [ ] `postcode-overlay.tsx` — `"use client"`. 모듈 스코프 `Promise`로 스크립트를 한 번만 로드(D1)
    - [ ] `window.daum` 타입은 이 파일 안 `declare global`로 **좁게** 선언한다. **`any` 금지**(lint 베이스라인 0 warnings)
    - [ ] `.embed(container, { autoClose: true })`로 우리 DOM 안에 넣는다. **`.open()`(팝업) 금지**
    - [ ] `oncomplete` → `zonecode` · (`userSelectedType === "R" ? roadAddress : jibunAddress`) 를 부모로 올리고 닫는다
  - [ ] 접근성 — `role="dialog"` `aria-modal="true"` `aria-label="우편번호 검색"`, **포커스 트랩**, `Esc` 닫기, 닫으면 **원래 버튼으로 포커스 복원**, 열려 있는 동안 본문 스크롤 잠금
  - [ ] 반응형 — `<768` 전체 화면 / `≥768` 가운데 모달. **CSS로만** 전환(`matchMedia` 금지)
  - [ ] 실패 폴백 — 로드 실패·타임아웃 시 문장 + `다시 시도` · `닫기`. **우편번호·주소 필드는 언제나 직접 입력 가능**
  - [ ] 닫힌 상태에서는 `<iframe`을 DOM에 남기지 않는다(언마운트) — 뒤 화면의 탭 순서에 끼어들지 않게
  - [ ] **새 npm 의존성 0건**

- [ ] **Task 6 — 미리보기 재조회 (경합 처리)** (AC: 5, 6)
  - [ ] `refreshPreview(postal)` — **요청 순번 `ref`** 로 늦은 응답을 버린다 (D2). 재조회 중에도 이전 금액을 지우지 않는다
  - [ ] 호출 지점은 **이벤트 핸들러 셋뿐** — 검색 완료 / 직접 입력 5자리 완성 / `다시 시도`. **`useEffect`가 `postalCode`를 감시하지 않는다**
  - [ ] 성공 → 묶음·금액을 preview 결과로 **통째 교체**. 사진은 `cart_item_id → image_url` 맵에서 붙인다 (D5)
  - [ ] `empty_cart` 422 → `주문할 수 있는 상품이 없습니다.` + `장바구니로 이동`
  - [ ] `validation_error` 422 → 우편번호 필드 오류
  - [ ] 401 → `/login?next=%2Fcheckout`

- [ ] **Task 7 — 금액 요약 · 결제 수단 · 중개자 고지 · CTA** (AC: 6, 7, 8, 9, 15)
  - [ ] `amount-summary.tsx` 최소 확장 — `total: number | null` + `pendingText`. 🚨 **행을 지우는 구현 금지**(D9)
  - [ ] 합계 라벨 `결제 예정 금액`, 값 21px/800 액센트. **화면당 한 번**
  - [ ] 요약 아래 안내 한 줄 — `remote_area_kind`에 따라 세 문장 (AC 6)
  - [ ] 결제 수단 — 라디오 1개(`defaultChecked`, 상태 없음) + `무통장입금` + `입금 확인 후 배송이 시작됩니다. 주문 후 3일 안에 입금하지 않으면 자동 취소됩니다.`
    - [ ] **결제 수단을 API로 보내지 않는다** (`OrderCreateRequest`에 필드가 없다)
  - [ ] 중개자 고지 — `import { BROKER_NOTICE } from "@/app/config/company"`. **문자열 복사 금지**. `b_notice` 표기, **2단 아래 전체 폭**
  - [ ] CTA — `{formatWon(grandTotal)} · 주문하기`. 금액 미확정이면 `주문하기` + `disabled`
    - [ ] **두 자리에 렌더**하고 CSS `display`로 전환(<768 고정 바 / ≥768 우측 칼럼). 상태는 한 곳
    - [ ] 고정 바는 DOM 순서상 **콘텐츠 뒤**

- [ ] **Task 8 — 주문 생성과 실패 경로** (AC: 9, 10, 11)
  - [ ] `cart_item_ids` = preview 응답에서 그대로 수집 (D6). `expected_grand_total` = **화면이 보여준 `grand_total`**
  - [ ] 제출 중 두 CTA 사본 모두 비활성 + `ref` 가드로 중복 제출 차단. **스피너 없이 텍스트 유지**
  - [ ] `out_of_stock` → `details` 항목 나열(상품명 + 옵션) + `장바구니로 이동`. **자동 이동 금지** (D7)
  - [ ] `price_changed` → `message` + **미리보기 자동 재조회**. **주문 자동 재제출 금지**
  - [ ] `empty_cart` · `not_found` → `message` + `장바구니로 이동`
  - [ ] `duplicate_request` → `message` + `주문내역 보기`(→ `/orders`)
  - [ ] `validation_error` → `details`를 필드에 매핑
  - [ ] 성공 → `router.replace("/orders/complete?order=" + order_id)` (**`push` 아님** — D3)
  - [ ] 성공 시 장바구니 배지를 0으로 갱신한다 — 8.4의 `useCartCount()` setter를 쓴다(서버가 장바구니를 비웠다). **`/carts`를 다시 부르지 않아도 되지만, 부른다면 그 값을 쓴다**

- [ ] **Task 9 — 주문완료 화면** (AC: 12, 13, 14, 16)
  - [ ] `(buyer)/orders/complete/page.tsx` — `BuyerShell tab="orders" topbar={{ variant: "logo-center" }}` (**`showTabbar` 없음**), 컨테이너 `.b_container.m_narrow`(560px)
  - [ ] `complete-view.tsx` — `useSearchParams()`로 `order` 읽기. **`<Suspense>` 경계 필요**(8.3의 학습)
    - [ ] `order`가 없거나 UUID 형식이 아니면 서버를 부르지 않고 `주문을 찾을 수 없습니다.` + `주문내역 보기`
    - [ ] `getOrder(id)` 1회 (effect + `ref` 가드, 로딩은 파생)
    - [ ] 401 → `/login?next=<현재 경로+쿼리>`로 `replace`
    - [ ] 404 → `주문을 찾을 수 없습니다.` + `주문내역 보기`
  - [ ] `주문이 접수되었습니다` + `주문번호` `{order_no}` (**응답 값 그대로 — 가공 금지**)
  - [ ] `deposit-box.tsx` — `variant="placed"`. 종이 면 + 1.5px 액센트 테두리 + 5px 라운드 + 노치 캡션 `입금 안내` + `입금 금액` 27px/800 액센트 + `입금 계좌`·`입금 기한` + `--b-paper-shade` 메모 상자
    - [ ] `입금 계좌`는 `deposit_account` **한 문자열 그대로**. **`예금주` 줄을 만들지 않는다** (D11, 위험 1)
    - [ ] 기한은 `formatDepositDue(deposit_due_at)` — `Asia/Seoul` 고정
    - [ ] 메모 `입금자명을 주문자 이름과 같게 해주세요.` — **괄호 이름 없이**
    - [ ] `expired === true`면 기한 아래 `기한이 지나 곧 자동 취소됩니다.`
    - [ ] **`deposit_info`가 `null`이면 상자를 그리지 않는다** — 상태 문자열로 분기하지 않는다 (AD-12)
  - [ ] 상자 아래 `기한까지 입금이 확인되지 않으면 주문은 자동 취소됩니다.`
  - [ ] 본문 버튼 2개 — `주문 상세 보기`(solid → `/orders/{order_id}`) · `쇼핑 계속하기`(ghost → `/`). **하단 고정 CTA·탭바 없음**
    - [ ] `/orders/[id]`는 **8.6이 만든다** — 8.5 완료 시점에 죽은 링크임을 Completion Notes에 적는다. 비활성으로 만들지 않는다

- [ ] **Task 10 — 반응형 배치** (AC: 15)
  - [ ] `checkout.css` — `<768` 한 칼럼 + 하단 CTA 바(패딩 `13px 20px 20px`, **탭바 없음**) / `≥768` grid `62fr 34fr`, column-gap 4%
  - [ ] `≥768` 우측 칼럼: 1px hairline 테두리 상자 + `position: sticky; top: calc(var(--b-topbar-h) + var(--b-space-5))`
  - [ ] **중개자 고지는 grid 밖 전체 폭**에 둔다 (UX-DR10 — 이 배치가 규제 요건이다)
  - [ ] 8px 종이 접기 띠는 `<768`에서만
  - [ ] `<768` 본문 하단 여백 = CTA 바 높이. **8.1 셸을 고치지 않는다**
  - [ ] `complete.css` — 560px 한 단. 2단으로 만들지 않는다
  - [ ] `matchMedia`·`innerWidth`·`resize` 사용 **0건**

- [ ] **Task 11 — 검증: 정적 규칙과 빌드** (AC: 17, 18, 19)
  - [ ] `cd apps/web && npx tsc --noEmit` → 0
  - [ ] `cd apps/web && npm run lint` → **0 errors · 0 warnings**. 특히 **`react-hooks/set-state-in-effect` 0건**을 눈으로 확인한다
  - [ ] `cd apps/web && npx next build` → 성공. 신규 라우트가 `/checkout` · `/orders/complete` · `/api/orders/**` 셋인지, **기존 URL이 하나도 바뀌지 않았는지** 확인
  - [ ] `grep -rn "#2f6bff\|--color-brand\|--shadow-\|box-shadow" apps/web/app/\(buyer\)` → 0건
  - [ ] `grep -rn "matchMedia\|innerWidth\|addEventListener(\"resize\"" apps/web/app/\(buyer\)/checkout apps/web/app/\(buyer\)/orders` → 0건
  - [ ] `git diff --stat`에 `apps/api` **0건** · `package.json`·`package-lock.json` **0건** · `app/styles/slur/**` **0건** · `app/styles/buyer/**` **0건**
  - [ ] `cd apps/api && uv run pytest -q` → **환경이 있을 때만.** 이 머신에는 `uv`·`docker`가 없다. 실행하지 못했으면 Completion Notes에 **"미실행 + 사유"**를 적는다 — **통과했다고 쓰지 않는다**

- [ ] **Task 12 — 검증: 화면 확인 (데이터 확보 방법 포함)** (AC: 1~16, 19)
  - [ ] **데이터 확보** — 다음 순서로 시도하고 무엇을 썼는지 기록한다
    1. 프로덕션 API를 `API_BASE_URL`로 가리키고 로컬 웹만 띄워 **테스트 계정**으로 확인한다. ⚠️ 이 스토리는 **실제 주문을 생성한다** — 반드시 테스트 계정으로만, 확인 후 관리자 화면에서 **주문을 취소 처리하고 담은 항목을 정리한다** (R8)
    2. **권장 — 스크래치패드 스텁 서버.** 이 머신에는 `uv`·`docker`가 없어 로컬 백엔드를 띄울 수 없다. 스크래치패드(`/private/tmp/claude-501/.../scratchpad`)에 네 응답만 흉내 내는 Node 스텁을 띄우고 `API_BASE_URL`을 거기로 돌린다 — `GET /api/v1/carts` · `POST /api/v1/orders/preview` · `POST /api/v1/orders` · `GET /api/v1/orders/{id}`. **인증은 스텁이 무시하고, BFF는 그대로 통과한다.** 🚨 **스텁을 저장소에 커밋하지 않는다.** 스텁으로만 확인한 항목은 그 사실을 함께 적는다
    3. 스텁은 **실패 응답도 낼 수 있어야 한다** — `out_of_stock`(details 2건) · `price_changed` · `duplicate_request` · `empty_cart` · 401 · 상류 중단. Task 13이 이것을 쓴다
  - [ ] **확인 케이스**
    - 판매자 2곳 이상 (묶음 분리·순서·헤더 배송비 / `무료배송`)
    - 일반 우편번호(도서산간 0원 줄이 **남아 있는지**) · 제주(63001) · 도서 — 세 경우의 요약 4행과 안내 문장
    - 우편번호 미입력 상태의 `배송지 입력 후 계산` 4행 + CTA `disabled`
    - 옵션 없는 항목(`N개`만) · 이미지 없는 항목
    - 구매 불가 항목이 장바구니에 섞여 있을 때 **주문서에 나타나지 않는지**
    - 구매 가능 항목 0건일 때의 빈 상태
    - 주문완료 — 입금 안내 상자(27px 금액·계좌·기한·메모) · 주문번호 · 버튼 2개 · 탭바 없음 · 560px
    - 주문완료를 **새로고침**했을 때 그대로 그려지는지, **뒤로가기**가 `/cart`로 가는지 (D3)
    - `?order=` 없음 / 잘못된 UUID / 404 — 빈 화면이 아니라 안내가 나오는지
  - [ ] **390 / 700 / 768 / 1280 네 폭** — `<768` CTA 바(탭바 **없음**·마지막 구획이 가려지지 않는지), `≥768` 62/34 + 우측 sticky 테두리 상자, **중개자 고지가 2단 아래 전체 폭인지**
    - ⚠️ Chrome 헤드리스는 최소 500px 폭을 강제한다(8.1의 학습) — `<640`은 500px으로 확인하고 390 고유 수치는 미디어쿼리 값과 대조한다
  - [ ] **폭을 바꿔도** 입력 중인 배송지·열린 오버레이·오류 문장이 유지되는지 확인
  - [ ] **키보드만으로 완주** — 배송지 → `우편번호 검색`(오버레이 안에 갇히는지, `Esc`로 복원되는지) → 요청사항 → 결제 수단 라디오 → 고지 → `주문하기`. 하단 고정 바가 콘텐츠보다 먼저 포커스되지 않는지
  - [ ] 먹색 포커스 링이 모든 새 컨트롤에 보이고 **파랑이 0회**인지 확인
  - [ ] 글자 크기 200% 확대에서 46px 입력·고정 바가 잘리지 않는지 (UX-DR7)
  - [ ] 결과를 Completion Notes에 기록한다 — **단위 테스트로 대체하지 않는다**(`apps/web`에 테스트 프레임워크가 없고 도입하지 않는다)

- [ ] **Task 13 — 검증: 실패 경로와 우편번호 스크립트** (AC: 4, 10, 11, 16)
  - [ ] **`out_of_stock`** — 스텁(또는 판매자 화면에서 품절 처리) → 주문이 생성되지 않고 **항목명·옵션이 나열**되는지, **자동 이동하지 않는지**, `장바구니로 이동`이 동작하는지
  - [ ] **`price_changed`** — 새 금액으로 갱신되고 **자동 재제출되지 않는지**
  - [ ] **`duplicate_request`** — `주문내역 보기` 안내가 나오는지
  - [ ] **`empty_cart`** — 주문서 진입 시·주문 시 각각
  - [ ] **세션 만료** — `slur_access`·`slur_refresh`만 지우고(`slur_role`은 남긴 채) `/checkout` 진입 → 미들웨어는 통과하지만 `GET`이 401 → `/login?next=%2Fcheckout`
  - [ ] **상류 중단** — 조회·미리보기·주문 각각에서 문장형 메시지 + 재시도 수단. **화면에 숫자·`code` 문자열이 없는지 확인**
  - [ ] **우편번호 스크립트 차단** — 개발자도구에서 `t1.daumcdn.net`을 차단하고 `우편번호 검색`을 누른다 → 오버레이 안에 안내 + `다시 시도`가 뜨고, **우편번호·주소를 직접 입력해 주문까지 완주할 수 있는지** 확인 (D1의 폴백이 살아 있다는 증거)
  - [ ] **경합** — 스텁의 preview 응답을 인위적으로 지연시키고 우편번호를 빠르게 두 번 바꾼다 → **이전 우편번호의 금액이 화면에 남지 않는지** 확인 (D2 — 이 스토리가 갚는 부채)
  - [ ] **프로덕션 재확인 (R3)** — 배포 후 `POST /api/orders/preview`가 Railway 프록시 뒤에서 `assertSameOrigin`을 통과하는지 실제 브라우저 요청 1회로 확인한다. **로컬만 보고 done으로 넘기지 않는다**
  - [ ] **테스트 데이터 정리** — 만든 주문을 관리자 화면에서 취소 처리하고, 담은 항목을 지운다 (R8)

## Dev Notes

### 이 스토리의 경계 — 하지 않는 일

| 하지 않는다 | 어디가 하는가 |
|---|---|
| 백엔드 수정·마이그레이션·신규 엔드포인트·응답 필드 추가 | 없음. Epic 8 전체가 백엔드 무변경 |
| 로그인·회원가입, `next` 값의 소비, 역할 쿠키 | **8.2** |
| 상품목록·상품상세, `?variant=`, 판매자 신원정보 접이식 | **8.3** |
| 장바구니 화면·수량·삭제·배지 컨텍스트·`GET /carts` BFF | **8.4** (8.5는 8.4가 만든 것을 **쓴다**) |
| 주문내역(`/orders` 목록)·주문상세(`/orders/[id]`)·묶음 취소·입금 안내 상자 `detail` 변형 | **8.6** |
| `/me`·PWA·service worker·`theme-color` | **8.7** |
| `apps/mobile` 제거 | **8.8** |
| 부분 선택 주문 · 단품(`바로 구매`) 직행 주문 | v1 밖 — 백엔드 변경이 선행 (D6, deferred-work 등재) |
| 배송지 주소록·최근 배송지·입력 자동저장 | v1 밖 (D14) |
| 결제 수단 추가·PG 결제창 | **Epic 7** (오픈 게이트) |
| `apps/web` 테스트 프레임워크 도입 | 하지 않는다 (의존성 추가 금지) |

### 소비하는 백엔드 API — 계약 (읽기만, 수정 금지)

네 엔드포인트 모두 **인증 필수**(`get_current_user_id`). 경로 접두사는 `/api/v1`. 구매자 역할 검사는 없다 — 로그인만 요구한다.

**① `GET /api/v1/carts`** → `200 CartResponse` — 8.4의 계약 그대로. 8.5는 **`purchasable === true`만** 쓰고, `image_url`을 `id`(= `cart_item_id`) 키로 보관해 preview 결과에 붙인다 (D5).

**② `POST /api/v1/orders/preview`** `{postal_code}` → `200 OrderPreviewResponse`

```jsonc
{ "seller_groups": [
    { "seller_id": "uuid",
      "brand_name": "토림도예",
      "items": [
        { "cart_item_id": "uuid",     // ← POST /orders의 cart_item_ids 소스
          "variant_id": "uuid",
          "product_name": "유광 도자 머그",
          "option_text": "색상: 살구 / 용량: 240ml",   // 서버 조립. 옵션 없으면 ""
          "quantity": 2,
          "final_price": 32000,       // base + extra, 단가
          "line_total": 64000 }       // ← 행 금액. 장바구니와 달리 서버가 준다
      ],
      "item_total": 64000,
      "shipping_fee": 3000,           // 판매자 기본 배송비
      "remote_extra_fee": 0,          // 도서산간 추가비 (일반 지역 0)
      "shipping_total": 3000 }        // ← 묶음 헤더에 쓰는 값 (기본 + 도서산간)
  ],
  "item_total": 118000,
  "shipping_total": 3000,             // 기본 배송비 **합** (도서산간 제외)
  "remote_extra_total": 0,            // 도서산간 추가비 합 — 요약 행 분리용
  "grand_total": 121000,              // item + shipping + remote
  "remote_area_kind": null }          // "jeju" | "island" | null(일반)
```

- `postal_code`는 **숫자 5자리 필수**. 형식 위반은 `422 validation_error`
- 구매 가능 항목 0건(빈 장바구니 포함)은 **`422 empty_cart`** (`주문할 수 있는 상품이 없습니다.`)
- **항목 선택 파라미터가 없다** — 장바구니의 구매 가능 항목 전체를 계산한다 (D6)
- ⚠️ **`image_url`이 없다.** 사진은 `GET /carts`에서 가져와 붙인다 (D5, 위험 3)
- ⚠️ 판매자 삭제 레이스는 `500 internal_error` (`판매자 정보를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.`)
- 읽기 전용이다 — 재고를 잡지도, 장바구니를 바꾸지도 않는다

**③ `POST /api/v1/orders`** → `201 OrderCreateResponse`

요청:
```jsonc
{ "cart_item_ids": ["uuid", …],   // 1~100개. 주문서에 표시된 항목 전부 (D6)
  "expected_grand_total": 121000, // 화면이 보여준 총액 — 불일치 시 409 price_changed
  "postal_code": "04044",         // ^\d{5}$
  "recipient_name": "김소연",      // 1~50
  "recipient_phone": "01028473391", // ^\d{9,11}$ — 🚨 하이픈 불가
  "address1": "서울특별시 마포구 양화로 45",  // 1~255
  "address2": "301호",             // 0~255 (선택)
  "order_note": "부재 시 경비실에 맡겨주세요" }  // 0~500 (선택)
```

응답:
```jsonc
{ "order_id": "uuid",
  "grand_total": 121000,
  "deposit_account": "국민은행 123456-01-987654",  // settings 값 (AD-13). 한 문자열
  "deposit_due_at": "2026-07-24T12:34:56Z" }       // UTC
```

- 🚨 **`order_no`가 없다.** 주문번호를 표시하려면 `GET /orders/{id}` 재조회가 **필수**다 (D3, 위험 2)
- 한 트랜잭션: 술어 재검증 → `quote()` 재계산 → 조건부 재고 차감 → 스냅샷 INSERT → **장바구니 항목 삭제** → 이벤트. 실패 시 전체 rollback
- 실패 code: `empty_cart`(422) · `out_of_stock`(422, `details=[{cart_item_id, product_name, option_text}]` **복수 가능**) · `price_changed`(409, `details=[{grand_total}]`) · `duplicate_request`(409) · `not_found`(404, 남의·없는 cart item) · `validation_error`(422)
- **성공 시 장바구니가 비워진다** — 뒤로가기로 `/checkout`에 돌아오면 `empty_cart`다 (D3)

**④ `GET /api/v1/orders/{order_id}`** → `200 OrderDetailResponse`

8.5가 쓰는 필드는 넷뿐이다: `order_no` · `grand_total` · `deposit_info` · `order_id`. 나머지(`sub_orders`·주소·금액 내역)는 **8.6이 쓴다.**

```jsonc
{ "order_no": "A1B2C3D4",     // UUID 뒤 8자리 대문자 — 🚨 클라 가공 금지 (위험 6)
  "deposit_info": {           // pending_payment일 때만. null이면 상자를 그리지 않는다
    "grand_total": 121000,    // 잔여 활성분 (부분 취소 반영 — 과입금 방지)
    "deposit_account": "국민은행 123456-01-987654",
    "deposit_due_at": "2026-07-24T12:34:56Z",
    "expired": false }        // 기한 경과(자동취소 배치 전 창) — 경고 표시
  … }
```
- 남의 주문·없는 주문 → **`404 not_found`** (403이 아니다 — 존재 노출 방지)
- **분기는 `deposit_info`의 존재 여부로만** 한다. `display_status` 문자열로 분기하지 않는다 (AD-12, 5.1 확정 규약)

**에러 봉투 (공통)** — `{code, message, details}`. 분기는 `code`, 표시는 `message`. **HTTP 코드·`code` 문자열은 화면에 나타나지 않는다.**

### 고칠 코드 — ① 지금 무엇을 하는가 ② 무엇을 바꾸는가 ③ 깨뜨리면 안 되는 것

**`apps/web/app/(buyer)/amount-summary.tsx`**
1. 8.1이 만든 뼈대. `{itemsTotal, shippingFee, remoteAreaFee, total}` 네 **숫자**를 받아 **상품 금액 · 배송비 · 도서산간 추가 · 합계** 순서로 렌더. 0원 값은 `.m_zero`로 물러난다. `formatWon`도 여기서 export한다. **8.4가 `shippingFee`·`remoteAreaFee`에 `number | null`과 `pendingText`·합계 라벨 prop을 더하는 중이다.**
2. `total`도 `number | null`을 받게 한다(우편번호 전 미확정). 합계 라벨은 `결제 예정 금액`을 넘긴다.
3. 🚨 **행 순서와 "도서산간 0원이어도 줄을 지우지 않는다"** — 파일 상단 주석이 이 둘을 못 박고 있다. `null` 처리를 "행을 지운다"로 구현하면 이 스토리가 UX-DR13을 깬다. 🚨 `formatWon`을 여기서 지우면 다른 화면이 깨진다 — 8.4 D12의 정리 규칙을 먼저 확인한다. 🚨 **8.4가 같은 파일을 동시에 만지고 있다**(위험 12).

**`apps/web/app/(buyer)/seller-pack.tsx`**
1. 뼈대. `brand`·`headStart`·`headEnd`·`children`·`foot`·`unavailable` 슬롯 + `.b_seller_pack` 마크업. 헤더 안에서 `<BrandLabel size="pack">`을 이미 그린다.
2. **가능하면 수정하지 않는다** — 주문서가 필요한 것(헤더 우측 배송비, 읽기 전용 항목 행)이 전부 슬롯으로 들어간다.
3. 파일 주석이 "주문서(8.5): 읽기 전용"을 이미 선언하고 있다. 🚨 **"주문 전체에 걸리는 상태·전체 취소 버튼을 두지 않는다"(FR-15·18)** 는 8.6도 쓰는 계약이다. 주문서 전용 prop을 추가해 다른 화면이 못 쓰게 만들지 않는다.

**`apps/web/app/(buyer)/format.ts`**
1. `formatWon(n)` 하나. `"ko-KR"` 로케일을 **명시**해 하이드레이션 불일치를 막는 주석이 붙어 있다.
2. `formatDepositDue(iso)` 추가 — `Asia/Seoul` 고정.
3. 🚨 로케일·타임존을 생략하지 않는다는 규칙이 이 파일의 존재 이유다. 새 함수가 그 규칙을 어기면 파일이 무의미해진다. 🚨 8.6이 쓸 날짜 포맷(`2026.07.21`)을 미리 만들지 않는다 — 쓰지 않는 export는 lint 대상이 될 수 있고, 8.6이 자기 화면을 보며 정하는 편이 맞다.

**`apps/web/app/(buyer)/buyer.css`**
1. 셸(컨테이너·그리드·상단바·탭바·배지·포커스 링) + 폼 프리미티브(`.b_btn`·`.b_input`·`.b_checkbox`) + 공유 컴포넌트(`.b_amount_summary`·`.b_seller_pack`·`.b_status_label`) + 8.4가 승격한 `.b_cta_bar`·`.b_confirm_row`·`.b_stepper`.
2. **공용 규칙만 추가한다** — 우편번호 오버레이(`.b_overlay`, `m_sheet`/`m_center` 변형) · 입금 안내 상자(`.b_deposit_box`) · 라벨-입력 폼 행(`.b_field`). **주문서 전용 배치는 `checkout.css`, 완료 전용은 `complete.css`로.**
3. 🚨 `.b_container`·`.b_row`·`.b_seller_pack`·`.b_amount_summary`·`.b_input`·포커스 링 블록은 8.1~8.4가 실측 검증한 것이다. **값을 다시 선언하거나 덮어쓰지 않는다.** 🚨 스코프 없는 태그 셀렉터(`input`·`button`·`iframe`)를 쓰지 않는다 — 격리의 근거는 임포트 위치가 아니라 셀렉터다(8.1의 학습). 🚨 `[data-surface="buyer"] svg { stroke-width: var(--b-tab-stroke, 1.4px) }`가 **구매자 라우트의 모든 SVG**에 걸린다 — 오버레이 닫기 아이콘을 SVG로 그리면 이 굵기를 물려받는다(글자 `×`로 만들면 문제가 없다, 8.4의 학습 12).

**`apps/web/app/config/company.ts` (수정하지 않는다)**
1. `COMPANY` placeholder 8필드 + `BROKER_NOTICE`(= `${COMPANY.name}는 통신판매중개자이며 …`). 푸터·정책 페이지·8.3 상품상세가 참조한다.
2. **아무것도 바꾸지 않는다.** `BROKER_NOTICE`를 **import만** 한다.
3. 🚨 **문구를 복사하지 않는다.** 8.3 D10이 정본을 이 상수로 못 박았고 UX 스파인이 그것에 맞춰 정정됐다(deferred-work 2026-07-22). 화면에 하드코딩하면 오픈 게이트의 실사업자 정보 교체가 이 화면만 빠뜨린다. 🚨 실값 교체는 **오픈 게이트 항목**이며 8.5의 일이 아니다.

**`apps/web/lib/auth.ts` (수정하지 않는다)**
1. 쿠키 상수 · `setSessionCookies` · `clearSessionCookies` · `resolveRole` · `setRoleCookie` · `fetchRoles` · **`assertSameOrigin`** · `safeNextPath` · **`proxyWithRefresh`**.
2. **아무것도 바꾸지 않는다.** 두 함수를 import한다.
3. 🚨 `proxyWithRefresh`의 401 경로가 `clearSessionCookies`를 호출한다 — **주문 경로에서는 이것이 올바른 동작이다**(세션이 정말 끝났다). 8.3이 공개 GET에서 이 함수를 피한 이유와 혼동하지 않는다. 🚨 refresh 회전 쿠키가 반환 응답에 실려 있으므로 **응답을 다시 감싸면 세션이 유실된다.**

**`apps/web/app/(buyer)/cart-count.tsx` · `cart-api.ts` (8.4 산출물, 최소 사용)**
1. 배지 값 컨텍스트(`useCartCount`)와 장바구니 fetch 래퍼(`getCart` 등).
2. `getCart()`를 주문서 1단계에서 쓰고, 주문 성공 후 배지를 0으로 갱신한다.
3. 🚨 **파일을 수정하지 않는다** — 필요한 것이 이미 export돼 있는지 먼저 확인하고, 없으면 최소 추가만 하되 그 사실을 스토리에 적는다. 🚨 배지 조회는 `slur_role` 쿠키가 있을 때만 시도하는 **UX 힌트**다(R7) — 주문서·완료 화면의 데이터 조회는 그 규칙과 무관하게 항상 서버에 묻는다.

**`apps/api/app/orders/**` · `app/carts/**` (읽기만, 수정 금지)**
1. `router.py` 5엔드포인트 + `service.py`(`quote`·`preview_order`·`create_order`·전이 엔진·자동취소·`get_my_order`) + `schemas.py` + `models.py`.
2. **한 줄도 바꾸지 않는다.**
3. 이 도메인은 4.2·4.3·4.4·4.5·4.6·5.1에서 프로덕션 검증됐고 `test_orders_*.py`가 다중 판매자 그룹핑·제주/도서 추가비·스냅샷 불변·동시 주문 레이스·`price_changed`·이중 제출을 봉인하고 있다. **API 테스트 153건이 그대로 통과하는 것이 백엔드 무변경의 증거**다.

### 앞선 학습 (sprint-status.yaml action_items · 앞선 스토리에서 골라온 것)

- **R3 (open) — 쿠키·Origin·CORS는 프로덕션(프록시 뒤) 실요청 검증 후에만 done.** 이 스토리는 **인증 BFF 라우트 3개를 신설**하고 그중 둘이 `assertSameOrigin`을 탄다. Railway 프록시 뒤에서 `x-forwarded-host` 비교가 통과하는지 **배포 후 미리보기 1회로 확인**한다 (Task 13). 로컬만 보고 done으로 넘기지 않는다.
- **R6 (done) — 에러 code는 Dev Notes에 사전 시드 선언.** 아래 별도 절.
- **R7 (done) — `slur_role`은 UX 힌트일 뿐 권한 판정이 아니다.** 미들웨어가 `/checkout`·`/orders/complete`를 통과시키는 것은 **인증이 아니다**(`slur_role` 14일 > `slur_access` 30분). 페이지가 API 401을 **자기 손으로** `/login` 처리한다 (AD-1).
- **R8 (in-progress) — 프로덕션 E2E 시나리오 사전 명시 + 테스트 데이터 즉시 정리.** ⚠️ **이 스토리는 8.4보다 위험하다** — 담기가 아니라 **주문을 만든다.** 재고가 차감되고 장바구니가 비워지며 주문이 남는다. Task 12·13이 스텁을 1순위 대안으로 두는 이유이며, 프로덕션에서 만든 주문은 반드시 관리자 화면에서 취소 처리한다.
- **A-E456-5 (done) — 웹 lint 베이스라인 0 errors · 0 warnings.** 🚨 **`react-hooks/set-state-in-effect`가 error다.** 8.3이 이 벽에 부딪혀 로딩 상태를 파생시켜 해결했고, 주문서는 재조회가 가장 잦은 화면이라 정면으로 해당한다 (D2). 항목 사진 `<img>`는 `@next/next/no-img-element` 후보다.
- **4.4의 확정 설계 — `cart_item_ids` + `expected_grand_total`.** 둘 다 "본 것과 다른 주문이 조용히 생성되는 것"을 막는 장치다. 화면이 이 둘을 성실히 채우지 않으면 백엔드의 안전장치가 무의미해진다 (D6).
- **4.4의 Flutter 처리 — `out_of_stock` details를 다이얼로그로 표시 후 장바구니 복귀.** 웹에는 다이얼로그가 없다(UX-DR16). **머무르며 인라인으로 알리고 이동은 사용자가 누른다** (D7).
- **4.2의 확정 계약 — `shipping_total`은 기본 배송비 합, `remote_extra_total`은 별도 필드.** 요약 4행을 **분리 표시하기 위해** 그렇게 나눴다. 화면이 둘을 더해 한 줄로 만들면 그 설계가 무의미해진다.
- **5.1의 확정 규약 — 입금 안내는 상태값이 아니라 `deposit_info` 객체의 존재로 분기한다** (AD-12). 부분 취소 후 금액은 **잔여 활성분**이다(과입금 방지) — 완료 화면도 그 값을 그대로 쓴다.
- **8.1의 학습 — Chrome 헤드리스는 최소 500px 폭을 강제한다.** `<640` 구간은 500px으로 확인하고 390 고유 수치는 미디어쿼리 값과 대조한다.
- **8.1의 위험 9 — `/orders/complete`와 `/orders/[id]`의 경로 경합.** 정적이 이긴다 (D4).
- **8.3의 학습 — `useSearchParams`는 `<Suspense>` 경계를 요구한다.** 주문완료가 `?order=`를 읽으므로 해당한다.
- **8.4의 학습 12 — `[data-surface="buyer"] svg { stroke-width: … }`가 구매자 라우트의 모든 SVG에 걸린다.** 오버레이 닫기 아이콘을 SVG로 그리면 굵기를 물려받는다.
- **`apps/web/AGENTS.md`: "이건 네가 아는 Next.js가 아니다 — `node_modules/next/dist/docs/`를 먼저 읽어라."** `ctx.params`는 Promise다.

### 에러 code 시드 (R6)

이 스토리가 만나는 `code`는 전부 **기존 백엔드 코드**이며 새로 만들지 않는다.

| code | HTTP | 언제 | 화면 처리 |
|---|---|---|---|
| `unauthorized` | 401 | 세션 만료·비로그인 | 주문서: `/login?next=%2Fcheckout`로 `replace` / 주문완료: `/login?next=<현재 경로+쿼리>`로 `replace` |
| `empty_cart` | 422 | preview·create — 구매 가능 항목 0 | `주문할 수 있는 상품이 없습니다.` + `장바구니로 이동`. 주문 상품·금액·CTA를 그리지 않는다 |
| `validation_error` | 422 | 우편번호 형식 · 배송지 필드 | **해당 필드에만** 오류 표시 (`details` 매핑). 상단 배너 금지 |
| `out_of_stock` | 422 | 주문 생성 재검증·차감 실패 | 주문 미생성. `details`의 `product_name`·`option_text`를 **항목별로 나열** + `장바구니로 이동`. **자동 이동 금지** |
| `price_changed` | 409 | `expected_grand_total` 불일치 | `message` + **미리보기 자동 재조회**로 새 금액 갱신. **자동 재제출 금지** |
| `duplicate_request` | 409 | 동시 이중 제출 (장바구니가 이미 비워짐) | `message` + `주문내역 보기`(→ `/orders`). 실패가 아니라 **이미 만들어졌다**는 뜻 |
| `not_found` | 404 | 남의·없는 cart item / 남의·없는 주문 / BFF의 잘못된 id | 주문서: `message` + `장바구니로 이동` / 주문완료: `주문을 찾을 수 없습니다.` + `주문내역 보기` |
| `forbidden` | 403 | BFF `assertSameOrigin` 위반 | `message` + 재시도 (정상 브라우저 사용에서는 나오지 않는다) |
| `internal_error` | 500 | `settings` 시드 누락 · 판매자 삭제 레이스 | `message` + `다시 시도` |
| `service_unavailable` | 503 · BFF 폴백 | 상류 장애, JSON 아닌 응답 | `message` + `다시 시도` |
| `http_error` | 그 외 | 매핑 없는 상태 | `message` + `다시 시도` |
| (봉투 없음) | — | fetch throw(네트워크 단절) · 우편번호 스크립트 로드 실패 | `연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요.` / 오버레이 안 폴백 문장 |

**표시 규약**: 분기는 `code`, 표시는 `message`. **HTTP 코드·`code` 문자열을 화면에 렌더하지 않는다** (UX-DR9·15 — `로그인 실패 (401)`이 Don't 예시다).

### 발견한 위험 · 기존 코드의 문제 (구현 전에 읽을 것)

1. 🚨 **`deposit_account`가 한 문자열이라 `예금주` 줄을 만들 수 없다 — UX 계약과 API 계약이 어긋나는 첫 번째 지점.** 목업과 DESIGN.md `{components.deposit-box}`는 `입금 계좌` / `예금주` / `입금 기한` 세 줄을 그리는데, 백엔드에는 `settings` 테이블의 `deposit_account` **문자열 하나**뿐이다(시드값 `은행/계좌번호/예금주 미설정`, 관리자 화면에서 1~200자 자유 문자열로 수정). D11이 `입금 계좌` 한 줄로 결정했지만, **예금주가 표시되려면 운영자가 그 문자열 안에 넣어야 한다.** 근본 해소는 `settings`에 key를 나누거나 응답 필드를 분리하는 것이며 **Epic 8 경계 밖**이다. **오픈 게이트(실계좌 등록) 시 Slur가 알아야 할 사실**이다.

2. 🚨 **`POST /orders`의 201 응답에 `order_no`가 없다.** 주문번호는 `GET /orders/{id}`·`GET /orders`에만 있다. 그래서 주문완료 화면이 **재조회 없이는 그려질 수 없다** — D3의 결정적 근거이자, "생성 응답을 화면으로 나른다"는 흔한 구현이 여기서는 **애초에 불가능**하다는 사실.

3. 🚨 **`POST /orders/preview` 응답에 상품 이미지가 없다.** `PreviewItem`에 `image_url`이 없어 주문서 묶음의 사진을 그릴 수 없다. `GET /carts`와 합성하는 것 말고 방법이 없다(D5). 백엔드에 필드를 하나 더하면 두 번째 호출이 사라지지만 **Epic 8 경계 밖**이다.

4. 🚨 **연락처 계약이 목업과 다르다.** 서버는 `^\d{9,11}$` — **하이픈을 받지 않는다.** 목업은 `010-2847-3391`로 그렸다. 전송 전 정규화(D8)를 빼먹으면 **정상 입력이 422로 튕긴다.** 이 스토리에서 가장 만들기 쉬운 버그다.

5. 🚨 **우편번호 검색이 청약 경로의 제3자 스크립트다.** `t1.daumcdn.net`이 죽거나 차단되면 주소를 넣을 수 없고 **주문 자체가 막힌다** — 그래서 직접 입력 폴백이 선택이 아니라 필수다(D1, Task 13이 차단 상태로 완주를 검증한다). 부수 사실 셋: (a) **현재 이 앱에 CSP가 없다** — 지금은 통과하지만 CSP를 도입하면 `script-src https://t1.daumcdn.net` 등의 allowlist가 필요하다, (b) **PWA(8.7)의 오프라인 캐시 대상이 아니다** — 오프라인에서는 검색이 되지 않는다, (c) **개인정보처리방침의 제3자 스크립트 고지** 검토 대상이다(오픈 게이트).

6. **주문번호 형식이 목업과 API가 다르다.** 목업은 `20260721-0037`(날짜 + 일련번호)인데 실제 `order_no`는 **UUID 뒤 8자리 대문자**(`_order_no()`)다. **API 값을 그대로 쓴다**(스키마 주석: "클라 가공 금지"). 부수로, 5.1이 **8자리 충돌 가능성**을 인지하고 관리자 화면에 전체 UUID를 병기해 두었다 — 구매자 화면은 8자리만 보여준다.

7. **`3일`이 화면 문구에 하드코딩된다.** `입금 확인 후 배송이 시작됩니다. 주문 후 3일 안에 입금하지 않으면 자동 취소됩니다.`는 UX-DR15의 확정 문장이지만, 실제 기한은 `settings.unpaid_cancel_days`이고 **구매자 API로 내려오지 않는다**(관리자 전용). AD-13(하드코딩 금지)과 긴장하는 지점이다. **완화**: 실제 기한은 주문완료의 `deposit_due_at`(서버 값)이 말한다. 운영자가 `unpaid_cancel_days`를 바꾸면 **이 문장만 손으로 고쳐야 한다** — 부채로 기록한다.

8. **도서산간 시드가 공식 대조 전이다** (`deferred-work.md`의 오픈 게이트 항목). `remote_area_zips` 870행(jeju 645 / island 225)은 공개 목록 기반이고 "목록에 없으면 일반"이 기본값이다(과청구 방지). 화면은 결과만 표시하므로 8.5의 책임은 아니지만, **잘못된 판정이 청약 금액에 직결된다.**

9. **preview는 장바구니 전체, create는 `cart_item_ids`.** 부분 주문을 만들 수는 있지만 미리 볼 수 없다 — 8.4 D3와 같은 사실이다. 8.5는 **preview가 준 id 전부**를 그대로 보내고 고르는 수단을 만들지 않는다 (D6).

10. **경로 경합 두 곳.** 페이지 `/orders/complete` vs `/orders/[id]`(8.6), BFF `/api/orders/preview` vs `/api/orders/[id]`. 둘 다 **정적이 동적을 이긴다**(8.1 위험 9). `[id]` 쪽에서 `complete`·`preview`를 문자열로 걸러내는 코드를 쓰지 않는다 — 라우터가 이미 판정한다.

11. **주문 성공 후 뒤로가기.** 장바구니가 비워지므로 `/checkout`으로 돌아가면 `empty_cart`다. D3이 `replace`로 히스토리에서 치우지만, **사용자가 주소창으로 직접 `/checkout`에 오는 경로는 남는다** — AC 16의 빈 상태가 그 자리를 받는다.

12. **8.4가 `amount-summary.tsx`·`buyer.css`·`cart-api.ts`를 동시에 만지고 있다.** 이 스토리의 baseline(`bd5a52e`) 시점에는 8.4의 산출물이 커밋되지 않은 상태다. **착수 전에 `git pull` 후 실제 파일을 다시 읽는다** — 특히 `.b_cta_bar`·`amount-summary`의 `null` 지원·`formatWon`의 위치.

13. **이 머신에서 백엔드를 띄울 수 없다.** `uv`·`docker`가 PATH에 없어 `apps/api` pytest도 로컬 API도 불가능하다. Task 12가 대안 셋을 순서대로 지시하며 **스크래치패드 스텁을 권장**한다. **"통과했다"고 쓰지 않는 것**이 8.1이 세운 규약이다.

14. **주문서에서 새로고침하면 입력이 사라진다.** 주소록·자동저장을 만들지 않기로 했기 때문이다(D14). 폭 변경·회전에서는 살아 있다(CSS만으로 재배치). 알려진 성질로 기록한다.

15. **`중개자 고지`의 배치가 규제 요건이다.** ≥768에서 우측 sticky 칼럼에 넣으면 스크롤 밖으로 사라질 수 있어 FR-32를 만족하지 않는다. **2단 밖 전체 폭**이 유일한 정답이다(UX-DR10). 코드 리뷰에서 가장 놓치기 쉬운 자리라 AC 8·15와 Task 7·10에 세 번 적었다.

16. **`middleware.ts`는 Next 16에서 deprecated이며 `proxy`로 이름이 바뀌었다**(8.1이 발견해 부채로 남긴 항목, Epic 8 완료 후 rename). 이 스토리는 미들웨어를 건드리지 않는다 — `/checkout`·`/orders/complete`는 8.1이 이미 matcher에 등록했다.

### Project Structure Notes

- 정렬: `Consistency Conventions`의 "프론트 = Next.js App Router + 슬러 시스템 CSS", 그 위에 8.1이 얹은 구매자 스코프 확장 층. 8.5는 그 층을 **소비하고 공용 부품 둘(우편번호 오버레이·입금 안내 상자)을 보탠다.** [Source: ARCHITECTURE-SPINE.md#Consistency-Conventions]
- 신규 페이지 라우트 2개: `/checkout` · `/orders/complete`. 신규 BFF 3파일: `app/api/orders/**`. **기존 URL 변경 0건.**
- 스파인 Deferred/Conventions의 `[ASSUMPTION]` "주소 입력 제공자"를 **D1이 해소한다** — 스파인 갱신은 Epic 8 회고에서 일괄 반영한다.
- 컴포넌트 파일은 라우트 폴더 안에 평평하게 둔다. 여러 화면이 공유하는 것(`orders-api.ts`·`deposit-box.tsx`)은 `(buyer)/` 바로 아래, 화면 전용은 각 라우트 폴더 안.
- `page.tsx`·`layout.tsx`·`route.ts`가 아닌 파일은 라우트를 만들지 않는다.
- 스택 핀: Next.js 16.2.10 / React 19.2.4. **의존성을 추가하지 않는다** — `package.json`·`package-lock.json` diff 0건이 AC 19의 증거다.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic-8 — 에픽 경계: 백엔드 무변경·ERD 0건·구매자 API 12개 재사용·테스트 153건]
- [Source: _bmad-output/planning-artifacts/epics.md#Story-8.5 — AC 원문(구획 구성·우편번호 모달 예외·preview 재조회·중개자 고지 위치·재검증 실패·입금 안내 상자·560px) 및 Dev Notes(우편번호 제공자 `[ASSUMPTION]`·주문 정보 전달 방식 `[ASSUMPTION]`)]
- [Source: _bmad-output/planning-artifacts/epics.md#Story-8.4 — 장바구니 CTA가 `/checkout`으로 보낸다, 구매 불가 항목이 주문서로 넘어가지 않는다]
- [Source: _bmad-output/planning-artifacts/epics.md#Story-8.6 — `/orders/[id]`·묶음 취소·입금 안내 `detail` 변형의 소유]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR3 — 하단 고정 CTA가 있는 화면에는 탭바를 두지 않는다(장바구니만 예외), 상단바 형태]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR4 — 주문서 62/34 우측 sticky, 주문완료 560px 한 단, ≥768 CTA 승격, 폭 변경 시 입력 중인 배송지 유지]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR5 — 여백 20/20/32, 본문 1080px, 행 내부 최대 폭 560px]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR6 — 먹색 포커스 링, 키보드로 목록→상세→담기→주문서→주문 완주, 하단 고정 바는 DOM 순서상 콘텐츠 뒤]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR7 — 터치 타깃 44×44, 글자 200% 확대에서 고정 높이 바가 늘어날 것]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR9 — 폼 오류는 필드에만·상단 배너 금지, 제출 중 버튼 비활성, HTTP 코드·code 미노출]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR10 — 주문서 `주문하기` 직전 중개자 고지, ≥768 2단 아래 전체 폭, 모달·별도 페이지·"더보기" 금지]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR12 — box-shadow 금지, 8px 띠·1px hairline·테두리 상자, 라운드 5px = 입금 안내 상자]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR13 — 판매자 묶음 뼈대(주문서는 읽기 전용), 금액 요약 행 순서, 도서산간 0원 줄 유지, 합계 21px 액센트는 화면당 한 번]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR14 — 입금 안내 상자 두 변형, 주문완료의 상자가 화면의 중심]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR15 — `입금 확인 후 배송이 시작됩니다…`, `주문이 접수되었습니다`, 금액·날짜 형식]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR16 — **모달 금지, 우편번호 검색만 예외**(<768 전체 화면 / ≥768 가운데 모달), 확인 후 실행, `prefers-reduced-motion`]
- [Source: ux-designs/ux-SLUR_platform_blueprint-2026-07-21/DESIGN.md#frontmatter — `deposit-amount` 27px/800/-.03em, `deposit-box`(placed/detail·radius md), `input` 46px, `checkbox`(라디오 16px 원 + 먹색 점), `amount-summary`, `section-label` 10.5px/800/.16em]
- [Source: ux-designs/…/DESIGN.md#Layout-&-Spacing — 8px 띠는 주문서의 배송지/주문 상품/결제 금액/결제 수단 사이, CTA 바 패딩 `13px 20px 20px`]
- [Source: ux-designs/…/DESIGN.md#Layout-&-Spacing#반응형 — 주문서 62/34 우측 sticky, 주문완료 560px, **2단 우측 칼럼에 한해 1px 테두리 상자 허용**]
- [Source: ux-designs/…/DESIGN.md#Components#입금-안내-상자 — placed 변형(1.5px 액센트 테두리·노치 캡션·27px 금액·paper-shade 메모)과 detail 변형의 차이·근거]
- [Source: ux-designs/…/DESIGN.md#Components#입력-필드 — 46px 고정 높이로 통일(목업 패딩 방식이 진다), 오류 테두리·면·메시지]
- [Source: ux-designs/…/DESIGN.md#Components#버튼 — small(`우편번호 검색`) 12px/700·1.4px 테두리, solid/ghost]
- [Source: ux-designs/…/EXPERIENCE.md#Information-Architecture — 주문서(뒤로가기+제목·탭바 없음·CTA `121,000원 · 주문하기`) / 주문완료(로고 중앙·탭바 없음·본문 버튼 2개)]
- [Source: ux-designs/…/EXPERIENCE.md#Voice-and-Tone — **`BROKER_NOTICE` 상수가 정본이며 화면은 임포트한다**, 금액·날짜 형식, `주문이 접수되었습니다`]
- [Source: ux-designs/…/EXPERIENCE.md#Component-Patterns — 금액 요약 행 순서·도서산간 0원 줄 유지, 하단 고정 CTA의 금액은 합계와 항상 같은 값]
- [Source: ux-designs/…/EXPERIENCE.md#State-Patterns — **주문 생성 시 재검증 실패**(주문을 만들지 않고 되돌린 뒤 어떤 항목이 문제인지 알린다), 폼 오류·제출 중·네트워크 실패]
- [Source: ux-designs/…/EXPERIENCE.md#법적-고지-배치-규칙 — 주문서의 고지는 청약 전, 규제 요건이며 취향이 아니다]
- [Source: ux-designs/…/EXPERIENCE.md#Responsive-&-Platform — 우편번호 검색 <768 전체 화면 / ≥768 가운데 모달, ≥768 뒤로가기 없음·주문서는 `장바구니` 활성, 폭 변경 시 입력 중인 배송지 유지]
- [Source: ux-designs/…/EXPERIENCE.md#Flow-1 11~12단계 — 주문서 입력 순서와 금액(118,000 + 3,000 + 0 = 121,000), 주문완료의 절정이 입금 안내 상자라는 서사]
- [Source: ux-designs/….working/screens-3-checkout.html — 주문서·주문완료 확정 시안: 구획 순서·`sec-h` 라벨 문구·`inp-row` 우편번호 행·`group-h`의 `배송비 3,000원`/`무료배송`·`sum-note`·`pay-note`·`notice`·`bottombar`, 완료의 `deposit`(cap·amt-l·amt·dl 3행·memo)·`tail`·`acts` 2버튼. **단, `예금주` 줄·주문번호 형식·연락처 하이픈은 API가 이긴다** (위험 1·4·6)]
- [Source: architecture/architecture-SLUR_platform_blueprint-2026-07-15/ARCHITECTURE-SPINE.md#AD-1 — FastAPI가 유일한 문지기, 미들웨어·쿠키는 판정이 아니다]
- [Source: …#AD-3 — 주문 상태 전이는 전이표 + 단일 통로 (주문 창생은 전이가 아니라 초기 상태)]
- [Source: …#AD-4 — 재고는 조건부 UPDATE로만 증감, rowcount가 최종 진실]
- [Source: …#AD-10 — 구매 가능 단일 술어, 클라이언트 재판단 금지]
- [Source: …#AD-11 — **배송비 계산은 orders가 소유하고 스냅샷한다**. 클라이언트는 미리보기도 이 API의 계산 결과만 표시한다]
- [Source: …#AD-12 — 파생 값은 백엔드 계산(`grand_total`·`shipping_total`·`remote_extra_total`·`option_text`·`cancellable`·`expired`)]
- [Source: …#AD-13 — SLUR 고유 값 하드코딩 금지: 입금 계좌·미입금 기한은 `settings` 테이블]
- [Source: …#AD-14 — 클라이언트 표면 단일화, 동일 BFF 경로, DESIGN/EXPERIENCE가 목업을 이긴다]
- [Source: …#Consistency-Conventions — **주소 입력은 카카오(다음) 우편번호 서비스 웹 위젯(무료·키 불요), 제공자는 구매자 웹 주문서 구현 시 확정** ← D1이 해소]
- [Source: implementation-artifacts/4-2-order-model-shipping-calc.md — `quote()`·`preview` 계약 확정(`shipping_total`은 기본 합, `remote_extra_total` 별도), `empty_cart`·`validation_error` code 시드, 도서산간 시드 870행·과소포함 안전 원칙]
- [Source: implementation-artifacts/4-4-order-creation.md — `cart_item_ids` 명시 설계 근거, `expected_grand_total`·`price_changed`, `duplicate_request` rowcount 가드, `out_of_stock` details 복수, 카카오 우편번호 위젯 선례]
- [Source: implementation-artifacts/5-1-buyer-order-history.md — `deposit_info` 객체 존재로만 분기(AD-12), 부분 취소 후 잔여 활성분 금액, `expired` 서버 파생, `order_no` 8자리 충돌 인지]
- [Source: implementation-artifacts/8-1-buyer-web-shell.md — D1(토큰 스코프)·D4(먹색 포커스 링)·D5(반응형 유틸리티·`m_narrow` 560px), 셸 컴포넌트 API, 위험 9(`/orders/complete` 경로 경합), 미실행 검증의 기록 규약]
- [Source: implementation-artifacts/8-3-buyer-product-browse-web.md — D9(CTA 두 자리 렌더)·D10(`BROKER_NOTICE` 정본)·D13(`formatWon`), `buyer-feedback.tsx`·`format.ts` 신설, `useSearchParams` Suspense 경계, `set-state-in-effect` 대응]
- [Source: implementation-artifacts/8-4-cart-web.md — D2(장바구니는 배송비 숫자를 내지 않는다)·D3(체크박스는 상태 표시)·D6(성공에만 재조회)·D10(2단·고정 바)·D11(BFF와 Origin 검사)·D12(`formatWon` 정리·클라 산술 최소화), `.b_cta_bar` 승격, `amount-summary`의 `null` 지원]
- [Source: implementation-artifacts/deferred-work.md#Deferred-from-Epic-8 — `바로 구매` 목적지 부재, `brand_name` UNIQUE 부재, `middleware.ts` deprecated, 중개자 고지 문구 오픈 게이트, 사업자 실정보 교체]
- [Source: implementation-artifacts/sprint-status.yaml#action_items — R3·R6·R7·R8·A-E456-5]
- [Source: apps/api/app/orders/router.py · schemas.py · service.py(`quote`·`preview_order`·`create_order`·`get_my_order`·`_order_no`·`get_setting`) — 요청·응답 필드, 실패 code, `deposit_account` 단일 문자열 (읽기만)]
- [Source: apps/api/app/admin/router.py `admin_update_deposit_account` · alembic `0275fa5bfee4` 시드 — 계좌는 1~200자 자유 문자열 한 칸, 시드값 `은행/계좌번호/예금주 미설정` (위험 1의 근거)]
- [Source: apps/api/app/carts/schemas.py · service.py — `purchasable`·`purchasable_total`·`image_url`·정렬 (읽기만)]
- [Source: apps/web/lib/auth.ts — `proxyWithRefresh`(401 시 `clearSessionCookies`·쿠키 회전)·`assertSameOrigin`]
- [Source: apps/web/app/config/company.ts — `BROKER_NOTICE` 상수 (임포트 대상, 수정 금지)]
- [Source: apps/web/app/(buyer)/format.ts · amount-summary.tsx · seller-pack.tsx · buyer-feedback.tsx — 재사용 대상의 현재 시그니처]
- [Source: apps/web/next.config.ts — `output: "standalone"`만. **CSP 헤더가 없다** (D1·위험 5의 근거)]
- [Source: apps/web/app/api/admin/orders/[id]/route.ts — BFF 동적 라우트 관례(`await ctx.params`·uuid 검증·봉투 그대로 전달)]
- [Source: apps/web/AGENTS.md — Next 16은 학습 데이터와 다르다. `node_modules/next/dist/docs/`를 먼저 읽는다]
- [Source: https://postcode.map.daum.net/guide — 다음 우편번호 서비스 v2 가이드: 스크립트 URL, `embed()`·`open()` 차이, `oncomplete`의 `zonecode`·`roadAddress`·`jibunAddress`·`userSelectedType` `[ASSUMPTION]` 구현 시 최신 문서로 재확인]

## Dev Agent Record

### Agent Model Used

(구현 시 기록)

### Debug Log References

(구현 시 기록 — 스크래치패드 스텁 서버는 저장소에 남기지 않는다)

### Completion Notes List

(구현 시 기록 — 실행하지 못한 검증은 "미실행 + 사유"로 적는다. 프로덕션에서 주문을 만들었다면 취소·정리 결과도 함께 적는다)

### File List

(구현 시 기록)

### Change Log

| 날짜 | 변경 | 비고 |
|---|---|---|
