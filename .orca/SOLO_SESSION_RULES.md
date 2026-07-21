# SLUR 단일 레인 세션 운영 규칙

## 원칙

- 기본 작업 위치는 `main`이다. 한 번에 하나의 BMAD 작업만 실행한다.
- 별도 worktree는 병렬 작업, 실험, 대규모 리팩터링, 안전한 검토가 필요할 때만 만든다.
- 세션의 기억은 대화창이 아니라 `.orca/SESSION_HANDOFF.md`와 BMAD `sprint-status.yaml`에 남긴다.

## 시작 자동화 전 검사

다음 네 조건을 모두 통과해야 새 Claude/BMAD 세션을 시작한다.

1. Git 작업 트리가 clean이다.
2. 현재 `main`과 `origin/main`의 커밋이 같다.
3. 기존 핸드오프 `state`가 `ready`다.
4. 실행 중인 BMAD Claude 터미널이 없다.

하나라도 실패하면 새 세션을 열지 않고, 상태만 보고한다.

## 작업 중 기준

- 시작 직후: `CLAUDE.md`, `.orca/SESSION_HANDOFF.md`, `sprint-status.yaml`, 현재 Story/계획 문서를 읽는다.
- Orca 작업 카드 comment를 `조사`, `구현`, `검증`, `결정 대기`, `완료`처럼 짧게 갱신한다.
- ERD/DB 스키마, 결제, 배포, PRD 범위 확장은 `blocked`로 전환하고 Dan의 결정을 받는다.
- 요청 범위 안에서는 파일 수정·테스트·Git 검증을 Auto Mode로 진행한다.

## 세션 정리 완료 기준

다음 항목을 모두 만족해야 세션을 정리한다.

1. BMAD 현재 단계와 결과가 문서화됐다.
2. 관련 테스트의 실제 결과가 기록됐다. 실행하지 못했으면 이유가 기록됐다.
3. `git diff` / `git status` / 원격 동기화 결과가 기록됐다.
4. `.orca/SESSION_HANDOFF.md`에 다음 BMAD 스킬·다음 액션·결정 필요 사항이 기록됐다.
5. 핸드오프 `state`가 `ready` 또는 `blocked`다. (`in-progress`면 종료 금지)
6. Git 작업 트리가 clean이고 원격과 동기화됐다. 미커밋·미푸시 변경이 있으면 정리 실패다.

## 상태 의미

- `in-progress`: 작업 중. 다음 세션을 자동 시작하거나 현재 터미널을 닫지 않는다.
- `ready`: 검증·동기화·핸드오프가 완료됐다. 다음 세션 자동 시작 가능.
- `blocked`: Dan의 결정이 필요하다. 다음 세션 자동 시작 금지.

## 다음 작업 실행

Hub맥의 프로젝트 루트에서 실행한다.

```bash
python3 scripts/orca_next_session.py status
python3 scripts/orca_next_session.py cleanup
python3 scripts/orca_next_session.py start
```

`start`는 `ready`일 때만 Orca의 새 Claude Auto Mode 터미널을 열고, 핸드오프 기준 BMAD 작업을 시작한다.
