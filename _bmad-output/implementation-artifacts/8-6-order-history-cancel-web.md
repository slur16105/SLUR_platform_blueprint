---
baseline_commit: a8d5da2c4270e4012c8ebffe2d325150b9c843d0
---

# Story 8.6: 주문내역·주문상세·취소 (구매자 반응형 웹)

Status: done

> **선행 조건.** 이 스토리는 **8.5(주문서·주문완료)가 끝난 뒤** 착수한다.
> 8.5가 만드는 `app/api/orders/route.ts`(POST) · `app/api/orders/[id]/route.ts`(GET) · `(buyer)/orders-api.ts` ·
> `(buyer)/deposit-box.tsx`(`placed` 변형) · `format.ts`의 `formatDepositDue`가 이 스토리의 입력이다.
> 8.5의 주문완료 화면에 있는 `주문 상세 보기` 버튼이 가리키는 `/orders/{id}`가 바로 이 스토리의 산출물이며,
> 8.5 완료 시점에는 그 링크가 404다. 순서를 바꿔 착수하면 8.6이 BFF·API 래퍼·입금 안내 상자를 대신 만들게 되고
> 8.5가 같은 파일을 다시 만들며 충돌한다.
>
> ⚠️ **baseline(`a8d5da2`) 시점에 8.5의 산출물은 아직 커밋되지 않았다.** Task 0이 실제 상태를 먼저 확인한다.

## Story

As a 구매자,
I want 주문마다 판매자 묶음이 어디까지 갔는지 보고 필요하면 취소하는 것,
So that 내 물건이 어디쯤인지 알고 마음이 바뀌어도 대응할 수 있다.

## Acceptance Criteria

1. **Given** 로그인 상태의 `/orders` **When** 진입 **Then** 최신순 주문 목록이 표시되고 각 행에 **날짜 · 대표 상태 · 주문번호 · 대표 상품명 · 총액**이 놓인다 (FR-22)
   - **And** 상단바는 `title`(좌측 정렬 `주문내역`)이고 **탭바가 선다** — 셸 호출은 `tab="orders"`, `showTabbar`. 최상위 4화면 중 하나다 (UX-DR3)
   - **And** 컨테이너는 **최대 폭 640px 한 단**(`.b_container.m_read`)이며 폭이 아무리 넓어도 2단으로 갈라지지 않는다 (UX-DR4)
   - **And** 행 사이는 1px hairline이고, 행 전체가 `/orders/{order_id}`로 가는 링크다. 히트 영역은 44px 이상이다 (UX-DR7)
   - **And** 행의 브랜드 줄은 응답 `sub_orders[].brand_name`을 ` · `로 이은 것이다(`토림도예 · 온실`) — 판매자를 브랜드명으로 부른다 (UX-DR15)

2. **Given** 주문내역의 대표 상태 **When** 렌더 **Then** 응답 `display_status`를 **그대로** 한국어 라벨로만 매핑해 표시한다 — 묶음 상태들로 클라이언트가 대표를 계산하지 않는다 (AD-12)
   - **And** 상태는 **색 + 텍스트를 항상 함께** 쓴다: `입금대기` 액센트 / `배송준비`·`배송중` 먹색 / `배송완료`·`취소` 흐린색. **액센트가 붙는 상태는 입금대기 하나뿐**이다 (UX-DR8)
   - **And** 8.1의 `<StatusLabel tone>` 컴포넌트를 쓰고 색을 새로 선언하지 않는다
   - **And** 스크린리더에 상태가 상태로 전달된다 — 색만 다른 글자가 아니라 무엇의 상태인지 읽힌다

3. **Given** 주문이 한 건도 없음 **When** `/orders`를 렌더 **Then** `아직 주문이 없습니다.`가 표시된다 (UX-DR9)
   - **And** 그 아래 `쇼핑 계속하기`(→ `/`) 버튼을 둔다 `[ASSUMPTION]`
   - **And** 최초 로딩은 **행 골격(skeleton)** 이다 — 화면 중앙 스피너를 쓰지 않는다 (UX-DR9)

4. **Given** 주문이 한 페이지를 넘음 **When** 목록 끝 **Then** 지금까지 받은 건수가 `total`보다 적으면 `더 보기` 버튼이 놓이고, 다 받았으면 `최근 주문부터 보입니다.`가 놓인다 (UX-DR9)
   - **And** **무한 스크롤 자동 로드를 만들지 않는다** (UX-DR16 금지 목록)
   - **And** 같은 `order_id`가 두 번 들어오면 **뒤엣것을 버린다** — offset 페이지네이션에서 새 주문이 끼어들면 중복 카드가 생긴다 (5.1의 확정 대응)
   - **And** 응답에 페이지 크기가 없으므로 화면은 **`20` 같은 숫자를 알지 못한다** — `누적 길이 < total`로만 판정한다 (AD-13)

5. **Given** 로그인 상태의 `/orders/[id]` **When** 진입 **Then** **주문번호·주문일시 → (입금대기면 입금 안내 상자) → 주문 상품(판매자 묶음들) → 배송 정보 → 결제 정보 → 하단 취소 안내** 순서로 표시된다
   - **And** 상단바는 `back-title`(뒤로가기 + `주문상세`)이고 **탭바가 서지 않는다** — 셸 호출은 `tab="orders"`, `showTabbar` 없음 (≥768에서 `주문내역`이 활성으로 표시된다)
   - **And** 컨테이너는 **최대 폭 640px 한 단**이며 2단으로 갈라지지 않는다 (UX-DR4)
   - **And** 성격이 다른 면 사이는 **8px 종이 접기 띠**, 같은 화면 안 다른 항목 사이는 1px hairline이다 (UX-DR12)
   - **And** 주문번호는 응답 `order_no`를 **그대로** 쓴다 — 목업의 `20260721-0037`은 존재하지 않는 형식이다

6. **Given** 주문상세의 판매자 묶음 **When** 렌더 **Then** 묶음마다 **독립된 상태 라벨 · 배송비 · 액션**을 갖는다 — **주문 전체에 걸리는 진행바·통합 상태·전체 취소 버튼을 두지 않는다** (FR-15·18, UX-DR13)
   - **And** 토림도예가 `배송준비`인 동시에 온실이 `배송중`일 수 있고, 화면은 그것을 하나로 뭉개지 않는다 (EXPERIENCE Flow 3)
   - **And** 묶음 뼈대는 8.1의 `<SellerPack>`을 쓴다: 헤더(브랜드 라벨 + **상태 라벨**) → 상품 행 → 푸터(배송비 + 액션)
   - **And** 묶음 푸터의 배송비는 그 묶음의 `shipping_fee + remote_extra_fee`이고 `0`이면 `무료배송`이다
   - **And** 상품 행은 상품명 · 옵션 · `수량 n개` · 행 금액(`line_total`)이며 **사진이 없다** (D5 — 응답에 이미지가 없다)

7. **Given** 배송중·배송완료인 묶음 **When** 렌더 **Then** `tracking_number`가 있으면 송장 줄이 `--b-paper-shade` 면 위에 `송장번호` / `CJ대한통운 1234-5678-9012` 형태로 표시된다 (FR-21)
   - **And** **추적 링크·외부 연동을 만들지 않는다** — 텍스트 표시까지가 전부다
   - **And** `tracking_number`가 없으면 줄 자체를 그리지 않는다. `carrier`만 있고 번호가 없는 경우도 그리지 않는다

8. **Given** `cancellable === true`인 묶음 **When** 렌더 **Then** 그 묶음 푸터에만 `주문 취소` 버튼이 표시된다 (FR-18)
   - **And** `cancellable === false`인 묶음(취소된 묶음 제외)에는 버튼 대신 `배송준비 이후에는 취소할 수 없습니다.`가 앉는다
   - **And** 화면 하단에 **항상** `배송준비 전까지 판매자 묶음 단위로 취소할 수 있습니다.`가 있다 — 버튼이 있는 묶음과 없는 묶음이 왜 나란한지 설명한다 (UX-DR15)
   - **And** 취소 가능 여부는 **응답의 `cancellable` 한 필드로만** 판정한다 — `display_status` 문자열을 보고 자체 판단하지 않는다 (AD-12)
   - **And** `주문 취소` 버튼에 **빨강을 쓰지 않는다** — 이 팔레트에 빨강이 없다. `cancel` 버튼(11.5px/700, 1px `--b-field-border`, 흰 면, 3px 라운드)이다

9. **Given** `주문 취소` **When** 누름 **Then** 그 자리가 `이 묶음을 취소할까요?` + `취소하기` · `아니요` **인라인 확인 줄**로 바뀌고, `취소하기`를 다시 눌러야 `POST /api/v1/orders/sub-orders/{sub_order_id}/cancel`이 실행된다 (UX-DR16 — 확인 후 실행)
   - **And** **모달·다이얼로그·`window.confirm`을 쓰지 않는다.** 8.4가 `buyer.css`에 만든 `.b_confirm_row`를 그대로 쓴다
   - **And** 확인 줄이 열리면 포커스가 `취소하기`로 옮겨가고, `Esc`·`아니요`로 닫으면 원래 `주문 취소` 버튼으로 돌아온다
   - **And** 한 번에 하나의 묶음만 확인 상태일 수 있다
   - **And** 확인 줄은 `role="group"` + `aria-label`로 **어느 브랜드의 묶음을 취소하는지** 말한다
   - **And** **취소 사유를 입력받지 않는다** — 요청 본문 없이 POST한다 (D7)

10. **Given** 취소 요청이 성공 **When** 응답을 받음 **Then** `GET /api/v1/orders/{id}`를 다시 조회해 **해당 묶음만** 취소로 갱신되고 다른 묶음의 상태는 그대로다
    - **And** 취소된 묶음은 헤더 상태 라벨이 `취소`(흐린색)가 되고, 상품 행 금액과 묶음 배송비에 **취소선**이 그어진다
    - **And** 전 묶음이 취소되면 대표 상태와 금액도 서버가 다시 계산해 내려준 값으로 갱신된다 — 화면이 계산하지 않는다
    - **And** 재조회 중에도 화면이 skeleton으로 되돌아가지 않고 스크롤이 튀지 않는다
    - **And** 요청이 도는 동안 그 묶음의 버튼이 비활성이고 중복 제출이 차단된다. 스피너를 쓰지 않는다 (UX-DR9)

11. **Given** 취소 요청이 거부됨 **When** 각 `code` **Then**
    - `invalid_transition`(422): 그 묶음 자리에 **봉투의 `message`를 문장 그대로** 표시(관리자 문의 안내가 message에 들어 있다)하고, **화면 상태를 서버 값으로 다시 맞춘다**(상세 재조회). **재조회가 그 문장을 지우지 않는다** (D8)
    - `not_found`(404): `주문을 찾을 수 없습니다.` + `주문내역 보기`(→ `/orders`)
    - `unauthorized`(401): `/login?next=%2Forders%2F<id>`로 `replace`
    - 봉투 없는 실패: `연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요.` + 재시도 수단
    - **And** **HTTP 상태 코드와 `code` 문자열이 화면 어디에도 나타나지 않는다** (분기는 `code`, 표시는 `message` — UX-DR9)

12. **Given** 주문이 입금대기 상태 **When** 주문상세를 열람 **Then** **입금 안내 상자가 주문번호 바로 아래 최상단**에 표시된다 (FR-23, UX-DR14)
    - **And** 이 상자는 8.5가 만든 `deposit-box.tsx`의 **`detail` 변형**이다: `--b-accent-wash` 면 + 1px `--b-accent-line` 테두리 + 5px 라운드, 캡션 `입금 안내`, **금액 20px/800 액센트**, 그 아래 `입금 계좌`·`입금 기한`
    - **And** 표시 여부는 **`deposit_info` 객체의 존재로만** 분기한다 — `display_status` 문자열로 분기하지 않는다 (AD-12, 5.1의 확정 규약)
    - **And** 금액·계좌·기한은 전부 서버 값이며 하드코딩하지 않는다 (AD-13). 계좌는 **한 문자열**이고 화면이 은행/번호/예금주로 쪼개지 않는다 (위험 6)
    - **And** 기한은 `deposit_due_at`을 **`Asia/Seoul` 고정**으로 `2026년 7월 24일까지` 형식으로 낸다 (8.5 D10의 `formatDepositDue` 재사용)
    - **And** `expired === true`면 기한 줄 아래에 `기한이 지나 곧 자동 취소됩니다.`를 덧붙인다
    - **And** 입금대기가 아닌 주문의 상세에서는 상자가 **사라진다**

13. **Given** 주문상세의 배송 정보 **When** 렌더 **Then** `수령인` · `연락처` · `주소` · `요청사항` 네 줄이 라벨-값 행으로 표시되고, 값은 **주문 시점 스냅샷**이다 (AD-7)
    - **And** 주소는 `(04044) 서울특별시 마포구 양화로 45 301호` 형태로 `postal_code` · `address1` · `address2`를 잇는다
    - **And** `address2`·`order_note`가 빈 문자열이면 그 자리는 `—`로 지킨다 — 행을 지우지 않는다
    - **And** 라벨-값 행은 칼럼이 아무리 넓어도 **560px 안에서** 좌측 정렬된다 (`.b_row`, UX-DR5)

14. **Given** 주문상세의 결제 정보 **When** 렌더 **Then** **상품 금액 · 배송비 · 합계 3행 + `결제수단 · 무통장입금` 한 줄**이 표시된다
    - **And** 값은 응답의 `item_total` · `shipping_total` · `grand_total`에서 **각각 하나씩** 온다 — 클라이언트가 더하거나 빼지 않는다 (AD-12)
    - **And** **도서산간 추가 줄을 만들지 않는다** — 주문상세 응답에는 그 값을 분리한 필드가 없다. 목업 확정본도 3행이다 (D6)
    - **And** 결제수단은 API가 주지 않는 **화면 고정 텍스트**다 (v1 결제 수단이 하나뿐이라는 사실 표기)

15. **Given** 관리자가 라인 일부를 취소한 묶음 **When** 렌더 **Then** `status === "canceled"`인 상품 행은 금액에 취소선 + `취소` 태그가 붙고, `ordered` 행은 그대로다 (AD-6 — 라인 단위 부분 취소는 관리자 몫)
    - **And** 묶음의 **모든** 라인이 취소된 경우에만 헤더 상태 라벨이 `취소`가 된다 — 그 판정도 서버의 `display_status`가 이미 해준 값이다
    - **And** 취소된 라인은 **숨기지 않는다** (UX-DR8 — 표기하고 자리에 남긴다)

