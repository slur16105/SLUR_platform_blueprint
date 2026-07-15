# 기술 검증 리뷰 — ARCHITECTURE-SPINE.md

- **대상:** `ARCHITECTURE-SPINE.md` (2026-07-15)
- **비교 자료:** `research-stack-versions.md` (2026-07-15 웹 검증본)
- **검증일:** 2026-07-15, 미검증 주장 5건은 직접 웹 재확인
- **판정: 조건부 통과** — Stack 표는 전 항목 research 근거 있음. 단 research에 근거 없는 기술 단정 2건이 수정 필요(UUIDv7×PG17, bcrypt), 리스크 노트 2건.

---

## 1. Stack 표 대조 (스파인 ↔ research 파일)

| 스파인 항목 | research 근거 | 판정 |
| --- | --- | --- |
| Python 3.14 | §1 (3.14.6, endoflife.date) | 일치 |
| FastAPI 0.139 | §1 (0.139.0, PyPI) | 일치 |
| Pydantic 2.13 | §1 (2.13.4) | 일치 |
| SQLAlchemy 2.0.51 (async+asyncpg) | §1 (2.1은 베타 → 2.0 핀 근거 명시) | 일치 |
| Alembic 1.18 | §1 (1.18.5) | 일치 |
| uv 0.11 | §1 (0.11.28) | 일치 |
| Next.js 16.2 (App Router) | §3 (16.2.10, LTS) | 일치 |
| React 19.2 | §3 (19.2.7) | 일치 |
| Flutter 3.44 / Dart 3.12 | §4 | 일치 |
| Riverpod 3.x | §4 (2026 커뮤니티 컨센서스 링크) | 일치 — 단 §3-C 리스크 노트 참조 |
| Supabase Postgres 17 | §5 (신규 프로젝트 기본값, PG14 종료) | 일치 |
| Railway 서비스별 Dockerfile | §5 (Railpack 기본이나 Dockerfile 우위 근거) | 일치 |

Stack 표 자체는 훈련 데이터 단정 없이 전부 research 파일에 소급된다. 도메인 모듈 구조 채택(계층형 템플릿 구조 대신)도 research §2에 근거 있음.

## 2. research에 근거 없던 주장 — 직접 웹 확인 결과

### 2-A. [수정 필요] AD-8 "PK는 UUIDv7" × Supabase PG17
- **확인 결과:** 네이티브 `uuidv7()` 함수는 **PostgreSQL 18부터** 제공된다. PG17에는 없다 (17 개발 사이클에서 탈락, 18에 수록 — thenile.dev, neon.com, aiven.io 다수 확인).
- **문제:** 스파인은 PG17을 핀하면서 UUIDv7 생성 주체를 명시하지 않았다. research 파일에도 UUIDv7 관련 조사 없음 — 훈련 데이터 단정으로 판단.
- **조치:** AD-8에 생성 전략을 명시할 것. 현 스택에서 현실적 선택지: (a) **애플리케이션 생성** — Python 3.14 표준 라이브러리 `uuid.uuid7()` 사용(스택과 정합, 권장), (b) `pg_uuidv7` 확장(Supabase 지원 여부 별도 확인 필요), (c) PG18 승격 대기. (a)를 채택하면 DB DEFAULT가 아닌 앱 레이어 발급임을 규칙에 적시해야 한다.

### 2-B. [수정 권고] AD-5 "비밀번호는 bcrypt"
- **확인 결과:** OWASP Password Storage Cheat Sheet 현행 권장 순위는 **Argon2id(1순위) > scrypt > bcrypt(레거시/불가피 시)**. bcrypt는 신규 시스템 기본 선택이 아니다.
- **문제:** research 파일에 해싱 알고리즘 조사가 전혀 없음 — 훈련 데이터의 관성적 선택으로 판단.
- **조치:** 신규 구축이므로 **Argon2id**(최소 19MiB/t=2/p=1, 여유 시 64MiB/t=3)로 교체 권고. bcrypt를 유지한다면 cost 12+ 명시와 함께 선택 사유를 스파인에 기록할 것.

