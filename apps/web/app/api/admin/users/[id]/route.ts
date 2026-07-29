import { NextRequest } from "next/server";

import { proxyWithRefresh } from "@/lib/auth";

// 관리자 회원 상세 — 기본정보·역할 + (판매자면) 사업자 프로필·상품 수
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) {
    return Response.json({ code: "validation_error", message: "올바르지 않은 회원 ID입니다.", details: [] }, { status: 422 });
  }
  return proxyWithRefresh(req, `/api/v1/admin/users/${id.toLowerCase()}`, { method: "GET" });
}
