# SLUR Market

운영자가 판매자를 직접 선별·초청하는 **큐레이션형 디자인 편집숍 마켓플레이스**입니다.

판매자 입점부터 상품·장바구니·주문·반품·정산 준비까지, 실제로 물건을 팔고 운영하는 데 필요한 흐름을 갖췄습니다.

> 현재 상태: **결제(PG)만 붙이면 문을 열 수 있는 단계**입니다. 자체 서버(Docker)로 운영 검증 중이며, 남은 항목은 [남은 오픈 게이트](#남은-오픈-게이트)에 있습니다.
>
> 외부 데모는 고정 주소를 두지 않습니다(임시 터널은 켤 때마다 주소가 바뀝니다). 여는 방법은 [LOCAL_DOCKER.md](LOCAL_DOCKER.md)를 참고하세요.

## 기능 안내

전체 기능을 화면 단위로 정리합니다. 하나의 계정이 **구매자·판매자·관리자** 역할을 겸할 수 있으며, 구매자는 반응형 웹, 판매자·관리자는 같은 웹의 콘솔 영역에서 역할로 분기합니다.

> **스크린샷** — 로컬 스택을 실제로 띄우고 데모 데이터를 넣어 캡처한 화면입니다. 데모 계정은 [빠른 시작](#빠른-시작--로컬-실행)에 있습니다.

### 한눈에 보기

| 영역 | 화면 |
| --- | --- |
| 구매자 | 홈 · 상품 상세 · 장바구니 · 주문서 · 주문 내역/상세 · 반품·교환 · 1:1 문의 · 공지사항 · 내 정보(배송지 주소록) · 로그인 |
| 판매자 콘솔 | 대시보드 · 상품 관리 · 상품 수정 · 상품 등록 · 주문 관리 · 설정(배송비·무료배송·정산 계좌) |
| 관리자 콘솔 | 대시보드(매출 집계) · 주문 관리/상세(결제 원장) · 입금 확인 · 반품·교환 · 문의 관리 · 공지사항 · 입점 심사 · 회원 관리(약관 동의 이력) · 메인 화면 관리 · 상품 조회 · 설정 |
| 공통 | 안내 화면(404 · 접근 권한 없음 · 화면 오류) |

---

### 구매자

#### 홈 — 운영자 편성 지면
운영자가 콘솔에서 짠 편성(히어로 + 슬롯)이 그대로 나오는 지면입니다. 상품을 기계적으로 나열하지 않고, 무엇을 먼저 보여줄지 사람이 정합니다.

![구매자 홈](docs/screenshots/buyer-home.png)

#### 상품 상세
옵션 조합별 재고·추가금액을 반영해 구매 가능 여부를 서버가 판정합니다. 판매자(브랜드) 정보와 배송비 조건이 함께 보입니다.

![상품 상세](docs/screenshots/buyer-product.png)

#### 장바구니
판매자별로 묶어 보여줍니다. 배송비가 판매자마다 다르기 때문이며, 이 묶음이 이후 주문·배송·취소의 단위가 됩니다.

![장바구니](docs/screenshots/buyer-cart.png)

#### 주문서
**저장된 배송지**를 골라 한 번에 채웁니다. 우편번호 검색으로 도서산간을 판정하고, 판매자별 배송비와 **조건부 무료배송**이 실시간으로 반영됩니다. 금액은 전부 서버 계산값입니다.

![주문서](docs/screenshots/buyer-checkout.png)

#### 주문 내역 · 상세
주문은 판매자 묶음 단위로 진행됩니다. 입금 전에는 **입금 안내(은행·계좌번호·예금주·기한)**, 배송 전에는 취소, **배송 완료 후에는 반품·교환** 버튼이 자리를 바꿔 나타납니다.

![주문 내역](docs/screenshots/buyer-orders.png)

![주문 상세 — 입금 안내](docs/screenshots/buyer-order-detail.png)

배송이 끝나면 같은 화면에 송장이 보이고, 취소 자리에 **반품·교환 신청**이 들어섭니다.

![주문 상세 — 배송 완료](docs/screenshots/buyer-order-delivered.png)

#### 반품 · 교환
전자상거래법 제17조 청약철회 창구입니다. 품목별로 수량을 골라 신청하며(부분 반품), **기한은 서버가 판정합니다** — 단순 변심 7일, 상품 하자·오배송 30일.

![반품·교환](docs/screenshots/buyer-returns.png)

#### 1:1 문의
통신판매중개자의 소비자 불만·분쟁 처리 창구입니다. 운영자 답변이 같은 화면에 이어 붙습니다.

![1:1 문의](docs/screenshots/buyer-support.png)

#### 공지사항
약관 개정 고지(시행 7일 전, 불리한 변경은 30일 전)를 이행하는 지면입니다. 고정 공지가 상단에 붙습니다.

![공지사항](docs/screenshots/buyer-notices.png)

#### 내 정보 — 배송지 주소록
계정·주문 내역과 함께 **배송지 주소록**을 관리합니다. 기본 배송지는 항상 하나로 유지되며, 주문서가 이 값을 자동으로 채웁니다.

![내 정보](docs/screenshots/buyer-me.png)

#### 로그인 · 회원가입
구매자·판매자·관리자가 같은 화면으로 로그인하고, 역할에 따라 갈 곳이 정해집니다. 가입 시 약관 동의는 **버전과 함께 서버에 기록**됩니다.

![로그인](docs/screenshots/buyer-login.png)

> 위 점선 상자의 빠른 로그인 버튼은 **로컬에서만** 보입니다(서버 환경변수로 판정, 기본 꺼짐).

---

### 판매자 콘솔

#### 대시보드
"지금 무엇을 처리할까"에 답하는 랜딩입니다. 처리 대기 큐(배송준비·배송중·품절 임박) + 발송할 주문 + 품절 임박 목록.

![판매자 대시보드](docs/screenshots/seller-dashboard.png)

#### 상품 관리 · 수정
상태 탭(판매중·품절·숨김)으로 거르고, 행에서 바로 상태를 바꿉니다. **수정** 화면에서 가격·설명·이미지·재고를 고칩니다.

![판매자 상품 관리](docs/screenshots/seller-products.png)

#### 상품 등록
성격별 카드로 나눈 폼입니다. 옵션 조합(최대 2축)을 표로 만들어 조합별 추가금액·재고를 지정합니다. 등록 버튼이 왜 비활성인지 화면이 문장으로 알려줍니다.

![상품 등록](docs/screenshots/seller-product-new.png)

#### 주문 관리
상태 탭으로 걸러 보고, 배송 시작(송장 입력)·배송 완료를 처리합니다. 송장은 **분할배송**으로 여러 건 남길 수 있습니다.

![판매자 주문 관리](docs/screenshots/seller-orders.png)

#### 설정
배송비(기본·제주·도서산간)와 **무료배송 기준**, **정산 계좌**를 관리합니다. 무료배송은 기본 배송비만 면제하고 도서산간 추가비는 면제하지 않습니다(실제 추가 운임이라서).

![판매자 설정](docs/screenshots/seller-settings.png)

---

### 관리자 콘솔

#### 대시보드 — 현황 집계 + 처리 대기 큐
기간 탭(오늘·7일·30일)으로 **매출·신규 주문·신규 가입·입금 대기 금액**을 봅니다. 아래 처리 대기 큐(입금 확인·배송준비·입점 심사·문의·반품)에서 각 화면으로 바로 들어갑니다.

![관리자 대시보드](docs/screenshots/admin-dashboard.png)

#### 주문 관리 · 주문 상세
상태 탭·기간 필터·검색(주문번호·주문자·브랜드)으로 찾습니다. 상세에서는 품목 단위 취소와 **결제 원장(받은 금액·환불·실수령)**을 확인합니다.

![관리자 주문 관리](docs/screenshots/admin-orders.png)

![관리자 주문 상세](docs/screenshots/admin-order-detail.png)

#### 입금 확인
무통장입금 대기 목록입니다. 금액을 대조해 확인하면 배송준비로 넘어가고, **결제 원장에 기록**됩니다.

![입금 확인](docs/screenshots/admin-deposits.png)

#### 반품 · 교환
접수 → 승인/거부 → 완료(환불 금액 기록) 3단계로 처리합니다. 완료 시 환불 금액 입력이 필수입니다.

![관리자 반품·교환](docs/screenshots/admin-returns.png)

#### 문의 관리
1:1 문의에 답변합니다. 답변하면 구매자 화면에 바로 표시됩니다.

![문의 관리](docs/screenshots/admin-inquiries.png)

#### 공지사항
약관 개정 고지를 작성·예약 게시합니다. 게시 일시 하나로 임시저장·예약·게시가 결정됩니다.

![공지사항 관리](docs/screenshots/admin-notices.png)

#### 입점 심사
판매자 신청을 승인·반려합니다. 반려는 되돌릴 수 없어 확인 모달과 사유 입력을 거칩니다.

![입점 심사](docs/screenshots/admin-applications.png)

#### 회원 관리 — 약관 동의 이력
역할 탭으로 회원을 찾고, 상세에서 사업자 프로필·상품 수와 함께 **약관 동의 이력(문서·버전·동의 일시)**을 확인합니다. 분쟁 시 입증 자료입니다.

![회원 관리](docs/screenshots/admin-lookup.png)

#### 메인 화면 관리
구매자 홈의 편성을 만듭니다. 드래그로 순서를 바꾸고, 노출 기간·활성 여부를 지정합니다.

![메인 화면 관리](docs/screenshots/admin-home.png)

#### 상품 조회
전체 상품을 상태·카테고리로 조회합니다. 등록·수정은 판매자 몫이라 여기서는 읽기 중심입니다.

![상품 조회](docs/screenshots/admin-products.png)

#### 설정
무통장입금 계좌(은행·계좌번호·예금주), 운영 수치, 카테고리를 관리합니다. "여기서 관리하지 않는 것" 안내로 운영자가 헤매지 않게 했습니다.

![관리자 설정](docs/screenshots/admin-settings.png)

---

### 공통 (전 역할)

- **인증·RBAC** — JWT + argon2. 역할 판정은 FastAPI가 소유하고, 웹은 힌트 쿠키로 UX 분기만 합니다.
- **주문 상태 전이** — 담기 → 주문 → 입금대기 → (관리자 입금확인) → 배송준비 → 배송중 → 배송완료. 전이표에 없는 변경은 거부되고, 모든 전이가 감사 로그(`order_events`)에 남습니다.
- **거래 원장** — 결제·환불을 별도 층으로 기록합니다(`payments`/`refunds`). PG 연동 시 승인번호·결제수단을 채우기만 하면 되도록 구조를 미리 맞췄습니다.
- **재고 원장** — 재고 증감 이력(`inventory_transactions`)으로 "왜 재고가 N인가"에 답합니다.
- **법적 요건** — 약관 버전·동의 이력, 1:1 문의, 공지사항 3종을 갖췄습니다. 약관 문안은 코드가 소유해 검토 없이 바뀌지 않습니다.
- **보안 헤더** — CSP(허용 출처 명시)·클릭재킹 차단·nosniff·Referrer-Policy·Permissions-Policy.
- **디자인 시스템** — 슬러 시스템(slur-ux·slur-design). 구매자는 매거진 톤, 콘솔은 밀도 높은 운영 화면.

### 모바일 뷰 (구매자)

구매자 화면은 반응형입니다. iPhone 14 폭(390px) 기준으로 캡처했습니다.

| 홈 | 상품 상세 | 장바구니 | 주문서 |
| --- | --- | --- | --- |
| ![](docs/screenshots/buyer-home-mobile.png) | ![](docs/screenshots/buyer-product-detail-mobile.png) | ![](docs/screenshots/buyer-cart-mobile.png) | ![](docs/screenshots/buyer-checkout-mobile.png) |

| 주문 내역 | 반품·교환 | 내 정보 | 로그인 |
| --- | --- | --- | --- |
| ![](docs/screenshots/buyer-orders-mobile.png) | ![](docs/screenshots/buyer-returns-mobile.png) | ![](docs/screenshots/buyer-me-mobile.png) | ![](docs/screenshots/buyer-login-mobile.png) |

### 안내 화면 — 진행이 막혔을 때

잘못된 주소, 삭제된 상품, 권한 없는 접근, 화면 오류. 이런 순간에 브라우저 기본 화면이나 영문 오류를 그대로 보여주지 않습니다. 모든 안내 화면은 **① 무슨 일이 일어났는지 ② 왜 그럴 수 있는지 ③ 지금 무엇을 하면 되는지**를 함께 말하고, 상황에 맞는 다음 행동 버튼을 줍니다.

| 화면 | 언제 뜨는가 | 어떤 안내를 하는가 |
| --- | --- | --- |
| **404 (구매자)** | 없는 주소, 판매가 끝나 내려간 상품 상세 | 홈으로 가기 + 주문 내역·자주 묻는 질문·1:1 문의 |
| **404 (콘솔)** | 운영자가 오타로 들어온 `/admin/...`, 삭제된 주문 | 역할별 대시보드·주문 관리로 (운영자에게 "홈으로"는 도움이 안 됩니다) |
| **접근 권한 없음** | 구매자 계정으로 판매자·관리자 화면 접근 | 입점 신청 / 다른 계정으로 로그인 / 쇼핑 계속하기 — 승인 직후 재로그인이 필요하다는 점까지 안내 |
| **화면 오류** | 렌더 중 예외 | 다시 시도(새로고침 없이 해당 구간만) · 홈으로 · 1:1 문의. 주문·결제 중이었다면 주문 내역에서 처리 여부부터 확인하도록 유도 |

| 404 — 구매자 | 404 — 콘솔 (관리자 로그인 상태) |
| --- | --- |
| ![](docs/screenshots/guide-404-buyer.png) | ![](docs/screenshots/guide-404-console.png) |

| 접근 권한 없음 | 화면 오류 |
| --- | --- |
| ![](docs/screenshots/guide-no-role.png) | ![](docs/screenshots/guide-error.png) |

설계상 지킨 것:

- **404는 실제로 HTTP 404를 반환합니다.** 없는 상품 상세도 "빈 화면 200"이 아니라 404입니다 — 검색엔진이 빈 지면을 색인하지 않도록 `noindex`도 함께 걸었습니다.
- **오류 내용을 사용자에게 노출하지 않습니다.** 스택·내부 경로 대신 오류 번호(digest)만 작게 보여주고, 문의 시 운영자가 로그와 대조할 수 있게 합니다.
- **최후의 방어선이 하나 더 있습니다.** 레이아웃 자체가 깨져 CSS·컴포넌트조차 못 쓰는 상황을 위해, 인라인 스타일만으로 그려지는 별도 화면(`global-error`)을 둡니다.
- **안내 화면은 다른 데이터에 기대지 않습니다.** 상단바(카테고리 조회 등)를 붙이지 않아, 안내 화면 자체가 다시 실패하는 일이 없습니다.

## 아키텍처

```text
구매자: Next.js 반응형 웹 (PWA)
판매자·관리자: Next.js 웹 콘솔 (역할 분기)
                  │
                  ▼
            FastAPI API
      인증 · RBAC · 주문 상태 전이
                  │
                  ▼
          PostgreSQL / Storage
```

- **FastAPI**가 인증, 권한, 상태 전이, 주문 로직의 유일한 소유자입니다.
- 구매자·판매자·관리자 웹은 모두 FastAPI API만 호출합니다. (초기 Flutter 구매자 앱은 반응형 웹으로 전환했고, 소스는 `flutter-app-final` 태그에 보존한 뒤 저장소에서 제거했습니다)
- **Supabase는 매니지드 PostgreSQL과 Storage(상품 이미지)로만 씁니다.** Auth·RLS·Edge Functions는 쓰지 않습니다 — 인증과 권한을 두 곳에서 관리하면 규칙이 갈라지기 때문입니다.
- 현재 운영 검증의 기본 DB는 운영 Supabase와 분리된 **Docker PostgreSQL**이며, `DATABASE_URL` 교체만으로 전환됩니다.

## 기술 구성

- API: Python 3.14, FastAPI, SQLAlchemy Async, Alembic, PostgreSQL
- 웹: Next.js(App Router), TypeScript — 구매자 반응형 웹 + PWA, 판매자·관리자 콘솔
- 통합 실행: Docker Compose

## 빠른 시작 — 로컬 실행

### 준비물

- Docker Desktop
- Docker Compose

### 1. 로컬 환경변수 만들기

```bash
cp .env.example .env
```

`.env`의 아래 값은 로컬 전용 랜덤값으로 바꿉니다.

```bash
# 예시: 각각 별도의 값으로 생성
openssl rand -hex 32
```

- `POSTGRES_PASSWORD`
- `JWT_SECRET`

`.env`는 Git에서 제외됩니다. 실제 Supabase·카카오 비밀값은 저장소에 넣지 않습니다.

### 2. 전체 스택 실행

```bash
docker compose up -d --build --wait
```

Docker Compose가 다음 순서로 기동합니다.

```text
PostgreSQL → Alembic migration → FastAPI → Next.js
```

### 3. 로컬 데모 카탈로그 만들기

새 로컬 DB는 비어 있습니다. Supabase나 Railway 데이터를 복사하지 않고, 검증용 카테고리와 상품을 생성하려면 다음을 실행합니다.

```bash
docker compose --profile tools run --rm seed
```

- 카테고리 2개와 데모 상품 6개, 역할별 데모 계정을 생성합니다.
- 로컬 환경과 Docker Postgres에서만 실행되도록 보호됩니다.
- 다시 실행해도 중복 생성하지 않습니다.
- Supabase Storage를 연결하지 않은 상태에서는 포함된 로컬 데모 이미지를 사용합니다.

데모 계정 — 로컬 전용이며, 로그인 화면의 빠른 로그인 버튼과 같은 값입니다.

| 역할 | 이메일 | 비밀번호 |
| --- | --- | --- |
| 관리자 | `local-admin@example.com` | `local-admin-password-2026` |
| 판매자 | `local-seller@example.com` | `local-seller-password-2026` |
| 구매자 | `local-buyer@example.com` | `local-buyer-password-2026` |

### 4. 확인 주소

| 대상 | 주소 |
| --- | --- |
| 외부 접속 | 임시 터널을 열 때 발급되는 주소 (위 안내 참고) |
| 웹 (로컬) | <http://localhost:3000> |
| API health | <http://localhost:8000/api/v1/health> |
| 같은 Wi‑Fi의 다른 기기 | `http://<서버-LAN-IP>:3000` |

서버에서 현재 LAN IP를 확인합니다.

```bash
ipconfig getifaddr en0
```

서버에 로컬 호스트명이 설정되어 있다면, 같은 Wi‑Fi의 다른 기기에서 `http://<서버-호스트명>.local:3000`처럼 `.local` 주소로도 접근할 수 있습니다.

> LAN URL은 내부 검토용 HTTP 서비스입니다. 라우터 포트포워딩이나 공개 터널을 기본으로 열지 않습니다.

## 테스트

```bash
# 스택 연결 점검 — Compose 구성·서비스 준비·API health·웹·BFF
npm run test

# 도메인 테스트 236개 (주문·결제·반품·권한·집계 등)
cd apps/api && uv run pytest -q
```

도메인 테스트는 전용 DB(`slur_test`)를 자동으로 만들고 마이그레이션까지 올립니다 —
개발용 데이터는 건드리지 않습니다.

## 운영 명령

```bash
# 상태와 로그
docker compose ps
docker compose logs -f api web

# 중지 — DB 볼륨은 유지
docker compose down

# 완전 초기화 — 로컬 DB 볼륨까지 삭제
docker compose down -v
```

더 자세한 로컬 실행, 카카오 callback, 데이터 경계는 [LOCAL_DOCKER.md](LOCAL_DOCKER.md)를 참고하세요.

## 데이터 경계와 전환 원칙

- 로컬 Compose는 운영 Supabase의 데이터에 자동 연결·복사·수정하지 않습니다.
- 앱은 환경변수 기반 `DATABASE_URL`을 사용하므로, 별도 전환 검증 단계에서 Supabase PostgreSQL 연결 문자열로 교체할 수 있습니다.
- Storage도 환경변수 기반으로 분리되어 있습니다.
- 운영 DB 연결, 데이터 복제, 외부 고객 판매는 오픈 게이트를 검토한 뒤에만 진행합니다.

## 저장소 구조

```text
apps/
  api/          FastAPI API, Alembic migration, 도메인 테스트
  web/          Next.js 구매자 웹 + 판매자·관리자 콘솔
docs/           스크린샷, 변경 보고서, 캡처·데모 데이터 스크립트
_bmad-output/   PRD, 아키텍처, UX, 구현 산출물
docker-compose.yml
LOCAL_DOCKER.md
```

## 참고 문서

- [로컬 Docker 운영 가이드](LOCAL_DOCKER.md)
- [프로젝트 작업 규칙 및 아키텍처](CLAUDE.md)
- 기획·PRD·아키텍처 산출물: [`_bmad-output/`](_bmad-output/)
- 변경 보고서(7/28 이후): [`docs/report-2026-08-01.html`](docs/report-2026-08-01.html)
- 스크린샷 촬영·데모 데이터 스크립트: [`docs/screenshots/README.md`](docs/screenshots/README.md)

## 남은 오픈 게이트

기능은 갖췄고, 실제 판매를 시작하려면 아래가 필요합니다. 전부 계약·검토 사안입니다.

- **결제(PG) 연동** — 스키마·호출부·멱등 구조는 준비돼 있고, 결제사 선택 후 어댑터와 웹훅만 붙이면 됩니다. PG 전에는 외부 구매자를 받지 않습니다.
- **사업자 실정보 등록** — 상호·사업자등록번호·통신판매업 신고번호·대표자·고객센터가 현재 임시값입니다(화면에 `임시 정보`로 표시됩니다).
- **약관·개인정보처리방침 법률 검토** — 현재 문안은 초안입니다. 개정 시 버전을 올리고 공지사항으로 고지합니다.
- **택배사 계약** — 계약사의 기준표로 도서산간 우편번호 목록을 최종 정렬합니다.
- **정산 조건 확정** — 수수료율·지급 주기. 판매자 입점 안내에 들어가는 값이라 PG와 함께 정합니다.

자세한 이력과 판단 근거는 [`deferred-work.md`](_bmad-output/implementation-artifacts/deferred-work.md)에 있습니다.
