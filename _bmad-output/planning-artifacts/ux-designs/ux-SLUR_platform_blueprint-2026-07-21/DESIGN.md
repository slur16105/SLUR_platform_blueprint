---
name: SLUR 구매자 웹
description: 큐레이션 편집숍의 구매자 표면. 종이빛 지면 위 먹색 활자, 브랜드명이 상품명보다 먼저 읽히는 매거진 위계. 색으로 소리치지 않는다.
status: draft
updated: 2026-07-21
sources:
  - .memlog.md (톤 B 확정 · 하단 탭 이식 · 브랜드 파랑 배제 · IA 규칙)
  - .working/B-SPEC.md
  - .working/direction-b-editorial.html (색 hex 정본)
  - .working/screens-1-browse.html · screens-2-account.html · screens-3-checkout.html · screens-4-orders.html
  - apps/web/app/styles/slur/ (상속하는 기존 슬러 시스템)
colors:
  paper: '#faf8f4'
  paper-shade: '#f2eee6'
  ink: '#1f1d1a'
  ink-strong: '#2c2a26'
  ink-body: '#3c3934'
  ink-prose: '#4d4942'
  ink-secondary: '#6a645c'
  ink-quiet: '#7d7a75'
  ink-label: '#8e8b85'
  ink-muted: '#9c968c'
  hairline: '#e3ded4'
  accent: '#8c4a32'
  accent-soft: '#f1e5df'
  accent-wash: '#faf1ec'
  accent-line: '#ecd9d0'
  field-surface: '#ffffff'
  field-border: '#ded8cc'
  field-error-surface: '#fdf7f4'
  field-placeholder: '#b3ada3'
  disabled-surface: '#f2eee6'
  disabled-border: '#e8e3da'
  disabled-ink: '#ada79d'
  strike-line: '#c9c3b9'
  kakao: '#fee500'
typography:
  font-family: '"Pretendard Variable", "Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", system-ui, sans-serif'
  logo:
    fontSize: 19px
    fontWeight: 800
    letterSpacing: .22em
  brand-label:
    fontSize: 11px
    fontWeight: 800
    letterSpacing: .15em
    note: '이 시스템의 지문. 목록 카드 11px/.15em · 묶음 헤더 10.5px/.14em · 상품상세 11.5px/.17em'
  eyebrow:
    fontSize: 10px
    fontWeight: 800
    letterSpacing: .2em
  section-label:
    fontSize: 10.5px
    fontWeight: 800
    letterSpacing: .16em
  display:
    fontSize: 25px
    fontWeight: 800
    letterSpacing: -0.03em
    lineHeight: 1.32
  title:
    fontSize: 23px
    fontWeight: 800
    letterSpacing: -0.03em
    lineHeight: 1.3
  title-sm:
    fontSize: 20px
    fontWeight: 800
    letterSpacing: -0.025em
    lineHeight: 1.4
  topbar-title:
    fontSize: 15px
    fontWeight: 700
    letterSpacing: .02em
  price-hero:
    fontSize: 20px
    fontWeight: 800
    letterSpacing: -0.02em
  price-total:
    fontSize: 21px
    fontWeight: 800
    letterSpacing: -0.02em
  price-item:
    fontSize: 14px
    fontWeight: 800
    letterSpacing: -0.02em
  price-card:
    fontSize: 13px
    fontWeight: 800
  deposit-amount:
    fontSize: 27px
    fontWeight: 800
    letterSpacing: -0.03em
  product-name-card:
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.4
  product-name-row:
    fontSize: 13px
    fontWeight: 600
  body:
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.85
  control:
    fontSize: 12.5px
    fontWeight: 600
  input:
    fontSize: 13.5px
    fontWeight: 400
  meta:
    fontSize: 11.5px
    fontWeight: 400
  status-label:
    fontSize: 11.5px
    fontWeight: 800
    letterSpacing: .05em
  notice:
    fontSize: 11px
    fontWeight: 400
    lineHeight: 1.75
  tab-label:
    fontSize: 10.5px
    fontWeight: 600
    note: '활성 탭은 800'
  button:
    fontSize: 14px
    fontWeight: 700
    letterSpacing: -0.01em
  tag:
    fontSize: 9.5px
    fontWeight: 700
    letterSpacing: .09em
rounded:
  xs: 2px
  sm: 3px
  DEFAULT: 4px
  md: 5px
  full: 999px
