import { NextRequest, NextResponse } from "next/server";

import { API_BASE, assertSameOrigin, fetchRoles, resolveRole, setRoleCookie, setSessionCookies } from "@/lib/auth";

/* 회원가입 BFF — 기존 POST /api/v1/auth/signup(201 TokenResponse)을 대리 호출한다.
   백엔드 신규 작업 0건. 토큰은 httpOnly 쿠키로만 존재하고 브라우저 JS가 만지지 않는다 (AD-14).
   약관 동의 상태는 화면 안에서만 살고 여기로 오지 않는다 — 백엔드 스키마에 필드가 없다 (위험 6). */
export async function POST(req: NextRequest) {
  const forbidden = assertSameOrigin(req);
  if (forbidden) return forbidden;

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ code: "validation_error", message: "입력값이 올바르지 않습니다.", details: [] }, { status: 422 });
  }
  const signup = await fetch(`${API_BASE}/api/v1/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = await signup.json().catch(() => null);
  if (!signup.ok || !data?.access_token) {
    // 409 email_already_exists · 422 validation_error를 화면이 필드에 매핑한다 — 봉투를 그대로 전달
    return NextResponse.json(
      data ?? { code: "service_unavailable", message: "잠시 후 다시 시도해 주세요.", details: [] },
      { status: signup.ok ? 502 : signup.status },
    );
  }

  const roles = await fetchRoles(data.access_token);
  if (roles === null) {
    return NextResponse.json({ code: "service_unavailable", message: "잠시 후 다시 시도해 주세요.", details: [] }, { status: 503 });
  }
  const role = resolveRole(roles);

  const res = NextResponse.json({ role });
  setSessionCookies(res, data.access_token, data.refresh_token);
  setRoleCookie(res, role);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
