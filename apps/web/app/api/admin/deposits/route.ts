import { NextRequest } from "next/server";

import { proxyWithRefresh } from "@/lib/auth";

export async function GET(req: NextRequest) {
  // 입금대기 주문 목록 — page 기반 페이지네이션
  const page = req.nextUrl.searchParams.get("page") ?? "1";
  return proxyWithRefresh(req, `/api/v1/admin/orders/pending?page=${encodeURIComponent(page)}`, { method: "GET" });
}

export async function POST(req: NextRequest) {
  // { order_id, note? } → 입금 확인 (FastAPI confirm-payment, 성공 시 204)
  const body = await req.json().catch(() => ({}));
  if (typeof body.order_id !== "string" || !/^[0-9a-f-]{36}$/.test(body.order_id)) {
    return Response.json({ code: "validation_error", message: "입력값이 올바르지 않습니다.", details: [] }, { status: 422 });
  }
  const note = typeof body.note === "string" && body.note.trim() ? { note: body.note.trim().slice(0, 500) } : {};
  return proxyWithRefresh(req, `/api/v1/admin/orders/${body.order_id}/confirm-payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(note),
  });
}
