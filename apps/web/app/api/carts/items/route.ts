import { NextRequest } from "next/server";

import { assertSameOrigin, proxyWithRefresh } from "@/lib/auth";

/* 장바구니 담기 BFF (D11).
   상태를 바꾸는 라우트이므로 assertSameOrigin을 먼저 태운다 (8.2가 세운 규약).
   본문은 {variant_id, quantity}만 화이트리스트로 상류에 넘긴다 —
   클라이언트가 보낸 다른 키가 FastAPI 스키마에 새어 들어가지 않게 한다. */
export async function POST(req: NextRequest) {
  const forbidden = assertSameOrigin(req);
  if (forbidden) return forbidden;

  const body = await req.json().catch(() => ({}));
  return proxyWithRefresh(req, "/api/v1/carts/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ variant_id: body.variant_id, quantity: body.quantity }),
  });
}