spacing:
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  '5': 20px
  '6': 24px
  '7': 32px
  gutter: 20px
  section-y: 22px
  band: 8px
  grid-gap-x: 14px
  grid-gap-y: 26px
  topbar-h: 54px
  tabbar-h: 56px
  cta-bar-y: 13px
  cta-bar-bottom: 20px
components:
  topbar:
    height: '{spacing.topbar-h}'
    background: '{colors.paper}'
    borderBottom: '1px solid {colors.hairline}'
    paddingX: '{spacing.gutter}'
    title: '{typography.topbar-title}'
  tabbar:
    height: '{spacing.tabbar-h}'
    background: '{colors.paper}'
    borderTop: '1px solid {colors.hairline}'
    label: '{typography.tab-label}'
    inactive: '{colors.ink-muted}'
    active: '{colors.ink}'
    iconSize: 22px
    iconStroke: '1.4px / 활성 1.9px'
  cta-bar:
    background: '{colors.paper}'
    borderTop: '1px solid {colors.hairline}'
    padding: '{spacing.cta-bar-y} {spacing.gutter} {spacing.cta-bar-bottom}'
    gap: 9px
  button-solid:
    background: '{colors.ink}'
    color: '{colors.paper}'
    paddingY: 15px
    radius: '{rounded.DEFAULT}'
    font: '{typography.button}'
  button-ghost:
    border: '1.4px solid {colors.ink}'
    color: '{colors.ink}'
    radius: '{rounded.DEFAULT}'
    font: '{typography.button}'
  button-kakao:
    background: '{colors.kakao}'
    color: '{colors.ink}'
    radius: '{rounded.DEFAULT}'
  product-card:
    imageRadius: '{rounded.DEFAULT}'
    brand: '{typography.brand-label}'
    name: '{typography.product-name-card}'
    nameColor: '#605b53'
    price: '{typography.price-card}'
    priceColor: '{colors.ink}'
    soldOutFilter: 'saturate(.45) brightness(1.04)'
  brand-label:
    font: '{typography.brand-label}'
    color: '{colors.ink}'
  option-chip:
    font: '{typography.control}'
    border: '1px solid {colors.field-border}'
    background: '{colors.field-surface}'
    padding: '8px 15px'
    radius: '{rounded.DEFAULT}'
    selectedBackground: '{colors.ink}'
    selectedColor: '{colors.paper}'
    disabledBackground: '{colors.disabled-surface}'
    disabledColor: '{colors.disabled-ink}'
  category-chip:
    font: '{typography.control}'
    border: '1px solid {colors.field-border}'
    radius: '{rounded.full}'
    padding: '6px 13px'
    selectedBackground: '{colors.ink}'
  seller-pack:
    paddingY: 18px
    paddingX: '{spacing.gutter}'
    dividerTop: '1px solid {colors.hairline}'
    footDivider: '1px solid #efeae1'
  amount-summary:
    rowFont: '{typography.control}'
    totalLabel: '{typography.control}'
    totalValue: '{typography.price-total}'
    totalColor: '{colors.accent}'
    totalDivider: '1px solid {colors.hairline}'
  deposit-box:
    variantPlaced: 'border 1.5px solid {colors.accent} · background {colors.paper} · 노치 캡션'
    variantDetail: 'border 1px solid {colors.accent-line} · background {colors.accent-wash}'
    radius: '{rounded.md}'
    amount: '{typography.deposit-amount}'
    amountColor: '{colors.accent}'
  input:
    height: 46px
    border: '1px solid {colors.field-border}'
    background: '{colors.field-surface}'
    radius: '{rounded.DEFAULT}'
    font: '{typography.input}'
    placeholder: '{colors.field-placeholder}'
    errorBorder: '{colors.accent}'
    errorBackground: '{colors.field-error-surface}'
  checkbox:
    size: 16px
    radius: '{rounded.sm}'
    checkedBackground: '{colors.ink}'
    uncheckedBorder: '#d5cfc4'
  status-label:
    font: '{typography.status-label}'
    waiting: '{colors.accent}'
    moving: '{colors.ink}'
    finished: '{colors.ink-muted}'
  count-badge:
    background: '{colors.accent}'
    color: '{colors.paper}'
    size: 16px
    radius: '{rounded.full}'
    ring: '1.5px solid {colors.paper}'
  tag:
    font: '{typography.tag}'
    soldOut: 'background {colors.ink} · color {colors.paper}'
    unavailable: 'background {colors.accent-soft} · color {colors.accent}'
    radius: '{rounded.xs}'
  notice:
    font: '{typography.notice}'
    color: '{colors.ink-quiet}'
    dividerTop: '1px solid {colors.hairline}'
