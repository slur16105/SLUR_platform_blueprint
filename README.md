# SLUR Market

운영자가 판매자를 직접 선별·초청하는 **큐레이션형 디자인 편집숍 마켓플레이스**입니다.

판매자 입점부터 상품·장바구니·주문·반품·정산 준비까지, 실제로 물건을 팔고 운영하는 데 필요한 흐름을 갖췄습니다.

> 현재 상태: **결제(PG)만 붙이면 문을 열 수 있는 단계**입니다. 자체 서버(Docker)에서 운영 검증 중이며, 남은 오픈 게이트는 PG 계약·사업자 실정보 등록·약관 법률 검토·택배사 계약입니다.
>
> *이전 이름은 `SLUR Platform Blueprint`였습니다. "범용 청사진을 뽑는다"는 처음 의도 대신 실서비스로 방향이 굳어 이름을 바꿨습니다(2026-08-01). 기획 문서 폴더·GitHub 주소에는 옛 이름이 남아 있습니다 — 그 시점의 기록이라 그대로 둡니다.*

> **🔗 라이브 데모**: <https://results-reply-shark-confidentiality.trycloudflare.com/>
>
> 외부에서 바로 열어볼 수 있는 데모입니다(Cloudflare Quick Tunnel로 자체 서버를 노출). 서버와 터널이 실행 중일 때만 접속되며, **임시 주소라 재시작 시 바뀔 수 있습니다.**

## 무엇을 검증하나요?

- 단일 계정 기반의 구매자·판매자·관리자 역할 모델
- 이메일 및 카카오 로그인 경계
- 판매자 입점 신청과 관리자 승인
- 카테고리, 상품, 옵션 조합, 재고 관리
- 구매자 상품 탐색, 장바구니, 주문 생성
- 무통장입금 확인 기반의 주문·배송·취소 운영 흐름
- 판매자·관리자용 Next.js 콘솔
- 자체 서버에서의 Docker 통합 실행과 같은 네트워크 다른 기기의 LAN 검토

## 기능 안내

전체 기능을 화면 단위로 정리합니다. 하나의 계정이 **구매자·판매자·관리자** 역할을 겸할 수 있으며, 구매자는 반응형 웹, 판매자·관리자는 같은 웹의 콘솔 영역에서 역할로 분기합니다.

