import { NextRequest } from "next/server";

import { assertSameOrigin, proxyWithRefresh } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const page = req.nextUrl.searchParams.get("page") ?? "1";
  return proxyWithRefresh(req, `/api/v1/returns?page=${encodeURIComponent(page)}`, { method: "GET" });
}

// 상태를 바꾸는 POST는 assertSameOrigin을 먼저 태운다 (8.2가 세운 규약)
export async function POST(req: NextRequest) {
  const forbidden = assertSameOrigin(req);
  if (forbidden) return forbidden;

  const body = await req.json().catch(() => ({}));
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return Response.json({ code: "validation_error", message: "반품할 상품을 선택해 주세요.", details: [] }, { status: 422 });
  }
  return proxyWithRefresh(req, "/api/v1/returns", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
