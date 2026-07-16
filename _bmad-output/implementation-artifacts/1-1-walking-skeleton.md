---
baseline_commit: a76e26bdcd70926977a2f5cc9817134c0ad8887d
---

# Story 1.1: 걷는 뼈대 (프로젝트 골격과 배포)

Status: in-progress

## Story

As a 운영자,
I want 빈 서비스가 로컬과 Railway에서 돌아가는 것,
so that 이후 모든 스토리가 올라탈 기반이 생긴다.

## Acceptance Criteria

1. **Given** 모노리포(apps/api·apps/web·apps/mobile)와 도메인 모듈 골격(app/core + auth/sellers/products/carts/orders/admin) **When** `docker compose up` 후 헬스체크 엔드포인트 호출 **Then** FastAPI가 로컬 Postgres 17에 연결된 상태로 200을 응답한다
2. **And** 에러 봉투 전역 핸들러가 동작한다 — 존재하지 않는 경로(404)·검증 실패(422) 포함 모든 에러 응답이 `{code, message, details}` 형식
3. **And** 클라이언트 코드(web·mobile)에 Supabase SDK·직접 연결이 존재하지 않는다 (NFR-1)
4. **Given** main 브랜치 푸시 **When** Railway 배포 **Then** API·웹 서비스가 각각 Dockerfile로 빌드되어 공개 URL에서 응답하고, API는 Supabase Postgres 17에 연결된다
5. **And** Alembic 마이그레이션이 pre-deploy 단계에서 실행된다 (테이블 0개 상태 — 빈 베이스라인)
6. **And** 시크릿은 Railway 환경변수/로컬 `.env`로만 주입된다 (코드에 리터럴 없음)

## Tasks / Subtasks

- [x] Task 1: 모노리포 골격 생성 (AC: 1)
  - [x] 리포 루트에 `apps/api`, `apps/web`, `apps/mobile` 생성
  - [x] `apps/api`: uv 프로젝트 (`uv init`, Python 3.14), 의존성 버전 핀 — fastapi·uvicorn[standard]·sqlalchemy[asyncio]·asyncpg·alembic·pydantic-settings + 개발 의존성 pytest·pytest-asyncio·httpx
  - [x] `apps/api/app/` 도메인 모듈 골격: `core/` + `auth/ sellers/ products/ carts/ orders/ admin/` — 각 폴더에 `router.py`(라우트 0개의 `router = APIRouter()` export)·`service.py`·`models.py`·`schemas.py` (고정 명명, main.py가 import해도 죽지 않아야 함)
  - [x] `apps/web`: `npx create-next-app@16.2` (App Router, TypeScript) — 핀 버전으로 생성, 자동 최신 설치 금지
  - [x] `apps/mobile`: Flutter 3.44로 `flutter create` (Android 타깃, 로컬 SDK 버전 확인 후 진행) + `flutter_riverpod` 3.x만 추가
- [x] Task 2: FastAPI core (AC: 1, 2, 6)
  - [x] `core/config.py`: Pydantic Settings — DATABASE_URL 등 전부 환경변수, 기본값에 시크릿 금지
  - [x] `core/db.py`: SQLAlchemy 2.0 async engine + 세션 의존성
  - [x] `core/errors.py`: 공통 예외 타입 + 전역 핸들러 — 모든 에러(404·422·500 포함)를 `{code(문자열 enum), message(한국어), details(배열)}` 봉투로 변환
  - [x] `GET /api/v1/health`: DB `SELECT 1` 확인 포함 200 응답 — 도메인 소속이 아니므로 `main.py`(또는 core 라우터)에 직접 정의 (core에 도메인 코드 금지 규칙과 무관한 인프라 엔드포인트)
  - [x] 각 도메인 `router.py`를 `/api/v1` 프리픽스로 등록하는 조립 코드 (`main.py`) — 이후 리소스 경로 관례는 `/api/v1/{복수형-리소스}`, 필드 snake_case, page 기반 페이지네이션 (스파인 API 컨벤션)
- [x] Task 3: 로컬 개발 환경 (AC: 1)
  - [x] `docker-compose.yml`: postgres:17 + api 서비스 (web·mobile은 로컬 프로세스로 실행) — postgres에 healthcheck를 걸고 api는 `depends_on: condition: service_healthy`로 대기 (간헐적 초기 연결 실패 방지). 로컬은 로컬 PG만 사용 — Supabase는 prod 전용 (스파인 환경·운영 표)
  - [x] `.env.example` 작성, `.gitignore`에 `.env` 확인 (이미 있음)
- [x] Task 4: Alembic 초기화 (AC: 5)
  - [x] `alembic init` (async 템플릿), `env.py`를 core 설정과 연동
  - [x] 빈 베이스라인 리비전 1개 (테이블 생성 없음 — 테이블은 후속 스토리에서, AD-9 승인 게이트)
