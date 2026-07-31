import { NextRequest } from "next/server";

import { assertSameOrigin, proxyWithRefresh } from "@/lib/auth";

const STATUSES = new Set(["requested", "approved", "rejected", "completed"]);
const OPS = new Set(["approve", "reject", "complete"]);
const UUID_RE = /^[0-9a-f-]{36}$/;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const status = sp.get("status") ?? "";
  const page = sp.get("page") ?? "1";
  if (status && !STATUSES.has(status)) {
    return Response.json({ code: "validation_error", message: "지원하지 않는 상태입니다.", details: [] }, { status: 422 });
  }
  const qs = new URLSearchParams({ page });
  if (status) qs.set("status", status);
  return proxyWithRefresh(req, `/api/v1/admin/returns?${qs.toString()}`, { method: "GET" });
}

export async function POST(req: NextRequest) {
  const forbidden = assertSameOrigin(req);
  if (forbidden) return forbidden;

  const body = await req.json().catch(() => ({}));
  if (typeof body.id !== "string" || !UUID_RE.test(body.id) || !OPS.has(body.op)) {
    return Response.json({ code: "validation_error", message: "입력값이 올바르지 않습니다.", details: [] }, { status: 422 });
  }
  // 환불 금액은 완료 처리에서만 의미가 있다 — 서버가 최종 검증하지만 여기서도 형태를 거른다
  const payload: Record<string, unknown> = { note: typeof body.note === "string" ? body.note : "" };
  if (body.op === "complete") payload.refund_amount = body.refund_amount;
  return proxyWithRefresh(req, `/api/v1/admin/returns/${body.id}/${body.op}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
