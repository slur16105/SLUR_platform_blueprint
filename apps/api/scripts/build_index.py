"""색인 만들기 — 문서 조각을 좌표로 바꿔 파일에 저장한다.

**바뀐 조각만 다시 만든다.** 조각의 지문(content_hash)을 대조해서, 이미 있고 지문이
같으면 건너뛴다. 32개짜리에선 별 차이가 없지만, 문의 이력 수천 건으로 넘어가면
이 구조가 있어야 재색인이 몇 초로 끝난다.

만든 파일은 **커밋한다.** Hub맥에는 Ollama가 없어 배포 환경에서 좌표를 만들 수 없다.
만드는 것은 여기서, 쓰는 것은 어디서나.

사용:
  uv run python scripts/build_index.py          # 바뀐 것만
  uv run python scripts/build_index.py --all    # 전부 다시
"""

import argparse
import asyncio
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.chat import corpus, embed  # noqa: E402
from app.chat.retriever import INDEX_PATH  # noqa: E402

ROUND = 6  # 소수 6자리면 검색 순위가 바뀌지 않고 파일이 3분의 1로 준다


async def build(rebuild_all: bool) -> int:
    docs = corpus.load_docs()
    existing: dict[str, dict] = {}
    if INDEX_PATH.exists() and not rebuild_all:
        data = json.loads(INDEX_PATH.read_text(encoding="utf-8"))
        if data.get("model") == embed.MODEL:
            existing = {i["locator"]: i for i in data["items"]}

    todo = [d for d in docs if existing.get(d.locator, {}).get("content_hash") != d.id]
    kept = len(docs) - len(todo)
    print(f"조각 {len(docs)}개 · 그대로 둘 것 {kept}개 · 새로 만들 것 {len(todo)}개")

    items = [existing[d.locator] for d in docs if d.locator in existing and d not in todo]
    if todo:
        t0 = time.monotonic()
        vectors = await embed.embed([d.text for d in todo])
        print(f"좌표 생성 {time.monotonic() - t0:.1f}초 ({embed.MODEL}, {len(vectors[0])}차원)")
        items += [
            {"locator": d.locator, "content_hash": d.id, "vector": [round(x, ROUND) for x in v]}
            for d, v in zip(todo, vectors)
        ]

    # 문서 순서대로 정렬해 두면 diff가 읽히고, 조각 하나가 바뀔 때 파일 전체가 흔들리지 않는다
    order = {d.locator: i for i, d in enumerate(docs)}
    items.sort(key=lambda i: order.get(i["locator"], 1 << 30))
    items = [i for i in items if i["locator"] in order]  # 사라진 문서의 좌표는 버린다

    INDEX_PATH.write_text(
        json.dumps({"model": embed.MODEL, "dim": embed.DIM, "items": items},
                   ensure_ascii=False, indent=1) + "\n",
        encoding="utf-8",
    )
    size = INDEX_PATH.stat().st_size / 1024
    print(f"저장: {INDEX_PATH.name}  좌표 {len(items)}개 · {size:.0f}KB")
    return 0


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--all", action="store_true", help="바뀌지 않은 조각도 전부 다시 만든다")
    return asyncio.run(build(p.parse_args().all))


if __name__ == "__main__":
    raise SystemExit(main())
