import { NextRequest } from "next/server";

import { assertSameOrigin, proxyWithRefresh } from "@/lib/auth";

const STATUSES = new Set(["preparing", "shipping", "delivered"]);
const UUID_RE = /^[0-9a-f-]{36}$/;

export async function GET(req: NextRequest) {
  // 판매자 주문 목록 — status 탭 + page 기반 페이지네이션
  const status = req.nextUrl.searchParams.get("status") ?? "preparing";
  const page = req.nextUrl.searchParams.get("page") ?? "1";
  if (!STATUSES.has(status)) {
    return Response.json({ code: "validation_error", message: "지원하지 않는 상태입니다.", details: [] }, { status: 422 });
  }
  return proxyWithRefresh(req, `/api/v1/sellers/orders?status=${status}&page=${encodeURIComponent(page)}`, { method: "GET" });
}

// 상태를 바꾸는 POST는 assertSameOrigin을 먼저 태운다 (8.2가 세운 규약).
// 검사가 없으면 임의 사이트의 폼 POST가 상류 401을 유발해 판매자를 강제 로그아웃시킬 수 있다.
export async function POST(req: NextRequest) {
  const forbidden = assertSameOrigin(req);
  if (forbidden) return forbidden;

  // { action: "ship"|"deliver", sub_order_id, carrier?, tracking_number? }
  // ship → 택배사·송장 등록(배송중 전환), deliver → 배송완료 전환. 성공 시 204
  const body = await req.json().catch(() => ({}));
  if (typeof body.sub_order_id !== "string" || !UUID_RE.test(body.sub_order_id)) {
    return Response.json({ code: "validation_error", message: "입력값이 올바르지 않습니다.", details: [] }, { status: 422 });
  }
  if (body.action === "ship") {
    const carrier = typeof body.carrier === "string" ? body.carrier.trim() : "";
    const tracking = typeof body.tracking_number === "string" ? body.tracking_number.trim() : "";
    if (!carrier || carrier.length > 50 || !tracking || tracking.length > 50) {
      return Response.json({ code: "validation_error", message: "택배사와 송장번호는 각각 1~50자여야 합니다.", details: [] }, { status: 422 });
    }
    return proxyWithRefresh(req, `/api/v1/sellers/sub-orders/${body.sub_order_id}/ship`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ carrier, tracking_number: tracking }),
    });
  }
  if (body.action === "deliver") {
    return proxyWithRefresh(req, `/api/v1/sellers/sub-orders/${body.sub_order_id}/deliver`, { method: "POST" });
  }
  return Response.json({ code: "validation_error", message: "지원하지 않는 동작입니다.", details: [] }, { status: 422 });
}
