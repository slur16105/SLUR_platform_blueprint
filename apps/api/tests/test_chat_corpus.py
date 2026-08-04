"""코퍼스와 평가셋이 정본에서 어긋나지 않는지 지킨다.

**두 벌이 존재하는 구조를 택했다** — 정본은 웹(FAQ·약관 화면이 API 없이 서야 하므로),
서버는 `scripts/sync_corpus.py`로 뽑은 사본을 읽는다. 두 벌은 언젠가 어긋나므로
어긋나는 순간을 여기서 잡는다. 정본을 고치고 sync를 안 돌리면 이 파일이 실패한다.

평가셋의 정답 라벨(gold)도 같이 지킨다. 라벨이 사라진 문서를 가리키면 검색 점수가
조용히 0이 되는데, 그건 검색이 나쁜 게 아니라 라벨이 썩은 것이다. 둘을 구분하지 못하면
"검색을 고쳤는데 점수가 안 오른다"에서 며칠을 잃는다.
"""

import json
import sys
from pathlib import Path

import pytest
import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from app.chat import corpus  # noqa: E402

API_DIR = Path(__file__).resolve().parent.parent
EVALSET = API_DIR.parents[1] / "docs" / "chatbot-evalset-v1.yaml"
WEB_EXISTS = (API_DIR.parent / "web" / "app").exists()

needs_web = pytest.mark.skipif(not WEB_EXISTS, reason="웹 소스가 없는 환경(배포 이미지 등)")


@needs_web
def test_faq_사본이_정본과_같다():
    """FAQ를 고치고 sync_corpus.py를 안 돌리면 여기서 걸린다."""
    import sync_corpus

    expected = sync_corpus.parse_faq(sync_corpus.FAQ_TS.read_text(encoding="utf-8"))
    actual = json.loads((corpus.CORPUS_DIR / "faq.json").read_text(encoding="utf-8"))
    assert actual == expected, "faq.json이 낡았다 — uv run python scripts/sync_corpus.py"


@needs_web
def test_약관_사본이_정본과_같다():
    import sync_corpus

    expected = sync_corpus.parse_policy(sync_corpus.POLICY_TSX.read_text(encoding="utf-8"))
    actual = json.loads((corpus.CORPUS_DIR / "policy.json").read_text(encoding="utf-8"))
    assert actual == expected, "policy.json이 낡았다 — uv run python scripts/sync_corpus.py"


def test_문서_id가_유일하다():
    docs = corpus.load_docs()
    assert len(corpus.by_id()) == len(docs), "id 충돌 — 같은 본문의 조각이 둘 있는지 확인"
    assert len(corpus.by_locator()) == len(docs), "locator 충돌 — FAQ 질문이 중복인지 확인"


def test_빈_조각이_없다():
    """본문이 비면 검색에는 걸리는데 답할 내용이 없는 유령 조각이 된다."""
    for d in corpus.load_docs():
        assert d.body.strip(), f"본문이 비었다: {d.locator}"
        assert d.title.strip(), f"제목이 비었다: {d.locator}"


def test_사업자정보가_코퍼스에_새지_않았다():
    """🚨 사업자 정보는 아직 placeholder다(오픈 게이트).

    챗봇이 가짜 상호·사업자번호를 사실처럼 읊으면 안 되므로 sync 단계에서 자리표시로
    바꾼다. 그 처리가 빠지면 여기서 걸린다.
    """
    joined = "\n".join(d.body for d in corpus.load_docs())
    for leak in ("COMPANY.", "{", "}"):
        assert leak not in joined, f"JSX 표현식이 그대로 남았다: {leak}"


def test_평가셋_gold가_실재하는_문서를_가리킨다():
    data = yaml.safe_load(EVALSET.read_text(encoding="utf-8"))
    known = set(corpus.by_locator())
    for item in data["items"]:
        assert "gold" in item, f"{item['id']}에 gold 라벨이 없다"
        for loc in item["gold"]:
            assert loc in known, f"{item['id']}의 gold가 사라진 문서를 가리킨다: {loc}"


def test_평가셋_분포가_선언과_일치한다():
    """meta에 적은 분포와 실제가 어긋나면 라벨을 고치다 만 것이다."""
    data = yaml.safe_load(EVALSET.read_text(encoding="utf-8"))
    actual: dict[str, int] = {}
    for item in data["items"]:
        actual[item["type"]] = actual.get(item["type"], 0) + 1
    assert actual == data["meta"]["분포"]
    assert len(data["items"]) == data["meta"]["총문항"]
