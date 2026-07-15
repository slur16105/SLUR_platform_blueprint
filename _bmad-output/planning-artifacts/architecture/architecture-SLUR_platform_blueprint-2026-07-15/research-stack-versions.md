# 스택 최신 버전 검증 (2026-07-15, 웹 리서치)

## 1. Python / FastAPI 생태계
- **Python 3.14.6** (2026-06-10, 최신 안정 라인) — 보수적으로 가려면 3.13.14 (2026-10 액티브 지원 종료 임박이므로 3.14 권장) — https://endoflife.date/python
- **FastAPI 0.139.0** (2026-07-01) — https://pypi.org/project/fastapi/
- **Pydantic 2.13.4** (2026-05-06) — v2가 완전한 표준 — https://pypi.org/project/pydantic/
- **SQLAlchemy 2.0.51** (2026-06-15, 2.1은 아직 베타 b3 → 2.0 라인에 핀) — https://pypi.org/project/sqlalchemy/
- **Alembic 1.18.5** (2026-06-25) — https://pypi.org/project/alembic/
- **uv 0.11.28** (2026-07-07) — FastAPI 팀 공식 권장 패키지 매니저. 2026년 커뮤니티에서 poetry를 사실상 대체 — https://pypi.org/project/uv/
- ORM 선택: 커머스급 복잡 쿼리에는 **SQLAlchemy 2.0 (async + asyncpg) 직접 사용이 커뮤니티 주류**. SQLModel(0.0.x, 여전히 1.0 미만)은 tiangolo 템플릿 기본값이지만 복잡한 도메인엔 SQLAlchemy 순정 권장 의견이 우세 — https://fastapi.tiangolo.com/tutorial/sql-databases/

## 2. FastAPI 템플릿/구조 관례
- **fastapi/full-stack-fastapi-template v0.10.0** (2026-01-23, 44k+ stars): FastAPI + SQLModel + PostgreSQL + uv + React(Vite, Tailwind + shadcn/ui로 최근 전환) + JWT + Docker Compose + GitHub Actions. Copier로 생성. 백엔드는 **계층(layered) 구조**(api/routes, models, crud 평면 분리)이지 도메인 모듈 구조 아님 — https://github.com/fastapi/full-stack-fastapi-template
- 커머스/대형 모놀리스에는 도메인별 패키지 구조(zhanymkanov/fastapi-best-practices 스타일: `src/{domain}/router|schemas|service|models`)가 커뮤니티 관례로 정착 — 템플릿 구조를 그대로 쓰기보다 도메인 모듈로 재구성하는 게 일반적

## 3. Next.js / React
- **Next.js 16.2.10** (2026-07-01, 16은 LTS·App Router+Turbopack 기본, Node 20+ 필요) — https://endoflife.date/nextjs , https://nextjs.org/blog/next-16
- **React 19.2.7** (2026-06) — https://react.dev/versions

## 4. Flutter / Dart
- **Flutter 3.44** (2026-05 안정, 다음 3.47은 8월 예정) + **Dart 3.12** — https://docs.flutter.dev/install/archive
- 주의: 3.44부터 Material/Cupertino가 SDK에서 분리되는 과도기(material_ui 패키지화 진행), Android 10+ Impeller 강제
- 상태관리: **Riverpod 3.x가 신규 앱 기본 선택**(async-first, codegen), Bloc 9.x는 대형 팀 표준으로 병존. 신규 커머스 앱엔 Riverpod 3 권장이 2026 커뮤니티 컨센서스 — https://asoasis.tech/articles/2026-04-17-2054-flutter-bloc-vs-riverpod-comparison-2026/

## 5. Supabase / Railway
- **Supabase Postgres 17** — 신규 프로젝트 기본값(플랫폼·셀프호스트 모두, 2026-06부터 self-host도 17). PG14 지원은 2026-07-01 종료 — https://supabase.com/changelog/46080-self-hosted-supabase-upgrading-from-pg-15-to-17-breaking-change
- Railway 빌드: 기본은 **Railpack**(Nixpacks 후속, Nixpacks는 유지보수 모드). 단 FastAPI·Next.js(standalone output) 모두 **커스텀 Dockerfile이 빌드 속도·재현성에서 우위**라 프로덕션 표준 구성은 서비스별 Dockerfile + Railway pre-deploy에서 Alembic 마이그레이션 실행 — https://docs.railway.com/guides/nextjs , https://blog.railway.com/p/comparing-deployment-methods-in-railway

## 권장 핀 요약 (스파인용)
Python 3.14 / FastAPI 0.139 / Pydantic 2.13 / SQLAlchemy 2.0.51(async) / Alembic 1.18 / uv 0.11 / Next.js 16.2(App Router) / React 19.2 / Flutter 3.44 + Dart 3.12 + Riverpod 3 / Supabase PG17 / Railway Dockerfile 빌드
