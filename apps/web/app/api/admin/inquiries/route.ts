import { NextRequest } from "next/server";

import { assertSameOrigin, proxyWithRefresh } from "@/lib/auth";

const STATUSES = new Set(["open", "answered", "closed"]);

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const status = sp.get("status") ?? "";
  const page = sp.get("page") ?? "1";
  if (status && !STATUSES.has(status)) {
    return Response.json({ code: "validation_error", message: "지원하지 않는 상태입니다.", details: [] }, { status: 422 });
  }
  const qs = new URLSearchParams({ page });
  if (status) qs.set("status", status);
  return proxyWithRefresh(req, `/api/v1/admin/inquiries?${qs.toString()}`, { method: "GET" });
}

export async function POST(req: NextRequest) {
  const forbidden = assertSameOrigin(req);
  if (forbidden) return forbidden;

  const body = await req.json().catch(() => ({}));
  if (typeof body.id !== "string" || !/^[0-9a-f-]{36}$/.test(body.id)) {
    return Response.json({ code: "validation_error", message: "입력값이 올바르지 않습니다.", details: [] }, { status: 422 });
  }
  if (body.op === "reply") {
    return proxyWithRefresh(req, `/api/v1/admin/inquiries/${body.id}/replies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: body.body }),
    });
  }
  if (body.op === "close") {
    return proxyWithRefresh(req, `/api/v1/admin/inquiries/${body.id}/close`, { method: "POST" });
  }
  if (body.op === "get") {
    return proxyWithRefresh(req, `/api/v1/admin/inquiries/${body.id}`, { method: "GET" });
  }
  return Response.json({ code: "validation_error", message: "입력값이 올바르지 않습니다.", details: [] }, { status: 422 });
}
