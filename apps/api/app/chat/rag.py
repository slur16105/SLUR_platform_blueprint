"""RAG — 검색으로 고른 몇 조각만 넣고 답한다.

기준선과의 차이는 **넣는 문서뿐**이다(규칙은 prompts.py에서 공유).
그래서 점수 차이를 검색 덕/탓으로 읽을 수 있다.

🚨 RAG에는 기준선에 없던 위험이 하나 생긴다: 검색이 엉뚱한 걸 가져오면 모델은
   **정답을 아예 볼 기회조차 없다.** 기준선은 전부 줬으니 최소한 눈앞엔 있었다.
   그래서 검색 점수를 답변 점수와 따로 재야 한다(평가셋의 gold 라벨이 그 용도다).
"""

from dataclasses import dataclass

from app.chat import prompts
from app.chat.llm import Provider, Reply
from app.chat.retriever import Hit, Retriever


@dataclass
class RagResult:
    reply: Reply
    hits: list[Hit]  # 무엇을 근거로 삼았는지 — 검색을 따로 채점하려면 이게 남아야 한다


async def answer(
    provider: Provider,
    retriever: Retriever,
    question: str,
    k: int = 5,
    min_score: float = 0.0,
) -> RagResult:
    """검색 → 프롬프트 조립 → 생성.

    min_score를 넘는 조각이 하나도 없으면 문서 없이 물어본다. 억지로 낮은 점수의
    조각을 끼워 넣는 것보다 낫다 — 관련 없는 문서를 주면 모델이 그걸로 답을
    만들어내려 하고, 그게 곧 지어낸 답이 된다.
    """
    hits = await retriever.search(question, k=k, min_score=min_score)
    system = prompts.render([h.doc for h in hits])
    reply = await provider.complete(system, question)
    return RagResult(reply=reply, hits=hits)
