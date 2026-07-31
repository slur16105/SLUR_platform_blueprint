import { NextRequest } from "next/server";

import { assertSameOrigin, proxyWithRefresh } from "@/lib/auth";

const UUID_RE = /^[0-9a-f-]{36}$/;

export async function GET(req: NextRequest) {
  return proxyWithRefresh(req, "/api/v1/addresses", { method: "GET" });
}

// 상태를 바꾸는 POST는 assertSameOrigin을 먼저 태운다 (8.2가 세운 규약)
export async function POST(req: NextRequest) {
  const forbidden = assertSameOrigin(req);
  if (forbidden) return forbidden;

  const body = await req.json().catch(() => ({}));
  const { op, id, ...payload } = body as Record<string, unknown>;
  const json = { headers: { "Content-Type": "application/json" } };

  if (op === "create") {
    return proxyWithRefresh(req, "/api/v1/addresses", { method: "POST", ...json, body: JSON.stringify(payload) });
  }
  if (typeof id !== "string" || !UUID_RE.test(id)) {
    return Response.json({ code: "validation_error", message: "입력값이 올바르지 않습니다.", details: [] }, { status: 422 });
  }
  if (op === "update") {
    return proxyWithRefresh(req, `/api/v1/addresses/${id}`, { method: "PUT", ...json, body: JSON.stringify(payload) });
  }
  if (op === "default") {
    return proxyWithRefresh(req, `/api/v1/addresses/${id}/default`, { method: "POST" });
  }
  if (op === "delete") {
    return proxyWithRefresh(req, `/api/v1/addresses/${id}`, { method: "DELETE" });
  }
  return Response.json({ code: "validation_error", message: "입력값이 올바르지 않습니다.", details: [] }, { status: 422 });
}
