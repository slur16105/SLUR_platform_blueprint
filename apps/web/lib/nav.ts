/* 복귀 경로·역할 목적지 — 순수 함수만 둔다 (D5).
   lib/auth.ts와 나누는 이유는 하나뿐이다: 이 파일은 클라이언트 폼도 임포트한다.
   lib/auth.ts는 next/server(NextResponse)를 임포트하므로 클라이언트 번들에 들어갈 수 없다.
   서버 라우트는 두 파일을 함께 쓰고, 판정식은 여기 한 벌만 존재한다. */

/** 역할 힌트 값. 역할이 없는 계정은 구매자다 — 세 번째 값은 더 이상 만들지 않는다.
 *  slur_role은 UX 라우팅 힌트일 뿐이며 권한 판정은 FastAPI가 한다 (R7, AD-1). */
export type SlurRole = "admin" | "seller" | "buyer";

/** 역할별 기본 목적지. next가 없거나 거부됐을 때 간다.
 *  admin·seller는 현행 동작 그대로이며, /no-role로 가는 경로는 사라진다. */
export function roleHome(role: string | null | undefined): string {
  return role === "admin" ? "/admin" : role === "seller" ? "/seller" : "/";
}

/** 복귀 경로 재검증 — 미들웨어가 만든 값이라고 믿지 않는다.
 *  미들웨어는 자체 경로만 싣지만 `/login?next=…`는 누구나 손으로 붙일 수 있다. */
export function safeNextPath(v: string | null | undefined): string | null {
  if (!v) return null;
  if (!v.startsWith("/")) return null; // 절대 URL(https://evil.example)·스킴 상대 차단
  if (v.startsWith("//") || v.startsWith("/\\")) return null; // //evil.example · /\evil.example — 브라우저가 호스트로 읽는다
  if (/[\u0000-\u001f]/.test(v)) return null; // CR/LF·제어문자 — Location 헤더 주입 차단
  if (v === "/login" || v.startsWith("/login?")) return null; // 로그인 → 로그인 루프
  if (v === "/signup" || v.startsWith("/signup?")) return null; // 가입 → 가입 루프
  return v; // 쿼리스트링은 통째로 보존한다 — 8.3이 선택 조합·수량을 실어 보낸다 (UX-DR11)
}