---

# SLUR 구매자 웹 — DESIGN.md

시각 계약. 동작 계약은 [EXPERIENCE.md](./EXPERIENCE.md)에 있다.
목업: [탐색 3화면](./.working/screens-1-browse.html) · [계정 3화면](./.working/screens-2-account.html) · [주문 진행 2화면](./.working/screens-3-checkout.html) · [주문 조회 2화면](./.working/screens-4-orders.html) · [원본 시안 B](./.working/direction-b-editorial.html)

## Brand & Style

SLUR는 운영자가 판매자를 직접 골라 초청하는 편집숍이다. 화면이 해야 할 일은 물건을 파는 소리를 내는 것이 아니라, 골라온 물건을 잘 놓아 보이게 하는 것이다. 그래서 이 시스템은 상점이 아니라 **지면**을 흉내 낸다. 종이빛 바탕에 먹색 활자, 여백은 넉넉하게, 색은 거의 쓰지 않는다.

세 시안(갤러리·매거진·상점)을 놓고 고른 결과가 B·매거진이다. 갤러리는 아름다웠지만 6개 품목을 한 화면에 못 담았고, 상점은 밀도가 좋았지만 편집숍의 얼굴로 브랜드 파랑이 맞지 않았다. 매거진은 둘 사이에서, 지면의 위계를 유지하면서 스크롤 한 번에 여섯 품목을 보여준다.

이 지면의 지문은 하나다. **브랜드명이 상품명보다 먼저, 더 굵게, 자간을 벌려 읽힌다.** 상품명은 그 아래에서 물러난 회색으로 앉고, 금액이 다시 먹색으로 선다. 큐레이션형 마켓플레이스에서 구매자가 먼저 사는 것은 "누가 만들었는가"이기 때문이다.

할인율·별점·리뷰 수·타이머·"BEST" 리본 — 커머스가 관습적으로 쌓아 올리는 장치는 이 지면에 없다. v1 기능 목록에 없기 때문이기도 하고, 있었더라도 이 톤이 감당하지 않았을 것이기 때문이기도 하다.

## Colors

팔레트는 여덟 색이다. 종이 두 겹, 먹 네 단계, 선 하나, 액센트 둘.

- **종이 `#faf8f4`** — 모든 화면의 바탕. 순백이 아니라 약간 노란 오프화이트다. 흰 화면 위에 놓인 상품 사진보다, 종이 위에 놓인 상품 사진이 편집숍처럼 보인다.
- **종이 그늘 `#f2eee6`** — 면과 면 사이를 가르는 8px 띠(`{spacing.band}`)와 보조 면(입금 안내 메모, 송장 줄, 비활성 옵션 면). 이 시스템은 섹션을 카드로 띄우지 않고 **종이를 접어서** 나눈다.
- **먹색 `#1f1d1a`** — 본문 최상위, 로고, 브랜드 라벨, 활성 탭, 채움 버튼의 면. 순흑이 아니라 갈색이 섞인 먹이라 종이와 같은 온도에 있다.
- **보조 먹색 `#2c2a26` · `#3c3934` · `#4d4942` · `#6a645c`** — 본문 강도의 층. 값을 새로 만들지 말고 이 넷 안에서 고른다.
- **흐린 텍스트 `#9c968c` · 라벨 `#8e8b85` · 조용한 `#7d7a75`** — 캡션, 날짜, 필드 라벨, 비활성 탭, 완료된 상태. 읽히되 먼저 읽히지는 않아야 하는 것들.
- **선 `#e3ded4`** — 유일한 구획선. 1px hairline. 두꺼워지는 순간 UI가 되고 지면이 아니게 된다.
- **액센트 벽돌빛 `#8c4a32`** — 이 지면의 유일한 유채색. **링크·선택 상태·가격 강조·경고**에만 쓴다. 실제 사용처는 여섯 곳뿐이다: 상품상세 가격, 결제 예정 금액·합계, 입금 안내 상자와 입금대기 상태 라벨, 장바구니 구매 불가 안내, 폼 오류, 개수 배지. 면으로 넓게 깔지 않는다 — 테두리와 글자에만 얹는다.
- **연한 벽돌 `#f1e5df` / 물 `#faf1ec` / 선 `#ecd9d0`** — 액센트를 면으로 써야 할 때의 최저 농도. 태그 배경, 입금 안내 배경, 구매 불가 안내 배경.

