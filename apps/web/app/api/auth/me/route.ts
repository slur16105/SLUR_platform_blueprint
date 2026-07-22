import { NextRequest } from "next/server";

import { proxyWithRefresh } from "@/lib/auth";

/* 계정 조회 BFF (8.7 Task 1) — GET /api/v1/auth/me.

   🚨 인증 경로다 — proxyWithRefresh를 쓴다. access 만료 시 refresh를 1회 회전해 재시도하고,
      회전된 세션 쿠키가 반환 NextResponse에 실려 있으므로 **가공하지 않고 그대로 돌려준다**.
      다시 감싸면 회전된 쿠키가 유실된다.
   🚨 assertSameOrigin을 붙이지 않는다 — 읽기(GET)다 (8.6 Task 1의 GET 규칙과 같다).
   🚨 lib/auth.ts는 import만 한다. 수정하지 않는다 — clearSessionCookies는 모든 BFF의
      세션 만료 처리를 공유한다 (8.2 D7).

   401이면 봉투가 그대로 내려오고 세션 쿠키가 지워진다 — 호출자(account-card)가
   /login?next=%2Fme로 보낸다. 미들웨어 통과는 인증이 아니다 (AD-1, R7). */
export async function GET(req: NextRequest) {
  return proxyWithRefresh(req, "/api/v1/auth/me", { method: "GET" });
}
