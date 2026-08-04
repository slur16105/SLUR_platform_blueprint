"""문서 코퍼스 — 흩어진 문서를 하나의 모양(Doc)으로 모은다.

색인 파이프라인의 1단계다. 기준선(검색 없이 전문 투입)과 RAG(검색)가 **같은 Doc**을 보고
겨루게 하려는 것이 목적이다. 문서가 다르면 점수 차이가 RAG 덕인지 문서 덕인지 알 수 없다.

id 규칙: `{source}:{scope}:{본문 해시 8자}`.
  본문이 바뀌면 id도 바뀐다 — **의도한 동작이다.** 내용이 달라졌으면 다른 조각이고,
  재색인 대상이라는 뜻이다. 순번(index)을 쓰면 문답 하나를 끼워 넣을 때 뒤가 전부
  밀려서 멀쩡한 조각까지 재색인된다.
"""

import hashlib
import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

CORPUS_DIR = Path(__file__).parent / "corpus"

SOURCE_FAQ = "faq"
SOURCE_TERMS = "terms"
SOURCE_PRIVACY = "privacy"


@dataclass(frozen=True)
class Doc:
    """검색·인용의 최소 단위. 이 자체가 청크다 — 문서의 자연 경계를 그대로 쓴다."""

    id: str
    source: str
    title: str
    body: str
    url: str  # 사용자에게 보여줄 출처. 답변에 근거를 달 때 쓴다
    locator: str  # 사람이 쓰는 안정적 주소 — 평가셋의 정답 라벨이 이걸 가리킨다

    # 🚨 id와 locator는 목적이 다르다.
    #   id      = 본문 해시 포함. 본문이 바뀌면 바뀐다 → 재색인 대상 판별용
    #   locator = 본문과 무관. FAQ 질문·조항 제목이 그대로다 → 평가셋 라벨용
    # 평가셋이 id를 가리키면 오탈자 하나 고칠 때마다 정답 라벨이 전부 깨진다.

    @property
    def text(self) -> str:
        """임베딩·프롬프트에 넣는 표현. 제목을 붙여야 본문만으로 모호한 조각이 살아난다."""
        return f"{self.title}\n{self.body}"


def _hid(source: str, scope: str, body: str) -> str:
    return f"{source}:{scope}:{hashlib.sha1(body.encode()).hexdigest()[:8]}"


def _load(name: str) -> list:
    path = CORPUS_DIR / name
    if not path.exists():  # 배포 이미지에 코퍼스가 빠진 경우 — 조용히 빈 답을 하느니 드러낸다
        raise RuntimeError(f"코퍼스 파일이 없다: {path}. scripts/sync_corpus.py를 실행했는가")
    return json.loads(path.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def load_docs() -> tuple[Doc, ...]:
    """전체 코퍼스. 파일에서 오므로 프로세스 수명 동안 캐시한다.

    문서를 고쳤으면 sync_corpus.py를 돌리고 **프로세스를 다시 띄워야** 반영된다.
    3단계에서 색인 갱신을 붙일 때 이 캐시도 함께 무효화 대상이 된다.
    """
    docs: list[Doc] = []

    for group in _load("faq.json"):
        for item in group["items"]:
            # 문답 1쌍이 1조각이다 — 질문과 답을 가르면 검색은 되는데 답이 없는 조각이 남는다
            body = f"Q. {item['q']}\nA. {item['a']}"
            docs.append(
                Doc(
                    id=_hid(SOURCE_FAQ, group["id"], body),
                    source=SOURCE_FAQ,
                    title=f"FAQ · {group['title']} · {item['q']}",
                    body=body,
                    url=f"/faq#{group['id']}",
                    locator=f"faq/{group['id']}/{item['q']}",
                )
            )

    for sec in _load("policy.json"):
        source = SOURCE_TERMS if sec["doc"] == "이용약관" else SOURCE_PRIVACY
        docs.append(
            Doc(
                id=_hid(source, sec["section"][:12], sec["body"]),
                source=source,
                title=f"{sec['doc']} · {sec['section']}",
                body=sec["body"],
                url="/legal/terms" if source == SOURCE_TERMS else "/legal/privacy",
                locator=f"{source}/{sec['section']}",
            )
        )

    return tuple(docs)


def by_id() -> dict[str, Doc]:
    return {d.id: d for d in load_docs()}


def by_locator() -> dict[str, Doc]:
    """평가셋의 정답 라벨(locator) → 현재 Doc. 본문이 바뀌어도 라벨은 살아 있다."""
    return {d.locator: d for d in load_docs()}
