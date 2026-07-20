import { NextRequest } from "next/server";

import { proxyWithRefresh } from "@/lib/auth";

export async function GET(req: NextRequest) {
  // 플랫폼 설정 목록 (deposit_account · unpaid_cancel_days · low_stock_threshold)
  return proxyWithRefresh(req, "/api/v1/admin/settings", { method: "GET" });
}

export async function PUT(req: NextRequest) {
  // { value } → 무통장입금 계좌 변경 (FastAPI deposit-account, 성공 시 204)
  const body = await req.json().catch(() => ({}));
  const value = typeof body.value === "string" ? body.value.trim() : "";
  if (value.length < 1 || value.length > 200) {
    return Response.json({ code: "validation_error", message: "계좌 정보는 1~200자로 입력해 주세요.", details: [] }, { status: 422 });
  }
  return proxyWithRefresh(req, "/api/v1/admin/settings/deposit-account", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value }),
  });
}
