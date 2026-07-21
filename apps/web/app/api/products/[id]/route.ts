import { NextRequest } from "next/server";

import { NOT_FOUND, UUID_RE, proxyPublic, publicJson } from "@/lib/public-api";

/* 공개 상품 상세 — GET /api/v1/products/{id}.
   params는 Next 16에서 Promise다 (await).
   id가 uuid 형식이 아니면 상류를 부르지 않고 404 not_found로 통일한다 —
   상류의 422와 없는 상품의 404를 화면에서 구별할 이유가 없고, 분기가 하나로 줄어든다 (D2). */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return publicJson(NOT_FOUND, 404);
  return proxyPublic(`/api/v1/products/${id.toLowerCase()}`);
}
