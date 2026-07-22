import { NextRequest } from "next/server";

import { assertSameOrigin, proxyWithRefresh } from "@/lib/auth";

// 표준 UUID — 하이픈 위치·hex 검증 (BFF 동적 라우트 관례, 8.3 D2 · 8.4 D11 · 8.5 D4)
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/* 판매자 묶음 취소 BFF (8.6 D12).
   상태를 바꾸는 POST다 — assertSameOrigin을 먼저 태운다 (8.2 D1의 규약).

   🚨 본문을 상류로 넘기지 않는다. 이 화면은 취소 사유를 받지 않으므로(D7) 빈 POST를 보낸다 —
      SubOrderCancelRequest는 전 필드 optional이고 라우터가 body 없는 POST를 허용한다 (4.6 리뷰 F7).
      비우면 서비스가 "구매자 취소"로 채운다.
   🚨 ctx.params는 Next 16에서 Promise다 — await한다.
   🚨 형식이 아닌 id는 상류를 부르지 않고 not_found 봉투로 끊는다. 남의 묶음도 상류가 404를 주므로
      (존재 노출 방지) 화면에서 두 경우가 같은 문장이 된다.
   🚨 proxyWithRefresh가 돌려준 응답을 그대로 반환한다 — 다시 감싸면 회전된 세션 쿠키가 유실된다. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const forbidden = assertSameOrigin(req);
  if (forbidden) return forbidden;

  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) {
    return Response.json({ code: "not_found", message: "주문을 찾을 수 없습니다.", details: [] }, { status: 404 });
  }

  return proxyWithRefresh(req, `/api/v1/orders/sub-orders/${id.toLowerCase()}/cancel`, { method: "POST" });
}
