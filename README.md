# SLUR Platform Blueprint

운영자가 판매자를 직접 선별·초청하는 **큐레이션형 디자인 편집숍 마켓플레이스**의 구현 블루프린트입니다.

SLUR 플랫폼 1호의 목표는 단기 매출이 아니라, 판매자 입점부터 상품·장바구니·주문·운영 관리까지의 **실서비스 흐름을 끝까지 검증**하는 것입니다. 이후 검증된 구조를 범용 커머스 플랫폼의 출발점으로 정리합니다.

> 현재 상태: v1 구현 완료 후 **Hub맥 Docker 기반 사전 운영 검증** 단계입니다. PG 연동, 사업자 실정보·법률 검토 등 실제 외부 판매 오픈 게이트는 별도로 남아 있습니다.

## 무엇을 검증하나요?

- 단일 계정 기반의 구매자·판매자·관리자 역할 모델
- 이메일 및 카카오 로그인 경계
- 판매자 입점 신청과 관리자 승인
- 카테고리, 상품, 옵션 조합, 재고 관리
- 구매자 상품 탐색, 장바구니, 주문 생성
- 무통장입금 확인 기반의 주문·배송·취소 운영 흐름
- 판매자·관리자용 Next.js 콘솔
- Hub맥에서의 Docker 통합 실행과 메인맥 LAN 검토

## 아키텍처

```text
구매자: Flutter 모바일 앱
판매자·관리자: Next.js 웹
                  │
                  ▼
            FastAPI API
      인증 · RBAC · 주문 상태 전이
                  │
                  ▼
          PostgreSQL / Storage
```

- **FastAPI**가 인증, 권한, 상태 전이, 주문 로직의 유일한 소유자입니다.
- 구매자 앱과 웹은 FastAPI API만 호출합니다.
- **Supabase**는 향후 매니지드 PostgreSQL 및 Storage 연결 대상으로 두며, Supabase Auth·RLS·Edge Functions는 사용하지 않습니다.
- 현재 사전 운영 검증의 기본 DB는 운영 Supabase와 분리된 **Docker PostgreSQL**입니다.

## 기술 구성

- API: Python 3.14, FastAPI, SQLAlchemy Async, Alembic, PostgreSQL
- 웹: Next.js, TypeScript
- 모바일: Flutter
- 로컬 통합 실행: Docker Compose

## 빠른 시작 — Hub맥 로컬 검증

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
| 웹 | <http://localhost:3000> |
| API health | <http://localhost:8000/api/v1/health> |
| 메인맥 등 같은 Wi‑Fi 기기 | `http://<Hub맥-LAN-IP>:3000` |

Hub맥에서 현재 LAN IP를 확인합니다.

```bash
ipconfig getifaddr en0
```

Hub맥의 로컬 호스트명이 설정되어 있다면, 같은 Wi‑Fi의 메인맥에서는 `http://slur-hub.local:3000`처럼 `.local` 주소로도 접근할 수 있습니다.

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