폼 계열은 지면 위에 얹히는 **흰 종이**로 구분한다: 필드 면 `#ffffff`, 테두리 `#ded8cc`, placeholder `#b3ada3`, 오류 면 `#fdf7f4`.

예외 색은 하나뿐이다. **카카오 노랑 `#fee500`** — 로그인 화면의 `카카오로 시작하기` 버튼. 카카오 브랜드 규정이 색을 지정하므로 팔레트 밖이지만 허용한다. 다른 어디에도 나타나지 않는다.

**브랜드 파랑 `#2f6bff`은 구매자 화면에 없다.** 기존 슬러 시스템의 파랑은 판매자·관리자 화면에 남는다. 한 코드베이스 안에서 구매자와 운영자의 색이 갈리는 것은 사고가 아니라 결정이다.

## Typography

한 벌만 쓴다. `Pretendard Variable` → `Pretendard` → `Apple SD Gothic Neo` → `Noto Sans KR` → `system-ui`. 명조를 섞지 않고, 굵기·크기·자간 대비만으로 층을 만든다. 기존 슬러 시스템의 `--font-sans`와 같은 스택이므로 판매자·관리자 화면과 글꼴은 공유하고 색만 갈린다.

**자간이 이 시스템의 문법이다.** 넓힌 자간은 라벨(작고 굵고 벌어진 것), 좁힌 자간은 제목(크고 굵고 조인 것). 그 사이의 본문은 기본 `-0.01em`.

| 역할 | 값 | 쓰는 곳 |
|---|---|---|
| `{typography.logo}` | 19px / 800 / `.22em` | 상단바의 `SLUR` |
| `{typography.brand-label}` | **11px / 800 / `.15em`** | 상품 카드·장바구니 묶음·주문 묶음의 브랜드명 |
| `{typography.eyebrow}` | 10px / 800 / `.2em` / 액센트 | `큐레이션`, `계정` |
| `{typography.section-label}` | 10.5px / 800 / `.16em` / `{colors.ink-label}` | `옵션 선택` `배송지` `결제 금액` `입금 안내` |
| `{typography.display}` | 25px / 800 / `-0.03em` | 상품목록의 큐레이션 문장 |
| `{typography.title}` | 23px / 800 / `-0.03em` | 상품명(상세) |
| `{typography.title-sm}` | 20px / 800 / `-0.025em` | `주문이 접수되었습니다`, 내 정보의 이름(24px 변형) |
| `{typography.body}` | 13px / 1.85 / `{colors.ink-prose}` | 상품 설명 |
| `{typography.meta}` | 11.5px / `{colors.ink-muted}` | 날짜, 옵션 요약, 필드 라벨 |
| `{typography.notice}` | 11px / 1.75 / `{colors.ink-quiet}` | 중개자 고지, 취소 안내 |

**`{typography.brand-label}`은 임의로 바꾸지 않는다.** 11px에서 800 굵기에 `.15em` 자간이라는 조합이 이 지면을 다른 커머스와 구분하는 유일한 지문이다. 문맥에 따라 10.5px/`.14em`(묶음 헤더)과 11.5px/`.17em`(상품상세)까지 흔들리지만, 굵기 800과 넓은 자간은 어디서도 놓지 않는다.

금액은 항상 `font-variant-numeric: tabular-nums`. 세로로 쌓인 금액의 자릿수가 어긋나면 지면이 무너진다. 형식은 `121,000원` 고정.

## Layout & Spacing

**모바일 퍼스트.** 기준 폭은 390px, 화면 좌우 여백은 `{spacing.gutter}` 20px로 전 화면 고정이다. 섹션의 세로 여백은 `{spacing.section-y}` 22px.

스케일은 4 / 8 / 12 / 16 / 20 / 24 / 32px. 목업은 그 사이값(7·9·11·13px)을 자유롭게 쓰고 있으므로, 구현에서는 위 스케일로 정리하면서 1~2px 어긋나는 것을 허용한다.

