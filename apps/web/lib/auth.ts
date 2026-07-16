// 서버 전용 인증 헬퍼 — 토큰은 httpOnly 쿠키로만 존재 (Task 1 결정)
import { cookies } from "next/headers";

export const API_BASE = process.env.API_BASE_URL ?? "http://localhost:8000";

export const COOKIE_ACCESS = "slur_access";
export const COOKIE_REFRESH = "slur_refresh";
export const COOKIE_ROLE = "slur_role"; // UX 라우팅 힌트 전용 — 보안 판정은 항상 FastAPI

const secure = process.env.NODE_ENV === "production";

export function cookieOptions(maxAgeSec: number, path = "/") {
  return { httpOnly: true, secure, sameSite: "lax" as const, maxAge: maxAgeSec, path };
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE}${path}`, { ...init, cache: "no-store" });
}

/** access로 호출하고 401(unauthorized)이면 refresh 회전 후 1회 재시도 */
export async function authedFetch(path: string, init?: RequestInit): Promise<Response> {
  const jar = await cookies();
  const access = jar.get(COOKIE_ACCESS)?.value;
  const call = (token: string | undefined) =>
    apiFetch(path, {
      ...init,
      headers: { ...(init?.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });

  let res = await call(access);
  if (res.status !== 401) return res;

  const refresh = jar.get(COOKIE_REFRESH)?.value;
  if (!refresh) return res;
  const rotated = await apiFetch("/api/v1/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refresh }),
  });
  if (!rotated.ok) return res;
  const tokens = (await rotated.json()) as { access_token: string; refresh_token: string };
  jar.set(COOKIE_ACCESS, tokens.access_token, cookieOptions(60 * 30));
  jar.set(COOKIE_REFRESH, tokens.refresh_token, cookieOptions(60 * 60 * 24 * 14));
  return call(tokens.access_token);
}
