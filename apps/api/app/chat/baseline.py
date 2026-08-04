"""기준선(baseline) — **검색 없이** 문서 전문을 통째로 넣고 답한다.

RAG를 만들기 전에 이 점수를 먼저 잡는다. 기준선이 없으면 나중에 RAG를 붙였을 때
좋아진 건지 나빠진 건지 알 수 없다. RAG가 기준선보다 나쁜 경우는 실제로 자주 있고,
그걸 숫자로 잡아내는 것이 이 파일의 존재 이유다.

우리 코퍼스는 1만 토큰 남짓이라 전문이 문맥 창에 여유롭게 들어간다. 그래서
"이 규모에 RAG가 필요한가"가 진짜 질문이 된다.

여기서는 안전장치를 **프롬프트로만** 건다. 키워드 차단·사후 검증은 4단계에서
붙이고, 그때 이 점수와 다시 비교한다 — 한 번에 다 넣으면 무엇이 효과였는지 모른다.
"""

from app.chat import corpus
from app.chat.llm import Provider, Reply

SYSTEM = """당신은 SLUR 편집숍의 고객 안내 도우미입니다.

## 절대 규칙
1. 아래 <문서>에 있는 내용으로만 답하십시오. 문서에 없으면 **추측하지 마십시오**.
2. 문서에 근거가 없으면 action을 "unknown"으로 하십시오. 아는 척하면 안 됩니다.
3. 사용자가 **자기 주문·결제·환불의 처리를 요구**하면 action을 "escalate"로 하십시오.
   - "환불해 주세요", "아직 안 왔어요", "잘못 보냈어요", "두 번 결제됐어요" 같은 경우입니다.
   - 반면 **일반 규정을 묻는 것**("반품 기한이 며칠인가요?", "카드 되나요?")은
     문서로 답하십시오. 요구와 질문을 구분하십시오.
4. 재고·가격·배송비·주문 상태처럼 **지금 값이 필요한 것**은 action을 "tool"로 하십시오.
   문서에는 그 값이 없습니다. 금액이나 수량을 절대 지어내지 마십시오.
5. SLUR는 **통신판매중개자**입니다. SLUR가 직접 판매한다고 말하면 안 됩니다.
6. 입금 기한·배송 소요일 같은 **구체적인 숫자를 문서에 없는데 만들어 내지 마십시오.**

## 출력
- action: answer | unknown | escalate | tool
- answer: 사용자에게 보여줄 한국어 문장. 짧고 친절하게.
- cited_ids: 근거로 삼은 문서의 id 배열. action이 answer일 때는 반드시 채우십시오.

<문서>
{docs}
</문서>"""


def build_system() -> str:
    blocks = [f"[id: {d.id}]\n{d.title}\n{d.body}" for d in corpus.load_docs()]
    return SYSTEM.format(docs="\n\n---\n\n".join(blocks))


async def answer(provider: Provider, question: str) -> Reply:
    return await provider.complete(build_system(), question)