**구획은 세 강도로만 나눈다.**
1. 아무것도 없음 — 같은 덩어리 안
2. 1px `{colors.hairline}` — 같은 화면 안 다른 항목 (장바구니 묶음 사이, 주문내역 행 사이)
3. 8px `{colors.paper-shade}` 띠 — 성격이 다른 면 사이 (주문서의 배송지 / 주문 상품 / 결제 금액 / 결제 수단)

상품목록은 **2열 리듬 그리드**다. 세로 간격 26px, 가로 간격 14px. 카드 이미지 높이를 품목마다 다르게 두어(160~216px) 두 열이 어긋나며 흐르게 한다 — 균일한 격자는 상점이고, 어긋난 격자가 지면이다.

고정 바의 높이 예산: 상단바 54px + 하단 탭바 56px. 하단 고정 CTA 바는 13px/20px 패딩에 버튼 높이 46px, 합계 약 79px. **CTA 바와 탭바를 겹쳐 쌓으면 112px을 먹는다** — 그래서 두 바가 같이 서는 화면은 장바구니 하나뿐이다(배치 규칙은 EXPERIENCE.md의 IA 절).

### 반응형 (2026-07-21 Slur 확정)

기존 슬러 시스템의 브레이크포인트(sm 640 / md 768 / lg 1024 / xl 1280)를 그대로 물려받는다.

**본문 최대 폭 1080px, 가운데 정렬.** 데스크톱에서 끝까지 펼치지 않는다 — 판매자 5~10팀·상품 수십 개 규모에서 4열 격자는 헐겁고, 지면의 밀도감이 흐려진다.

| | < 640 | 640 ~ 767 | ≥ 768 |
|---|---|---|---|
| 좌우 여백 `{spacing.gutter}` | 20px | 20px | 32px |
| 본문 최대 폭 | — | — | **1080px** (읽는 화면은 640px) |
| 상품목록 열 | **2열** | **3열** | **3열** (카드가 커진다) |
| 카드 간격 (세로/가로) | 26 / 14px | 26 / 14px | 36 / 20px |
| 내비 | 하단 탭바 56px | 하단 탭바 56px | **상단 내비** (탭바 제거) |
| 하단 고정 CTA 바 | 있음 | 있음 | **없음** — 우측 요약 칼럼 안 버튼으로 승격 |

**≥768에서 2단으로 갈라지는 화면 3개.** 좌측이 내용, 우측이 요약이며 우측은 `position: sticky`로 스크롤을 따라간다.

| 화면 | 좌 (약 62%) | 우 (약 34%, sticky) |
|---|---|---|
| 상품상세 | 이미지 갤러리 | 브랜드·상품명·가격·옵션 축·`장바구니 담기`/`바로 구매` |
| 장바구니 | 판매자 묶음 목록 | 금액 요약 + `주문하기 (N건)` |
| 주문서 | 배송지·요청사항·주문 상품·결제 수단 | 금액 요약 + `주문하기` |

상품상세의 **판매자 신원정보와 중개자 고지는 2단 아래 전체 폭**에 둔다 — 청약 전 노출 의무 항목이므로 우측 칼럼에 밀어 넣어 스크롤 밖으로 사라지게 하지 않는다.

**끝까지 한 단으로 두는 화면**: 주문내역 · 주문상세 · 내 정보 · 로그인 · 회원가입(최대 **640px**), 주문완료(최대 **560px**). 읽고 확인하는 화면이라 행 길이를 늘리면 오히려 읽기 어렵다. 2단으로 만들지 않는다.

**≥768에서만 hover 상태를 쓴다.** 그 아래는 포인터가 없으므로 hover에 정보를 담지 않는다.

## Elevation & Depth

**그림자를 쓰지 않는다.** 목업 파일의 `box-shadow`는 폰 프레임을 회색 배경 위에 띄우기 위한 목업 장치이며 제품 표면이 아니다.

깊이는 세 가지로만 만든다.

- **종이 접기** — `{colors.paper-shade}` 8px 띠. 카드를 띄우는 대신 종이를 접어 면을 나눈다.
- **hairline** — 1px `{colors.hairline}`.
- **테두리 상자** — 판매자 정보(`#f7f4ee` 면 + 1px 테두리), 입금 안내(액센트 테두리). 떠 있는 것이 아니라 지면에 인쇄된 상자다.

