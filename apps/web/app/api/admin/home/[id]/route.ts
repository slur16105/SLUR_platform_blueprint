import { NextRequest } from "next/server";

import { assertSameOrigin, proxyWithRefresh } from "@/lib/auth";

// 표준 UUID — 하이픈 위치·hex 검증, 대소문자 허용 (FastAPI 전달 전 소문자 정규화)
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function badId() {
  return Response.json({ code: "validation_error", message: "올바르지 않은 항목 ID입니다.", details: [] }, { status: 422 });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return badId();
  return proxyWithRefresh(req, `/api/v1/admin/home/features/${id.toLowerCase()}`, { method: "GET" });
}

// 부분 수정 — 상태를 바꾸므로 assertSameOrigin 필수. product_ids가 오면 상류가 품목을 전량 교체한다.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const forbidden = assertSameOrigin(req);
  if (forbidden) return forbidden;
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return badId();
  const body = await req.json().catch(() => ({}));
  return proxyWithRefresh(req, `/api/v1/admin/home/features/${id.toLowerCase()}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const forbidden = assertSameOrigin(req);
  if (forbidden) return forbidden;
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return badId();
  return proxyWithRefresh(req, `/api/v1/admin/home/features/${id.toLowerCase()}`, { method: "DELETE" });
}
