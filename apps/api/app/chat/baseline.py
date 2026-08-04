"""기준선(baseline) — **검색 없이** 문서 전문을 통째로 넣고 답한다.

RAG를 만들기 전에 이 점수를 먼저 잡는다. 기준선이 없으면 나중에 검색을 붙였을 때
좋아진 건지 나빠진 건지 알 수 없다. RAG가 기준선보다 나쁜 경우는 실제로 자주 있고,
그걸 숫자로 잡아내는 것이 이 파일의 존재 이유다.

우리 코퍼스는 1만 토큰 남짓이라 전문이 문맥 창에 여유롭게 들어간다. 그래서
"이 규모에 RAG가 필요한가"가 진짜 질문이 된다.

규칙(프롬프트)은 rag.py와 **공유한다**(prompts.py). 둘의 차이는 넣는 문서뿐이어야 한다.
"""

from app.chat import corpus, prompts
from app.chat.llm import Provider, Reply


def build_system() -> str:
    return prompts.render(corpus.load_docs())


async def answer(provider: Provider, question: str) -> Reply:
    return await provider.complete(build_system(), question)
