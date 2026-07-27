import { NextRequest, NextResponse } from "next/server";

import { COOKIE_OAUTH_NEXT, COOKIE_OAUTH_STATE, OAUTH_COOKIE_PATH, assertSameOrigin } from "@/lib/auth";
import { safeNextPath } from "@/lib/nav";

const KAKAO_AUTHORIZE = "https://kauth.kakao.com/oauth/authorize";
// lib/auth.ts와 동일 규칙 — 로컬 http 검증에서는 COOKIE_SECURE=false로 끈다(미설정 시 NODE_ENV==production).
const secure = process.env.COOKIE_SECURE != null
  ? process.env.COOKIE_SECURE === "true"
  : process.env.NODE_ENV === "production";

/* 카카오 인가 시작 (D4).
   GET 링크가 아니라 POST인 이유: GET이면 제3자가 <img src="/api/auth/kakao/start">로
   피해자 브라우저에 플로우를 강제 개시시킬 수 있다(소셜 login-CSRF).
   POST + Origin 검사가 "기존 검사를 신규 인증 라우트에 동일 적용"을 문자 그대로 만족시킨다. */
export async function POST(req: NextRequest) {
  const forbidden = assertSameOrigin(req);
  if (forbidden) return forbidden;

  const clientId = process.env.KAKAO_REST_API_KEY ?? "";
  const redirectUri = process.env.KAKAO_REDIRECT_URI ?? "";

  const form = await req.formData().catch(() => null);
  const rawNext = form?.get("next");
  const next = safeNextPath(typeof rawNext === "string" ? rawNext : null) ?? "";

  // env가 없으면 인가 URL을 만들 수 없다 — 화면은 고정 한국어 문장을 보인다(원인을 노출하지 않는다)
  if (!clientId || !redirectUri) {
    return noStore(NextResponse.redirect(new URL("/login?e=kakao", req.nextUrl), 303));
  }

  const state = crypto.randomUUID();
  const authorize = new URL(KAKAO_AUTHORIZE);
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("redirect_uri", redirectUri); // 카카오 콘솔·백엔드 allowlist와 글자 단위로 같아야 한다
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("state", state);

  const res = NextResponse.redirect(authorize, 303);
  const opts = { httpOnly: true, secure, sameSite: "lax" as const, maxAge: 600, path: OAUTH_COOKIE_PATH };
  res.cookies.set(COOKIE_OAUTH_STATE, state, opts);
  res.cookies.set(COOKIE_OAUTH_NEXT, next, opts);
  return noStore(res);
}

function noStore(res: NextResponse) {
  res.headers.set("Cache-Control", "no-store");
  return res;
}
