"""평가 러너 — 평가셋을 던지고 자동 채점한다.

**화면 없이 채점하는 것이 요점이다.** 화면으로 시험하면 32문항에 30분이 걸리고,
프롬프트를 고칠 때마다 30분이 다시 든다. 여기서는 1분이면 한 바퀴가 돈다.
개발은 고치고-확인하는 반복이므로, 그 한 바퀴의 길이가 곧 개발 속도다.

채점이 자동인 이유는 모델이 `action`을 enum으로 내기 때문이다(llm.py 참조).
문장 품질은 사람이 봐야 하지만, **"거짓말했는가 / 사람에게 넘겼는가"는 기계가 잰다.**

🚨 검색과 생성을 **따로** 잰다. 답이 틀렸을 때 "못 찾은 건지, 찾았는데 못 쓴 건지"를
   가르지 못하면 어디를 고쳐야 할지 알 수 없다.

사용:
  uv run python scripts/eval_chat.py                        # 기준선(검색 없음)
  uv run python scripts/eval_chat.py --mode rag             # RAG
  uv run python scripts/eval_chat.py --mode rag --k 3 --min-score 0.55
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

from app.chat import baseline, rag, retriever  # noqa: E402
from app.chat.llm import OllamaProvider  # noqa: E402

EVALSET = Path(__file__).resolve().parents[3] / "docs" / "chatbot-evalset-v1.yaml"
RESULTS = Path(__file__).resolve().parent.parent / ".eval-results"

EXPECTED = {
    "doc_answer": "answer",
    "no_answer": "unknown",
    "escalate": "escalate",
    "api_lookup": "tool",
}
# 이 유형에서 'answer'가 나오면 지어낸 것이다 — 정답률과 별개로 따로 센다
HALLUCINATION_TYPES = {"no_answer", "api_lookup"}


async def run(args) -> dict:
    data = yaml.safe_load(EVALSET.read_text(encoding="utf-8"))
    items = [i for i in data["items"] if not args.only or i["type"] == args.only]
    provider = OllamaProvider(model=args.model)
    ret = retriever.load_index() if args.mode == "rag" else None

    rows, started = [], time.monotonic()
    for n, item in enumerate(items, 1):
        t0 = time.monotonic()
        hits = []
        try:
            if ret is None:
                reply = await baseline.answer(provider, item["q"])
            else:
                out = await rag.answer(provider, ret, item["q"], k=args.k, min_score=args.min_score)
                reply, hits = out.reply, out.hits
        except Exception as exc:  # 한 문항이 죽어도 나머지는 돌아야 한다
            reply = {"action": "error", "answer": f"{type(exc).__name__}: {exc}", "cited_ids": []}

        want = EXPECTED[item["type"]]
        ok = reply["action"] == want
        gold = item["gold"]
        found = [h.doc.locator for h in hits]
        rows.append({
            "id": item["id"], "q": item["q"], "type": item["type"],
            "want": want, "got": reply["action"], "ok": ok,
            "answer": reply["answer"],
            "gold": gold, "found": found,
            # gold가 있는 문항만 검색 채점 대상. 없는 문항은 '가장 높은 점수'가
            # 임계값을 정하는 재료가 된다 (관련 없는 문서가 몇 점까지 올라오는가)
            "retrieval_ok": (any(g in found for g in gold) if gold else None),
            "top_score": round(hits[0].score, 3) if hits else None,
            "sec": round(time.monotonic() - t0, 1),
        })
        mark = "✅" if ok else "❌"
        rmark = {True: "🔎", False: "🚫", None: "  "}[rows[-1]["retrieval_ok"]]
        print(f"  [{n:2}/{len(items)}] {mark}{rmark} {item['id']} "
              f"{want}→{reply['action']:9} {rows[-1]['sec']:>4}s  {item['q'][:26]}")

    return {"mode": args.mode, "model": args.model, "k": args.k, "min_score": args.min_score,
            "elapsed": round(time.monotonic() - started, 1), "rows": rows}


def report(res: dict) -> int:
    rows = res["rows"]
    total, ok = len(rows), sum(r["ok"] for r in rows)
    lies = [r for r in rows if r["type"] in HALLUCINATION_TYPES and r["got"] == "answer"]
    missed = [r for r in rows if r["type"] == "escalate" and r["got"] != "escalate"]

    label = "기준선(검색 없음)" if res["mode"] == "baseline" else f"RAG (k={res['k']}, 하한 {res['min_score']})"
    print(f"\n{'=' * 64}\n{label} · {res['model']}   총 {res['elapsed']}초\n{'=' * 64}")
    print(f"정답률   {ok}/{total}  ({ok / total * 100:.0f}%)")
    per = Counter()
    for r in rows:
        per[(r["type"], r["ok"])] += 1
    for t in EXPECTED:
        n = per[(t, True)] + per[(t, False)]
        if n:
            print(f"  {t:12} {per[(t, True)]}/{n}")

    # ── 검색 점수 (RAG일 때만) ──
    graded = [r for r in rows if r["retrieval_ok"] is not None]
    if graded:
        hit = sum(r["retrieval_ok"] for r in graded)
        print(f"\n검색 정확도  {hit}/{len(graded)}  ({hit / len(graded) * 100:.0f}%)"
              f"   정답 문서가 상위 {res['k']}개 안에 들어왔는가")
        for r in graded:
            if not r["retrieval_ok"]:
                print(f"  🚫 {r['id']} {r['q'][:30]}\n       원했던 것: {r['gold'][0][:48]}")
        noise = [r for r in rows if not r["gold"] and r["top_score"] is not None]
        if noise:
            top = max(r["top_score"] for r in noise)
            print(f"\n  참고 · 답이 없어야 하는 문항의 최고 점수: {top}"
                  f"   (하한을 이보다 높이면 걸러진다)")

    print(f"\n🚨 지어낸 답  {len(lies)}건   (근거가 없는데 답한 경우 — 1건이라도 있으면 배포 불가)")
    for r in lies:
        print(f"     {r['id']} {r['q']}\n        → {r['answer'][:80]}")
    print(f"🚨 놓친 연결  {len(missed)}건")
    for r in missed:
        print(f"     {r['id']} {r['q']}  ({r['got']})")

    wrong = [r for r in rows if not r["ok"] and r not in lies and r not in missed]
    if wrong:
        print(f"\n그 외 오답 {len(wrong)}건")
        for r in wrong:
            found = "검색 성공" if r["retrieval_ok"] else ("검색 실패" if r["retrieval_ok"] is False else "")
            print(f"     {r['id']} {r['want']}→{r['got']:9} {found:9} {r['q'][:32]}")

    RESULTS.mkdir(exist_ok=True)
    out = RESULTS / f"{res['mode']}-{res['model'].replace(':', '_')}.json"
    out.write_text(json.dumps(res, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n결과 저장: .eval-results/{out.name}")
    return 0 if not lies and not missed else 1


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--mode", choices=["baseline", "rag"], default="baseline")
    p.add_argument("--model", default="llama3.1:8b")
    p.add_argument("--k", type=int, default=5, help="검색으로 가져올 조각 수")
    p.add_argument("--min-score", type=float, default=0.0, help="이 점수 미만은 버린다")
    p.add_argument("--only", choices=list(EXPECTED))
    a = p.parse_args()
    return report(asyncio.run(run(a)))


if __name__ == "__main__":
    raise SystemExit(main())
