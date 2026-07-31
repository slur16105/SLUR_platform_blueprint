import { NextRequest } from "next/server";

import { assertSameOrigin, proxyWithRefresh } from "@/lib/auth";

const UUID_RE = /^[0-9a-f-]{36}$/;

export async function GET(req: NextRequest) {
  const page = req.nextUrl.searchParams.get("page") ?? "1";
  return proxyWithRefresh(req, `/api/v1/admin/notices?page=${encodeURIComponent(page)}`, { method: "GET" });
}

// 상태를 바꾸는 POST는 assertSameOrigin을 먼저 태운다 (8.2가 세운 규약)
export async function POST(req: NextRequest) {
  const forbidden = assertSameOrigin(req);
  if (forbidden) return forbidden;

  const body = await req.json().catch(() => ({}));
  const payload = {
    title: body.title,
    body: body.body,
    is_pinned: Boolean(body.is_pinned),
    published_at: body.published_at ?? null,
  };
  const json = { headers: { "Content-Type": "application/json" } };

  if (body.op === "create") {
    return proxyWithRefresh(req, "/api/v1/admin/notices", { method: "POST", ...json, body: JSON.stringify(payload) });
  }
  if (typeof body.id !== "string" || !UUID_RE.test(body.id)) {
    return Response.json({ code: "validation_error", message: "입력값이 올바르지 않습니다.", details: [] }, { status: 422 });
  }
  if (body.op === "update") {
    return proxyWithRefresh(req, `/api/v1/admin/notices/${body.id}`, { method: "PUT", ...json, body: JSON.stringify(payload) });
  }
  if (body.op === "delete") {
    return proxyWithRefresh(req, `/api/v1/admin/notices/${body.id}`, { method: "DELETE" });
  }
  return Response.json({ code: "validation_error", message: "입력값이 올바르지 않습니다.", details: [] }, { status: 422 });
}
