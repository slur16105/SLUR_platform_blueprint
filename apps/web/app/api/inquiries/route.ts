import { NextRequest } from "next/server";

import { assertSameOrigin, proxyWithRefresh } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const page = req.nextUrl.searchParams.get("page") ?? "1";
  return proxyWithRefresh(req, `/api/v1/inquiries?page=${encodeURIComponent(page)}`, { method: "GET" });
}

// 상태를 바꾸는 POST는 assertSameOrigin을 먼저 태운다 (8.2가 세운 규약)
export async function POST(req: NextRequest) {
  const forbidden = assertSameOrigin(req);
  if (forbidden) return forbidden;

  const body = await req.json().catch(() => ({}));
  // 상세 조회는 { op: "get", id } 로 받는다 — 동적 세그먼트 라우트를 늘리지 않는 기존 방식
  if (body.op === "get") {
    if (typeof body.id !== "string" || !/^[0-9a-f-]{36}$/.test(body.id)) {
      return Response.json({ code: "validation_error", message: "입력값이 올바르지 않습니다.", details: [] }, { status: 422 });
    }
    return proxyWithRefresh(req, `/api/v1/inquiries/${body.id}`, { method: "GET" });
  }
  return proxyWithRefresh(req, "/api/v1/inquiries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