고정 상단바·탭바·CTA 바는 스크롤 콘텐츠 위에 얹히지만, 경계는 **1px 선**으로만 표시한다. 그림자로 띄우지 않는다. 기존 슬러 시스템의 `--shadow-*` 토큰은 구매자 화면에서 쓰지 않는다.

## Shapes

모서리는 거의 없다. 지면에 인쇄된 것에는 라운드가 없고, 손으로 누르는 것에만 최소한이 붙는다.

- `{rounded.xs}` 2px — 태그(`품절`, `구매 불가 · 품절`, `임시 정보`)
- `{rounded.sm}` 3px — 안내 상자(구매 불가 안내, 입금 메모, 송장 줄), 취소 버튼
- `{rounded.DEFAULT}` 4px — **기본값**. 버튼, 입력 필드, 옵션 칩, 사진 자리, 판매자 정보 상자
- `{rounded.md}` 5px — 입금 안내 상자 (이 화면에서 가장 무거운 요소이므로 1px만 더 부드럽다)
- `{rounded.full}` — 카테고리 칩과 개수 배지. **완전 원형은 이 둘에만**

상품 사진은 4px 라운드에 컨테이너를 정확히 따른다. 원형 크롭·비네트·오버레이 그라디언트를 얹지 않는다.

## Components

값은 전부 확정 목업에서 읽은 것이다.

### 상단바 `{components.topbar}`
54px 고정. 종이 배경, 하단 1px hairline, 좌우 20px. 세 형태가 있다.
- **로고형** — `SLUR` 좌측 + 장바구니 아이콘(배지) 우측. 상품목록.
- **로고 중앙형** — `SLUR` 중앙만. 로그인, 주문완료.
- **제목형** — 뒤로가기(22px 셰브런) + 제목 15px/700 + 우측 22px 빈 자리(광학 중앙 정렬). 회원가입·주문서·주문상세·장바구니.
- **제목만** — 좌측 정렬 제목. 주문내역. `[ASSUMPTION]` 내 정보는 중앙 정렬 제목이라 최상위 두 화면의 제목 정렬이 갈린다 — 좌측 정렬로 통일 권장.

### 하단 탭바 `{components.tabbar}`
56px, 4탭 균등. 배경 `{colors.paper}`, 상단 1px `{colors.hairline}`. 아이콘은 22px CSS 도형(외부 아이콘 폰트 금지), 라벨 10.5px/600.
**활성 표시는 색 채움이 아니라 `{colors.ink}` + 라벨 굵기 800 + 아이콘 선 굵기 1.4px→1.9px.** 비활성은 `{colors.ink-muted}`. 채워진 알약이나 밑줄 인디케이터를 두지 않는다 — 이 지면은 색으로 소리치지 않는다.
장바구니 탭에는 개수 배지가 아이콘 우상단에 붙는다.

### 하단 고정 CTA 바 `{components.cta-bar}`
종이 배경 + 상단 1px hairline. 패딩 `13px 20px 20px` — 아래쪽 20px은 홈 인디케이터 여백을 겸한다. 버튼은 가로 균등 분할(gap 9px).
- 1버튼: `주문하기 (2건)`, `121,000원 · 주문하기` (금액 + 가는 점 구분 `·` + 동사)
- 2버튼: `장바구니 담기`(ghost) + `바로 구매`(solid)

### 버튼
- **solid** `{components.button-solid}` — 먹색 면 + 종이색 글자, 15px 세로 패딩, 4px 라운드, 14px/700.
- **ghost** `{components.button-ghost}` — 1.4px 먹색 테두리, 투명 면.
- **small** — 12px/700, 1.4px 테두리, 좌우 14px (`우편번호 검색`).
- **cancel** — 11.5px/700, 1px `{colors.field-border}` 테두리, 흰 면, 3px 라운드 (`주문 취소`). 취소는 파괴적 액션이지만 **빨간색을 쓰지 않는다** — 이 팔레트에 빨강이 없다.
- **kakao** `{components.button-kakao}` — `#fee500` 면 + 먹색 글자 + CSS 도형 말풍선. 유일한 예외 색.
- **약한 텍스트 버튼** — `로그아웃`, `삭제`. 12.5px/600 `{colors.ink-quiet}`에 1px 밑줄.

