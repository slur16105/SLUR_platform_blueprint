"""챗봇 엔드포인트 — **로컬 검증 전용**.

`chat_enabled`가 기본 꺼짐이라 배포 환경에서는 상태 조회가 `enabled: false`를 돌려주고
질문은 503이 된다. Ollama가 개발 머신에만 있기 때문이다(Hub맥은 인텔이라 GPU 가속이 없다).

로그인은 요구하지 않는다 — 근거가 FAQ·약관이라 공개 지면과 같은 내용이고,
개인 정보가 필요한 질문은 파이프라인이 담당자 연결로 돌린다.
"""

import logging

from fastapi import APIRouter

from app.chat import pipeline, retriever, schemas
from app.chat.llm import OllamaProvider
from app.core.config import get_settings
from app.core.errors import AppError

logger = logging.getLogger("slur.chat")
router = APIRouter(prefix="/chat")

_retriever: retriever.InMemoryRetriever | None = None


def _get_retriever() -> retriever.InMemoryRetriever:
    """좌표 파일은 한 번만 읽는다(32조각 × 1024차원). 파일이 없으면 기동이 아니라
    **첫 요청에서** 드러난다 — 챗봇이 꺼져 있는 배포에서 기동을 막을 이유가 없다."""
    global _retriever
    if _retriever is None:
        _retriever = retriever.load_index()
    return _retriever


@router.get("/status", response_model=schemas.ChatStatus)
async def status() -> schemas.ChatStatus:
    s = get_settings()
    return schemas.ChatStatus(enabled=s.chat_enabled, model=s.chat_model if s.chat_enabled else "")


@router.post("", response_model=schemas.ChatResponse)
async def ask(body: schemas.ChatRequest) -> schemas.ChatResponse:
    s = get_settings()
    if not s.chat_enabled:
        raise AppError("chat_disabled", "지금은 안내 도우미를 사용할 수 없어요.", status_code=503)

    result = await pipeline.answer(
        OllamaProvider(model=s.chat_model, base_url=s.chat_ollama_url, think=s.chat_think),
        _get_retriever(),
        body.question,
        k=s.chat_top_k,
        min_score=s.chat_min_score,
    )
    # 근거는 **실제로 답했을 때만** 붙인다. 담당자 연결에 출처를 달면
    # "문서를 봤는데 답을 안 해준다"로 읽힌다.
    sources = (
        [schemas.Source(title=h.doc.title, url=h.doc.url) for h in result.hits]
        if result.outcome == "answer" else []
    )
    logger.info("chat gate=%s outcome=%s q=%r", result.gate, result.outcome, body.question[:60])
    return schemas.ChatResponse(
        outcome=result.outcome, answer=result.answer, sources=sources, gate=result.gate
    )