16. **Given** 로딩·오류·세션 만료 **When** 각 상황 **Then**
    - 최초 로딩: 목록은 행 골격, 상세는 블록 골격 — 화면 중앙 스피너를 쓰지 않는다
    - `GET /orders`·`GET /orders/{id}` 실패: `message` + `다시 시도`
    - 401: `/login?next=%2Forders` · `/login?next=%2Forders%2F<id>`로 `replace` — **미들웨어 통과는 인증이 아니다**(`slur_role` 14일 > `slur_access` 30분, AD-1)
    - `/orders/[id]`의 `id`가 UUID 형식이 아니거나 남의 주문이면 `주문을 찾을 수 없습니다.` + `주문내역 보기` — 빈 화면이 되지 않는다

17. **Given** 폭에 따른 배치 **When** 390 / 700 / 768 / 1280으로 렌더 **Then** 두 화면 모두 **끝까지 한 단(최대 640px)** 이고 하단 고정 CTA 바가 없다 (UX-DR4)
    - **And** `<768`에서 `/orders`에 탭바가 서고 `/orders/[id]`에는 서지 않는다. `≥768`에서는 둘 다 상단 내비로 바뀌고 `주문내역`이 활성이다
    - **And** 폭을 390 ↔ 1280으로 바꿔도 화면이 다시 마운트되지 않고 **열린 취소 확인 줄 · 진행 중 요청 · 오류 문장 · 더 보기로 쌓은 목록이 초기화되지 않는다** — `matchMedia`·`innerWidth`·`resize` 사용 **0건**, CSS로만 배치를 바꾼다 (AD-14)

18. **Given** 이 스토리의 모든 CSS **When** 작성 **Then** 8.1의 `--b-*` 토큰과 `.b_*` 타이포 역할 클래스만 쓴다 — **새 hex·새 px 스케일을 만들지 않는다** (UX-DR1)
    - **And** 구매자 파일에 `#2f6bff`·`--color-brand`·`--shadow-`·`box-shadow` 선언이 0건이다 (UX-DR12)
    - **And** `app/styles/slur/**`·`app/styles/buyer/**`을 수정하지 않는다 — `detail` 변형의 20px 금액도 `buyer.css`에서 `.b_deposit_amount`를 덮는다
    - **And** 판매자·관리자 화면의 색·레이아웃·포커스 링이 한 픽셀도 바뀌지 않는다
    - **And** 새로 만드는 모든 컨트롤(`더 보기`·`주문 취소`·확인 줄·행 링크)에 **먹색 포커스 링**이 보이고 파랑이 한 번도 나타나지 않는다 (UX-DR6)

19. **Given** 이 스토리 전체 **When** 완료 **Then** 백엔드가 변경되지 않는다 — `git diff --stat`에 `apps/api` **0건**, 마이그레이션 0건, 신규 엔드포인트 0개. 소비하는 API는 기존 3개(`GET /orders` · `GET /orders/{id}` · `POST /orders/sub-orders/{id}/cancel`)뿐이다

20. **Given** 검증 **When** 실행 **Then** `npx tsc --noEmit` 0 · `npm run lint` **0 errors · 0 warnings**(A-E456-5 베이스라인) · `npx next build` 성공이 유지되고, 390/700/768/1280 네 폭에서 두 화면을 실제로 렌더한 결과가 스토리에 기록된다
    - **And** `apps/web`에 **테스트 프레임워크를 도입하지 않는다** — 의존성 추가 0건

## 설계 판단 (이 스토리에서 확정 — 근거를 남긴다)

