"use client";

/* 최후의 오류 경계 — 루트 레이아웃 자체가 실패했을 때만 뜬다.

   🚨 이 화면은 layout.tsx를 대체하므로 <html>·<body>를 직접 그려야 한다(Next 규약).
   🚨 CSS·폰트·컴포넌트에 기대지 않는다 — 그것들이 실패해서 여기까지 온 것일 수 있다.
      그래서 인라인 스타일만 쓰고, 링크도 next/link 대신 평범한 <a>를 쓴다. */

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, sans-serif", color: "#111" }}>
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "24px", textAlign: "center" }}>
          <div style={{ maxWidth: 420 }}>
            <p style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>SLUR.</p>
            <h1 style={{ fontSize: 22, margin: "40px 0 12px", letterSpacing: "-0.01em" }}>
              문제가 발생했습니다
            </h1>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: "#666", margin: 0 }}>
              잠시 후 다시 시도해 주세요. 계속 같은 화면이 나오면 고객센터로 알려주시면 확인하겠습니다.
            </p>
            <div style={{ marginTop: 28, display: "flex", gap: 8, justifyContent: "center" }}>
              <button
                type="button"
                onClick={reset}
                style={{ height: 44, padding: "0 22px", border: "1px solid #111", background: "#111", color: "#fff", fontSize: 14, cursor: "pointer" }}
              >
                다시 시도
              </button>
              {/* 의도적으로 next/link를 쓰지 않는다 — 라우터·번들이 깨져서 여기까지 온 것일 수
                  있다. 평범한 <a>는 전체 새로고침을 일으켜 깨진 상태에서 벗어날 가능성이 높다. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a
                href="/"
                style={{ height: 44, padding: "0 22px", border: "1px solid #ddd", color: "#111", fontSize: 14, lineHeight: "44px", textDecoration: "none" }}
              >
                홈으로
              </a>
            </div>
            {error.digest && (
              <p style={{ marginTop: 32, fontSize: 11, color: "#999" }}>오류 번호 {error.digest}</p>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
