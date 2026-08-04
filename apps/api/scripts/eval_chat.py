"""평가 러너 — 평가셋을 던지고 자동 채점한다.

**화면 없이 채점하는 것이 요점이다.** 화면으로 시험하면 32문항에 30분이 걸리고,
프롬프트를 고칠 때마다 30분이 다시 든다. 여기서는 2분이면 한 바퀴가 돈다.
개발은 고치고-확인하는 반복이므로, 그 한 바퀴의 길이가 곧 개발 속도다.

채점이 자동인 이유는 모델이 `action`을 enum으로 내기 때문이다(llm.py 참조).
문장 품질은 사람이 봐야 하지만, **"거짓말했는가 / 사람에게 넘겼는가"는 기계가 잰다.**

사용:
  uv run python scripts/eval_chat.py                 # 기준선, 기본 모델
  uv run python scripts/eval_chat.py --model qwen3:8b
  uv run python scripts/eval_chat.py --only no_answer
"""

import argparse
import asyncio
import json
import sys
import time
from collections import Counter
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.chat import baseline  # noqa: E402
from app.chat.llm import OllamaProvider  # noqa: E402

EVALSET = Path(__file__).resolve().parents[3] / "docs" / "chatbot-evalset-v1.yaml"
RESULTS = Path(__file__).resolve().parent.parent / ".eval-results"

# 평가셋의 type → 기대하는 action
EXPECTED = {
    "doc_answer": "answer",
    "no_answer": "unknown",
    "escalate": "escalate",
    "api_lookup": "tool",
}
# 이 유형에서 'answer'가 나오면 지어낸 것이다 — 정답률과 별개로 따로 센다
HALLUCINATION_TYPES = {"no_answer", "api_lookup"}


async def run(model: str, only: str | None) -> dict:
    data = yaml.safe_load(EVALSET.read_text(encoding="utf-8"))
    items = [i for i in data["items"] if not only or i["type"] == only]
    provider = OllamaProvider(model=model)

    rows, started = [], time.monotonic()
    for n, item in enumerate(items, 1):
        t0 = time.monotonic()
        try:
            reply = await baseline.answer(provider, item["q"])
        except Exception as exc:  # 한 문항이 죽어도 나머지는 돌아야 한다
            reply = {"action": "error", "answer": f"{type(exc).__name__}: {exc}", "cited_ids": []}
        want = EXPECTED[item["type"]]
        ok = reply["action"] == want
        rows.append({
            "id": item["id"], "q": item["q"], "type": item["type"],
            "want": want, "got": reply["action"], "ok": ok,
            "answer": reply["answer"], "cited_ids": reply["cited_ids"],
            "sec": round(time.monotonic() - t0, 1),
        })
        print(f"  [{n:2}/{len(items)}] {'✅' if ok else '❌'} {item['id']} "
              f"{want}→{reply['action']:9} {rows[-1]['sec']:>4}s  {item['q'][:28]}")

    return {"model": model, "elapsed": round(time.monotonic() - started, 1), "rows": rows}


def report(res: dict) -> int:
    rows = res["rows"]
    total, ok = len(rows), sum(r["ok"] for r in rows)
    lies = [r for r in rows if r["type"] in HALLUCINATION_TYPES and r["got"] == "answer"]
    missed = [r for r in rows if r["type"] == "escalate" and r["got"] != "escalate"]

    print(f"\n{'=' * 62}\n모델: {res['model']}   총 {res['elapsed']}초 "
          f"(문항당 평균 {res['elapsed'] / max(total, 1):.1f}초)\n{'=' * 62}")
    print(f"정답률   {ok}/{total}  ({ok / total * 100:.0f}%)")

    per = Counter()
    for r in rows:
        per[(r["type"], r["ok"])] += 1
    for t in EXPECTED:
        n = per[(t, True)] + per[(t, False)]
        if n:
            print(f"  {t:12} {per[(t, True)]}/{n}")

    print(f"\n🚨 지어낸 답  {len(lies)}건   (근거가 없는데 답한 경우 — 1건이라도 있으면 배포 불가)")
    for r in lies:
        print(f"     {r['id']} {r['q']}\n        → {r['answer'][:80]}")
    print(f"🚨 놓친 연결  {len(missed)}건   (사람에게 넘겼어야 하는데 직접 답한 경우)")
    for r in missed:
        print(f"     {r['id']} {r['q']}  ({r['got']})")

    wrong = [r for r in rows if not r["ok"] and r not in lies and r not in missed]
    if wrong:
        print(f"\n그 외 오답 {len(wrong)}건")
        for r in wrong:
            print(f"     {r['id']} {r['want']}→{r['got']}  {r['q'][:40]}")

    RESULTS.mkdir(exist_ok=True)
    out = RESULTS / f"baseline-{res['model'].replace(':', '_')}.json"
    out.write_text(json.dumps(res, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n결과 저장: {out.relative_to(Path.cwd()) if out.is_relative_to(Path.cwd()) else out}")
    return 0 if not lies and not missed else 1


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--model", default="llama3.1:8b")
    p.add_argument("--only", choices=list(EXPECTED))
    a = p.parse_args()
    print(f"평가 시작 — 기준선(검색 없음) · {a.model}\n")
    return report(asyncio.run(run(a.model, a.only)))


if __name__ == "__main__":
    raise SystemExit(main())
