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

/** 세션 쿠키 소거.
 *
 *  🚨 `res.cookies.delete()`도 `res.cookies.set()`도 쓰면 안 된다 — ResponseCookies는
 *  **이름만으로** 키를 잡는다. 같은 이름을 두 path로 지우려 하면 두 번째 호출이 첫 번째를
 *  덮어써 Set-Cookie가 한 줄만 나간다. 실측으로 확인했다:
 *    set() 3회(access · refresh@/api · refresh@/api/auth) → Set-Cookie 3줄이 나오지만
 *    refresh는 `/api/auth` 한 줄뿐 → **Path=/api의 진짜 refresh 쿠키가 14일 살아남는다.**
 *  그 쿠키가 남으면 로그아웃 후에도 다음 401에서 proxyWithRefresh가 회전시켜 세션이
 *  되살아난다(정상 경로에선 백엔드가 토큰을 폐기해 죽은 쿠키지만, 상류 로그아웃이 실패하면
 *  유효한 채로 남는다 — 그 실패는 지금 catch로 삼켜진다).
 *
 *  그래서 Set-Cookie 헤더를 직접 append한다. 이 경로만 path별 독립 소거를 보장한다. */
function expireCookie(res: NextResponse, name: string, path: string, httpOnly: boolean) {
  const parts = [`${name}=`, `Path=${path}`, "Max-Age=0", "SameSite=Lax"];
  if (httpOnly) parts.push("HttpOnly");
  if (secure) parts.push("Secure");
  res.headers.append("Set-Cookie", parts.join("; "));
}

export function clearSessionCookies(res: NextResponse) {
  expireCookie(res, COOKIE_ACCESS, "/", true);
  expireCookie(res, COOKIE_REFRESH, REFRESH_PATH, true);
  expireCookie(res, COOKIE_REFRESH, "/api/auth", true); // 1.6 시절 path 쿠키 마이그레이션 정리
  expireCookie(res, COOKIE_ROLE, "/", false); // UX 힌트 쿠키 — JS가 읽어야 하므로 httpOnly 아님
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
    // Origin: null(샌드박스 iframe·일부 리다이렉트 경유)은 URL로 파싱되지 않는다.
    // 던지게 두면 봉투 없는 500이 나가므로 파싱 실패는 곧 차단으로 본다 (fail-closed).
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      return NextResponse.json({ code: "forbidden", message: "허용되지 않은 요청입니다.", details: [] }, { status: 403 });
    }
    const hosts = [req.headers.get("x-forwarded-host"), req.headers.get("host"), req.nextUrl.host].filter(Boolean);
    if (!hosts.includes(originHost)) {
      return NextResponse.json({ code: "forbidden", message: "허용되지 않은 요청입니다.", details: [] }, { status: 403 });
    }
  }
  return null;
}

/** 인증 경유 응답은 절대 캐시되면 안 된다. 이 경로로 나가는 본문에는 이름·이메일·주소·주문이
 *  들어간다. Vary: Cookie까지 붙여 쿠키가 다른 사용자의 응답이 섞이지 않게 한다.
 *  (공개 경로 lib/public-api.ts는 이미 no-store를 붙이고 있었고 여기만 비어 있었다.) */
function noStore(res: NextResponse): NextResponse {
  res.headers.set("Cache-Control", "no-store, private");
  res.headers.set("Vary", "Cookie");
  return res;
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

  let upstream: Response;
  try {
    upstream = await call(access);
  } catch {
    // 상류에 닿지 못한 경우. proxyPublic과 같은 봉투로 통일한다 — 규약이 두 벌이면
    // 클라이언트가 어떤 화면에서는 봉투를, 어떤 화면에서는 500 HTML을 받는다.
    return noStore(NextResponse.json(
      { code: "service_unavailable", message: "일시적인 오류입니다. 잠시 후 다시 시도해 주세요.", details: [] },
      { status: 503 },
    ));
  }
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
  return noStore(res);
}
