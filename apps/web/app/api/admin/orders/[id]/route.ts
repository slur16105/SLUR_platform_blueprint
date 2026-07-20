import { NextRequest } from "next/server";

import { proxyWithRefresh } from "@/lib/auth";

const UUID_RE = /^[0-9a-f-]{36}$/;

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  // 관리자 주문 상세 — 라인 id·취소 기록·이벤트 타임라인 포함
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) {
    return Response.json({ code: "validation_error", message: "올바르지 않은 주문 ID입니다.", details: [] }, { status: 422 });
  }
  return proxyWithRefresh(req, `/api/v1/admin/orders/${id}`, { method: "GET" });
}
