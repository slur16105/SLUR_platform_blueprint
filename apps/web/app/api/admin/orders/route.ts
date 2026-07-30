import { NextRequest } from "next/server";

import { proxyWithRefresh } from "@/lib/auth";

const STATUSES = new Set(["awaiting_payment", "preparing", "shipping", "delivered", "canceled"]);
const PERIODS = new Set(["today", "7d", "30d"]);

export async function GET(req: NextRequest) {
  // 관리자 전체 주문 검색 (FR-29) — q(구매자·브랜드·주문번호) + status + period + page
  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") ?? "").trim();
  const status = sp.get("status") ?? "";
  const period = sp.get("period") ?? "";
  const page = sp.get("page") ?? "1";
  if (q && (q.length < 2 || q.length > 100)) {
    return Response.json({ code: "validation_error", message: "검색어는 2~100자로 입력해 주세요.", details: [] }, { status: 422 });
  }
  if (status && !STATUSES.has(status)) {
    return Response.json({ code: "validation_error", message: "지원하지 않는 상태입니다.", details: [] }, { status: 422 });
  }
  if (period && !PERIODS.has(period)) {
    return Response.json({ code: "validation_error", message: "지원하지 않는 기간입니다.", details: [] }, { status: 422 });
  }
  if (!/^\d+$/.test(page) || Number(page) < 1 || Number(page) > 10000) {
    return Response.json({ code: "validation_error", message: "올바르지 않은 페이지입니다.", details: [] }, { status: 422 });
  }
  const query = new URLSearchParams({ page });
  if (q) query.set("q", q);
  if (status) query.set("status", status);
  if (period) query.set("period", period);
  return proxyWithRefresh(req, `/api/v1/admin/orders?${query.toString()}`, { method: "GET" });
}