- [ ] Task 5: Dockerfile과 Railway 배포 (AC: 4, 5, 6)
  - [x] `apps/api/Dockerfile`: uv 기반 빌드, uvicorn 실행
  - [x] `apps/web/Dockerfile`: Next.js standalone output 빌드
  - [ ] GitHub 리포 연결: git remote가 없으면 GitHub 리포 생성·push 후 Railway에 연결, main 브랜치 자동 배포 트리거 설정 (AC 4의 "푸시 → 배포" 조건)
  - [x] Railway 프로젝트: 서비스 2개(api·web), 각 서비스 루트 디렉토리 지정(모노리포), Dockerfile 빌드
  - [x] api 서비스 pre-deploy 커맨드: `alembic upgrade head`
  - [x] 환경변수: DATABASE_URL(Supabase 연결 문자열 — 아래 배포 노트의 Session pooler 필수) 등 Railway에 설정
- [x] Task 6: 검증 (AC: 전체)
  - [x] 로컬: `docker compose up` → 헬스체크 200, 404/422 에러 봉투 형식 확인
  - [x] 프로드: Railway 공개 URL 헬스체크 200 (Supabase 연결), web URL 응답
  - [x] `grep -r supabase apps/web apps/mobile` → 0건 확인 (AC 3)

## Dev Notes

### 아키텍처 불변 규칙 (이 스토리에 걸리는 것)

- **AD-1**: Supabase는 Postgres+Storage로만. 클라이언트(web·mobile)에 Supabase SDK 설치 금지. Auth·RLS·Edge Functions 절대 사용 금지.
- **AD-2**: 도메인 간 의존은 상대 도메인의 `service.py` 경유만, 순환 금지. 이 스토리는 빈 골격만 만들지만 폴더·파일 명명이 이후 전부를 고정한다.
- **AD-8**: 이후 모든 PK는 UUIDv7 — **앱 레이어(Python 3.14 `uuid.uuid7()`)에서 생성**. PG17에는 네이티브 `uuidv7()` 없음(PG18부터). 이 스토리에선 규칙만 인지.
- **AD-9**: 테이블 생성 금지. Alembic 베이스라인은 빈 리비전. `users` 등 첫 테이블은 Story 1.2에서 Slur 승인 후.
- **AD-13**: SLUR 고유 값 하드코딩 금지 — 설정은 `core/config.py` 또는 (후속) `settings` 테이블.
- **에러 봉투 컨벤션**: `code`는 문자열 enum(클라이언트 분기용), `message`는 한국어(그대로 표시 가능), `details`는 필드별 배열. FastAPI 기본 422 응답(`detail`)도 전역 핸들러로 변환해야 함 — `RequestValidationError` 핸들러 오버라이드 필요.
- **이 스토리가 시드하는 code 값** (이후 전 클라이언트가 이 이름으로 분기하므로 그대로 사용): `not_found`(404), `validation_error`(422), `internal_error`(500). 이후 스토리는 같은 명명 패턴(snake_case, 도메인 접두 없이 의미 중심)으로 추가한다.

### 스택 버전 핀 (2026-07-15 웹 검증 — 임의 변경 금지)

| 구성 | 버전 |
|---|---|
| Python / FastAPI / Pydantic | 3.14 / 0.139 / 2.13 |
| SQLAlchemy(async) / asyncpg / Alembic | 2.0.51 / 0.31 / 1.18 |
| 패키지 관리 | uv 0.11 |
| Next.js / React | 16.2 (App Router, Node 20+) / 19.2 |
| Flutter / Dart / Riverpod | 3.44 / 3.12 / 3.x |
| Postgres | 17 (로컬 docker + Supabase 동일 메이저) |

주의: Flutter 3.44는 Material/Cupertino SDK 분리 과도기 — 이 스토리에선 기본 템플릿 그대로 두고 UI 작업 없음. SQLAlchemy 2.1은 베타이므로 2.0 라인 고정.

### 소스 트리 (이 스토리가 만드는 것)

```text
apps/
  api/
    app/
      main.py          # FastAPI 앱 조립, 라우터 등록
      core/            # config.py, db.py, errors.py — 도메인 코드 금지
      auth/ sellers/ products/ carts/ orders/ admin/
                       # 각각 router.py service.py models.py schemas.py (빈 파일)
    alembic/           # env.py + 빈 베이스라인 리비전
    Dockerfile
    pyproject.toml     # uv, 버전 핀
  web/                 # Next.js 16.2 App Router 기본 골격 + Dockerfile
  mobile/              # Flutter 3.44 기본 골격 (Android)
docker-compose.yml     # postgres:17 + api
.env.example
```

### 배포 (Railway)

- 서비스 2개: `api`(루트 `apps/api`), `web`(루트 `apps/web`) — 모노리포 루트 디렉토리 지정 방식.
- 빌드는 Railpack이 아니라 **서비스별 Dockerfile** (스파인 결정 — 재현성).
- api pre-deploy: `alembic upgrade head` (Railway 서비스 설정의 Pre-deploy Command).
- **Supabase 연결은 반드시 Session pooler** (`aws-0-[region].pooler.supabase.com:5432`, 사용자명 `postgres.[project-ref]`). Direct connection(`db.[ref].supabase.co`)은 IPv6 전용인데 **Railway는 아웃바운드 IPv6 미지원이라 ENETUNREACH로 실패**한다 (흔한 장애 패턴). Transaction pooler도 금지 — asyncpg prepared statement 비호환. asyncpg 스킴: `postgresql+asyncpg://`.
- Next.js는 `output: 'standalone'` 설정으로 Docker 이미지 경량화.

