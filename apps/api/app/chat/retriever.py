"""검색 — "이 질문과 비슷한 조각을 찾아줘"라고 부탁하는 창구.

**창구를 따로 두는 이유**: 지금은 파이썬이 직접 계산하지만(조각이 32개뿐이라 순식간),
조각이 수천 개가 되면 pgvector로 옮겨야 한다. 그때 이 창구를 쓰는 쪽 코드는 그대로 두고
뒤에 있는 구현만 갈아끼운다. llm.py에서 생성기를 가른 것과 같은 이유다.

지금 구현은 InMemoryRetriever 하나뿐이고, 나중에 PgVectorRetriever가 옆에 붙는다.
"""

import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from app.chat import corpus, embed

logger = logging.getLogger("slur.chat")

INDEX_PATH = Path(__file__).parent / "corpus" / "embeddings.json"


@dataclass(frozen=True)
class Hit:
    doc: corpus.Doc
    score: float  # 0~1. 1에 가까울수록 뜻이 비슷하다


class Retriever(Protocol):
    async def search(self, query: str, k: int = 5, min_score: float = 0.0) -> list[Hit]: ...


class InMemoryRetriever:
    """좌표 전부를 메모리에 두고 하나씩 비교한다.

    32조각 × 1024차원 = 곱셈 32,768번. 사람이 못 느끼는 시간이다.
    수천 조각이 되면 이 방식이 무너지고, 그때가 pgvector로 옮길 시점이다.
    """

    def __init__(self, vectors: dict[str, list[float]]):
        self._by_locator = corpus.by_locator()
        # 좌표는 있는데 문서가 사라진 경우가 있다(FAQ 항목 삭제 후 재색인 전).
        # 그런 좌표로 검색되면 존재하지 않는 문서를 인용하게 되므로 여기서 버린다.
        self._vectors = {loc: v for loc, v in vectors.items() if loc in self._by_locator}
        dropped = len(vectors) - len(self._vectors)
        if dropped:
            logger.warning("문서가 사라진 좌표 %d개를 무시한다 — 재색인이 필요하다", dropped)

    async def search(self, query: str, k: int = 5, min_score: float = 0.0) -> list[Hit]:
        qv = await embed.embed_one(query)
        scored = [
            Hit(self._by_locator[loc], embed.dot(qv, vec))
            for loc, vec in self._vectors.items()
        ]
        scored.sort(key=lambda h: h.score, reverse=True)
        return [h for h in scored[:k] if h.score >= min_score]


def load_index(path: Path = INDEX_PATH) -> InMemoryRetriever:
    """저장된 좌표를 읽어 검색기를 만든다.

    🚨 본문이 바뀌었는데 좌표가 옛것이면 **틀린 검색을 조용히** 한다. 그래서
    조각의 지문(content_hash)을 대조하고, 어긋나면 경고한다. 조용한 실패보다
    시끄러운 경고가 낫다 — 검색 점수가 왜 떨어졌는지 며칠 헤매게 된다.
    """
    if not path.exists():
        raise RuntimeError(f"좌표 파일이 없다: {path}. uv run python scripts/build_index.py 를 실행하라")
    data = json.loads(path.read_text(encoding="utf-8"))

    if data.get("model") != embed.MODEL:
        logger.warning("좌표를 만든 모델이 다르다: 파일 %s ≠ 현재 %s", data.get("model"), embed.MODEL)

    current = {d.locator: d for d in corpus.load_docs()}
    vectors, stale = {}, []
    for item in data["items"]:
        loc = item["locator"]
        doc = current.get(loc)
        if doc is not None and item["content_hash"] != doc.id:
            stale.append(loc)
        vectors[loc] = item["vector"]

    missing = [loc for loc in current if loc not in vectors]
    if stale or missing:
        logger.warning(
            "좌표가 낡았다 — 본문이 바뀐 조각 %d개, 좌표가 없는 조각 %d개. "
            "scripts/build_index.py를 다시 실행하라", len(stale), len(missing)
        )
    return InMemoryRetriever(vectors)
