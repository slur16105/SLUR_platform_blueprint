import { NextRequest } from "next/server";

import { proxyWithRefresh } from "@/lib/auth";

const STATUSES = new Set(["awaiting_payment", "preparing", "shipping", "delivered", "canceled"]);

export async function GET(req: NextRequest) {
  // 관리자 전체 주문 검색 (FR-29) — q(구매자·브랜드·주문번호) + status + page
  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") ?? "").trim();
  const status = sp.get("status") ?? "";
  const page = sp.get("page") ?? "1";
  if (q && (q.length < 2 || q.length > 100)) {
    return Response.json({ code: "validation_error", message: "검색어는 2~100자로 입력해 주세요.", details: [] }, { status: 422 });
  }
  if (status && !STATUSES.has(status)) {
    return Response.json({ code: "validation_error", message: "지원하지 않는 상태입니다.", details: [] }, { status: 422 });
  }
  const query = new URLSearchParams({ page });
  if (q) query.set("q", q);
  if (status) query.set("status", status);
  return proxyWithRefresh(req, `/api/v1/admin/orders?${query.toString()}`, { method: "GET" });
}
