import { NextRequest, NextResponse } from "next/server";

import { API_BASE, COOKIE_REFRESH, assertSameOrigin, clearSessionCookies } from "@/lib/auth";

export async function POST(req: NextRequest) {
  // 로그아웃도 상태를 바꾸는 POST다. Origin 검사가 없으면 임의의 사이트가 폼 POST 하나로
  // SLUR 사용자를 강제 로그아웃시킬 수 있다 — SameSite=Lax가 요청에 토큰을 싣지 못하게
  // 막아도, 이 응답이 내보내는 쿠키 삭제 Set-Cookie는 브라우저에 그대로 적용된다(실측).
  const forbidden = assertSameOrigin(req);
  if (forbidden) return forbidden;

  const refresh = req.cookies.get(COOKIE_REFRESH)?.value;
  if (refresh) {
    await fetch(`${API_BASE}/api/v1/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
      cache: "no-store",
    }).catch(() => {}); // 멱등 — 서버 실패해도 쿠키는 지운다
  }
  const res = NextResponse.json({ ok: true });
  clearSessionCookies(res);
  res.headers.set("Cache-Control", "no-store, private");
  return res;
}