### 2-C. [확인됨] Railway pre-deploy 단계 존재
- 공식 문서 `docs.railway.com/deployments/pre-deploy-command` 및 2025-01-10 changelog로 확인. 빌드와 배포 사이에 실행되며 마이그레이션 용도가 공식 예시. `railway.toml`의 `preDeployCommand`로도 설정 가능. 스파인의 "Alembic 마이그레이션은 pre-deploy에서 실행" 서술은 유효 (research §5에도 언급 있었음).

### 2-D. [확인됨] asyncpg 호환성
- 최신 asyncpg **0.31.0** (2025-11-24): Python 3.14 지원(휠 제공, free-threading은 experimental), PostgreSQL 9.5~18 지원. Python 3.14 + SQLAlchemy 2.0 async + PG17 조합에 문제 없음.
- **경미한 공백:** research 파일과 스파인 모두 asyncpg 버전 핀이 없다. 의존성 확정 시 `asyncpg>=0.31` 명시 권장.

### 2-E. [확인됨, 리스크 노트] Riverpod 3 안정성
- 3.0 stable은 2025-09-10 출시 — "3.x가 신규 앱 기본"이라는 research 서술과 부합.
- **주의:** 공식 changelog가 3.0을 "transition version — 4.0.0이 비교적 이른 시일에 나올 수 있음"이라 명시. offline persistence·mutations는 아직 experimental. 채택 유지는 타당하나, experimental API에 의존하지 않는다는 가드를 프론트 컨벤션 확정 시(Deferred 항목) 포함 권장.

### 2-F. [확인됨] Supabase Storage 사전서명 업로드 URL
- `createSignedUploadUrl`(유효 2시간) 공식 지원 확인 — 서버(FastAPI)가 발급하고 클라이언트가 직접 업로드하는 스파인의 패턴(AD-1 연장)은 공식 지원 플로우와 정확히 일치.

## 3. 검증 불요 판정 항목

- JWT access 30분 + refresh, CHECK 제약 vs PG enum, page 기반 페이지네이션, 조건부 UPDATE 재고 차감 — 버전·존재 여부와 무관한 설계 선택으로, 웹 검증 대상 아님.
- 카카오 OAuth — 서비스 존속 자명, 스파인은 구현 상세를 주장하지 않음.

## 4. 종합

| # | 발견 | 심각도 | 조치 |
| --- | --- | --- | --- |
| 1 | UUIDv7 네이티브 함수는 PG18부터 — PG17 핀과 생성 전략 미명시 충돌 | 높음 | AD-8에 앱 레이어 생성(`uuid.uuid7()`) 명시 |
| 2 | bcrypt는 OWASP 현행 3순위 — 신규 시스템 기본 아님 | 중간 | AD-5를 Argon2id로 교체 또는 사유 기록 |
| 3 | asyncpg 버전 핀 부재 (호환성 자체는 문제 없음, 0.31.0) | 낮음 | 의존성 확정 시 핀 추가 |
| 4 | Riverpod 3.0은 공식 "transition version" | 낮음 | experimental API 비의존 가드 |
| 5 | Railway pre-deploy·Supabase signed upload URL·Stack 표 전 항목 | — | 이상 없음 |

### 주요 출처
- UUIDv7/PG18: https://www.thenile.dev/blog/uuidv7 , https://neon.com/postgresql/18/uuidv7-support , https://aiven.io/blog/exploring-postgresql-18-new-uuidv7-support
- 비밀번호 해싱: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- asyncpg: https://github.com/MagicStack/asyncpg/releases , https://pypi.org/project/asyncpg/
- Railway pre-deploy: https://docs.railway.com/deployments/pre-deploy-command , https://railway.com/changelog/2025-01-10-pre-deploy-command
- Riverpod 3: https://riverpod.dev/docs/whats_new , https://pub.dev/packages/riverpod/changelog
- Supabase 서명 업로드: https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl
