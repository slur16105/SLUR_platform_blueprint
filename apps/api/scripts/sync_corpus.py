"""문서 정본(웹) → 서버가 읽는 코퍼스 동기화. FAQ + 약관·개인정보처리방침.

**정본은 웹에 있다.** 화면이 그것을 직접 쓰고, 서버(챗봇)는 여기서 뽑은 파일을 읽는다.
두 벌이 생기지만 어긋나면 `tests/test_chat_corpus.py`가 잡는다 — 정본을 고치고
이 스크립트를 안 돌리면 테스트가 실패한다.

왜 서버를 정본으로 하지 않았나: FAQ·약관 화면은 공개 라우트이고 지금은 API 없이 선다.
정본을 서버로 옮기면 그 화면이 API 장애에 묶인다. 그 결합을 만들 이유가 아직 없다.

🚨 사업자 정보(상호·이메일 등)는 **일부러 값을 넣지 않는다.** 아직 placeholder이므로
   (오픈 게이트) 챗봇이 가짜 사업자 정보를 사실처럼 읊는 일을 원천 차단한다.

사용: uv run python scripts/sync_corpus.py
"""

import html
import json
import re
import sys
from pathlib import Path

API_DIR = Path(__file__).resolve().parent.parent
WEB = API_DIR.parent / "web" / "app"
FAQ_TS = WEB / "(buyer)" / "faq" / "faq-content.ts"
POLICY_TSX = WEB / "legal" / "policy-docs.tsx"
OUT = API_DIR / "app" / "chat" / "corpus"

_GROUP = re.compile(r'id:\s*"([^"]+)"\s*,\s*\n\s*title:\s*"([^"]+)"')
_QA = re.compile(r'q:\s*"([^"]+)"\s*,\s*\n\s*a:\s*"([^"]+)"')
_H2 = re.compile(r"<h2>(.*?)</h2>", re.S)
_TAG = re.compile(r"<[^>]+>")
_EXPR = re.compile(r"\{[^{}]*\}")  # {COMPANY.email} 같은 JSX 표현식


def parse_faq(ts: str) -> list[dict]:
    body = ts.split("FAQ_GROUPS", 1)[1]
    bounds = [(m.start(), m.group(1), m.group(2)) for m in _GROUP.finditer(body)]
    if not bounds:
        raise SystemExit("FAQ 그룹을 못 찾았다 — faq-content.ts 구조가 바뀐 것으로 보인다")
    groups = []
    for i, (pos, gid, title) in enumerate(bounds):
        end = bounds[i + 1][0] if i + 1 < len(bounds) else len(body)
        items = [{"q": q, "a": a} for q, a in _QA.findall(body[pos:end])]
        if not items:
            raise SystemExit(f"FAQ 그룹 '{gid}'에 문답이 없다 — 구조 변경 의심")
        groups.append({"id": gid, "title": title, "items": items})
    return groups


def _text(fragment: str) -> str:
    """JSX 조각 → 사람이 읽는 텍스트.

    표현식은 값을 넣지 않고 자리표시로 남긴다(위 주석 참조). 태그 자리는 공백으로
    바꾼다 — 붙여버리면 `<li>a</li><li>b</li>`가 'ab'가 되어 단어가 뭉갠다.
    """
    s = _EXPR.sub(" (별도 안내) ", fragment)
    s = _TAG.sub(" ", s)
    s = html.unescape(s)
    s = s.replace("\u201c", '"').replace("\u201d", '"')
    return re.sub(r"\s+", " ", s).strip()


def parse_policy(tsx: str) -> list[dict]:
    docs = []
    for fn, label in (("TermsDoc", "이용약관"), ("PrivacyDoc", "개인정보처리방침")):
        if f"export function {fn}" not in tsx:
            raise SystemExit(f"{fn}을 못 찾았다 — policy-docs.tsx 구조가 바뀐 것으로 보인다")
        body = tsx.split(f"export function {fn}", 1)[1]
        # 다음 export까지가 이 문서의 범위
        nxt = body.find("export function ")
        if nxt != -1:
            body = body[:nxt]
        marks = list(_H2.finditer(body))
        if not marks:
            raise SystemExit(f"{fn}에 <h2>가 없다 — 구조 변경 의심")
        for i, m in enumerate(marks):
            end = marks[i + 1].start() if i + 1 < len(marks) else len(body)
            section = _text(m.group(1))
            raw = body[m.end():end]
            # 마지막 조항은 뒤에 컴포넌트 닫는 코드(`</>`, `);`, `}`)가 붙는다.
            # </section>에서 끊지 않으면 그 조각들이 본문에 섞여 들어간다.
            raw = raw.split("</section>", 1)[0]
            content = _text(raw)
            if content:
                docs.append({"doc": label, "section": section, "body": content})
    return docs


def main() -> int:
    for p in (FAQ_TS, POLICY_TSX):
        if not p.exists():
            print(f"정본을 찾을 수 없다: {p}", file=sys.stderr)
            return 1
    OUT.mkdir(parents=True, exist_ok=True)

    faq = parse_faq(FAQ_TS.read_text(encoding="utf-8"))
    (OUT / "faq.json").write_text(
        json.dumps(faq, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    policy = parse_policy(POLICY_TSX.read_text(encoding="utf-8"))
    (OUT / "policy.json").write_text(
        json.dumps(policy, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    qa = sum(len(g["items"]) for g in faq)
    print(f"FAQ    그룹 {len(faq)}개 · 문답 {qa}개")
    print(f"약관류 조항 {len(policy)}개")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