### 이 스토리에서 하지 말 것

- 테이블·모델 정의 (Story 1.2+, AD-9 게이트)
- 인증·비즈니스 로직 (빈 골격만)
- CI/CD 파이프라인 (스파인 Deferred — Railway 기본 배포로 충분)
- Flutter/Next.js 화면 작업 (기본 템플릿 그대로, 화면은 1.5/1.6)
- dev/prod 환경 분리 (production 단일 — 오픈 게이트에서 도입)

### 테스트 기준

- 이 스토리는 E2E 스모크가 곧 테스트: 로컬 헬스체크, 에러 봉투 형식(404·422 각 1건), 프로드 헬스체크.
- pytest 골격(`apps/api/tests/`)을 만들고 헬스체크·에러 봉투 테스트 2~3개를 남겨 후속 스토리의 테스트 관례를 시드한다.

### Project Structure Notes

- 이 리포(SLUR_platform_blueprint)가 곧 코드 리포 — 기획 문서(`_bmad-output/`)와 코드(`apps/`)가 공존하는 모노리포 (git 초기화·첫 커밋 2026-07-15 완료).
- 슬러 시스템 CSS 규칙은 실제 UI 화면이 생기는 스토리(1.6 웹 로그인)부터 적용 — 이 스토리 범위 아님.

### References

- [Source: _bmad-output/planning-artifacts/architecture/architecture-SLUR_platform_blueprint-2026-07-15/ARCHITECTURE-SPINE.md] — Design Paradigm, AD-1·2·8·9·13, Consistency Conventions(에러 봉투), Stack, 배포 토폴로지, 환경·운영 표
- [Source: _bmad-output/planning-artifacts/architecture/architecture-SLUR_platform_blueprint-2026-07-15/research-stack-versions.md] — 버전 핀 근거·출처 URL
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.1] — AC 원문
- [Source: _bmad-output/planning-artifacts/prds/prd-SLUR_platform_blueprint-2026-07-14/prd.md#6. 비기능 요구사항] — NFR-1·2·6

## Dev Agent Record

### Agent Model Used

Claude Fable 5 (claude-fable-5)

### Debug Log References

- 배포 실패 #1 (2835e2b6): Alembic env.py에서 configparser가 URL 인코딩 비밀번호의 `%`를 보간 문법으로 해석 → `database_url.replace("%", "%%")` 이스케이프로 해결
- 배포 실패 #2 (819a0fa3): 컨테이너가 8000 고정 포트로 리슨해 Railway 헬스체크(PORT 환경변수 기준) 실패 → Dockerfile CMD를 `${PORT:-8000}` shell 형태로 변경
- web 502: Railway 도메인 타깃 포트가 앱 리슨 포트(8080)와 불일치 → `railway domain update --port 8080`
- Supabase pooler 호스트는 `aws-1-ap-northeast-2`(aws-0 아님) — 로컬 사전 검증으로 발견. 스토리 Dev Notes의 aws-0 표기는 리전별로 다름을 확인
- Railway MCP 인증 불안정(간헐 Unauthorized) → CLI + IaC(`railway config apply`)로 우회. `.railway/railway.ts`가 서비스 설정의 진실 소스

### Completion Notes List

- 로컬: `docker compose up` → 헬스체크 200(PG17 연결), 404/422 에러 봉투 검증, pytest 3/3 통과
- 프로덕션: api 헬스체크 200 (Supabase Session pooler 연결), 에러 봉투 정상, Alembic pre-deploy 실행 확인(테이블 0 + alembic_version)
- 에러 code 시드: not_found / validation_error / internal_error
- Colima(도커 런타임) 신규 설치 — 전역 도구, `~/.docker/config.json`에 cliPluginsExtraDirs 추가로 compose 연결
- 미해결(후속): GitHub 푸시 자동 배포 미작동 — Railway GitHub App 설치 필요(대시보드에서 1회). 현재는 `railway up`으로 배포

### File List

- apps/api/pyproject.toml, uv.lock, Dockerfile, alembic.ini
- apps/api/app/main.py, app/core/{config,db,errors}.py
- apps/api/app/{auth,sellers,products,carts,orders,admin}/{router,service,models,schemas}.py
- apps/api/alembic/env.py, alembic/versions/6a946b59cb95_baseline_no_tables.py
- apps/api/tests/{conftest.py,test_health_and_errors.py}
- apps/web/ (Next.js 16.2 골격 + Dockerfile, next.config.ts standalone)
- apps/mobile/ (Flutter 3.44 골격 + flutter_riverpod)
- docker-compose.yml, .env.example, .gitignore, .railway/railway.ts, package.json
