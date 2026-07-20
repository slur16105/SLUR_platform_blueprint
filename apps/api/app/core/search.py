"""검색 공용 헬퍼 — 도메인 무관 순수 문자열 처리 (core 규칙 준수)."""

ESCAPE = "\\"


def ilike_pattern(q: str) -> str:
    """부분 일치 패턴 — %·_ 와일드카드 주입 방지 이스케이프 (escape=ESCAPE와 함께 사용)."""
    escaped = q.replace(ESCAPE, ESCAPE * 2).replace("%", ESCAPE + "%").replace("_", ESCAPE + "_")
    return f"%{escaped}%"
