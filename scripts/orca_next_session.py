#!/usr/bin/env python3
"""SLUR의 Orca + BMAD 단일 레인 세션 시작/정리 도우미.

외부 패키지 없이 macOS의 python3와 Orca CLI만 사용한다.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HANDOFF = ROOT / ".orca" / "SESSION_HANDOFF.md"
BMAD_TITLE = "BMAD 자동 세션"


def run(*args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(args, cwd=ROOT, text=True, capture_output=True, check=check)


def orca(*args: str, check: bool = True) -> dict:
    completed = run("orca", *args, "--json", check=check)
    if completed.returncode:
        raise RuntimeError(completed.stderr.strip() or completed.stdout.strip())
    try:
        payload = json.loads(completed.stdout)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Orca 응답을 읽지 못했습니다: {exc}") from exc
    if not payload.get("ok", False):
        raise RuntimeError(str(payload))
    return payload["result"]


def git_output(*args: str) -> str:
    completed = run("git", *args)
    if completed.returncode:
        raise RuntimeError(completed.stderr.strip())
    return completed.stdout.strip()


def handoff_state() -> str:
    if not HANDOFF.exists():
        return "missing"
    match = re.search(r"^state:\s*([\w-]+)\s*$", HANDOFF.read_text(), re.MULTILINE)
    return match.group(1) if match else "missing"


def git_state() -> dict:
    return {
        "branch": git_output("branch", "--show-current"),
        "dirty": bool(git_output("status", "--porcelain")),
        "head": git_output("rev-parse", "HEAD"),
        "remote": git_output("rev-parse", "origin/main"),
    }


def bmad_terminals() -> list[dict]:
    result = orca("terminal", "list", "--worktree", f"path:{ROOT}")
    # Claude가 작업 중이면 Orca가 제목 앞에 스피너를 붙이고 내용을 바꿀 수 있다.
    # 따라서 접두사가 아니라 제목 전체의 BMAD 표기를 기준으로 추적한다.
    return [
        terminal for terminal in result.get("terminals", [])
        if terminal.get("connected") and "BMAD" in terminal.get("title", "")
    ]


def readiness() -> tuple[bool, list[str], dict]:
    info = git_state()
    reasons: list[str] = []
    state = handoff_state()
    terminals = bmad_terminals()
    if info["branch"] != "main":
        reasons.append(f"현재 브랜치가 main이 아닙니다: {info['branch']}")
    if info["dirty"]:
        reasons.append("Git 작업 트리에 미커밋 변경이 있습니다")
    if info["head"] != info["remote"]:
        reasons.append("main과 origin/main이 동기화되지 않았습니다")
    if state != "ready":
        reasons.append(f"핸드오프 상태가 ready가 아닙니다: {state}")
    if terminals:
        reasons.append("실행 중인 BMAD Orca 터미널이 있습니다")
    info.update({"handoff_state": state, "bmad_terminals": terminals})
    return (not reasons, reasons, info)


def status() -> int:
    runtime = orca("status")
    safe, reasons, info = readiness()
    print(json.dumps({
        "orca_ready": runtime.get("runtime", {}).get("reachable", False),
        "start_ready": safe,
        "blockers": reasons,
        "state": info,
    }, ensure_ascii=False, indent=2))
    return 0


def cleanup() -> int:
    # 정리는 in-progress 세션이나 미동기화 Git을 절대로 건드리지 않는다.
    info = git_state()
    state = handoff_state()
    if info["dirty"] or info["head"] != info["remote"] or state not in {"ready", "blocked"}:
        print("정리 중단: handoff/Git 조건이 충족되지 않았습니다.", file=sys.stderr)
        return 2
    terminals = bmad_terminals()
    for terminal in terminals:
        handle = terminal["handle"]
        waited = orca("terminal", "wait", "--terminal", handle, "--for", "tui-idle", "--timeout-ms", "1000")
        if not waited.get("wait", {}).get("satisfied"):
            print(f"정리 중단: {terminal['title']}가 idle 상태가 아닙니다.", file=sys.stderr)
            return 2
    for terminal in terminals:
        orca("terminal", "close", "--terminal", terminal["handle"])
    comment = "세션 정리 완료 — 다음 작업 준비" if state == "ready" else "결정 대기 — Dan 확인 필요"
    orca("worktree", "set", "--worktree", f"path:{ROOT}", "--comment", comment)
    print(comment)
    return 0


def start() -> int:
    safe, reasons, _ = readiness()
    if not safe:
        print("다음 세션을 시작하지 않았습니다:", *reasons, sep="\n- ", file=sys.stderr)
        return 2
    created = orca(
        "terminal", "create", "--worktree", f"path:{ROOT}", "--title", BMAD_TITLE,
        "--command", "DISABLE_AUTOUPDATER=1 claude --permission-mode auto",
    )
    handle = created["terminal"]["handle"]
    orca("terminal", "wait", "--terminal", handle, "--for", "tui-idle", "--timeout-ms", "60000")
    prompt = (
        "새 SLUR BMAD 세션을 시작해. 먼저 CLAUDE.md, .orca/SESSION_HANDOFF.md, "
        "_bmad-output/implementation-artifacts/sprint-status.yaml 및 handoff가 가리키는 문서를 읽어. "
        "핸드오프에 기록된 다음 BMAD 워크플로우만 수행해. 시작과 각 중요한 단계에서 "
        "`orca worktree set --worktree active --comment ...`으로 모바일 카드 상태를 갱신해. "
        "세션 종료 전 테스트·Git·다음 액션을 handoff에 갱신하고 state를 ready 또는 blocked로 설정해. "
        "ERD/DB·결제·배포·PRD 범위 확장은 Dan의 승인 없이는 진행하지 마. 커밋·푸시도 별도 승인 전에는 하지 마."
    )
    orca("terminal", "send", "--terminal", handle, "--text", prompt, "--enter")
    print(f"Orca Claude 세션을 시작했습니다: {handle}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=("status", "cleanup", "start"))
    args = parser.parse_args()
    try:
        return {"status": status, "cleanup": cleanup, "start": start}[args.command]()
    except (RuntimeError, subprocess.SubprocessError, KeyError) as exc:
        print(f"오류: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
