// 8.6 주문상세가 이 라우트를 그대로 쓴다 — 경로·검증 규칙을 복제하지 않는다.

import { NextRequest } from "next/server";

import { proxyWithRefresh } from "@/lib/auth";

// 표준 UUID — 하이픈 위치·hex 검증 (BFF 동적 라우트 관례, 8.3 D2 · 8.4 D11)
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/* 주문 상세 조회 BFF (8.5 D13).
   주문완료 화면이 ?order=<uuid>로 받은 id를 여기로 되묻는다 — 생성 응답에 order_no가 없기 때문이다 (D3).

   🚨 ctx.params는 Next 16에서 Promise다 — await한다.
   🚨 형식이 아닌 id는 상류를 부르지 않고 not_found 404 봉투로 끊는다.
      남의 주문도 상류가 404를 주므로(존재 노출 방지) 화면에서 두 경우가 같은 문장이 된다. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) {
    return Response.json({ code: "not_found", message: "주문을 찾을 수 없습니다.", details: [] }, { status: 404 });
  }
  return proxyWithRefresh(req, `/api/v1/orders/${id.toLowerCase()}`, { method: "GET" });
}
