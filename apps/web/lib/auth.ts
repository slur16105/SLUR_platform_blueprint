// 서버 전용 인증 헬퍼 — 토큰은 httpOnly 쿠키로만 존재 (1.6 결정, 2.1에서 refresh path /api로 개정)
import { NextRequest, NextResponse } from "next/server";

import type { SlurRole } from "./nav";

export type { SlurRole };

export const API_BASE = process.env.API_BASE_URL ?? "http://localhost:8000";

export const COOKIE_ACCESS = "slur_access";
export const COOKIE_REFRESH = "slur_refresh";
export const COOKIE_ROLE = "slur_role"; // UX 라우팅 힌트 전용 — 보안 판정은 항상 FastAPI
export const REFRESH_PATH = "/api"; // BFF API 라우트 전체에서 회전 가능, 페이지 요청엔 미탑재

// 카카오 인가 플로우 전용 단명 쿠키 (D4) — 시작에서 심고 콜백에서 소비 즉시 삭제한다.
// path를 좁혀 두어 다른 요청에는 실리지 않는다. sameSite는 반드시 lax —
// strict면 카카오에서 돌아오는 최상위 GET 내비게이션에 실리지 않아 항상 state 불일치가 된다.
export const COOKIE_OAUTH_STATE = "slur_oauth_state";
export const COOKIE_OAUTH_NEXT = "slur_oauth_next";
export const OAUTH_COOKIE_PATH = "/api/auth/kakao";

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

/* ─────────────────────────────────────────────
   D1 — 역할 판정·Origin 검사의 자리. 로그인·회원가입·카카오 콜백 셋이 이것만 쓴다.
   판정식이 세 곳에 복제되면 다음에 역할이 하나 늘 때 두 곳만 고치는 사고가 난다.
   ───────────────────────────────────────────── */

/** roles → 역할 힌트. 빈 배열 = 구매자 (백엔드 GET /auth/roles의 계약: "빈 배열 = 구매자(암묵 기본)").
 *  admin·seller 두 항은 1.6에서 프로덕션 검증된 식 그대로다 — 바뀐 것은 마지막 항 하나뿐. */
export function resolveRole(roles: string[]): SlurRole {
  return roles.includes("admin") ? "admin" : roles.includes("seller") ? "seller" : "buyer";
}

/** slur_role — 14일 · httpOnly:false · sameSite lax · path /. UX 라우팅 힌트 전용 (R7, AD-1). */
export function setRoleCookie(res: NextResponse, role: SlurRole) {
  res.cookies.set(COOKIE_ROLE, role, { ...cookieOptions(60 * 60 * 24 * 14), httpOnly: false });
}

/** GET /auth/roles. 실패 시 null — 호출자가 503으로 막는다.
 *  조용한 강등(역할 없는 쿠키를 14일 세우기)은 판매자를 구매자로 만드는 사고다 (1.6 리뷰 결정). */
export async function fetchRoles(access: string): Promise<string[] | null> {
  const rolesRes = await fetch(`${API_BASE}/api/v1/auth/roles`, {
    headers: { Authorization: `Bearer ${access}` },
    cache: "no-store",
  });
  if (!rolesRes.ok) return null;
  return (await rolesRes.json()).roles ?? [];
}

/** login-CSRF 방어: 크로스사이트 폼 POST 차단. 위반이면 403 봉투, 아니면 null.
 *  프록시(Railway) 뒤에서는 nextUrl.host가 내부 호스트일 수 있어 forwarded 헤더까지 비교한다.
 *  origin 헤더가 아예 없으면 통과시킨다 — 브라우저 외 클라이언트를 막지 않는 현행 성질이다.
 *  상태를 바꾸는 모든 신규 POST 라우트가 이 한 벌을 쓴다 (AC 8). */
export function assertSameOrigin(req: NextRequest): NextResponse | null {
  const origin = req.headers.get("origin");
  if (origin) {
    const originHost = new URL(origin).host;
    const hosts = [req.headers.get("x-forwarded-host"), req.headers.get("host"), req.nextUrl.host].filter(Boolean);
    if (!hosts.includes(originHost)) {
      return NextResponse.json({ code: "forbidden", message: "허용되지 않은 요청입니다.", details: [] }, { status: 403 });
    }
  }
  return null;
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

  let res: NextResponse;
  if (upstream.status === 204) {
    res = new NextResponse(null, { status: 204 }); // 본문 없는 응답 — json 생성 시 TypeError 방지
  } else {
    const body = await upstream.json().catch(() => ({ code: "service_unavailable", message: "일시적인 오류입니다.", details: [] }));
    res = NextResponse.json(body, { status: upstream.status });
  }
  if (rotated) setSessionCookies(res, rotated.access_token, rotated.refresh_token);
  if (upstream.status === 401) clearSessionCookies(res); // 갱신 실패 — 클라이언트는 /login으로
  return res;
}