> **스크린샷** — 로컬 스택(`localhost:3000`)을 실제로 띄우고 데모 데이터를 넣은 뒤 자동 캡처한 화면입니다(`docs/screenshots/`). 재촬영 방법은 [촬영 가이드](#스크린샷-촬영-가이드)를 참고하세요. 데모 계정·시드는 [빠른 시작](#빠른-시작--자체-서버-로컬-검증)에 있습니다.

### 한눈에 보기

| 영역 | 화면 |
| --- | --- |
| 구매자 | 홈 · 상품 상세 · 장바구니 · 주문서 · 주문 내역/상세 · **반품·교환** · **1:1 문의** · **공지사항** · 내 정보(**배송지 주소록**) · 로그인 |
| 판매자 콘솔 | 대시보드 · 상품 관리 · **상품 수정** · 상품 등록 · 주문 관리 · **설정(배송비·무료배송·정산 계좌)** |
| 관리자 콘솔 | 대시보드(**매출 집계**) · 주문 관리/상세(**결제 원장**) · 입금 확인 · **반품·교환** · **문의 관리** · **공지사항** · 입점 심사 · 회원 관리(**약관 동의 이력**) · 메인 화면 관리 · 상품 조회 · 설정 |

**굵게** 표시한 화면은 2026년 7월 28일 이후 추가된 것입니다.

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

- **인증·RBAC** — JWT + bcrypt. 역할 판정은 FastAPI가 소유하고, 웹은 힌트 쿠키로 UX 분기만 합니다.
- **주문 상태 전이** — 담기 → 주문 → 입금대기 → (관리자 입금확인) → 배송준비 → 배송중 → 배송완료. 전이표에 없는 변경은 거부되고, 모든 전이가 감사 로그(`order_events`)에 남습니다.
- **거래 원장** — 결제·환불을 별도 층으로 기록합니다(`payments`/`refunds`). PG 연동 시 승인번호·결제수단을 채우기만 하면 되도록 구조를 미리 맞췄습니다.
- **재고 원장** — 재고 증감 이력(`inventory_transactions`)으로 "왜 재고가 N인가"에 답합니다.
- **법적 요건** — 약관 버전·동의 이력, 1:1 문의, 공지사항 3종을 갖췄습니다. 약관 문안은 코드가 소유해 검토 없이 바뀌지 않습니다.
- **보안 헤더** — CSP(허용 출처 명시)·클릭재킹 차단·nosniff·Referrer-Policy·Permissions-Policy.
- **디자인 시스템** — 슬러 시스템(slur-ux·slur-design). 구매자는 매거진 톤, 콘솔은 밀도 높은 운영 화면.

### 모바일 뷰 (구매자)

구매자 화면은 반응형입니다. 아래는 7월 28일 모바일 캡처입니다.

| 홈 | 상품 상세 | 장바구니 |
| --- | --- | --- |
| ![](docs/screenshots/buyer-home-mobile.png) | ![](docs/screenshots/buyer-product-detail-mobile.png) | ![](docs/screenshots/buyer-cart-mobile.png) |

| 주문서 | 주문 내역 | 내 정보 |
| --- | --- | --- |
| ![](docs/screenshots/buyer-checkout-mobile.png) | ![](docs/screenshots/buyer-orders-mobile.png) | ![](docs/screenshots/buyer-me-mobile.png) |

### 스크린샷 촬영 가이드

로컬 스택을 띄우고 데모 데이터를 넣은 뒤, 캡처 스크립트를 실행하면 `docs/screenshots/`가 갱신됩니다.

```bash
# 1) 스택 + 기본 시드
docker compose up -d --build --wait
docker compose --profile tools run --build --rm seed

# 2) 화면이 비어 보이지 않도록 데모 데이터 채우기(선택)
docker compose exec -T api uv run python -m app.local_seed_bulk      # 판매자·상품·주문 34건
docker compose exec -T api uv run python -m app.local_seed_history   # 과거 30일치 주문(기간 탭 확인용)

# 3) 캡처 (playwright 필요)
npx playwright install chromium
node docs/shoot.mjs docs/screenshots
```

`docs/shoot.mjs`가 역할별로 로그인해 28개 화면을 찍습니다. 파일명은 README의 이미지 경로와 1:1로 맞춰져 있어, 다시 찍으면 문서가 자동으로 갱신됩니다.

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
- 구매자·판매자·관리자 웹은 모두 FastAPI API만 호출합니다. (초기 Flutter 구매자 앱은 반응형 웹으로 전환됐으며 `apps/mobile`은 제거 예정)
- **Supabase**는 향후 매니지드 PostgreSQL 및 Storage 연결 대상으로 두며, Supabase Auth·RLS·Edge Functions는 사용하지 않습니다.
- 현재 사전 운영 검증의 기본 DB는 운영 Supabase와 분리된 **Docker PostgreSQL**입니다.

## 기술 구성

- API: Python 3.14, FastAPI, SQLAlchemy Async, Alembic, PostgreSQL
- 웹: Next.js, TypeScript
- 모바일: Flutter
- 로컬 통합 실행: Docker Compose

## 빠른 시작 — 자체 서버 로컬 검증

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

- 카테고리 2개와 데모 상품 6개를 생성합니다.
- 로컬 환경과 Docker Postgres에서만 실행되도록 보호됩니다.
- 다시 실행해도 중복 생성하지 않습니다.
- Supabase Storage를 연결하지 않은 상태에서는 포함된 로컬 데모 이미지를 사용합니다.

### 4. 확인 주소

| 대상 | 주소 |
| --- | --- |
| 외부 접속 (임시 터널) | <https://results-reply-shark-confidentiality.trycloudflare.com/> |
| 웹 (로컬) | <http://localhost:3000> |
| API health | <http://localhost:8000/api/v1/health> |
| 같은 Wi‑Fi의 다른 기기 | `http://<서버-LAN-IP>:3000` |

서버에서 현재 LAN IP를 확인합니다.

```bash
ipconfig getifaddr en0
```

서버에 로컬 호스트명이 설정되어 있다면, 같은 Wi‑Fi의 다른 기기에서 `http://<서버-호스트명>.local:3000`처럼 `.local` 주소로도 접근할 수 있습니다.

> LAN URL은 내부 검토용 HTTP 서비스입니다. 라우터 포트포워딩이나 공개 터널을 기본으로 열지 않습니다.

## 검증

```bash
npm run test
```

이 명령은 Compose 구성, 서비스 준비 상태, API health, 웹 루트, 웹 BFF 카테고리 요청을 통합 점검합니다.

추가 API 테스트는 다음에서 실행합니다.

```bash
cd apps/api
uv run pytest -q
```

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
  web/          Next.js 판매자·관리자·구매자 웹
  mobile/       Flutter 구매자 앱
_bmad-output/   PRD, 아키텍처, UX, 구현 산출물
docker-compose.yml
LOCAL_DOCKER.md
```

## 참고 문서

- [로컬 Docker 운영 가이드](LOCAL_DOCKER.md)
- [프로젝트 작업 규칙 및 아키텍처](CLAUDE.md)
- 기획·PRD·아키텍처 산출물: [`_bmad-output/`](_bmad-output/)

## 현재 제한 사항

이 저장소의 로컬 Docker 구성은 **실서비스 운영 가능성 검증용**입니다. 다음 항목은 실제 외부 판매 오픈 전 별도 완료가 필요합니다.

- PG 결제 연동
- 사업자 정보와 법률 고지의 실정보 검토
- 배송·도서산간 정책의 공식 기준 대조
- 실제 Supabase PostgreSQL·Storage 전환 검증
