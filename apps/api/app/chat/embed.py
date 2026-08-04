"""임베딩 — 글을 뜻의 좌표로 바꾼다.

Ollama의 bge-m3를 쓴다. 한국어를 포함한 다국어 모델이고 로컬에서 무료로 돈다.

**만든 좌표는 파일에 저장하고 커밋한다.** Hub맥에는 Ollama가 없어서 배포 환경에서는
좌표를 만들 수 없기 때문이다. 만드는 것은 개발할 때(여기), 쓰는 것은 어디서나 —
빌드 산출물처럼 다룬다.

좌표는 **길이 1로 정규화해서** 저장한다. 그러면 코사인 유사도가 단순 내적이 되어
검색 쪽이 곱셈과 덧셈만 하면 된다(외부 수치 라이브러리 불필요).
"""

import math

import httpx

from app.core.errors import AppError

MODEL = "bge-m3"
DIM = 1024
BASE_URL = "http://localhost:11434"


def normalize(vec: list[float]) -> list[float]:
    norm = math.sqrt(sum(x * x for x in vec))
    if norm == 0:  # 빈 문자열 등 — 검색에서 아무것과도 안 닮게 둔다
        return vec
    return [x / norm for x in vec]


async def embed(texts: list[str], base_url: str = BASE_URL, timeout: float = 120.0) -> list[list[float]]:
    """여러 문장을 한 번에 좌표로. 정규화까지 마쳐서 돌려준다."""
    if not texts:
        return []
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            res = await client.post(
                f"{base_url}/api/embed", json={"model": MODEL, "input": texts}
            )
            res.raise_for_status()
            data = res.json()
    except httpx.HTTPError as exc:
        raise AppError("chat_unavailable", "지금은 답변을 드릴 수 없어요.", status_code=503) from exc

    # /api/embed는 embeddings(복수), 구버전 /api/embeddings는 embedding(단수)을 준다
    vectors = data.get("embeddings") or [data["embedding"]]
    if len(vectors) != len(texts):
        raise RuntimeError(f"좌표 개수가 안 맞는다: 입력 {len(texts)} → 출력 {len(vectors)}")
    return [normalize(v) for v in vectors]


async def embed_one(text: str, base_url: str = BASE_URL) -> list[float]:
    return (await embed([text], base_url))[0]


def dot(a: list[float], b: list[float]) -> float:
    """정규화된 두 좌표의 내적 = 코사인 유사도. 1에 가까울수록 뜻이 비슷하다."""
    return sum(x * y for x, y in zip(a, b))