### 상품 카드 `{components.product-card}`
사진(4px 라운드, 높이 가변) → 11px 여백 → 브랜드 라벨 → 7px → 상품명 13px/400 `#605b53` → 7px → 가격 13px/800 먹색.
**품절 카드**는 숨기지 않는다: 사진에 `saturate(.45)`, 좌상단에 먹색 `품절` 태그, 상품명·가격을 `{colors.ink-muted}`로 내리고 가격에 취소선.

### 브랜드 라벨 `{components.brand-label}`
독립 컴포넌트로 둔다. 카드·장바구니 묶음 헤더·주문서 묶음·주문상세 묶음에서 같은 얼굴로 반복되며, 이 반복이 "판매자별로 나뉜 주문"이라는 구조를 시각적으로 가르친다.

### 옵션 축 칩 `{components.option-chip}`
축(`색상`, `용량`)마다 라벨 11.5px/600 + 칩 행. 칩은 12.5px/600, 흰 면, 1px `{colors.field-border}`, 4px 라운드, 패딩 `8px 15px`.
- **선택** — 먹색 면 + 종이색 글자 + 700.
- **부분 품절** — 칩 안 작은 서브라벨 `일부 품절`(10px, 액센트).
- **비활성(조합 품절)** — `{colors.disabled-surface}` 면, `{colors.disabled-ink}` 글자, 취소선, 서브라벨 `품절`을 `{colors.ink-muted}` 알약으로. **숨기지 않는다.**

축 아래에 **선택 결과 한 줄**이 붙는다: 좌측 액센트 2px 세로선 + `#f7f4ee` 면, `선택` 라벨 + `살구 / 240ml` + 우측 끝 상태(`구매 가능` / 품절). 옵션 상태를 조합 목록으로 나열하지 않고 이 한 줄이 답한다.

### 카테고리 칩 `{components.category-chip}`
가로 스크롤 행, 999px 라운드, 패딩 `6px 13px`. 선택은 먹색 면. 우측 끝에 34px 종이색 페이드로 더 있음을 알린다.

### 판매자 묶음 카드 `{components.seller-pack}`
장바구니·주문서·주문상세에서 반복되는 뼈대. 헤더(브랜드 라벨 + 우측 배송비 또는 상태 라벨) → 상품 행(사진 66~74px + 이름/옵션/금액) → 푸터(배송비 + 액션). 묶음 사이는 1px hairline.
- **장바구니**에서는 헤더 좌측에 체크박스, 상품 행에 수량 스테퍼와 `삭제`.
- **주문상세**에서는 헤더 우측에 상태 라벨, 푸터에 `주문 취소`(취소 가능할 때만), 배송중이면 송장 줄.
- **구매 불가 묶음**은 사진 `grayscale(.85)`, 글자 `#a8a29a`, 금액 취소선, 체크박스 해제, 헤더에 `구매 불가 · 품절` 태그, 하단에 `{colors.accent-wash}` 안내 상자.

### 금액 요약 `{components.amount-summary}`
행: 좌측 라벨 `{colors.ink-secondary}` / 우측 값 `{colors.ink-strong}` 600. 값이 0원이면 `{colors.ink-muted}` 500으로 물러난다.
합계: 12px 위 여백 + 14px 패딩 + 1px hairline 위 경계. 라벨 13px/700 먹색, 값 21px/800 **액센트**. 이 지면에서 액센트가 가장 크게 나타나는 곳이며, 화면당 한 번만 허용한다.

### 입금 안내 상자 `{components.deposit-box}`
v1 결제가 무통장입금뿐이므로 이것이 주문 이후 가장 중요한 컴포넌트다. 두 변형이 있다.
- **주문완료** — 종이 면 위 1.5px 액센트 테두리, 상단 노치 캡션 `입금 안내`(10px/800/.2em/액센트), 금액 27px/800 액센트, 하단에 계좌·예금주·기한, 그 아래 `{colors.paper-shade}` 메모 상자.
- **주문상세** — `{colors.accent-wash}` 면 + 1px `{colors.accent-line}` 테두리, 금액 20px. 화면 최상단(주문번호 바로 아래)에 놓인다.

**확정 — 두 변형을 유지한다.** 같은 정보지만 하는 일이 다르다. 주문완료의 상자는 **방금 무엇을 해야 하는지 알리는 통보**라서 그 화면에서 가장 무거워야 하고, 주문상세의 상자는 **다시 들어왔을 때의 상기**라서 주문 정보 위에 조용히 얹혀야 한다. 무게가 같으면 주문상세에서 배송 정보·금액 내역과 시선을 다툰다.

