import { NextRequest } from "next/server";

import { assertSameOrigin, proxyWithRefresh } from "@/lib/auth";

/* 장바구니 항목 수량 변경·삭제 BFF (D11).
   🚨 Next 16에서 ctx.params는 Promise다 — await 후 형식을 검사한다.
      형식이 아니면 상류를 부르지 않고 not_found 봉투를 돌려준다(존재 노출 방지: 백엔드도 404다).
   🚨 DELETE는 204(본문 없음)로 응답한다 — proxyWithRefresh가 204 분기를 이미 갖고 있고
      클라이언트도 res.json()을 부르면 안 된다 (cart-api.ts). */

// 표준 UUID — 하이픈 위치·hex 검증, 대소문자 허용 (FastAPI 전달 전 소문자 정규화)
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function notFound() {
  return Response.json({ code: "not_found", message: "장바구니 항목을 찾을 수 없습니다.", details: [] }, { status: 404 });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const forbidden = assertSameOrigin(req);
  if (forbidden) return forbidden;

  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return notFound();

  const body = await req.json().catch(() => ({}));
  return proxyWithRefresh(req, `/api/v1/carts/items/${id.toLowerCase()}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quantity: body.quantity }),
  });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const forbidden = assertSameOrigin(req);
  if (forbidden) return forbidden;

  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return notFound();

  return proxyWithRefresh(req, `/api/v1/carts/items/${id.toLowerCase()}`, { method: "DELETE" });
}
