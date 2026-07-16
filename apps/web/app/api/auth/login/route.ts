import { NextRequest, NextResponse } from "next/server";

import { API_BASE, COOKIE_ACCESS, COOKIE_REFRESH, COOKIE_ROLE, cookieOptions } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const login = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = await login.json();
  if (!login.ok) {
    return NextResponse.json(data, { status: login.status }); // 에러 봉투 그대로 전달
  }

  const rolesRes = await fetch(`${API_BASE}/api/v1/auth/roles`, {
    headers: { Authorization: `Bearer ${data.access_token}` },
    cache: "no-store",
  });
  const roles: string[] = rolesRes.ok ? (await rolesRes.json()).roles : [];
  const role = roles.includes("admin") ? "admin" : roles.includes("seller") ? "seller" : "none";

  const res = NextResponse.json({ role });
  res.cookies.set(COOKIE_ACCESS, data.access_token, cookieOptions(60 * 30));
  res.cookies.set(COOKIE_REFRESH, data.refresh_token, cookieOptions(60 * 60 * 24 * 14));
  res.cookies.set(COOKIE_ROLE, role, { ...cookieOptions(60 * 60 * 24 * 14), httpOnly: false });
  return res;
}
