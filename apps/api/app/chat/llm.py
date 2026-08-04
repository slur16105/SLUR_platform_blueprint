"""생성기(LLM) — 갈아끼울 수 있는 창구 하나.

**왜 인터페이스로 가르나**: 개발은 이 맥의 Ollama(무료·무제한 실험), 배포는 API가 될
가능성이 크다. Hub맥은 인텔이라 GPU 가속이 없어 로컬 추론이 실용적이지 않다.
여기저기서 Ollama를 직접 부르면 나중에 전부 뜯어고쳐야 하므로 창구를 하나만 둔다.
설정값(`CHAT_LLM_PROVIDER`) 하나로 뒤가 바뀐다.

덤: 같은 질문을 두 제공자에 던져 답을 비교하는 실험이 그대로 된다.

**구조화 출력을 강제한다.** 자유 문장을 받으면 채점을 사람이 해야 하지만,
`action`을 enum으로 받으면 평가가 자동으로 돌아간다. 이 결정이 평가 루프의 속도를 만든다.
"""

import json
import logging
from typing import Any, Literal, Protocol

import httpx

from app.core.errors import AppError

logger = logging.getLogger("slur.chat")

Action = Literal["answer", "unknown", "escalate", "tool"]

# 답변 봉투 — 모든 제공자가 이 모양으로 답해야 한다.
#   answer   문서에 근거가 있어 답한다
#   unknown  근거가 없다. 지어내지 않는다
#   escalate 개별 처리 요구 → 담당자 연결
#   tool     실시간 값이 필요하다 (재고·주문 상태 등) → 조회가 선행
RESPONSE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "action": {"type": "string", "enum": ["answer", "unknown", "escalate", "tool"]},
        "answer": {"type": "string"},
        "cited_ids": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["action", "answer", "cited_ids"],
}


class Reply(dict):
    """{action, answer, cited_ids}. dict 그대로 쓰되 이름을 붙여 의도를 드러낸다."""


class Provider(Protocol):
    async def complete(self, system: str, user: str) -> Reply: ...


class OllamaProvider:
    """로컬 Ollama. 맥에서는 **네이티브 설치**여야 GPU(Metal)를 쓴다 —
    도커 안에 넣으면 리눅스 VM이라 Metal이 전달되지 않아 몇 배 느려진다."""

    def __init__(self, model: str, base_url: str = "http://localhost:11434", timeout: float = 300.0,
                 think: bool | None = None):
        self.model = model
        # qwen3 계열은 기본이 '생각하기 켬'이라 짧은 답에도 추론 토큰을 잔뜩 쓴다.
        # 우리는 판정(action)과 한두 문장이 전부라 대개 끌 만하다. None이면 모델 기본값.
        self.think = think
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    async def complete(self, system: str, user: str) -> Reply:
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "format": RESPONSE_SCHEMA,  # 스키마를 주면 모델이 그 모양으로만 낸다
            "stream": False,
            "options": {"temperature": 0},  # 평가는 재현 가능해야 한다
        }
        if self.think is not None:
            payload["think"] = self.think
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                res = await client.post(f"{self.base_url}/api/chat", json=payload)
                res.raise_for_status()
                content = res.json()["message"]["content"]
        except httpx.HTTPError as exc:
            raise AppError("chat_unavailable", "지금은 답변을 드릴 수 없어요.", status_code=503) from exc

        try:
            data = json.loads(content)
        except json.JSONDecodeError:
            # 스키마를 줬는데도 깨졌다면 모델이 지시를 못 따른 것이다.
            # 조용히 넘기지 않는다 — 이런 모델은 "모른다고 답하기"도 못 한다.
            logger.warning("구조화 출력 파싱 실패: %s", content[:200])
            return Reply(action="escalate", answer="", cited_ids=[])
        return Reply(
            action=data.get("action", "escalate"),
            answer=data.get("answer", ""),
            cited_ids=data.get("cited_ids") or [],
        )


def get_provider(name: str, model: str) -> Provider:
    if name == "ollama":
        return OllamaProvider(model=model)
    # claude 제공자는 배포를 실제로 켤 때 붙인다 — 자리만 비워 둔다.
    raise AppError("chat_unavailable", "지금은 답변을 드릴 수 없어요.", status_code=503)
