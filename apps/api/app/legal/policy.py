"""약관 정본 메타데이터 — 문안은 웹(app/legal/policy-docs.tsx)이, 버전은 여기가 소유한다.

문구를 고치면 **반드시 버전을 올린다.** 버전이 그대로면 이전 동의자가 새 문구에 동의한 것처럼
기록이 남는다. 개정 시 절차는 세 가지가 한 묶음이다:
  ① 웹 문안 수정 → ② 여기 version·effective_at 갱신 → ③ 관리자 콘솔 > 공지사항에 개정 고지 게시
     (시행 7일 전, 소비자에게 불리한 변경은 30일 전 — 예약 게시로 시점을 맞출 수 있다)
"""

POLICIES = {
    "terms": {
        "version": "1.0",
        "effective_at": "2026-07-31T00:00:00+09:00",
        # 웹 문안(TermsDoc)의 해시. 문구를 고치고 버전을 안 올리면 검증 스크립트가 잡는다.
        "content_hash": "",
        "label": "이용약관",
    },
    "privacy": {
        "version": "1.0",
        "effective_at": "2026-07-31T00:00:00+09:00",
        "content_hash": "",
        "label": "개인정보처리방침",
    },
}

REQUIRED_TYPES = ("terms", "privacy")  # 가입 시 필수 동의 대상
