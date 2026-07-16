// 서버 전용 인증 헬퍼 — 토큰은 httpOnly 쿠키로만 존재 (1.6 결정, 2.1에서 refresh path /api로 개정)
import { NextRequest, NextResponse } from "next/server";

export const API_BASE = process.env.API_BASE_URL ?? "http://localhost:8000";

export const COOKIE_ACCESS = "slur_access";
export const COOKIE_REFRESH = "slur_refresh";
export const COOKIE_ROLE = "slur_role"; // UX 라우팅 힌트 전용 — 보안 판정은 항상 FastAPI
export const REFRESH_PATH = "/api"; // BFF API 라우트 전체에서 회전 가능, 페이지 요청엔 미탑재

const secure = process.env.NODE_ENV === "production";

export function cookieOptions(maxAgeSec: number, path = "/") {
  return { httpOnly: true, secure, sameSite: "lax" as const, maxAge: maxAgeSec, path };
}

export function setSessionCookies(res: NextResponse, access: string, refresh: string) {
  res.cookies.set(COOKIE_ACCESS, access, cookieOptions(60 * 30));
  res.cookies.set(COOKIE_REFRESH, refresh, cookieOptions(60 * 60 * 24 * 14, REFRESH_PATH));
}

export function clearSessionCookies(res: NextResponse) {
  res.cookies.delete(COOKIE_ACCESS);
  res.cookies.delete({ name: COOKIE_REFRESH, path: REFRESH_PATH });
  res.cookies.delete({ name: COOKIE_REFRESH, path: "/api/auth" }); // 1.6 시절 path 쿠키 마이그레이션 정리
  res.cookies.delete(COOKIE_ROLE);
}

/** BFF 공통: access로 FastAPI 호출, 401(unauthorized)이면 refresh 회전 후 1회 재시도.
 *  반환된 NextResponse에 회전된 쿠키가 실려 있으므로 그대로 응답해야 한다. */
export async function proxyWithRefresh(
  req: NextRequest,
  path: string,
  init: RequestInit,
): Promise<NextResponse> {
  const access = req.cookies.get(COOKIE_ACCESS)?.value;
  const call = (token?: string) =>
    fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { ...(init.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      cache: "no-store",
    });

  let upstream = await call(access);
  let rotated: { access_token: string; refresh_token: string } | null = null;

  if (upstream.status === 401) {
    const refresh = req.cookies.get(COOKIE_REFRESH)?.value;
    if (refresh) {
      try {
        const r = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refresh }),
          cache: "no-store",
        });
        if (r.ok) {
          rotated = await r.json();
          upstream = await call(rotated!.access_token);
        }
      } catch {
        // 네트워크 예외 — 아래에서 401 그대로 처리 (500 방지)
      }
    }
  }

  const body = await upstream.json().catch(() => ({ code: "service_unavailable", message: "일시적인 오류입니다.", details: [] }));
  const res = NextResponse.json(body, { status: upstream.status });
  if (rotated) setSessionCookies(res, rotated.access_token, rotated.refresh_token);
  if (upstream.status === 401) clearSessionCookies(res); // 갱신 실패 — 클라이언트는 /login으로
  return res;
}