### 입력 필드 `{components.input}`
높이 46px, 흰 면, 1px `{colors.field-border}`, 4px 라운드, 좌우 13px, 글자 13.5px. 라벨은 필드 위 11.5px/600 `{colors.ink-secondary}`, 선택 항목은 `(선택)`을 `{colors.ink-muted}` 10.5px로 덧붙인다. 도움말은 아래 11px `{colors.ink-muted}`.
**오류** — 테두리 `{colors.accent}`, 면 `{colors.field-error-surface}`, 아래 11.5px/600 액센트 메시지.
`[ASSUMPTION]` 주문서 목업은 같은 필드를 패딩 방식(11px/12px, 글자 13px)으로 그렸다 — 46px 고정 높이로 통일한다.

### 체크박스 `{components.checkbox}`
16px 정사각, 3px 라운드. 체크됨은 먹색 면 + 종이색 갈고리, 해제는 흰 면 + `#d5cfc4` 테두리. 라디오는 16px 원 + 먹색 점(결제 수단).

### 배지 · 상태 라벨
- **개수 배지** `{components.count-badge}` — 액센트 원 + 종이색 숫자 9.5px/700 + 1.5px 종이색 링. 장바구니 아이콘에만.
- **상태 라벨** `{components.status-label}` — **배지가 아니다.** 면 없는 11.5px/800/`.05em` 글자에 색만 다르다: 입금대기 `{colors.accent}` / 배송중·결제완료·배송준비 `{colors.ink}` / 배송완료·취소 `{colors.ink-muted}`. 액센트가 붙는 상태는 **입금대기 하나뿐**이다 — 구매자가 지금 무언가 해야 하는 유일한 상태이기 때문이다.
- **태그** `{components.tag}` — 9.5px/700/.09em, 2px 라운드. `품절`은 먹색 면, `구매 불가 · 품절`·`임시 정보`는 연한 벽돌 면 + 액센트 글자.

### 알림 문구 `{components.notice}`
중개자 고지, 취소 안내, 목록 끝 문구. 11px/1.75 `{colors.ink-quiet}`, 위에 1px hairline. 아이콘도 색 면도 없다 — 법적 고지는 경고가 아니라 **인쇄된 사실**로 보여야 한다.
단, 구매자가 행동해야 하는 안내는 면을 가진다: 결제 안내 `{colors.accent-wash}` + 액센트 글자, 구매 불가 안내도 같은 처리.

## Do's and Don'ts

| Do | Don't |
|---|---|
| 브랜드명을 상품명보다 먼저·굵게·자간 벌려 | 상품명을 크게 키우고 브랜드를 캡션으로 내리기 |
| 액센트 `{colors.accent}`는 링크·선택·가격 강조·경고에만 | 액센트를 면으로 넓게 깔기, 버튼 배경으로 쓰기 |
| **브랜드 파랑 `#2f6bff`은 구매자 화면에서 쓰지 않는다** — 판매자·관리자와 색이 갈리는 것은 의도된 결정 | 슬러 시스템의 `--color-brand-*`·`--color-focus-ring`을 구매자 화면에 그대로 끌어오기 |
| 활성 탭은 먹색 + 라벨 굵기로 | 활성 탭을 색 채움·알약·밑줄 인디케이터로 |
| 면 구분은 8px `{colors.paper-shade}` 띠와 1px hairline으로 | 카드 그림자, 그라디언트 면, 떠 있는 카드 |
| 상태는 면 없는 작은 라벨 + 색 층으로 | 알록달록한 상태 배지, 성공 초록·위험 빨강 도입 |
| 품절·구매 불가를 **표기**하고 자리에 남기기 | 품절 상품·조합을 목록에서 숨기기 |
| 금액은 `121,000원` + tabular-nums | 금액에 원화 기호(`₩`), 소수점, 축약(`12.1만`) |
| 예외 색은 카카오 `#fee500` 하나 | 소셜 로그인 추가 시마다 브랜드 색 늘리기 |
| 아이콘은 CSS 도형 또는 인라인 SVG | 이모지, 아이콘 폰트, 외부 아이콘 CDN |
| 조용한 존댓말, 짧은 동사형 버튼 | 감탄사·마케팅 과장·이모지 |
| v1에 있는 것만 그리기 | 검색·리뷰·별점·찜·쿠폰·알림·배송추적 링크 |
