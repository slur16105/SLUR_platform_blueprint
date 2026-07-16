import { NextRequest, NextResponse } from "next/server";

import { API_BASE, COOKIE_ACCESS, COOKIE_REFRESH, COOKIE_ROLE, cookieOptions } from "@/lib/auth";

export async function POST(req: NextRequest) {
  // login-CSRF 방어: 크로스사이트 폼 POST 차단
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.nextUrl.host) {
    return NextResponse.json({ code: "forbidden", message: "허용되지 않은 요청입니다.", details: [] }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ code: "validation_error", message: "입력값이 올바르지 않습니다.", details: [] }, { status: 422 });
  }
  const login = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = await login.json().catch(() => null);
  if (!login.ok || !data?.access_token) {
    return NextResponse.json(
      data ?? { code: "kakao_unavailable", message: "일시적인 오류입니다. 잠시 후 다시 시도해 주세요.", details: [] },
      { status: login.ok ? 502 : login.status },
    ); // 에러 봉투 그대로 전달
  }

  const rolesRes = await fetch(`${API_BASE}/api/v1/auth/roles`, {
    headers: { Authorization: `Bearer ${data.access_token}` },
    cache: "no-store",
  });
  if (!rolesRes.ok) {
    // 역할 조회 실패 시 조용한 강등(none 쿠키 14일) 대신 로그인 실패로 — 재시도가 정직하다
    return NextResponse.json({ code: "service_unavailable", message: "잠시 후 다시 시도해 주세요.", details: [] }, { status: 503 });
  }
  const roles: string[] = (await rolesRes.json()).roles ?? [];
  const role = roles.includes("admin") ? "admin" : roles.includes("seller") ? "seller" : "none";

  const res = NextResponse.json({ role });
  res.cookies.set(COOKIE_ACCESS, data.access_token, cookieOptions(60 * 30));
  res.cookies.set(COOKIE_REFRESH, data.refresh_token, cookieOptions(60 * 60 * 24 * 14, "/api/auth")); // path 제한 — 페이지 요청에 refresh 미탑재
  res.cookies.set(COOKIE_ROLE, role, { ...cookieOptions(60 * 60 * 24 * 14), httpOnly: false });
  return res;
}
