import { NextRequest } from "next/server";

import { assertSameOrigin, proxyWithRefresh } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const qs = req.nextUrl.searchParams.toString();
  return proxyWithRefresh(req, `/api/v1/admin/seller-applications${qs ? `?${qs}` : ""}`, { method: "GET" });
}

// 상태를 바꾸는 POST는 assertSameOrigin을 먼저 태운다 (8.2가 세운 규약).
// 검사가 없으면 임의 사이트의 폼 POST가 상류 401을 유발해 관리자를 강제 로그아웃시킬 수 있다.
export async function POST(req: NextRequest) {
  const forbidden = assertSameOrigin(req);
  if (forbidden) return forbidden;

  // { id, action: "approve" | "reject", reason? }
  const body = await req.json().catch(() => ({}));
  if (typeof body.id !== "string" || !/^[0-9a-f-]{36}$/.test(body.id)) {
    return Response.json({ code: "validation_error", message: "입력값이 올바르지 않습니다.", details: [] }, { status: 422 });
  }
  const action = body.action === "reject" ? "reject" : "approve";
  return proxyWithRefresh(req, `/api/v1/admin/seller-applications/${body.id}/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: action === "reject" ? JSON.stringify({ reason: body.reason }) : undefined,
  });
}
