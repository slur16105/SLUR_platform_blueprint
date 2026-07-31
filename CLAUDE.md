# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트

**SLUR Market** — 운영자가 판매자를 직접 선별·초청하는 큐레이션형 디자인 편집숍 마켓플레이스(통신판매중개자 모델). 목표는 **실서비스 오픈**이며, 기능 추가 판단 기준은 "오픈에 기여하는가".

이름: 2026-08-01에 `SLUR Platform Blueprint` → `SLUR Market`으로 변경. "범용 청사진 추출"이라는 2차 목표는 폐기됐다(실서비스로 방향 확정). 저장소 주소·기획 문서 폴더명에는 옛 이름이 남아 있으며 **바꾸지 않는다** — 그 시점 기록의 좌표다.

**구현 상태 (2026-07-30): v1 전 스토리(Epic 1~6) 완주 + Epic 8(구매자 반응형 웹 전환) 완료 — 실기 검증까지 마쳤다.** Epic 9(구매자 홈 편성)는 구현·리뷰 완료 `review`. 잔여는 실서비스 오픈 게이트 항목(`_bmad-output/implementation-artifacts/deferred-work.md` 참조): PG 연동, 사업자 실정보·법률 검토, 도서산간 공식 대조 등.

## 명령어

```bash
# API (apps/api) — 로컬 Postgres는 docker compose up
cd apps/api && uv run pytest -q          # 전체 테스트 (236 — 마지막 실측 2026-08-01)
# 테스트는 전용 DB(slur_test)를 자동 생성·마이그레이션한다 — 개발용 slur DB를 건드리지 않는다.
# 접속 정보는 DATABASE_URL(또는 apps/api/.env)에서 DB 이름만 바꿔 쓴다. 별도 준비 불필요.
uv run alembic upgrade head              # 마이그레이션
# 웹 (apps/web)
cd apps/web && npx tsc --noEmit && npm run lint
# Hub맥 로컬 테스트: docker compose up -d --build --wait (API·web·Postgres·Alembic)
# Railway는 기존 배포 검증 환경이며, 종료 결정 전까지 유지한다. 상세: LOCAL_DOCKER.md
```

## 확정 문서 (여기서 시작)

| 문서 | 경로 |
|---|---|
| PRD (final) — FR-1~35, NFR, 용어집, ASSUMPTION 색인 | `_bmad-output/planning-artifacts/prds/prd-SLUR_Market-2026-07-14/prd.md` |
| PRD 부록 — 기각 대안·기술 노트·벤치마킹 수치 | 같은 폴더 `addendum.md` |
| 프로덕트 브리프 (final) | `_bmad-output/planning-artifacts/briefs/brief-SLUR_Market-2026-07-14/brief.md` |
| 리서치 (시장·PG·옵션모델) | PRD 폴더의 `research-*.md` |

요구사항 관련 질문은 PRD가 정답 소스다. 결정의 이유가 궁금하면 PRD 폴더의 `.memlog.md`(결정 이력)와 `addendum.md`(기각 대안 표)를 본다.

## 아키텍처 (확정)

- **FastAPI(Python)가 유일한 문지기.** 인증(JWT+bcrypt), RBAC, 상태 전이, 주문 로직 전부 FastAPI 소유. Next.js는 FastAPI API만 호출한다.
- **Supabase는 매니지드 Postgres + Storage로만 사용.** Supabase Auth·RLS·Edge Functions는 의도적으로 배제된 결정이다 — 제안하지 말 것.
- **클라이언트 표면은 Next.js 웹 하나다 (AD-14).** 구매자·판매자·관리자가 같은 앱에서 Role로 갈린다 — 구매자 라우트는 모바일 퍼스트 반응형+PWA, 판매자·관리자 라우트는 PC 폭. (구매자 Flutter 앱은 2026-07-21 코스 코렉션으로 웹 전환, 2026-07-30 저장소에서 제거 — 소스는 태그 `flutter-app-final`에 보존)
- 계정 모델: 단일 계정 + 역할(구매자/판매자/관리자 중복 보유 가능).
- 결제: v1 개발·내부 테스트는 무통장입금(관리자 수동 확인). **PG 연동이 실서비스 오픈의 선행 조건** — PG 전에 실제 외부 구매자를 받지 않는다 (에스크로·지급대행 규제 회피의 전제).
- Hub맥 테스트 배포: Docker Compose(API·web·로컬 Postgres). Railway는 종료 결정 전까지 기존 배포 검증 환경으로만 유지한다. Next.js CSS는 슬러 시스템 (`slur-ux`·`slur-design` 스킬 적용).

## 작업 규칙

- **ERD(DB 스키마)는 AI가 단독 확정하지 않는다.** 초안 제시 → Slur 승인 후 진행. 마이그레이션 작성 전에도 동일.
- PRD 화면 목록 밖 기능(리뷰·검색·알림 등)은 임의 추가하지 않는다. 필요해 보이면 근거와 함께 제안만 한다.
- 기획·문서 작업은 BMad 워크플로우(`.claude/skills/bmad-*`)를 쓰고, 산출물은 `_bmad-output/` 아래에 쌓인다.
- 소통·문서 언어: 한국어.

## Orca 단일 레인 세션 규칙

- 기본 작업 위치는 `main`이며, 하나의 BMAD 작업만 진행한다. 병렬·실험 작업에만 별도 worktree를 만든다.
- 새 세션 시작 전 `.orca/SESSION_HANDOFF.md`, `sprint-status.yaml`, 현재 Story/계획 문서를 읽는다. 핸드오프 `state`가 `ready`가 아니면 새 구현을 시작하지 않는다.
- 작업 시작·조사·구현·검증·결정대기·완료의 각 의미 있는 단계에서 `orca worktree set --worktree active --comment "..."`으로 Orca 모바일 카드 상태를 갱신한다.
- 세션 종료 전 `.orca/SESSION_HANDOFF.md`에 완료 작업, 실제 테스트 결과 또는 미실행 사유, Git/원격 상태, 다음 BMAD 워크플로우·다음 액션·Dan 결정 필요 사항을 기록한다. 그 뒤 state를 `ready` 또는 `blocked`로 바꾼다.
- `in-progress` 세션은 정리하거나 다음 세션을 자동 시작하지 않는다. Git 작업 트리가 clean이고 `main`과 `origin/main`이 동기화된 경우에만 세션 정리를 완료한다.
- `scripts/orca_next_session.py`의 `status`, `cleanup`, `start`가 이 규칙의 표준 실행 경로다.