에픽 Story 8.6 Dev Notes의 `[ASSUMPTION]` **"대표 상태 선정 규칙(가장 덜 진행된 상태 권장)과 취소 묶음의 목록 표기"** 를 **D1·D3이 해소한다.**
`EXPERIENCE.md` §주문 상태의 `[ASSUMPTION]` **"취소 상태는 목업에 없다 — 묶음 헤더에 `취소`, 금액 취소선 권장"** 을 **D10이 확정한다.**
[Source: epics.md#Story-8.6, EXPERIENCE.md#State-Patterns#주문-상태]

### D1 — 상태는 **서버 값 5개**뿐이다. 화면은 한국어 라벨과 색 층만 소유한다

**결정.** `display_status`(주문 대표·묶음 공통)의 실제 값과 표시를 아래 표 하나로 고정하고, 이 표를 `(buyer)/orders/order-status.ts` 한 곳에 둔다.

| `display_status` | 한국어 라벨 | `<StatusLabel tone>` | 나오는 곳 |
|---|---|---|---|
| `awaiting_payment` | `입금대기` | `waiting` (**유일한 액센트**) | 대표·묶음 |
| `preparing` | `배송준비` | `moving` (먹색) | 대표·묶음 |
| `shipping` | `배송중` | `moving` (먹색) | 대표·묶음 |
| `delivered` | `배송완료` | `finished` (흐린색) | 대표·묶음 |
| `confirmed` | `배송완료` | `finished` | 묶음만 (v1 미사용 값, 데이터가 있으면 대표는 이미 `delivered`로 접는다) |
| `canceled` | `취소` | `finished` | 대표·묶음 |
| 그 밖의 값 | `확인 중` `[ASSUMPTION]` | `moving` | — |

**근거.**
- **한국어 문언은 클라이언트 표현 계층이다**(5.1의 확정, AD-8 — 상태값은 영어 enum). 서버는 영어 값만 주고 색·라벨은 화면이 정한다. 그러나 **어떤 값이 올 수 있는지는 서버가 정한다** — `derive_sub_status`·`derive_order_status`가 낼 수 있는 값이 위 여섯이며, 그 밖의 값이 오면 데이터 이상이다.
- 🚨 **`결제완료`라는 표시 상태는 존재하지 않는다.** `EXPERIENCE.md`의 6단계는 `입금대기 → 결제완료 → 배송준비 → …`인데, 백엔드는 입금 확인(paid) 시 4.3의 연쇄로 **모든 활성 묶음을 즉시 `preparing`으로** 옮긴다. 그래서 `결제완료`가 화면에 뜨는 순간이 없다. **없는 상태를 위한 라벨을 만들지 않는다** — 만들면 영원히 죽은 코드다. (위험 3)
- **`취소완료`가 아니라 `취소`다.** 5.1(Flutter)은 `취소완료`로 매핑했지만 DESIGN.md·EXPERIENCE.md·목업 확정본이 모두 `취소`다. AD-14가 "DESIGN/EXPERIENCE가 목업을 이긴다"고 정했고 여기서는 셋이 일치하므로 **`취소`로 통일**한다. Flutter판과 문언이 갈리지만 앱은 8.8에서 제거된다.
- 미지 값에 **영어 원문을 그대로 노출하지 않는다** — `preparing`이 화면에 뜨는 것은 UX-DR9의 "code 문자열 미노출"과 같은 종류의 사고다. `[ASSUMPTION]` `확인 중`이라는 문구는 스파인에 없다 — 실제로 나올 수 없는 값이므로 방어 문구로만 둔다.

### D2 — 취소 가능 판정은 **`cancellable` 한 필드**뿐이다. 그리고 실제 취소 창은 입금대기뿐이다

**결정.** `주문 취소` 버튼의 표시 조건은 `sub.cancellable === true` **하나**다. `display_status`로 자체 판단하지 않는다.

**근거.**
- 서버 파생식은 `bool(active) and sub.shipping_status is None` — 4.6의 엔진 가드와 **동치**로 만들어 둔 값이다 (AD-12). 화면이 같은 판정을 다시 구현하면 두 곳이 어긋날 때 사용자에게 "눌리는데 실패하는 버튼"이 생긴다.
- 🚨 **알아야 할 사실: `결제완료 이후에도 취소 가능`은 참이 아니다.** `EXPERIENCE.md`는 결제완료 상태에서 "취소 계속 가능"이라고 적었지만, paid 전이가 곧바로 `shipping_status = preparing`을 만들기 때문에 그 순간 `cancellable`은 `false`가 된다. **실제 취소 창은 `입금대기` 동안뿐이다.** 화면 문구(`배송준비 전까지 판매자 묶음 단위로 취소할 수 있습니다.`)는 FR-18의 표현이므로 그대로 두되, **UX 계약과 백엔드 동작이 어긋나는 지점으로 기록**한다 (위험 3). 근본 해소는 백엔드 설계 변경이며 Epic 8 경계 밖이다.
- 취소된 묶음(`display_status === "canceled"`)은 `cancellable`도 `false`지만, 그 자리에 `배송준비 이후에는 취소할 수 없습니다.`를 놓으면 거짓말이다. **취소된 묶음에는 안내 문장도 버튼도 놓지 않는다** — 헤더의 `취소` 라벨이 이미 다 말했다.

### D3 — 주문내역 행은 **대표 상태 하나**만 쓴다. 묶음 상태 칩을 목록에 두지 않는다 (에픽 `[ASSUMPTION]` 해소)

**결정.** 목록 행은 `display_status` 하나만 상태로 표시하고, `sub_orders` 배열은 **브랜드명 나열**(`토림도예 · 온실`)에만 쓴다.

**근거.**
- 목업 확정본(`screens-4-orders.html`)의 주문내역 행은 **상태 하나 + 브랜드명 나열**이고, 8.6 에픽 AC도 "각 행에 주문번호·날짜·대표 상태"까지만 요구한다. `EXPERIENCE.md` Flow 3이 서사로 확인한다 — "각 행 우측에 상태가 있다 … **상세로 들어가면 묶음별 진짜 상태가 나온다**".
- 5.1(Flutter) AC 1은 "주문 카드에 판매자 묶음별 상태가 각각 표시된다"였다. **웹 시안이 그것을 채택하지 않았다** — AD-14가 DESIGN/EXPERIENCE를 정본으로 세웠으므로 웹은 시안을 따른다. 문서 간 차이를 알고 남기는 것이며 회귀가 아니다.
- **대표 상태 파생 방향에 대한 에픽의 `[ASSUMPTION]`은 반대로 확정된다.** `EXPERIENCE.md`는 "가장 앞선(덜 진행된) 상태를 대표로 권장"했지만 실제 `derive_order_status`는 **`shipping`이 하나라도 있으면 `배송중`**, 전부 완료여야 `배송완료`다 — 즉 **가장 진행된 쪽**이 대표다. Flow 3의 주문(배송준비 + 배송중)은 목록에서 `배송중`으로 보인다. **API가 소유한 값이므로 API가 이긴다**(AD-12). 화면은 받은 값을 그대로 쓴다.
- **알려진 한계.** 일부 묶음만 취소된 주문은 목록에서 그 사실이 보이지 않는다(대표 상태는 남은 묶음 기준). 목록에 묶음 상태를 다 그리면 대표 상태와 시선을 다투고 640px 행이 무너진다 — 상세가 그 답을 갖는다.

### D4 — 페이지네이션은 **`더 보기` 버튼 + 누적 길이 vs `total`**

**결정.**

```
초기: GET /api/orders?page=1        → items 누적, total 보관
더 보기: page + 1로 재요청           → 누적 뒤에 append (order_id 중복 제거)
버튼 표시 조건: 누적 길이 < total
다 받으면: `최근 주문부터 보입니다.`
```

**근거.**
- **응답에 페이지 크기가 없다.** `OrderListResponse`는 `{items, total, page}`뿐이고 size는 `settings.page_size`(현재 20)다. 화면이 `20`을 박으면 AD-13(고유 값 하드코딩 금지)을 깨고, 운영자가 값을 바꾸면 조용히 어긋난다. **누적 길이와 `total`만 비교하면 size를 알 필요가 없다.**
- **무한 스크롤 자동 로드는 UX-DR16의 금지 목록에 있다.** 버튼이 유일한 선택지다.
- **중복 제거는 5.1이 이미 겪은 사고다** — offset 페이지네이션 중에 새 주문이 생기면 경계 항목이 두 페이지에 걸친다. `order_id` Set으로 거른다.
- 요청 경합은 8.5 D2와 같은 방식(요청 순번)으로 막는다. `더 보기`를 두 번 빠르게 누르면 같은 페이지가 두 번 붙을 수 있는데, **진행 중에는 버튼을 비활성**으로 두는 것이 1차 방어이고 dedupe가 2차 방어다.

### D5 — 상품 **사진이 없다**. 사진 자리를 비워두지 않고 아예 만들지 않는다

**결정.** 주문내역 행과 주문상세 상품 행에 **썸네일을 그리지 않는다.** 목업의 64px·68px 사진 자리는 이 화면에서 사라진다.

**근거.**
- 🚨 **`OrderCard`에도 `OrderLineView`에도 `image_url`이 없다.** 주문 라인은 스냅샷(상품명·옵션·단가·수량)이고 이미지는 스냅샷 대상이 아니다 (AD-7). `variant_id`조차 응답에 없어 원본 상품을 되짚을 경로도 없다.
- 8.5가 쓴 방법(`GET /carts`와 합성)은 여기서 **불가능하다** — 주문이 만들어지는 순간 장바구니가 비워진다.
- **빈 회색 사각형을 자리표시로 남기지 않는다.** 지면 톤에서 내용 없는 면은 오류처럼 보이고, 6개 행이 모두 같은 회색 사각을 달고 있으면 "이미지를 못 불러왔다"로 읽힌다. 사진이 없는 대신 **상품명·옵션·금액의 타이포 위계**로 행을 세운다.
- 5.1도 같은 이유로 "주문 카드 상품 이미지"를 의도적으로 보류했다. 근본 해소는 응답에 이미지 필드를 더하는 것이며 **Epic 8 경계 밖**이다 (위험 1).

### D6 — 주문상세 결제 정보는 **3행**이다. 도서산간 줄을 만들지 않는다

**결정.** `상품 금액` · `배송비` · `합계` 세 행 + `결제수단 · 무통장입금` 한 줄. `<AmountSummary>` 컴포넌트를 **쓰지 않고** `.b_amount_summary` CSS만 재사용한다.

**근거.**
- 🚨 **주문상세 응답에 도서산간 금액을 분리한 필드가 없다.** `OrderDetailResponse`는 `item_total`·`shipping_total`·`grand_total` 셋뿐이고, `shipping_total`은 이미 `shipping_fee + remote_extra_fee`의 합이다. 묶음별 `remote_extra_fee`를 클라이언트가 더하는 방법은 있지만 — **취소된 묶음을 제외하는 기준(`_display_amounts`)까지 재현해야 하므로 그것이 곧 파생 로직 구현**이고 AD-12 위반이다. 두 기준이 어긋나면 4행의 합이 합계와 맞지 않는다.
- **목업 확정본도 3행이다.** `screens-4-orders.html`의 결제 정보는 `상품 금액 · 배송비 · 합계 · 결제수단`이고 도서산간 줄이 없다. UX-DR13의 "도서산간 추가는 0원이어도 줄을 지우지 않는다"는 **분리 필드를 주는 화면**(장바구니·주문서 — `preview`가 `remote_extra_total`을 따로 준다)의 규칙이다. 주문상세는 그 줄이 애초에 서지 않는다.
- **`<AmountSummary>`에 "행을 빼는 prop"을 만들지 않는다.** 그 prop이 생기는 순간 주문서에서도 실수로 켜질 수 있고, 그러면 UX-DR13을 지키려고 만든 컴포넌트가 그 규칙을 깨는 수단이 된다. 주문상세는 자기 마크업 3행을 그리고 **CSS만 공유**한다.
- **합계 금액은 `b_price_total`(21px)이 아니라 20px 변형을 쓴다.** 목업이 입금 안내 상자 금액과 합계를 둘 다 20px 액센트로 그렸다. DESIGN.md의 "합계 21px 액센트는 화면당 한 번"과 긴장하지만, 입금대기 주문의 상세에는 **액센트 금액이 둘(입금 금액·합계) 서는 것이 확정 시안**이고 이때 합계가 상자보다 커지면 "이 화면에서 가장 중요한 것은 입금 금액"이라는 UX-DR14의 판단이 뒤집힌다. 알고 내리는 편차로 기록한다.

### D7 — 취소 확인은 **인라인 확인 줄**이고, **사유를 받지 않는다**

**결정.** 8.4가 `buyer.css`에 공용으로 만든 `.b_confirm_row`를 그대로 쓴다. 묶음 푸터의 `주문 취소` 자리가 `이 묶음을 취소할까요?` + `취소하기` + `아니요`로 바뀐다. 요청 본문은 **보내지 않는다**(`POST` body 없음).

**근거.**
- 모달을 쓰지 않는다는 규칙(UX-DR16)과 파괴적 동작은 확인 후 실행한다는 규칙을 **동시에** 만족시키는 형태이며, 8.4 D7이 "이 패턴이 8.6의 `주문 취소` 확인에도 그대로 쓰인다"고 미리 못 박았다. 새 확인 UI를 만들면 같은 지면에 확인 방식이 두 벌 생긴다.
- **사유 입력을 만들지 않는 이유.** (a) 확인 줄에 텍스트 입력을 넣으면 그것은 확인 줄이 아니라 폼이고, 모달 금지의 취지를 우회하는 형태가 된다. (b) `SubOrderCancelRequest.reason`은 전 필드 optional이고 라우터가 **body 없는 POST를 허용**한다(4.6 리뷰 F7). 비우면 서비스가 `"구매자 취소"`로 채운다. (c) 사유는 운영자가 보는 값이고 구매자에게 되돌아오지 않는다 — v1에서 입력을 요구할 근거가 없다. Flutter판은 다이얼로그가 있어 선택 입력을 넣을 수 있었지만 웹에는 다이얼로그가 없다.
- 접근성: 확인 줄이 열리면 포커스를 `취소하기`로 옮기고 `Esc`로 되돌린다. `aria-label`은 `토림도예 묶음 주문 취소 확인`처럼 **어느 묶음인지** 말한다 — 한 화면에 확인 줄 후보가 여럿이므로 8.4보다 더 필요하다.

### D8 — 취소 후 갱신: **성공도 거부도 재조회한다. 단 오류 문장은 재조회가 지우지 않는다**

**결정.**

| 결과 | 재조회 | 화면 |
|---|---|---|
| 성공(200) | **한다** | 확인 줄 닫힘, 묶음·대표 상태·금액이 서버 값으로 갱신 |
| `invalid_transition`(422) | **한다** | 그 묶음 자리에 `message` 유지 + 상태가 실제 값으로 정정됨 |
| `not_found`(404) | 하지 않는다 | `주문을 찾을 수 없습니다.` + `주문내역 보기` |
| `unauthorized`(401) | 하지 않는다 | `/login?next=…`로 `replace` |
| 봉투 없음(네트워크) | 하지 않는다 | 확인 줄 유지 + 문장. 서버 상태를 바꾸지 못했으므로 재조회할 이유가 없다 |

**근거.**
- 8.4 D6은 **"성공에만 재조회"** 였다. 여기서 갈라지는 이유: 에픽 AC가 "전이가 거부되면 `message`를 보여주고 **화면 상태를 서버 값으로 다시 맞춘다**"를 명시한다. `invalid_transition`은 **화면이 낡았다는 신호**다 — 다른 탭에서 관리자가 입금을 확인했거나 판매자가 배송을 시작한 것이므로, 재조회하지 않으면 사용자가 같은 버튼을 계속 누른다.
- 🚨 **그래서 오류 문장을 재조회 결과와 분리된 상태에 담는다.** 재조회가 `result`를 통째로 갈아끼우므로, 문장을 같은 객체에 넣으면 스스로 지운다(Flutter판 `finally-invalidate` 부채의 웹 재현). 8.4가 이미 `rowError`를 분리해 해결한 형태를 그대로 쓴다 — `packError: { subOrderId, message } | null`.
- 재조회는 **조용히** 한다 — skeleton으로 되돌아가지 않고 스크롤이 튀지 않는다(8.4의 `refetch` 패턴).

### D9 — 입금 안내 상자는 8.5 컴포넌트에 **`detail` 변형을 더한다** (복제하지 않는다)

**결정.** `(buyer)/deposit-box.tsx`의 props를 `{ variant: "placed" | "detail"; amount; account; dueAt; expired? }`로 넓히고, `detail` 변형의 스타일을 `buyer.css`에 더한다. 새 컴포넌트를 만들지 않는다.

**근거.**
- 8.5 D11이 파일을 `(buyer)` 루트에 두고 **"8.6이 `detail` 변형을 타입·CSS에 더한다"** 를 미리 선언했다. 두 변형은 같은 정보를 담고 무게만 다르며(DESIGN.md `{components.deposit-box}`), 복제하면 계좌 문자열 처리·기한 포맷·`expired` 처리가 두 벌이 된다.
- `detail`의 시각 규격: `--b-accent-wash` 면 + 1px `--b-accent-line` 테두리 + `--b-rounded-md`(5px), 금액 **20px**. `styles/buyer/type.css`의 `.b_deposit_amount`는 27px이므로 `buyer.css`에서 `.b_deposit_box.m_detail .b_deposit_amount { font-size: 20px }`로 덮는다 — **`styles/buyer/**`를 수정하지 않는다**는 8.1의 규약을 지킨다.
- **분기는 `deposit_info` 객체의 존재로만** 한다(AD-12, 5.1 확정 규약). `display_status === "awaiting_payment"`로 분기하면 부분 취소·관리자 개입이 만든 경계에서 상자가 잘못 뜬다.
- 상자 위치는 **주문번호 바로 아래 최상단**이다 — 상품 목록 아래가 아니다. 다시 들어온 사람이 "얼마를 어디로 넣어야 하는가"를 스크롤 없이 봐야 한다 (UX-DR14).

### D10 — 취소 표기는 **두 층**이다: 라인 취소선 · 묶음 헤더 라벨

**결정.** (EXPERIENCE의 `[ASSUMPTION]` 확정)

| 층 | 조건 | 표기 |
|---|---|---|
| 상품 행 | `item.status === "canceled"` | 행 금액에 취소선(`--b-strike-line`) + `취소` 태그. **숨기지 않는다** |
| 묶음 | `display_status === "canceled"` | 헤더 상태 라벨 `취소`(흐린색), 묶음 배송비에 취소선, 취소 버튼·안내 문장 없음 |
| 주문 | 대표 `display_status === "canceled"` | 목록 행 상태 라벨 `취소`. 상세는 묶음 표기의 합으로 이미 보인다 |

**근거.**
- **라인 층이 필요한 이유는 관리자다.** 구매자의 취소 단위는 묶음이지만(AD-6) 관리자는 라인 단위 부분 취소를 한다(5.5). 그 결과가 `OrderLineView.status`로 그대로 내려오고, 표기하지 않으면 **취소된 상품이 아직 오는 것처럼 보인다.** 금액 합계는 이미 활성 라인만 반영하므로 화면과 숫자가 어긋난다.
- **취소된 묶음의 배송비에 취소선을 긋는 이유.** 응답의 `shipping_fee`·`remote_extra_fee`는 **원래 값 그대로** 내려오지만 `shipping_total` 합계에서는 빠져 있다(`_amounts`가 활성 라인이 남은 묶음만 더한다). 취소선 없이 `배송비 3,000원`을 그리면 합계와 맞지 않아 보인다.
- 색만으로 전달하지 않는다 — 취소선(형태) + `취소` 글자(텍스트) + 흐린색(색) 셋을 함께 쓴다 (UX-DR8).
- **성공 초록·위험 빨강을 도입하지 않는다.** 취소 표기에도 빨강이 없다.

### D11 — 날짜·연락처 포맷은 **`format.ts` 한 곳**, 타임존은 `Asia/Seoul` 고정

**결정.** `(buyer)/format.ts`에 셋을 더한다. 8.5의 `formatDepositDue`는 **그대로 쓰고 다시 만들지 않는다.**

```ts
/** `2026.07.21` — 주문내역 행의 날짜 */
export function formatOrderDate(iso: string): string
/** `2026년 7월 21일 14:22` — 주문상세의 주문일시 */
export function formatOrderDateTime(iso: string): string
/** `010-2847-3391` — 저장은 숫자만(^\d{9,11}$)이고 표시에만 하이픈을 넣는다 */
export function formatPhone(digits: string): string
```

**근거.**
- `created_at`은 **UTC로 내려온다.** 로케일·타임존을 생략하면 (a) 서버 렌더와 브라우저 렌더가 달라 하이드레이션이 불일치하고 (b) 다른 타임존에서 **주문 날짜가 하루 어긋난다.** 8.3 D13·8.5 D10이 같은 이유로 세운 규칙이며 이 파일의 존재 이유다. `Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul" })`.
- **연락처는 `order_no`와 다르다.** `order_no`는 스키마 주석이 "클라 가공 금지"를 명시한 **식별자**지만, 전화번호는 표시 계층의 문제다. 서버는 `^\d{9,11}$`로 숫자만 저장하고 목업은 `010-2847-3391`로 그렸다. `[ASSUMPTION]` 규칙은 **11자리 → 3-4-4, 10자리 → 3-3-4, 그 외 → 원문 그대로**로 둔다. 서울 지역번호(02) 같은 예외는 구매자 연락처가 휴대폰이라는 전제에서 벗어나며, **틀리게 끊느니 원문을 보여준다.**
- 🚨 **8.6이 쓰지 않는 포맷을 미리 만들지 않는다** — 쓰지 않는 export는 lint 대상이 될 수 있다.

### D12 — 라우트·파일·BFF: **기존 파일에 GET을 더하고, 취소만 새로 만든다**

**결정.**

```
apps/web/
  app/api/orders/route.ts                          ← 수정 (8.5의 POST 옆에 GET 추가 — 파일을 새로 만들지 않는다)
  app/api/orders/[id]/route.ts                     ← 그대로 사용 (8.5가 만든 GET)
  app/api/orders/sub-orders/[id]/cancel/route.ts   ← 신설 POST + assertSameOrigin
  app/(buyer)/
    orders/page.tsx            ← 대체 (자리표시 → 목록. 셸 + OrdersView)
    orders/orders-view.tsx     ← 신설 "use client" 목록 본체
    orders/order-status.ts     ← 신설 (D1의 표 — 목록·상세가 함께 쓴다)
    orders/orders.css          ← 신설 (목록 전용 배치)
    orders/[id]/page.tsx       ← 신설 (셸 + OrderDetailView)
    orders/[id]/order-detail-view.tsx ← 신설 "use client" 상세 본체
    orders/[id]/order-pack.tsx ← 신설 (묶음 하나 + 상품 행 + 확인 줄)
    orders/[id]/detail.css     ← 신설 (상세 전용 배치)
    orders-api.ts              ← 수정 (8.5의 preview·create·getOrder 옆에 listOrders·cancelSubOrder 추가)
    deposit-box.tsx            ← 수정 (`detail` 변형 — D9)
    format.ts                  ← 수정 (D11의 세 함수)
    buyer.css                  ← 수정 (입금 안내 `m_detail` · 송장 줄 · 취소선 · 라벨-값 행 공용 규칙)
```

**근거·주의.**
- 🚨 **경로 경합 두 곳은 이미 판정돼 있다.** 페이지 `(buyer)/orders/complete/`(8.5, 정적) vs `(buyer)/orders/[id]/`(동적), BFF `app/api/orders/preview/`(정적) vs `app/api/orders/[id]/`(동적). **Next는 정적 세그먼트를 동적보다 먼저 매칭**하므로 `complete`·`preview`가 이긴다. **`[id]` 쪽에서 `id === "complete"`를 걸러내는 코드를 쓰지 않는다** — 라우터가 이미 판정했고, 그런 코드는 "라우터를 못 믿는다"는 잘못된 신호를 남긴다. (8.1 위험 9 · 8.5 D4)
- **`app/api/orders/route.ts`에 `GET`을 export로 추가**한다. 8.5가 그 자리에 주석으로 남겨 두기로 한 항목이다. 파일을 새로 만들면 같은 경로에 두 파일이 생겨 빌드가 깨진다.
- **취소 BFF만 `assertSameOrigin`을 탄다.** 상태를 바꾸는 POST이므로 8.2 D1이 세운 규약 그대로다. `GET` 둘은 읽기이므로 `proxyWithRefresh`만 탄다.
- **취소 BFF는 본문을 상류로 넘기지 않는다.** 사유를 받지 않으므로(D7) 빈 POST를 보낸다 — 클라이언트 본문을 통째로 흘리지 않는다는 규약과도 맞는다.
- `[id]` 핸들러는 **UUID 형식(36자)을 검사**하고 아니면 상류를 부르지 않고 `not_found` 404 봉투를 돌려준다 (8.3 D2·8.4 D11·8.5 D4와 같은 규칙). 취소 BFF도 `sub_order_id`에 같은 검사를 한다.
- `proxyWithRefresh`가 돌려준 `NextResponse`를 **그대로 반환**한다 — 다시 감싸면 회전된 세션 쿠키가 유실된다.
- `ctx.params`는 **Next 16에서 Promise다** — `await`한다.

### D13 — 반응형: **끝까지 한 단 640px.** 폭 전환은 CSS만으로

**결정.**

```
/orders          < 768 : 640px 한 단 + 하단 탭바.        ≥ 768 : 640px 한 단 + 상단 내비 (탭바 사라짐)
/orders/[id]     < 768 : 640px 한 단 + 뒤로가기 헤더.     ≥ 768 : 640px 한 단 + 상단 내비 (뒤로가기 사라짐, `주문내역` 활성)
두 화면 모두 하단 고정 CTA 바가 **없다**. 2단이 없다.
```

**근거.**
- UX-DR4가 주문내역·주문상세를 **"끝까지 한 단(최대 640px)"** 화면으로 못 박았다. 읽고 확인하는 화면이라 행 길이를 늘리면 오히려 읽기 어렵다. 8.1이 만든 `.b_container.m_read`가 그 자리를 이미 갖고 있다 — **새 컨테이너를 만들지 않는다.**
- 상단바·탭바 전환은 셸(8.1)이 CSS로 처리한다. 이 스토리는 `tab`·`showTabbar`·`topbar` prop만 넘긴다.
- **폭 전환에 JS를 쓰지 않는다.** `matchMedia`로 조건부 렌더하면 폭이 바뀔 때 언마운트되어 **열린 취소 확인 줄·진행 중 요청·오류 문장·`더 보기`로 쌓은 목록**이 날아간다. 특히 목록은 누적 상태라 8.4보다 손실이 크다. 8.1·8.3·8.4·8.5가 지킨 같은 규칙이다.
- 하단 고정 바가 없으므로 `.b_main[data-tabbar]`의 여백 규칙을 건드릴 일이 없다.

## Tasks / Subtasks

- [x] **Task 0 — 착수 전 확인 (선행 산출물의 실제 상태)** (AC: 전부)
  - [x] `git pull` 후 **8.5의 산출물이 실제로 있는지** 확인한다 — `app/api/orders/route.ts`(POST) · `app/api/orders/[id]/route.ts`(GET) · `(buyer)/orders-api.ts` · `(buyer)/deposit-box.tsx` · `format.ts`의 `formatDepositDue`
  - [x] `orders-api.ts`의 실제 시그니처를 읽는다 — 반환 형태가 `{ok, data} | {ok, error}` 한 벌인지, `getOrder`가 어떤 타입을 내는지. **8.6은 그 형태를 따르고 두 번째 규약을 만들지 않는다**
  - [x] `deposit-box.tsx`의 props와 마크업을 읽는다 — `variant`가 이미 유니온인지, 금액 클래스가 무엇인지
  - [x] `buyer.css`의 `.b_confirm_row`·`.b_seller_pack`·`.b_amount_summary`·`.b_status_label` 실제 선언을 읽는다. **값을 다시 선언하지 않는다**
  - [x] `(buyer)/orders/page.tsx`가 아직 8.1의 자리표시인지 확인한다 (이 스토리가 통째로 대체한다)
  - [x] 8.5가 아직 진행 중이면 **착수하지 않는다** — 같은 파일 4개를 동시에 만지게 된다

- [x] **Task 1 — BFF 라우트 (GET 추가 1건 + 신설 1건)** (AC: 1, 5, 9, 19)
  - [x] `app/api/orders/route.ts`에 **`GET` export를 추가**한다 → `proxyWithRefresh(req, "/api/v1/orders?page=" + page, { method: "GET" })`. 파일을 새로 만들지 않는다
    - [x] `page`는 쿼리에서 읽되 **정수만 통과**시킨다(`Number.isInteger` + `1 ≤ page ≤ 10000`). 아니면 상류를 부르지 않고 `validation_error` 422 봉투
  - [x] `app/api/orders/sub-orders/[id]/cancel/route.ts` 신설 — `POST`, **`assertSameOrigin(req)` 먼저**, `sub_order_id` UUID 형식 검사, 본문 없이 `proxyWithRefresh(req, \`/api/v1/orders/sub-orders/${id}/cancel\`, { method: "POST" })`
  - [x] `ctx.params`는 `await`한다 (Next 16)
  - [x] `proxyWithRefresh`의 응답을 **그대로 반환**한다 — 감싸지 않는다
  - [x] `lib/auth.ts`는 **import만 한다. 수정하지 않는다**

- [x] **Task 2 — API 래퍼와 상태 표** (AC: 1, 2, 5, 9, 11)
  - [x] `orders-api.ts`에 `listOrders(page)` · `cancelSubOrder(subOrderId)` 추가 + 목록·상세 응답 타입. **8.5가 만든 request 헬퍼를 재사용**하고 두 번째를 만들지 않는다
  - [x] 타입은 **서버 계약 그대로** — 클라이언트가 필드를 더하지 않는다. `image_url`이 없다는 사실을 타입 주석으로 남긴다 (D5)
  - [x] `orders/order-status.ts` 신설 — D1의 표(`display_status` → `{ label, tone }`). 목록·상세가 함께 쓴다. **미지 값 폴백 포함**
  - [x] `format.ts`에 `formatOrderDate`·`formatOrderDateTime`·`formatPhone` 추가 (D11). `Asia/Seoul` 고정. **`formatDepositDue`·`formatWon`을 다시 만들지 않는다**

- [x] **Task 3 — 주문내역 화면** (AC: 1, 2, 3, 4, 16, 17)
  - [x] `orders/page.tsx` 대체 — `<BuyerShell tab="orders" showTabbar topbar={{ variant: "title", title: "주문내역" }}>` + `.b_container.m_read`
  - [x] `orders/orders-view.tsx` — 최초 로드는 **effect 안 async IIFE + `alive` 가드**(8.4의 형태 그대로). **effect 안에서 동기 `setState`를 하지 않는다** (`react-hooks/set-state-in-effect`가 lint error다)
  - [x] 행: 날짜(`2026.07.21`) · 대표 상태 라벨 · 주문번호 · 대표 상품명(`title`) · 브랜드 나열 · 총액. 행 전체가 `<Link href={`/orders/${order_id}`}>`이고 히트 영역 44px 이상
  - [x] 행 사이 1px hairline. 목업의 우측 셰브런은 CSS 도형으로 그리거나 생략한다 — **인라인 SVG를 새로 만들면 `[data-surface="buyer"] svg`의 stroke-width 전역 규칙을 물려받는다**(8.4 학습 12)
  - [x] `더 보기`(누적 < total) / `최근 주문부터 보입니다.`(끝) — **무한 스크롤 금지**. 진행 중 버튼 비활성 + `order_id` dedupe (D4)
  - [x] 빈 상태 `아직 주문이 없습니다.` + `쇼핑 계속하기`, 최초 로딩은 행 골격
  - [x] 401 → `router.replace("/login?next=%2Forders")`

- [x] **Task 4 — 주문상세 골격과 조회** (AC: 5, 12, 13, 14, 16, 17)
  - [x] `orders/[id]/page.tsx` — `<BuyerShell tab="orders" topbar={{ variant: "back-title", title: "주문상세" }}>` (**`showTabbar` 없음**) + `.b_container.m_read`. `params`는 `await`
  - [x] `order-detail-view.tsx` — 조회·상태·핸들러 소유. 구획 순서: 주문번호·일시 → 입금 안내(있을 때) → 8px 띠 → `주문 상품 · 판매자별 N건` → 묶음들 → 8px 띠 → `배송 정보` → 8px 띠 → `결제 정보` → hairline → 하단 취소 안내
  - [x] 입금 안내는 `deposit_info` **객체의 존재로만** 분기하고 `<DepositBox variant="detail">`를 쓴다. `expired`면 경고 한 줄 (D9)
  - [x] 배송 정보 4행 — 빈 값은 `—`. 라벨-값 행은 `.b_row`(560px)
  - [x] 결제 정보 **3행 + 결제수단 줄** (D6). 합계는 20px 액센트. **도서산간 줄을 만들지 않는다**
  - [x] 하단 안내 `배송준비 전까지 판매자 묶음 단위로 취소할 수 있습니다.` — `b_notice`, 위 1px hairline. **항상 있다**
  - [x] 401 → `/login?next=%2Forders%2F<id>` / 404·비UUID → `주문을 찾을 수 없습니다.` + `주문내역 보기`

- [x] **Task 5 — 판매자 묶음 (상태·송장·취소)** (AC: 6, 7, 8, 15)
  - [x] `orders/[id]/order-pack.tsx` — 8.1의 `<SellerPack>` 슬롯을 채운다. **`seller-pack.tsx`를 수정하지 않는다**
    - `headEnd` = 상태 라벨 / `children` = 상품 행 / `foot` = 배송비 + 액션
  - [x] 상품 행: 상품명 · 옵션(`option_text` 없으면 `—`) · `수량 n개` · `line_total`. **썸네일 없음** (D5)
  - [x] `item.status === "canceled"` 행 — 금액 취소선 + `취소` 태그. **숨기지 않는다** (D10)
  - [x] 송장 줄 — `tracking_number`가 있을 때만. `--b-paper-shade` 면 + 3px 라운드, `송장번호` / `${carrier} ${tracking_number}`. **링크 아님** (FR-21)
  - [x] 푸터 배송비 — `shipping_fee + remote_extra_fee`가 0이면 `무료배송`. 취소된 묶음이면 취소선
  - [x] 액션 — `cancellable`이면 `주문 취소`(cancel 버튼, 빨강 금지) / `canceled`면 아무것도 없음 / 그 밖이면 `배송준비 이후에는 취소할 수 없습니다.`
  - [x] **주문 전체에 걸리는 상태·진행바·전체 취소 버튼을 만들지 않는다** (FR-15·18)

- [x] **Task 6 — 취소 실행과 실패 경로** (AC: 9, 10, 11)
  - [x] 인라인 확인 줄 — `.b_confirm_row` 재사용. `이 묶음을 취소할까요?` + `취소하기` + `아니요`. 한 번에 하나만 열린다 (D7)
  - [x] 확인 줄 열림 시 포커스를 `취소하기`로, `Esc`·`아니요`로 닫으면 원래 버튼으로. `role="group"` + `aria-label="<브랜드> 묶음 주문 취소 확인"`
  - [x] 실행 중 그 묶음의 버튼 비활성 + 중복 제출 차단. 스피너 없음
  - [x] 성공·`invalid_transition` → **조용한 재조회**. `not_found`·`unauthorized`·네트워크는 재조회하지 않는다 (D8)
  - [x] 🚨 오류 문장은 **재조회가 지우지 않는 별도 상태**(`packError`)에 담는다 — 8.4의 `rowError`와 같은 형태
  - [x] **HTTP 코드·`code` 문자열을 렌더하지 않는다**

- [x] **Task 7 — 입금 안내 `detail` 변형과 공용 CSS** (AC: 12, 18)
  - [x] `deposit-box.tsx`에 `variant: "detail"` 추가 — **복제하지 않는다** (D9)
  - [x] `buyer.css`에 `.b_deposit_box.m_detail`(accent-wash 면 + 1px accent-line + 5px 라운드 + 금액 20px) 추가. **`app/styles/buyer/**`를 수정하지 않는다**
  - [x] 공용 규칙만 `buyer.css`에: 라벨-값 행(`.b_kv_row`) · 송장 줄(`.b_track`) · 취소선(`.m_struck`). **목록 전용은 `orders.css`, 상세 전용은 `[id]/detail.css`**
  - [x] 스코프 없는 태그 셀렉터를 쓰지 않는다 — 격리의 근거는 임포트 위치가 아니라 셀렉터다 (8.1 학습)

- [x] **Task 8 — 검증: 정적 규칙과 빌드** (AC: 18, 19, 20)
  - [x] `cd apps/web && npx tsc --noEmit` → 0
  - [x] `npm run lint` → **0 errors · 0 warnings** (A-E456-5 베이스라인 — 늘어나면 이 스토리가 깬 것)
  - [x] `npx next build` 성공 — `/orders/complete`와 `/orders/[id]`가 **둘 다** 라우트 목록에 나오는지 확인
  - [x] `grep -rn "#2f6bff\|--color-brand\|--shadow-\|box-shadow\|matchMedia\|innerWidth" app/\(buyer\)/orders` → 0건
  - [x] `git diff --stat`에 `apps/api` **0건** · `app/styles/slur/` 0건 · `app/styles/buyer/` 0건 · `package.json`/`package-lock.json` 0건
  - [ ] `cd apps/api && uv run pytest -q` → **환경이 있을 때만.** 이 머신에는 `uv`·`docker`가 없다. 실행하지 못했으면 Completion Notes에 **"미실행 + 사유"** 를 적는다 — **통과했다고 쓰지 않는다**(8.1이 세운 규약)

- [x] **Task 9 — 검증: 화면 확인 (데이터 확보 방법 포함)** (AC: 1~17, 20)
  - [x] 🚨 **여러 상태의 주문을 만들려면 스텁이 사실상 필수다.** 이 화면의 핵심(묶음마다 다른 상태·송장·취소 가능 여부·부분 취소)은 **실제로 그 상태의 데이터가 있어야만** 보인다. 실서버에서 그 상태들을 만들려면 관리자 입금 확인 → 판매자 배송 처리까지 거쳐야 하고, 이 머신에는 백엔드가 없다
  - [x] **1순위 — 스크래치패드 스텁.** `/api/orders`·`/api/orders/{id}`·`/api/orders/sub-orders/{id}/cancel`을 흉내 내는 작은 서버를 스크래치패드에 두고 `next dev`가 그쪽을 보게 한다. **저장소에 커밋하지 않는다.** 아래 8개 시나리오를 스텁 데이터로 만든다
    - ① 입금대기(묶음 2개, 둘 다 `cancellable`, `deposit_info` 있음) — 목업 그대로
    - ② **Flow 3** — 한 묶음 `preparing`(취소 불가) + 다른 묶음 `shipping`(송장 있음). `deposit_info` 없음
    - ③ 배송완료(전 묶음 `delivered`)
    - ④ 전체 취소(대표 `canceled`, 묶음 `canceled`, 배송비 취소선)
    - ⑤ **부분 취소** — 한 묶음 안에 `ordered` 라인과 `canceled` 라인이 섞임 (D10 라인 층)
    - ⑥ `expired: true`인 입금대기
    - ⑦ 주문 0건(빈 상태) · ⑧ `total`이 페이지 크기보다 큰 목록(`더 보기`)
  - [ ] **2순위 — 프로덕션 실데이터.** 계정이 있으면 주문 1건으로 ①만 확인 가능하다. ②~⑤는 관리자·판매자 조작이 필요하다. **프로덕션에서 만든 테스트 주문은 반드시 정리한다** (R8)
  - [x] 390(또는 헤드리스 최소 500) / 700 / 768 / 1280 네 폭에서 두 화면 렌더 — 한 단 640px 유지, 목록에만 탭바, ≥768 상단 내비 `주문내역` 활성
  - [x] 폭을 390 ↔ 1280으로 **바꿔가며** 열린 확인 줄·오류 문장·`더 보기`로 쌓은 목록이 살아 있는지 확인 (AC 17)
  - [x] 키보드만으로 완주 — 목록 행 → 상세 → 묶음 → `주문 취소` → 확인 줄 → 재조회. 포커스 이동·`Esc` 복귀 확인
  - [x] 상태 라벨의 색을 **끄고**(그레이스케일 렌더 또는 개발자도구) 텍스트만으로 상태를 알 수 있는지 확인 (UX-DR8)

- [x] **Task 10 — 검증: 취소 실패 경로** (AC: 10, 11)
  - [x] 스텁으로 `invalid_transition` 422를 만들고 — `message`가 문장 그대로 뜨는지, **재조회 후에도 문장이 남는지**, 상태가 서버 값으로 정정되는지 확인 (D8)
  - [x] `not_found` 404 → `주문내역 보기` / `unauthorized` 401 → `/login?next=%2Forders%2F<id>` 확인
  - [x] 네트워크 차단 상태에서 취소 → 확인 줄이 유지되고 문장이 뜨는지, 재조회로 화면이 날아가지 않는지
  - [x] **HTTP 코드·`code` 문자열이 화면에 한 번도 나타나지 않는지** 문서 전체 grep으로 확인(`422`·`invalid_transition`·`not_found`)
  - [x] 취소 성공 → **그 묶음만** 취소로 바뀌고 다른 묶음 상태가 그대로인지 (이 스토리의 가장 중요한 확인)

- [ ] **Task 11 — 검증: 프로덕션 (R3·R8)** (AC: 9, 19)
  - [ ] 배포 후 `/orders`·`/orders/{id}`가 프로덕션(Railway 프록시 뒤)에서 뜨는지, 비로그인 접근이 `/login?next=…`로 가는지 curl로 확인
  - [ ] **취소 BFF의 `assertSameOrigin`이 프록시 뒤에서 통과하는지** 실요청 1회로 확인 — 로컬만 보고 done으로 넘기지 않는다 (R3)
  - [ ] 프로덕션에서 취소를 실행했다면 **어떤 주문을 어떻게 정리했는지** Completion Notes에 적는다 (R8)

- [x] **Task 12 — 판매자·관리자 회귀 (눈으로)** (AC: 18)
  - [x] `/seller`·`/admin` 진입 → 색·레이아웃·**파랑 포커스 링**이 그대로인지 확인
  - [x] 구매자 두 화면에서 Tab 이동 → **먹색 링**이 모든 인터랙티브 요소에 보이고 파랑이 없는지 확인

## Dev Notes

### 이 스토리의 경계 — 하지 않는 일

| 하지 않는다 | 어디가 하는가 |
|---|---|
| 백엔드 수정·마이그레이션·신규 엔드포인트·응답 필드 추가 | 없음. Epic 8 전체가 백엔드 무변경 |
| 로그인·회원가입·`next` 소비·역할 쿠키 | **8.2** |
| 상품목록·상품상세 | **8.3** |
| 장바구니·수량·삭제·배지 컨텍스트 | **8.4** (8.6은 `.b_confirm_row`만 물려받는다) |
| 주문서(`/checkout`)·주문완료(`/orders/complete`)·`deposit-box`의 `placed` 변형·BFF `POST /api/orders`·`GET /api/orders/[id]` | **8.5** (8.6은 그것들을 **쓴다**) |
| `/me`·PWA·service worker·`theme-color` | **8.7** |
| `apps/mobile` 제거 | **8.8** |
| 주문 전체 취소 버튼 · 라인 단위 부분 취소 | **만들지 않는다** (FR-15·18, AD-6 — 라인 취소는 관리자 5.5) |
| 취소 사유 입력 · 취소 이력 표시 · 환불 상태 표시 | v1 밖 (D7, `refunded_at`은 5.5 관리자) |
| 배송 추적 링크·택배사 연동 | **v1 밖** (FR-21 — 번호 표시까지) |
| 목록 필터·검색·정렬·재구매·리뷰 | v1 밖 (PRD 화면 목록 밖) |
| 무한 스크롤 자동 로드 · pull-to-refresh | 금지 (UX-DR16) |
| `apps/web` 테스트 프레임워크 도입 | 하지 않는다 (의존성 추가 금지) |

### 소비하는 백엔드 API — 계약 (읽기만, 수정 금지)

세 엔드포인트 모두 **인증 필수**(`get_current_user_id`). 경로 접두사는 `/api/v1`. 역할 검사는 없다 — 로그인만 요구한다.

**① `GET /api/v1/orders?page=1`** → `200 OrderListResponse`

```jsonc
{ "items": [
    { "order_id": "uuid",
      "order_no": "A1B2C3D4",        // UUID 뒤 8자리 대문자 — 🚨 클라 가공 금지
      "created_at": "2026-07-21T05:22:00Z",   // UTC
      "display_status": "awaiting_payment",   // 대표 상태 — 서버 파생 (AD-12)
      "grand_total": 121000,          // 활성 라인만 합산 (전-취소 주문은 원 주문 금액 폴백)
      "title": "유광 도자 머그 외 1건", // 서버 조립 — 클라가 "외 n건"을 만들지 않는다
      "sub_orders": [
        { "brand_name": "토림도예", "display_status": "awaiting_payment" },
        { "brand_name": "온실",     "display_status": "awaiting_payment" } ] }
  ],
  "total": 3,     // 전체 건수
  "page": 1 }
```
- 최신순(`created_at DESC, id DESC`). **페이지 크기는 응답에 없다** — `settings.page_size`(현재 20)이며 화면이 알 수 없다 (D4)
- `page < 1` 또는 `page > 10000` → **`422 validation_error`**
- ⚠️ **`image_url`이 없다** (D5, 위험 1) · ⚠️ `sub_orders`에 `sub_order_id`가 **없다** — 목록에서는 취소할 수 없다(의도된 설계)

**② `GET /api/v1/orders/{order_id}`** → `200 OrderDetailResponse`

```jsonc
{ "order_id": "uuid", "order_no": "A1B2C3D4", "created_at": "…",
  "display_status": "awaiting_payment",
  "recipient_name": "김소연", "recipient_phone": "01028473391",  // 🚨 숫자만 (^\d{9,11}$)
  "postal_code": "04044", "address1": "서울특별시 마포구 양화로 45", "address2": "301호",
  "order_note": "부재 시 경비실에 맡겨주세요",                    // 빈 문자열 가능
  "sub_orders": [
    { "sub_order_id": "uuid",          // ← 취소 API의 키
      "brand_name": "토림도예",
      "display_status": "awaiting_payment",  // 묶음 독립 상태 (FR-15)
      "carrier": null,                  // 배송중 전에는 null
      "tracking_number": null,          // FR-21 — 표시만
      "shipping_fee": 3000,             // 🚨 취소된 묶음도 원래 값 그대로 온다
      "remote_extra_fee": 0,
      "cancellable": true,              // 서버 파생 (AD-12) — 4.6 가드와 동치
      "items": [
        { "product_name": "유광 도자 머그", "option_text": "색상: 살구 / 용량: 240ml",
          "unit_price": 30000, "extra_price": 2000, "quantity": 2,
          "line_total": 64000, "status": "ordered" } ] }   // ordered | canceled
  ],
  "item_total": 118000,
  "shipping_total": 3000,     // 🚨 기본 + 도서산간의 합. **도서산간 분리 필드가 없다** (D6)
  "grand_total": 121000,
  "deposit_info": {           // pending_payment일 때만. null이면 상자를 그리지 않는다
    "grand_total": 121000,    // 잔여 활성분 (부분 취소 반영 — 과입금 방지)
    "deposit_account": "국민은행 123456-01-987654",   // settings 값 (AD-13). **한 문자열**
    "deposit_due_at": "2026-07-24T12:34:56Z",         // UTC
    "expired": false } }
```
- 남의 주문·없는 주문 → **`404 not_found`** (403이 아니다 — 존재 노출 방지)
- 금액은 전부 **활성(ordered) 라인만** 합산하며, 활성 라인이 남지 않은 묶음은 배송비도 합계에서 빠진다. **전-취소 주문만** 표시 금액이 원 주문 금액으로 폴백된다(0원 카드 방지)
- `display_status`가 낼 수 있는 값: `awaiting_payment` · `preparing` · `shipping` · `delivered` · `confirmed`(묶음만, v1 미사용) · `canceled` (D1)

**③ `POST /api/v1/orders/sub-orders/{sub_order_id}/cancel`** → `200 SubOrderCancelResponse`

요청: **본문 없이 보낸다**(전 필드 optional이라 라우터가 허용한다). `{"reason": "…"}`도 가능하지만 이 화면은 보내지 않는다 (D7)

```jsonc
{ "canceled_items": 2,      // 이번 호출에서 취소된 ordered 라인 수 (선취소분 제외)
  "order_canceled": false } // 전 묶음 취소로 order 층까지 canceled 전이됐는지
```
- 🚨 **응답에 갱신된 주문이 없다** — 화면을 맞추려면 `GET /orders/{id}` 재조회가 **필수**다 (D8)
- 실패 code: `invalid_transition`(422 — 배송준비 진입 후 / 이미 취소된 묶음) · `not_found`(404 — 남의·없는 묶음) · `validation_error`(422 — reason 형식, 이 화면은 보내지 않으므로 방어적)
- `invalid_transition`의 `message`에 **관리자 문의 안내가 이미 들어 있다**: `배송준비가 시작된 주문은 직접 취소할 수 없습니다. 관리자에게 문의해 주세요.` — 화면이 문장을 덧붙이지 않는다
- 재고 복원·취소 기록(`cancellations`)·이벤트는 전이 엔진이 한 트랜잭션에서 처리한다 (AD-3·AD-4)

**에러 봉투 (공통)** — `{code, message, details}`. 분기는 `code`, 표시는 `message`. **HTTP 코드·`code` 문자열은 화면에 나타나지 않는다.**

### 고칠 코드 — ① 지금 무엇을 하는가 ② 무엇을 바꾸는가 ③ 깨뜨리면 안 되는 것

**`apps/web/app/(buyer)/orders/page.tsx`**
1. 8.1이 만든 자리표시. `<BuyerShell tab="orders" showTabbar topbar={{variant:"title", title:"주문내역"}}>` + `.b_container.m_read` + `주문내역은 8.6에서 채웁니다.` 두 줄.
2. **통째로 대체한다.** 셸 호출 형태(`tab`·`showTabbar`·`topbar`)는 **그대로 유지**한다 — 8.1이 탭바·상단 내비 활성 표시를 그 prop으로 판정한다.
3. 🚨 `.b_container.m_read`(640px)를 빼지 않는다 — UX-DR4의 "끝까지 한 단"이 이 클래스 하나에 걸려 있다. 🚨 `showTabbar`를 빼면 최상위 화면에서 탭바가 사라진다.

**`apps/web/app/(buyer)/seller-pack.tsx`**
1. 8.1의 뼈대. `brand`·`headStart`·`headEnd`·`children`·`foot`·`unavailable` 슬롯 + `.b_seller_pack` 마크업. 헤더 안에서 `<BrandLabel size="pack">`을 이미 그린다. 파일 주석이 **"주문상세(8.6): 헤더 우측 상태 라벨, 푸터에 `주문 취소`(취소 가능할 때만), 배송중이면 송장 줄"** 을 이미 선언하고 있다.
2. **수정하지 않는다** — 필요한 것이 전부 슬롯으로 들어간다. 송장 줄은 `foot` 위가 아니라 `children`(상품 행) 다음·`foot` 앞이 자연스러운데, 슬롯이 없으면 **`foot` 안에 세로로 쌓는다**. prop을 새로 파지 않는다.
3. 🚨 파일 주석의 **"주문 전체에 걸리는 상태나 전체 취소 버튼을 두지 않는다 (FR-15·18)"** 가 이 스토리의 핵심 계약이다. 🚨 `unavailable`은 8.4(담은 뒤 품절)의 의미다 — **취소된 묶음에 그 prop을 재사용하지 않는다.** 회색조 처리는 "살 수 없는 물건"의 표기이고 취소는 "이미 끝난 거래"의 표기다.

**`apps/web/app/(buyer)/status-label.tsx`**
1. 8.1이 완성했다. `tone: "waiting" | "moving" | "finished"` → `.m_waiting`(액센트) · `.m_moving`(먹색) · `.m_finished`(흐린색). 면 없는 11.5px/800/`.05em`.
2. **수정하지 않는다.** D1의 표가 `display_status` → `{label, tone}` 매핑만 담당한다.
3. 🚨 **액센트가 붙는 상태는 입금대기 하나뿐**이다(UX-DR8). `preparing`·`shipping`에 `waiting`을 주면 이 지면의 색 규칙이 무너진다. 🚨 색과 텍스트를 항상 함께 — `children`으로 한국어 라벨이 반드시 들어간다.

**`apps/web/app/(buyer)/deposit-box.tsx` (8.5 산출물)**
1. `placed` 변형(1.5px 액센트 테두리·노치 캡션 `입금 안내`·금액 27px·`paper-shade` 메모 상자). props `{variant, amount, account, dueAt, expired?}`.
2. `variant`에 `"detail"`을 더하고 그 스타일을 `buyer.css`에 추가한다 (D9).
3. 🚨 **`예금주` 줄을 만들지 않는다** — 백엔드에 `deposit_account` 문자열 하나뿐이다(8.5 D11·위험 6). 🚨 `placed` 변형의 시각을 바꾸지 않는다 — 8.5가 실렌더로 검증한 값이다. 🚨 기한은 `formatDepositDue`(Asia/Seoul)를 그대로 쓴다.

**`apps/web/app/(buyer)/orders-api.ts` (8.5 산출물)**
1. `preview`·`create`·`getOrder` 래퍼 + `{ok:true,data} | {ok:false,error}` 반환 규약(throw하지 않는다).
2. `listOrders(page)`·`cancelSubOrder(subOrderId)`를 **같은 형태로** 추가한다.
3. 🚨 반환 규약을 바꾸지 않는다 — 8.5의 화면들이 그 형태에 기대고 있다. 🚨 `request` 헬퍼를 복제하지 않는다.

**`apps/web/app/api/orders/route.ts` (8.5 산출물)**
1. `POST` 하나 — `assertSameOrigin` → `proxyWithRefresh(req, "/api/v1/orders", {method:"POST"})`. 8.5가 "8.6이 여기에 GET을 더한다"는 주석을 남겨 두기로 했다.
2. **같은 파일에 `GET`을 추가한다.** 새 파일을 만들면 같은 경로에 두 라우트가 생겨 빌드가 깨진다.
3. 🚨 기존 `POST`의 화이트리스트·Origin 검사를 건드리지 않는다. 🚨 GET에 `assertSameOrigin`을 붙이지 않는다 — 읽기 요청에 CSRF 방어를 붙이면 정상 내비게이션이 막힌다.

**`apps/web/app/(buyer)/buyer.css`**
1. 셸 + 폼 프리미티브 + 공유 컴포넌트(`.b_amount_summary`·`.b_seller_pack`·`.b_status_label`·`.b_tag.m_unavailable`) + 8.4가 승격한 `.b_cta_bar`·**`.b_confirm_row`**·`.b_stepper` + 8.5가 더한 오버레이·입금 안내.
2. **공용 규칙만 추가한다** — `.b_deposit_box.m_detail` · 라벨-값 행 · 송장 줄 · 취소선. **목록 전용은 `orders/orders.css`, 상세 전용은 `orders/[id]/detail.css`.**
3. 🚨 `.b_confirm_row`·`.b_seller_pack`·`.b_amount_summary`·`.b_status_label`·포커스 링 블록은 8.1~8.5가 실측 검증한 것이다. **값을 다시 선언하거나 덮어쓰지 않는다.** 🚨 스코프 없는 태그 셀렉터를 쓰지 않는다. 🚨 `[data-surface="buyer"] svg { stroke-width: var(--b-tab-stroke, 1.4px) }`가 **구매자 라우트의 모든 SVG**에 걸린다 — 목록 행의 셰브런을 SVG로 그리면 굵기를 물려받는다(글자·CSS 도형이면 문제 없다, 8.4 학습 12).

**`apps/web/app/(buyer)/cart/cart-view.tsx` · `cart-pack.tsx` (참조용, 수정하지 않는다)**
1. 8.4의 완성품. effect 안 async IIFE + `alive` 가드로 로드하고, `result`를 `{data, error} | null` 한 벌로 두어 **로딩 상태를 파생**시킨다(`react-hooks/set-state-in-effect` 회피). 행 오류는 `rowError`로 **분리**해 재조회가 지우지 않게 한다. 인라인 확인 줄의 포커스 이동·`Esc` 복귀가 여기 구현돼 있다.
2. **아무것도 바꾸지 않는다.** 형태만 따른다.
3. 🚨 이 두 파일이 이 스토리가 따라야 할 **관례의 정본**이다 — 새로운 로딩·오류 규약을 발명하지 않는다.

**`apps/api/app/orders/**` (읽기만, 수정 금지)**
1. `router.py` 5엔드포인트 + `service.py`(`derive_sub_status`·`derive_order_status`·`list_my_orders`·`get_my_order`·`cancel_sub_order`·`_amounts`·`_display_amounts`·`_order_no`) + `schemas.py` + `transitions.py`(3층 상태 기계).
2. **한 줄도 바꾸지 않는다.**
3. 이 도메인은 4.3·4.6·5.1에서 프로덕션 검증됐고 `test_order_history.py`·`test_buyer_cancel.py`가 파생 매트릭스·paid+NULL·부분 취소 금액·스냅샷 불변·재고 복원 1회·취소 vs 입금확인 동시성을 봉인하고 있다. **API 테스트 153건이 그대로 통과하는 것이 백엔드 무변경의 증거**다.

### 앞선 학습 (sprint-status.yaml action_items · 앞선 스토리에서 골라온 것)

- **A-E456-5 (done) — 웹 lint 베이스라인 0 errors · 0 warnings.** 🚨 **`react-hooks/set-state-in-effect`가 error다.** 8.3이 처음 부딪혔고 8.5가 재조회 설계 전체를 여기에 맞췄다. 이 스토리도 **두 화면 모두 마운트 시 조회**하므로 정면으로 해당한다 — 8.4의 형태(effect 안 async IIFE + `alive` 가드, 로딩은 `null` 여부로 파생)를 그대로 쓴다.
- **R3 (open) — 쿠키·Origin·CORS는 프로덕션(프록시 뒤) 실요청 검증 후에만 done.** 이 스토리는 **`assertSameOrigin`을 타는 POST BFF 하나를 신설**한다. Railway 프록시 뒤 확인이 Task 11이다.
- **R6 (done) — 에러 code는 Dev Notes에 사전 시드 선언.** 아래 별도 절.
- **R7 (done) — `slur_role`은 UX 힌트일 뿐 권한 판정이 아니다.** 미들웨어가 `/orders`·`/orders/[id]`를 통과시키는 것은 인증이 아니다(`slur_role` 14일 > `slur_access` 30분). 페이지가 API 401을 **자기 손으로** `/login` 처리한다 (AD-1).
- **R8 (in-progress) — 프로덕션 E2E 시나리오 사전 명시 + 테스트 데이터 즉시 정리.** ⚠️ 이 스토리는 **주문을 취소한다** — 재고가 복원되고 `cancellations`에 기록이 남으며 되돌릴 수 없다. 프로덕션에서 실행했다면 어떤 주문인지 적는다.
- **4.6의 확정 계약 — 취소 단위는 `sub_order`, 주문 전체 취소 = 모든 묶음 취소.** 화면이 이를 뒤집지 않는다(AD-6). 전체 취소 버튼을 만들면 UX 계약(FR-15·18)과 아키텍처 결정 둘을 동시에 어긴다.
- **5.1의 확정 규약 — 입금 안내는 상태값이 아니라 `deposit_info` 객체의 존재로 분기한다** (AD-12). 부분 취소 후 금액은 **잔여 활성분**(과입금 방지)이다.
- **5.1의 확정 — 파생 로직은 서버 한 곳뿐이고 클라이언트는 표시만.** 대표 상태·금액·`cancellable`·`expired` 넷 다 서버 값이다.
- **5.1의 리뷰 교훈 4개가 그대로 재현된다** — (a) offset 페이지네이션 중복 카드 → dedupe, (b) 새로고침이 loadMore에 막힘 → 플래그 분리, (c) 전-취소 주문 표시 금액 0원 → 서버가 폴백을 넣어 두었다(화면이 다시 처리할 필요 없음), (d) 만료된 입금 안내 무표시 → `expired` 경고.
- **8.4의 D7 — 인라인 확인 줄은 `buyer.css`의 공용 규칙(`.b_confirm_row`)이며 "8.6의 `주문 취소` 확인도 이 규칙을 쓴다"** 고 명시돼 있다. 새 확인 UI를 만들지 않는다.
- **8.4의 D6 — 성공에만 재조회.** 8.6은 `invalid_transition`에서도 재조회하며 **그 차이의 근거를 D8에 적었다.** 무의식적으로 어기지 않는다.
- **8.4의 학습 12 — `[data-surface="buyer"] svg`의 stroke-width 전역 규칙.** 새 인라인 SVG를 만들면 물려받는다.
- **8.1의 학습 — Chrome 헤드리스는 최소 500px 폭을 강제한다.** `<640` 구간은 500px으로 확인하고 390 고유 수치는 미디어쿼리 값과 대조한다.
- **8.1의 위험 9 · 8.5의 D4 — `/orders/complete`(정적)가 `/orders/[id]`(동적)를 이긴다.** `[id]` 쪽에서 문자열로 걸러내지 않는다.
- **`apps/web/AGENTS.md`: "이건 네가 아는 Next.js가 아니다 — `node_modules/next/dist/docs/`를 먼저 읽어라."** `ctx.params`·`params`는 Promise다.

### 에러 code 시드 (R6)

이 스토리가 만나는 `code`는 전부 **기존 백엔드 코드**이며 새로 만들지 않는다.

| code | HTTP | 언제 | 화면 처리 |
|---|---|---|---|
| `unauthorized` | 401 | 세션 만료·비로그인 | 목록: `/login?next=%2Forders`로 `replace` / 상세: `/login?next=%2Forders%2F<id>`로 `replace` |
| `not_found` | 404 | 남의·없는 주문 / 남의·없는 묶음 / BFF의 잘못된 UUID | `주문을 찾을 수 없습니다.` + `주문내역 보기`(→ `/orders`) |
| `invalid_transition` | 422 | 배송준비 진입 후 취소 · 이미 취소된 묶음 | **`message` 문장 그대로** 그 묶음 자리에 + **상세 재조회로 상태 정정**. 문장은 재조회가 지우지 않는다 (D8) |
| `validation_error` | 422 | `page < 1` · `page > 10000` · reason 형식(보내지 않으므로 방어적) | `message` + `다시 시도`. 목록은 page를 1로 되돌린다 |
| `forbidden` | 403 | 취소 BFF `assertSameOrigin` 위반 | `message` + 재시도 (정상 브라우저 사용에서는 나오지 않는다) |
| `internal_error` | 500 | `settings` 누락 · 판매자 조회 레이스 | `message` + `다시 시도` |
| `service_unavailable` | 503 · BFF 폴백 | 상류 장애, JSON 아닌 응답 | `message` + `다시 시도` |
| `http_error` | 그 외 | 매핑 없는 상태 | `message` + `다시 시도` |
| (봉투 없음) | — | fetch throw(네트워크 단절) | `연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요.` + 재시도 |

**표시 규약**: 분기는 `code`, 표시는 `message`. **HTTP 코드·`code` 문자열을 화면에 렌더하지 않는다** (UX-DR9·15).

### 발견한 위험 · 기존 코드의 문제 (구현 전에 읽을 것)

1. 🚨 **주문 응답에 상품 이미지가 없다 — UX 계약과 API 계약이 어긋나는 첫 번째 지점.** 목업은 주문내역 행에 64px, 주문상세 묶음에 68px 사진을 그리는데 `OrderCard`·`OrderLineView` 어디에도 `image_url`이 없다. 8.5처럼 `GET /carts`와 합성할 수도 없다 — **주문이 만들어지는 순간 장바구니가 비워진다.** 스냅샷에 `variant_id`도 없어 원본을 되짚을 경로가 없다. **D5가 "사진 없이 그린다"로 결정**했고, 근본 해소는 응답 필드 추가(백엔드 변경)라 Epic 8 경계 밖이다.

2. 🚨 **주문상세 응답에 도서산간 추가비를 분리한 필드가 없다 — 두 번째 어긋남.** `shipping_total`이 이미 합쳐진 값이라 UX-DR13의 4행 금액 요약이 성립하지 않는다. 묶음별 `remote_extra_fee`를 더하면 되지만 **취소된 묶음 제외 기준까지 재현해야 하므로 그것이 파생 로직 구현**이고 AD-12 위반이다. **목업 확정본도 3행**이라 D6이 3행으로 결정했다. 장바구니·주문서(4행)와 주문상세(3행)의 금액 요약이 갈리는 이유가 여기 있다.

3. 🚨 **`EXPERIENCE.md`의 "결제완료 — 취소 계속 가능"은 사실이 아니다 — 세 번째 어긋남이자 가장 중요한 것.** 백엔드는 입금 확인(paid) 시 4.3의 연쇄로 활성 묶음을 **즉시 `preparing`으로** 옮긴다. 따라서 (a) **`결제완료`라는 표시 상태가 화면에 뜨는 순간이 없고**, (b) **실제 취소 창은 `입금대기` 동안뿐이다.** UX 스파인의 6단계 서술과 화면 문구(`배송준비 전까지…`)는 FR-18의 표현이므로 유지하되, **구매자가 입금 후에는 취소할 수 없다는 사실**을 Slur가 알아야 한다. 화면은 `cancellable`만 보므로 동작은 정확하다 — 어긋나는 것은 **문서의 기대**다.

4. **대표 상태 파생 방향이 UX 권장과 반대다.** `EXPERIENCE.md`는 "가장 덜 진행된 상태를 대표로 권장"하지만 `derive_order_status`는 `shipping`이 하나라도 있으면 `배송중`이다(가장 진행된 쪽). Flow 3의 주문은 목록에서 `배송중`으로 보인다. **API가 소유한 값이므로 API가 이긴다**(AD-12, 에픽 `[ASSUMPTION]`의 지시대로 응답을 확인해 맞춘 결과 — D3).

5. **취소 상태 문언이 문서마다 다르다.** 5.1(Flutter)은 `취소완료`, DESIGN/EXPERIENCE/목업은 `취소`. **D1이 `취소`로 통일**했다. 앱은 8.8에서 제거되므로 두 문언이 공존하는 기간은 짧다.

6. 🚨 **`deposit_account`가 한 문자열이라 `예금주` 줄을 만들 수 없다** (8.5 위험 1 승계). 목업의 `입금 계좌 / 예금주 / 입금 기한` 세 줄 중 예금주 줄이 없다. **오픈 게이트(실계좌 등록) 항목**이며 `deferred-work.md`에 이미 등재돼 있다.

7. **주문번호 형식이 목업과 다르다.** 목업 `20260721-0037`(날짜+일련) vs 실제 `A1B2C3D4`(UUID 뒤 8자리 대문자). **API 값을 그대로 쓴다** — 스키마 주석이 "클라 가공 금지"다. 5.1이 8자리 충돌 가능성을 인지하고 관리자 화면에 전체 UUID를 병기해 두었다.

8. **페이지 크기가 응답에 없다.** `settings.page_size`(20)를 화면이 알 수 없으므로 `누적 길이 < total`로만 판정한다(D4). 운영자가 값을 바꿔도 화면이 깨지지 않는 형태다.

9. **취소된 묶음의 `shipping_fee`는 원래 값 그대로 내려온다.** 합계(`shipping_total`)에서는 빠져 있으므로 취소선 없이 그대로 그리면 **숫자가 맞지 않아 보인다**(D10이 취소선으로 처리).

10. **부분 취소된 주문은 목록에서 그 사실이 보이지 않는다.** 대표 상태는 남은 묶음 기준이고 목록에 묶음 상태를 두지 않기로 했다(D3). 상세가 답을 갖는다 — 알려진 한계로 기록한다.

11. **`confirmed`가 묶음 상태로 내려올 수 있다.** `derive_sub_status`는 `shipping_status`를 그대로 반환하고 `SUB_CONFIRMED = "confirmed"`가 값으로 정의돼 있다(v1 미사용, 전이표 미등록). 대표 상태는 이미 `delivered`로 접는다. **D1의 표가 `confirmed`도 `배송완료`로 매핑**해 영어 값이 화면에 새지 않게 한다.

12. **이 화면은 데이터 없이는 검증할 수 없다.** 묶음마다 다른 상태·송장·부분 취소는 **그 상태의 데이터가 있어야만** 보인다. 이 머신에는 `uv`·`docker`가 없어 로컬 백엔드가 불가능하다 — **스크래치패드 스텁이 사실상 필수**이며 Task 9가 8개 시나리오를 지시한다. 스텁은 **저장소에 커밋하지 않는다.** "통과했다"고 쓰지 않는 것이 8.1이 세운 규약이다.

13. **8.5가 같은 파일 4개를 만지고 있다** — `app/api/orders/route.ts` · `orders-api.ts` · `deposit-box.tsx` · `format.ts` · `buyer.css`. baseline(`a8d5da2`) 시점에는 8.5 산출물이 커밋되지 않았다. **Task 0이 실제 상태를 다시 읽는다.**

14. **`middleware.ts`는 Next 16에서 deprecated이며 `proxy`로 이름이 바뀌었다**(8.1이 발견해 부채로 남긴 항목, Epic 8 완료 후 rename). 이 스토리는 미들웨어를 건드리지 않는다 — `/orders`·`/orders/:path*`는 8.1이 이미 matcher에 등록했다.

15. **`/orders/[id]`가 `/orders/complete`를 가로채지 않는다.** 정적 세그먼트가 이긴다. 그래도 **빌드 후 라우트 목록에서 둘 다 확인**한다(Task 8) — 이 경합은 조용히 깨지는 종류다.

16. **취소는 되돌릴 수 없다.** 재고 복원·`cancellations` 기록이 한 트랜잭션에서 일어나고 재취소는 422다. 확인 줄(D7)이 유일한 방어선이며, **확인 줄을 건너뛰는 경로를 만들지 않는다**(키보드 Enter 연타로 두 번 실행되지 않도록 확인 줄 열림과 실행 사이에 별도 클릭이 필요하다).

### Project Structure Notes

- 정렬: `Consistency Conventions`의 "프론트 = Next.js App Router + 슬러 시스템 CSS", 그 위에 8.1이 얹은 구매자 스코프 확장 층. 8.6은 그 층을 **소비하고 공용 부품 셋(입금 안내 `detail` 변형·송장 줄·라벨-값 행)을 보탠다.** [Source: ARCHITECTURE-SPINE.md#Consistency-Conventions]
- 신규 페이지 라우트 1개: `/orders/[id]`. `/orders`는 자리표시 대체. 신규 BFF 1파일 + 기존 1파일에 GET 추가. **기존 URL 변경 0건.**
- 컴포넌트 파일은 라우트 폴더 안에 평평하게 둔다. 여러 화면이 공유하는 것(`orders-api.ts`·`deposit-box.tsx`·`format.ts`)은 `(buyer)/` 바로 아래, 화면 전용은 각 라우트 폴더 안. `order-status.ts`는 목록·상세 둘만 쓰므로 `orders/` 아래 둔다.
- `page.tsx`·`layout.tsx`·`route.ts`가 아닌 파일은 라우트를 만들지 않는다.
- 스택 핀: Next.js 16.2.10 / React 19.2.4. **의존성을 추가하지 않는다** — `package.json`·`package-lock.json` diff 0건이 AC 20의 증거다.
- 이 스토리로 **Epic 8의 구매자 화면 9개 중 8개가 선다** — 남은 것은 `/me`(8.7)다.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic-8 — 에픽 경계: 백엔드 무변경·ERD 0건·구매자 API 12개 재사용·테스트 153건]
- [Source: _bmad-output/planning-artifacts/epics.md#Story-8.6 — AC 원문(대표 상태 서버 값·묶음 독립 상태·취소 버튼과 안내 문장·송장 텍스트·입금 안내 detail·한 단 640px) 및 Dev Notes(`[ASSUMPTION]` 대표 상태 규칙·취소 묶음 목록 표기 → D1·D3이 해소)]
- [Source: _bmad-output/planning-artifacts/epics.md#Story-8.5 — 주문완료의 `주문 상세 보기`가 이 스토리의 `/orders/[id]`를 가리킨다, `deposit-box.tsx`·`orders-api.ts`·BFF의 소유]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR3 — 탭바는 최상위 4화면에만(주문내역 포함), 상단바 형태, ≥768 상단 내비]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR4 — **주문내역·주문상세는 끝까지 한 단(최대 640px)**, 2단으로 만들지 않는다, 폭 변경 시 상태 유지]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR5 — 여백 20/20/32, 행 내부 최대 폭 560px]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR6 — 먹색 포커스 링, 키보드 완주, 하단 고정 바는 DOM 순서상 콘텐츠 뒤]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR7 — 터치 타깃 44×44 (`보기` 링크가 미달 항목으로 지목됨), 글자 200% 확대]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR8 — **색만으로 상태를 전달하지 않는다**, 상태 라벨은 면 없는 11.5px/800/.05em, 액센트는 입금대기 하나뿐, 성공 초록·위험 빨강 도입 금지]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR9 — 빈 주문내역 `아직 주문이 없습니다.`, 목록 끝 `최근 주문부터 보입니다.`, skeleton, 제출 중 버튼 비활성, HTTP 코드·code 미노출]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR12 — box-shadow 금지, 8px 띠·1px hairline·테두리 상자, 라운드 3px(안내 상자·취소 버튼)·5px(입금 안내 상자)]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR13 — 판매자 묶음 뼈대(주문상세는 각자의 상태·배송비·취소 버튼·송장 줄), **주문 전체 상태·전체 취소 버튼 금지**, 금액 요약 행 순서]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR14 — 입금 안내 상자 두 변형, 주문상세 변형은 `#faf1ec` 면 + 1px `#ecd9d0` + 금액 20px + 최상단, 입금대기가 아니면 사라진다]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR15 — `배송준비 전까지 판매자 묶음 단위로 취소할 수 있습니다.`, 버튼 문구 `주문 취소`, 브랜드명으로 부르기, 날짜 형식]
- [Source: _bmad-output/planning-artifacts/epics.md#UX-DR16 — **모달 금지**(우편번호만 예외), 확인 후 실행, 스와이프·pull-to-refresh·**무한 스크롤 자동 로드 금지**, 뒤로가기는 브라우저 히스토리와 일치]
- [Source: ux-designs/ux-SLUR_platform_blueprint-2026-07-21/EXPERIENCE.md#State-Patterns#주문-상태 — **6단계 표와 각 상태에서 화면에 일어나는 일**, 입금대기만 액센트, 배송중에 송장 줄, 취소 표기 `[ASSUMPTION]`(D10이 확정), 대표 상태 `[ASSUMPTION]`(D3이 확정), 취소 가능 여부·하단 안내 문장]
- [Source: ux-designs/…/EXPERIENCE.md#Key-Flows#Flow-3 — **배송이 따로 갈 때**: 목록의 세 상태 색 층, 입금 안내가 사라진 상세, 토림도예 `배송준비` + 온실 `배송중` + 송장, 취소 버튼이 있는 묶음과 없는 묶음, 하단 안내 한 줄]
- [Source: ux-designs/…/EXPERIENCE.md#Component-Patterns — 판매자 묶음(주문상세는 각자의 상태·배송비·취소 버튼), 입금 안내 상자, 상태 라벨(면 없는 글자, 색+텍스트)]
- [Source: ux-designs/…/EXPERIENCE.md#Information-Architecture — 주문내역(제목만 헤더·탭바 있음) / 주문상세(뒤로가기+제목·탭바 없음)]
- [Source: ux-designs/…/EXPERIENCE.md#Responsive-&-Platform — ≥768 뒤로가기 없음·**주문상세는 `주문내역`이 활성**, 폭 변경 시 상태 유지]
- [Source: ux-designs/…/EXPERIENCE.md#Accessibility-Floor — 상태 라벨이 스크린리더에 상태로 전달, 44×44, 포커스 순서]
- [Source: ux-designs/…/DESIGN.md#Components#판매자-묶음-카드 — 주문상세는 헤더 우측 상태 라벨, 푸터에 `주문 취소`(취소 가능할 때만), 배송중이면 송장 줄]
- [Source: ux-designs/…/DESIGN.md#Components#입금-안내-상자 — detail 변형(`accent-wash` 면·1px `accent-line`·금액 20px·최상단)과 **두 변형을 유지하는 근거**("다시 들어왔을 때의 상기라서 조용히 얹혀야 한다")]
- [Source: ux-designs/…/DESIGN.md#Components#배지-·-상태-라벨 — 11.5px/800/.05em, 입금대기 액센트 / 배송중·결제완료·배송준비 먹색 / 배송완료·취소 흐린색]
- [Source: ux-designs/…/DESIGN.md#Components#버튼 — cancel 변형(11.5px/700·1px `field-border`·흰 면·3px 라운드), **취소에 빨강을 쓰지 않는다**]
- [Source: ux-designs/…/DESIGN.md#Layout-&-Spacing#반응형 — **끝까지 한 단으로 두는 화면: 주문내역·주문상세(최대 640px)**]
- [Source: ux-designs/…/DESIGN.md#Elevation-&-Depth · #Shapes — 그림자 금지, 3px(송장 줄·취소 버튼) · 5px(입금 안내 상자)]
- [Source: ux-designs/….working/screens-4-orders.html — 주문내역·주문상세 확정 시안: `.oitem`(날짜·상태·주문번호·상품명·브랜드 나열·금액) · `.olist-end` · `.od-head` · `.paybox`(20px 금액) · `.pack`/`.pack-foot`/`.btn-cancel` · `.track`(송장 줄) · `.no-cancel` · `.sum-r`/`.sum-total`/`.pay-way`(**결제 정보 3행 + 결제수단**) · 하단 `notice`, 그리고 **배송중 묶음 상태 예시 조각**(송장 등장 + 취소 버튼 소멸). **단, 상품 사진·주문번호 형식·`예금주` 줄은 API가 이긴다** (위험 1·6·7)]
- [Source: architecture/architecture-SLUR_platform_blueprint-2026-07-15/ARCHITECTURE-SPINE.md#AD-1 — FastAPI가 유일한 문지기, 미들웨어·쿠키는 판정이 아니다]
- [Source: …#AD-3 — **주문 상태 기계는 3층**(orders 결제 / sub_orders 배송 / order_items 취소), 전이표 + 단일 통로, 층을 넘는 가드도 같은 모듈]
- [Source: …#AD-6 — **취소 단위는 판매자 묶음(sub_order)**, 라인 단위 부분 취소는 관리자만, **대표 상태는 컬럼이 아니라 파생**]
- [Source: …#AD-7 — 주문 라인은 스냅샷, 조회 화면은 스냅샷만 읽는다]
- [Source: …#AD-8 — 상태값은 영어 enum, 한국어 표시 문언은 클라이언트 표현 계층]
- [Source: …#AD-12 — **파생 값은 백엔드가 계산해 내려준다**(대표 상태·금액 합계·`cancellable`·`expired`). 클라이언트는 파생 로직을 구현하지 않는다]
- [Source: …#AD-13 — SLUR 고유 값 하드코딩 금지: 입금 계좌·페이지 크기·미입금 기한은 settings]
- [Source: …#AD-14 — 클라이언트 표면 단일화, 동일 BFF 경로, **DESIGN/EXPERIENCE가 목업을 이긴다**]
- [Source: implementation-artifacts/4-3-order-state-engine.md — 전이표·paid 연쇄(입금 확인 시 활성 묶음이 preparing으로), `invalid_transition` message 원문]
- [Source: implementation-artifacts/4-6-buyer-cancel.md — **취소 API 계약**: 본문 없는 POST 허용(리뷰 F7), `{canceled_items, order_canceled}`, code별 반응 표(`invalid_transition` message 그대로 / `not_found` 목록 복귀), 소유 검증 404, 재고 복원 1회]
- [Source: implementation-artifacts/5-1-buyer-order-history.md — **대표 상태 파생 표(단일 소스)**, 금액 파생(활성 라인만·과입금 방지), `deposit_info` 객체 존재로만 분기, `order_no` 8자리, 리뷰 교훈(offset 중복·전-취소 표시 금액·`expired`·페이지 상한)]
- [Source: implementation-artifacts/8-1-buyer-web-shell.md — D1(토큰 스코프)·D4(먹색 포커스 링)·D5(`m_read` 640px·CSS만으로 폭 전환), `<SellerPack>`·`<StatusLabel>`·`<AmountSummary>` 뼈대, 위험 9(경로 경합), 미실행 검증의 기록 규약]
- [Source: implementation-artifacts/8-4-cart-web.md — **D7(인라인 확인 줄 `.b_confirm_row` — 8.6이 쓴다)**·D6(성공에만 재조회·오류 문장 분리)·D10(2단·고정 바는 CSS만)·D11(BFF와 Origin 검사), 학습 12(svg stroke-width 전역 규칙)]
- [Source: implementation-artifacts/8-5-checkout-web.md — D3(주문완료는 재조회)·D4(라우트·BFF 파일 배치와 경로 경합)·**D10(`Asia/Seoul` 고정 포맷)**·**D11(`deposit-box.tsx`는 공용, 8.6이 detail을 더한다)**·D13(BFF 세 라우트), 위험 1·2·6]
- [Source: implementation-artifacts/deferred-work.md#Deferred-from-Epic-8 — 입금 계좌 단일 문자열(오픈 게이트), `order_no` 표기, `middleware.ts` deprecated, CSP 부재]
- [Source: implementation-artifacts/sprint-status.yaml#action_items — R3·R6·R7·R8·A-E456-5]
- [Source: apps/api/app/orders/router.py — `GET /orders`(page 1~10000) · `GET /orders/{id}` · `POST /orders/sub-orders/{id}/cancel` (읽기만)]
- [Source: apps/api/app/orders/schemas.py — `OrderCard`·`OrderListResponse`·`OrderSubView`·`OrderLineView`·`DepositInfo`·`OrderDetailResponse`·`SubOrderCancelResponse`의 정확한 필드 (읽기만)]
- [Source: apps/api/app/orders/service.py — `derive_sub_status`·`derive_order_status`(대표 상태 방향)·`_amounts`/`_display_amounts`(활성 라인 기준·전-취소 폴백)·`cancellable` 파생·`_order_no` (읽기만)]
- [Source: apps/api/app/orders/transitions.py — 상태 상수(`preparing`·`shipping`·`delivered`·`confirmed`), buyer 취소 가드 message 원문 (읽기만)]
- [Source: apps/web/app/(buyer)/cart/cart-view.tsx · cart-pack.tsx — effect 안 async IIFE + `alive` 가드, `result` 한 벌로 로딩 파생, `rowError` 분리, 인라인 확인 줄의 포커스 이동·`Esc` 복귀 (관례의 정본)]
- [Source: apps/web/app/(buyer)/status-label.tsx · seller-pack.tsx · amount-summary.tsx · buyer-feedback.tsx · buyer-shell.tsx — 재사용 대상의 현재 시그니처]
- [Source: apps/web/app/(buyer)/buyer.css · styles/buyer/type.css · tokens.css — `.b_confirm_row`·`.b_seller_pack`·`.b_amount_summary`·`.b_status_label`·`.b_deposit_amount`(27px)·`--b-strike-line` 등 실제 선언]
- [Source: apps/web/lib/auth.ts — `proxyWithRefresh`(401 시 쿠키 정리·회전)·`assertSameOrigin` (import만, 수정 금지)]
- [Source: apps/web/AGENTS.md — Next 16은 학습 데이터와 다르다. `node_modules/next/dist/docs/`를 먼저 읽는다]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Claude Code)

### Debug Log References

- 스크래치패드 스텁(저장소 밖, 종료함): `scratchpad/s86/stub-api.mjs` — `GET /api/v1/orders?page=n`(페이지 크기 3, total 8) · `GET /api/v1/orders/{id}` · `POST /api/v1/orders/sub-orders/{id}/cancel`을 흉내 낸다. 취소는 **상태를 실제로 바꾸고** 백엔드의 파생(활성 라인만 합산 · 활성 라인이 없는 묶음은 배송비도 제외 · 전-취소 주문만 원 주문 금액 폴백 · `deposit_info.grand_total`은 잔여 활성분)을 축약 재현한다.
  - `sub_order_id` 접두사로 실패 경로를 만든다: `aaaa…` 성공 / `bbbb…` `invalid_transition` 422 / `cccc…` `not_found` 404.
  - 8개 시나리오 주문: ① 입금대기 2묶음(둘 다 `cancellable`, `deposit_info`) ② Flow 3(`preparing` 취소불가 + `shipping` 송장) ③ 배송완료 ④ 전체 취소 ⑤ 부분 취소(라인 혼재 + 취소된 묶음) ⑥ `expired: true` ⑦ 빈 목록(제어 엔드포인트로 토글) ⑧ `total(8) > 페이지 크기(3)`.
- 실행: `API_BASE_URL=http://localhost:8099 npx next dev -p 3186` + 헤드리스 크롬 CDP(`Emulation.setDeviceMetricsOverride`로 폭 강제 — 헤드리스는 창 폭 최소 500px을 강제한다, 8.1의 학습). 미들웨어 통과용 `slur_role` 쿠키는 `Network.setCookie`로 심었다.
- 스텁·개발 서버·크롬은 검증 후 전부 종료했고 **저장소에 남기지 않았다**(`git status`에 스크래치패드 파일 0건).

### Completion Notes List

**빌드·정적 검증 (Task 8)**
- `npx tsc --noEmit` → 0
- `npm run lint` → **0 errors · 0 warnings** (A-E456-5 베이스라인 유지)
- `npx next build` → 성공. 라우트 목록에 `/orders`(○) · **`/orders/[id]`(ƒ)** · **`/orders/complete`(○)** 가 **셋 다** 나온다 — 경로 경합 없음(정적이 동적을 이긴다). `/api/orders/sub-orders/[id]/cancel`(ƒ)도 등록됐다.
- `grep -rn "#2f6bff|--color-brand|--shadow-|box-shadow|matchMedia|innerWidth|resize" app/(buyer)/orders` → 7건 전부 **주석**(금지 사실을 적어 둔 줄). 선언 0건. 새 CSS 두 파일에 hex 리터럴 0건.
- `git diff --stat`: `apps/api` **0건** · `apps/mobile` **0건** · `app/styles/slur/` **0건** · `app/styles/buyer/` **0건** · `package.json`·`package-lock.json` **0건** · `lib/auth.ts` **0줄**. 마이그레이션 0건, 신규 백엔드 엔드포인트 0개.
- `cd apps/api && uv run pytest -q` → **미실행.** 이 머신에 `uv`·`docker`가 없어 로컬 백엔드를 띄울 수 없다. 통과했다고 쓰지 않는다. 백엔드 무변경은 `git diff --stat`의 `apps/api` 0건으로만 주장한다.

**화면 검증 (Task 9·10 — 실렌더)**
- 폭 **390 / 700 / 768 / 1280** 네 폭에서 두 화면 렌더. 두 화면 모두 **본문 폭 640px 한 단**이 유지되고(1280에서도 `.b_orders`·`.b_order_detail` 폭 = 640) `scrollWidth == 뷰포트 폭`(가로 스크롤 0). 2단·하단 고정 CTA 바 없음.
- `<768`: `/orders`에 탭바가 서고(`display: flex`) `/orders/[id]`에는 탭바가 **없다**. `≥768`: 둘 다 상단 내비로 바뀌고 **`주문내역`이 활성**(`data-active="true"`), 상세의 뒤로가기는 사라진다.
- 목록: 날짜(`2026.07.21`) · 대표 상태 · 주문번호(`A1B2C3D4` 원문) · 대표 상품명 · 브랜드 나열(`토림도예 · 온실`) · 총액. 행 높이 161~162px(44px 크게 상회). 행 전체가 링크.
  - 🚨 `created_at: 2026-06-28T23:40:00Z` → `2026.06.29`로 표시된다 — `Asia/Seoul` 고정이 실제로 하루 어긋남을 막고 있음을 확인.
- `더 보기`: 3 → 6 → 8건 누적 후 `최근 주문부터 보입니다.`로 바뀐다. **390 ↔ 1280 폭 전환 후에도 누적 8건이 유지**(AC 17). 빈 목록은 `아직 주문이 없습니다.` + `쇼핑 계속하기`.
- 상세 ①: 입금 안내 `detail` 변형(accent-wash 면 · 1px accent-line · 5px 라운드 · **금액 20px**, 계산된 `font-size: 20px` 확인) — 주문번호 바로 아래 최상단. 배송 정보 4행(빈 값은 `—`). 결제 정보 **3행 + `결제수단 · 무통장입금`**, 합계 20px 액센트(도서산간 줄 없음). 하단 안내 문장 항상 표시.
- 상세 ② Flow 3: 토림도예 `배송준비`(버튼 없음 + `배송준비 이후에는 취소할 수 없습니다.`) + 온실 `배송중`(송장 줄 `CJ대한통운 1234-5678-9012`, `<a>` 0개 — 링크 아님). 입금 안내 상자 사라짐. 배송비 `6,000원`(기본 3,000 + 도서산간 3,000).
- 상세 ④ 전체 취소: 두 묶음 다 `취소` 라벨, 라인 금액과 **묶음 배송비에 취소선**(`48,000원`·`배송비 3,000원`·`48,000원`·`배송비 2,500원`), 취소 버튼 0개 · 안내 문장 0개.
- 상세 ⑤ 부분 취소: 한 묶음 안에서 `ordered` 라인은 그대로, `canceled` 라인만 취소선 + `취소` 태그(숨기지 않음). 다른 묶음은 통째로 `취소`.
- 상세 ⑥: `기한이 지나 곧 자동 취소됩니다.` 표시.
- 그레이스케일 렌더에서도 `입금대기`·`배송중`·`배송완료`가 **텍스트만으로** 구분된다 (UX-DR8).
- 키보드: Tab 순서가 로고 → 상단 내비 4 → 주문 행들 / 상세는 → `주문 취소`까지 도달하고 **모든 컨트롤에 먹색 2px outline**(`rgb(31,29,26)`), `box-shadow: none`. 파랑 **0건**(구매자 두 화면 전체를 계산 스타일로 훑어 0).

**취소 경로 (Task 6·10 — 이 스토리의 핵심)**
- 확인 줄: `주문 취소` 자리가 `이 묶음을 취소할까요? · 취소하기 · 아니요`로 바뀌고 `role="group"` + `aria-label="토림도예 묶음 주문 취소 확인"`. 열리면 포커스가 `취소하기`로 옮겨가고, `Esc`·`아니요`로 닫으면 **원래 `주문 취소` 버튼으로 포커스 복귀**. 다른 묶음의 버튼을 누르면 이전 확인 줄이 닫힌다(**한 번에 하나**). 모달·`window.confirm` 0건.
- 성공: **그 묶음만** `취소`로 바뀌고 다른 묶음은 `입금대기` 그대로. 합계·상품 금액·배송비·`deposit_info` 금액이 전부 **서버 재조회 값**으로 갱신(121,000 → 54,000). 취소된 묶음의 라인 금액·배송비에 취소선. 남은 취소 버튼 1개. **skeleton으로 되돌아가지 않음.**
- `invalid_transition`: `배송준비가 시작된 주문은 직접 취소할 수 없습니다. 관리자에게 문의해 주세요.` 를 **문장 그대로** 그 묶음 자리에 표시하고 상세를 재조회했으며, **재조회 후에도 문장이 남아 있다**(D8의 `packError` 분리가 작동). 폭을 1280으로 바꿔도 문장이 살아 있다.
- `not_found`: `주문을 찾을 수 없습니다.` + `주문내역 보기`(→ `/orders`).
- 비UUID(`/orders/not-a-uuid`)·없는 주문 → 빈 화면이 아니라 `주문을 찾을 수 없습니다.` + `주문내역 보기`.
- **HTTP 코드·`code` 문자열이 화면 어디에도 없다** — `document.body.innerText`에 `422`·`invalid_transition`·`not_found`·`unauthorized` 전부 0건.

**판매자·관리자 회귀 (Task 12)**
- `/admin/orders`·`/seller`에 `[data-surface="buyer"]`가 **새지 않는다**. 관리자 컨트롤의 **파랑 포커스 링**(`rgba(47,107,255,.3) box-shadow`)이 그대로다 — 구매자 먹색 링과 분리된 채 공존.

**미실행 · 사람이 해야 할 일**
- **Task 11(프로덕션 R3·R8) 미실행.** 커밋·푸시가 이 작업의 범위 밖이라 배포가 없었다. **취소 BFF는 `assertSameOrigin`을 타는 신규 POST**이므로 Railway 프록시 뒤 실요청 1회 확인이 남아 있다(R3). 프로덕션에서 취소를 실행한 적이 **없으므로 정리할 테스트 데이터도 없다**(R8).
- **백엔드 테스트 153건 미실행** (사유는 위 Task 8 항목).

**스토리와 어긋난 지점 · 알게 된 것**
1. ~~**D11의 `formatPhone` 10자리 규칙이 02 지역번호를 잘못 끊는다.** … 명세대로 구현했고 바꾸지 않았다.~~
   → **[2026-07-22 해소] D11의 이 규칙은 폐기됐다.** 구현 직후 검토에서 "출력이 객관적으로 틀렸다"로 판정해 커밋 `a12606b`에서 고쳤다. 현재 `apps/web/app/(buyer)/format.ts`는 `digits.startsWith("02") ? 2 : 3`으로 지역번호 자릿수를 분기한다 — 서울만 두 자리다. 검증: `010-2847-3391` · `02-1234-5678` · `02-123-4567` · `031-234-5678`.
   **D11 본문은 당시 판단의 기록으로 남기되, 코드의 정본은 `format.ts`다.** 스토리를 처음 읽는 사람이 코드와 반대되는 사실을 읽지 않도록 여기에 표시한다.
2. **위험 3(EXPERIENCE의 "결제완료 이후에도 취소 가능")은 여전히 참이 아니다.** 화면은 `cancellable`만 보므로 동작은 정확하지만, 실제 취소 창은 `입금대기` 동안뿐이다. 화면 문구(`배송준비 전까지…`)는 FR-18의 표현이라 그대로 뒀다. **Slur가 알아야 할 UX 계약 ↔ 백엔드 동작의 어긋남**이며 해소는 Epic 8 밖이다.
3. **송장 줄의 자리.** `<SellerPack>`에 상품 행과 푸터 사이 슬롯이 없어 송장 줄이 목업(푸터 위)과 달리 **푸터 hairline 아래** 맨 위에 선다. 스토리 Task 5가 지시한 처리(`foot` 안에 세로로 쌓기)를 그대로 따랐고 prop을 새로 파지 않았다. 시각적으로는 구분선 한 줄 차이다.
4. **주문상세에서만 `.b_seller_pack .i_foot`을 `display: block`으로 되돌렸다**(`detail.css` 안, 이 화면 스코프). 푸터에 송장 줄·안내 문장·오류 문장이 세로로 쌓여야 하는데 8.1의 한 줄 flex로는 불가능했다. `seller-pack.tsx`는 한 줄도 고치지 않았다.
5. **입금 안내 `detail` 변형은 마크업을 공유하려고 상자를 2열 그리드로 뒀다.** 금액 라벨과 금액이 한 줄에 서야 하는데 8.5의 마크업이 둘을 형제로 쌓아 두었기 때문이다. `placed` 변형의 시각은 한 픽셀도 바뀌지 않는다(`m_detail`에만 걸린 규칙).

### File List

**신설**
- `apps/web/app/api/orders/sub-orders/[id]/cancel/route.ts` — 취소 BFF(POST, `assertSameOrigin` + UUID 검사, 본문 없이 프록시)
- `apps/web/app/(buyer)/orders/orders-view.tsx` — 주문내역 본체
- `apps/web/app/(buyer)/orders/order-status.ts` — D1의 표(`display_status` → `{label, tone}`)
- `apps/web/app/(buyer)/orders/orders.css` — 목록 전용 배치
- `apps/web/app/(buyer)/orders/[id]/page.tsx` — 주문상세 라우트(셸 + `await params`)
- `apps/web/app/(buyer)/orders/[id]/order-detail-view.tsx` — 상세 본체(조회·취소·오류 소유)
- `apps/web/app/(buyer)/orders/[id]/order-pack.tsx` — 묶음 하나(상태·송장·배송비·취소·확인 줄)
- `apps/web/app/(buyer)/orders/[id]/detail.css` — 상세 전용 배치

**수정**
- `apps/web/app/api/orders/route.ts` — 기존 POST 옆에 **`GET` export 추가**(page 정수 1~10000 검증)
- `apps/web/app/(buyer)/orders/page.tsx` — 자리표시 → 목록(셸 호출 세 값 유지)
- `apps/web/app/(buyer)/orders-api.ts` — `listOrders`·`cancelSubOrder` + 목록·상세·취소 응답 타입(기존 `request` 헬퍼 재사용)
- `apps/web/app/(buyer)/format.ts` — `formatOrderDate`·`formatOrderDateTime`·`formatPhone`(`Asia/Seoul` 고정 파트 추출 공용화)
- `apps/web/app/(buyer)/deposit-box.tsx` — `variant`에 `"detail"` 추가(복제 없음)
- `apps/web/app/(buyer)/buyer.css` — `.b_deposit_box.m_detail` · `.b_kv_row` · `.b_track` · `.m_struck` · `.b_tag.m_canceled` · `.b_btn_cancel` · `.b_sr`

**수정하지 않음(계약)**: `apps/api/**` · `apps/mobile/**` · `app/styles/slur/**` · `app/styles/buyer/**` · `lib/auth.ts` · `seller-pack.tsx` · `status-label.tsx` · `amount-summary.tsx` · `cart/**` · `checkout/**` · `middleware.ts` · `package.json`

### Change Log

| 날짜 | 변경 | 비고 |
|---|---|---|
| 2026-07-22 | Story 8.6 구현 — 주문내역·주문상세·묶음 취소 | Task 0~10·12 완료, Task 11(프로덕션 R3·R8) 미실행. tsc 0 / lint 0 errors 0 warnings / build 성공. 390·700·768·1280 실렌더 검증, 스크래치패드 스텁 8시나리오 |
