import { NextRequest, NextResponse } from "next/server";

import {
  API_BASE,
  COOKIE_OAUTH_NEXT,
  COOKIE_OAUTH_STATE,
  OAUTH_COOKIE_PATH,
  fetchRoles,
  resolveRole,
  setRoleCookie,
  setSessionCookies,
} from "@/lib/auth";
import { roleHome, safeNextPath } from "@/lib/nav";

const MAX_CODE = 512; // 백엔드 KakaoLoginRequest.code의 상한과 같은 값
const MAX_STATE = 128;

/* 카카오 콜백 (D4) — 페이지가 아니라 Route Handler다.
   인가 코드는 이 함수 스코프 밖으로 나가지 않는다: HTML을 만들지 않으므로 클라이언트 번들·
   RSC 페이로드·localStorage 어디에도 남지 않고, 서버 리다이렉트라 주소창에도 남지 않는다 (AC 6).

   🔒 GET(카카오가 브라우저를 돌려보내는 최상위 내비게이션)이라 Origin 검사가 성립하지 않는다 —
      이 자리의 CSRF 방어는 start가 심은 state 쿠키다. sameSite는 lax여야 쿠키가 실린다. */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const error = sp.get("error");
  const state = sp.get("state");
  const code = sp.get("code");
  const cookieState = req.cookies.get(COOKIE_OAUTH_STATE)?.value;
  const cookieNext = req.cookies.get(COOKIE_OAUTH_NEXT)?.value;

  // 1) 사용자가 카카오에서 취소 — 조용히 돌아간다(문구 없음). 그 밖의 인가 오류는 고정 문장으로.
  if (error) return leave(error === "access_denied" ? "/login" : "/login?e=kakao");

  // 2) state 검증 — 없거나 다르면 세션을 세우지 않는다
  if (!cookieState || !state || state.length > MAX_STATE || state !== cookieState) {
    return leave("/login?e=state");
  }
  if (!code || code.length > MAX_CODE) return leave("/login?e=kakao");

  // 3) 기존 백엔드 엔드포인트로 교환 — 신규 엔드포인트 0건
  let kakaoStatus = 0;
  let data: { access_token?: string; refresh_token?: string; code?: string } | null = null;
  try {
    const upstream = await fetch(`${API_BASE}/api/v1/auth/kakao`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, redirect_uri: process.env.KAKAO_REDIRECT_URI ?? "" }),
      cache: "no-store",
    });
    kakaoStatus = upstream.status;
    data = await upstream.json().catch(() => null);
  } catch {
    return leave("/login?e=kakao"); // 네트워크 예외
  }

  if (kakaoStatus < 200 || kakaoStatus >= 300 || !data?.access_token || !data.refresh_token) {
    // 인가 코드는 로그에 남기지 않는다 (R2) — 상태 코드와 백엔드 에러 code까지만
    console.error("kakao callback failed", { status: kakaoStatus, code: data?.code });
    return leave(data?.code === "email_conflict" ? "/login?e=conflict" : "/login?e=kakao");
  }

  // 4) 역할 조회 — 실패 시 세션을 세우지 않고 되돌린다(조용한 강등 금지)
  const roles = await fetchRoles(data.access_token);
  if (roles === null) return leave("/login?e=kakao");
  const role = resolveRole(roles);

  // 5) 복귀 — 소비 직전에 다시 자체 경로인지 확인한다
  const dest = safeNextPath(cookieNext) ?? roleHome(role);
  const res = leave(dest);
  setSessionCookies(res, data.access_token, data.refresh_token);
  setRoleCookie(res, role);
  return res;
}

/** 어느 경로로 끝나든 state·next 쿠키를 소비 즉시 삭제하고 캐시를 막는다.
 *  Location은 상대경로(자체 루트경로)로 준다 — dest는 항상 safeNextPath·roleHome·"/login…"이라
 *  루트 상대경로다. 브라우저가 "실제로 접속한 공개 URL" 기준으로 해석하므로, 프록시(Railway)
 *  뒤에서 req.nextUrl이 내부 호스트(0.0.0.0:8080)를 담아 리다이렉트가 0.0.0.0으로 새던 버그를
 *  원천 차단한다. 절대 URL을 만들지 않아 x-forwarded-host 위조에도 영향받지 않는다. */
function leave(dest: string) {
  const res = new NextResponse(null, { status: 302, headers: { Location: dest } });
  res.cookies.delete({ name: COOKIE_OAUTH_STATE, path: OAUTH_COOKIE_PATH });
  res.cookies.delete({ name: COOKIE_OAUTH_NEXT, path: OAUTH_COOKIE_PATH });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
