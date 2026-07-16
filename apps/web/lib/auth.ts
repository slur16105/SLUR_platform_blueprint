// 서버 전용 인증 헬퍼 — 토큰은 httpOnly 쿠키로만 존재 (Story 1.6 결정)
export const API_BASE = process.env.API_BASE_URL ?? "http://localhost:8000";

export const COOKIE_ACCESS = "slur_access";
export const COOKIE_REFRESH = "slur_refresh";
export const COOKIE_ROLE = "slur_role"; // UX 라우팅 힌트 전용 — 보안 판정은 항상 FastAPI

const secure = process.env.NODE_ENV === "production";

export function cookieOptions(maxAgeSec: number, path = "/") {
  return { httpOnly: true, secure, sameSite: "lax" as const, maxAge: maxAgeSec, path };
}
