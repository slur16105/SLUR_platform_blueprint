"""답변 흐름 — 관문을 하나라도 못 넘으면 사람에게 넘긴다.

**정책 (Slur 결정 2026-08-04): 헛소리하느니 사람 연결이 낫다.**
그래서 "모르겠습니다"로 끝나는 길을 없앴다. 모르면 담당자에게 넘긴다 —
사용자에게 다음 행동이 남아야 한다.

    질문
      ├─ 관문0  검색에 태울 질문인가?       처리요구 ─► 👤   조회 ─► 🔧
      ├─ 관문1  비슷한 문서가 있나?        없음 ────► 👤
      ├─ 관문2  모델이 답할 수 있다 하나?   아니오 ──► 👤
      └─ 통과                                       ──► 💬

🚨 관문1은 **모델을 부르기 전에** 코드로 막는다. 실측에서 문서가 0개인데도
   모델이 답을 지어낸 사례가 나왔다(B05 "상품 후기 어디에 써요?" → 없는 안내를 창작).
   프롬프트로 "문서가 없으면 모른다고 하라"고 시켜도 8B 모델은 어긴다.
   **확실한 것은 모델에게 묻지 않고 코드로 끝낸다** — 더 빠르고 싸고 확실하다.

지표는 "사람 연결을 줄이자"가 아니라 **"틀린 답 0건"** 이다. 연결이 늘어도 좋다.
"""

from dataclasses import dataclass, field
from typing import Literal

from app.chat import prompts, triage
from app.chat.llm import Provider
from app.chat.retriever import Hit, Retriever

# 사용자에게 보이는 결과는 셋뿐이다 — "모름"은 사람 연결로 흡수된다
Outcome = Literal["answer", "escalate", "tool"]

ESCALATE_MESSAGE = "제가 정확히 답변드리기 어려운 내용이에요. 담당자에게 전달해 드릴까요?"
# 조회는 아직 도구가 없다. 붙기 전까지는 사람이 안전한 기본값이다 —
# "재고 있습니다"를 지어내는 것보다 담당자에게 넘기는 편이 낫다.
LOOKUP_MESSAGE = "지금 값을 확인해야 하는 내용이에요. 담당자에게 전달해 드릴까요?"


@dataclass
class Result:
    outcome: Outcome
    answer: str
    hits: list[Hit] = field(default_factory=list)
    gate: str = ""  # 어느 관문에서 갈렸는지 — 지표·디버깅용. 이게 없으면 원인 추적이 안 된다
    cited_ids: list[str] = field(default_factory=list)


async def answer(
    provider: Provider,
    retriever: Retriever,
    question: str,
    k: int = 5,
    min_score: float = 0.60,
) -> Result:
    # ── 관문 0 · 검색에 태울 질문이 아니다 (검색·모델 호출 없음) ──
    lane = triage.route(question)
    if lane == "escalate":
        return Result("escalate", ESCALATE_MESSAGE, gate="triage_escalate")
    if lane == "lookup":
        return Result("tool", LOOKUP_MESSAGE, gate="triage_lookup")

    hits = await retriever.search(question, k=k, min_score=min_score)

    # ── 관문 1 · 근거가 아예 없다 (모델 호출 없음) ──
    if not hits:
        return Result("escalate", ESCALATE_MESSAGE, gate="no_docs")

    reply = await provider.complete(prompts.render([h.doc for h in hits]), question)

    # ── 관문 2 · 모델이 답할 수 없다고 한다 ──
    if reply["action"] in ("unknown", "escalate"):
        # 모델이 쓴 문장은 버린다. "모르겠습니다"로 끝나면 사용자에게 남는 행동이 없다.
        return Result("escalate", ESCALATE_MESSAGE, hits=hits, gate=f"model_{reply['action']}")

    if reply["action"] == "tool":
        return Result("tool", reply["answer"], hits=hits, gate="needs_lookup")

    return Result("answer", reply["answer"], hits=hits, gate="answered",
                  cited_ids=reply["cited_ids"])
