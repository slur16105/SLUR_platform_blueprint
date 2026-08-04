import uuid

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    # 상한을 두는 이유: 긴 입력은 임베딩·생성 비용을 키우고, 실제 질문은 대부분 한 문장이다.
    # 넘치면 자르지 않고 422로 거절한다 — 잘라서 답하면 사용자가 묻지 않은 것에 답하게 된다.
    question: str = Field(min_length=2, max_length=300)


class Source(BaseModel):
    """답변의 근거. **화면에 반드시 보여준다** — 어디서 나온 답인지 확인할 수 있어야
    사용자가 검증할 수 있고, 그게 신뢰를 만든다."""

    title: str
    url: str


class ChatResponse(BaseModel):
    # answer   문서 근거로 답했다
    # escalate 답할 수 없다 → 담당자 연결
    # tool     지금 값을 조회해야 한다 (도구 미구현이라 현재는 안내만)
    outcome: str
    answer: str
    sources: list[Source] = []
    # 어느 관문에서 갈렸는지. 화면은 쓰지 않지만 로컬 검증에서 원인을 눈으로 보려고 싣는다.
    gate: str = ""


class ChatStatus(BaseModel):
    """화면이 챗봇을 그릴지 말지 판단하는 값. 꺼져 있으면 입력창 자체를 그리지 않는다 —
    눌러야 '안 됩니다'가 나오는 버튼은 없는 것만 못하다."""

    enabled: bool
    model: str = ""
