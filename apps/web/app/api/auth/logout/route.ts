import { NextRequest, NextResponse } from "next/server";

import { API_BASE, COOKIE_REFRESH, clearSessionCookies } from "@/lib/auth";

export async function POST(req: NextRequest) {
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
  return res;
}
