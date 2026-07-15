# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트

SLUR 커머스 플랫폼 1호 — 운영자가 판매자를 직접 선별·초청하는 큐레이션형 디자인 편집숍 마켓플레이스(통신판매중개자 모델). 1차 목표는 매출이 아니라 **실서비스 완주**, 2차 목표는 완성 후 범용 커머스 블루프린트 추출. 기능 추가 판단 기준은 "완주에 기여하는가".

현재 **기획 단계** — 코드 없음. 빌드·테스트 명령은 구현 시작 후 이 파일에 추가할 것.

## 확정 문서 (여기서 시작)

| 문서 | 경로 |
|---|---|
| PRD (final) — FR-1~35, NFR, 용어집, ASSUMPTION 색인 | `_bmad-output/planning-artifacts/prds/prd-SLUR_platform_blueprint-2026-07-14/prd.md` |
| PRD 부록 — 기각 대안·기술 노트·벤치마킹 수치 | 같은 폴더 `addendum.md` |
| 프로덕트 브리프 (final) | `_bmad-output/planning-artifacts/briefs/brief-SLUR_platform_blueprint-2026-07-14/brief.md` |
| 리서치 (시장·PG·옵션모델) | PRD 폴더의 `research-*.md` |

요구사항 관련 질문은 PRD가 정답 소스다. 결정의 이유가 궁금하면 PRD 폴더의 `.memlog.md`(결정 이력)와 `addendum.md`(기각 대안 표)를 본다.

## 아키텍처 (확정)

- **FastAPI(Python)가 유일한 문지기.** 인증(JWT+bcrypt), RBAC, 상태 전이, 주문 로직 전부 FastAPI 소유. Flutter·Next.js는 FastAPI API만 호출한다.
- **Supabase는 매니지드 Postgres + Storage로만 사용.** Supabase Auth·RLS·Edge Functions는 의도적으로 배제된 결정이다 — 제안하지 말 것.
- 구매자: Flutter 모바일 앱 (Android 먼저, iOS는 이후). 판매자·관리자: Next.js PC 웹 단일 앱에서 Role 분기.
- 계정 모델: 단일 계정 + 역할(구매자/판매자/관리자 중복 보유 가능).
- 결제: v1 개발·내부 테스트는 무통장입금(관리자 수동 확인). **PG 연동이 실서비스 오픈의 선행 조건** — PG 전에 실제 외부 구매자를 받지 않는다 (에스크로·지급대행 규제 회피의 전제).
- 배포: Railway. Next.js CSS는 슬러 시스템 (`slur-ux`·`slur-design` 스킬 적용).

## 작업 규칙

- **ERD(DB 스키마)는 AI가 단독 확정하지 않는다.** 초안 제시 → Slur 승인 후 진행. 마이그레이션 작성 전에도 동일.
- PRD 화면 목록 밖 기능(리뷰·검색·알림 등)은 임의 추가하지 않는다. 필요해 보이면 근거와 함께 제안만 한다.
- 기획·문서 작업은 BMad 워크플로우(`.claude/skills/bmad-*`)를 쓰고, 산출물은 `_bmad-output/` 아래에 쌓인다.
- 소통·문서 언어: 한국어.
