import { NextRequest } from "next/server";

import { assertSameOrigin, proxyWithRefresh } from "@/lib/auth";

export async function GET(req: NextRequest) {
  // 플랫폼 설정 목록 (deposit_account · unpaid_cancel_days · low_stock_threshold)
  return proxyWithRefresh(req, "/api/v1/admin/settings", { method: "GET" });
}

// 상태를 바꾸는 PUT은 assertSameOrigin을 먼저 태운다 (8.2가 세운 규약).
// 검사가 없으면 임의 사이트의 크로스사이트 요청이 상류 401을 유발해 관리자를 강제 로그아웃시킬 수 있다.
export async function PUT(req: NextRequest) {
  const forbidden = assertSameOrigin(req);
  if (forbidden) return forbidden;

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
