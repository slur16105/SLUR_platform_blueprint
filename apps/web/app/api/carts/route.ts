import { NextRequest } from "next/server";

import { proxyWithRefresh } from "@/lib/auth";

/* 장바구니 조회 BFF (D11).
   🚨 인증 경로다 — lib/public-api.ts가 아니라 proxyWithRefresh를 쓴다.
      access 만료 시 refresh를 회전하고 1회 재시도하며, 회전된 쿠키가 반환 응답에 실려 있으므로
      NextResponse를 가공하지 않고 그대로 돌려준다. 401이면 세션 쿠키가 지워지고
      호출자(cart-view)가 /login?next=%2Fcart로 보낸다. */
export async function GET(req: NextRequest) {
  return proxyWithRefresh(req, "/api/v1/carts", { method: "GET" });
}
