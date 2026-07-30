import { NextRequest } from "next/server";

import { assertSameOrigin, proxyWithRefresh } from "@/lib/auth";

export async function GET(req: NextRequest) {
  // counts=1 → 관리자 전용 목록(카테고리별 상품 수 포함, admin 권한 필요).
  // 기본은 공개 목록 — 이 라우트는 판매자 상품 등록 화면도 쓰므로 기본 경로를 admin 전용으로 바꾸면 403이 된다.
  if (req.nextUrl.searchParams.get("counts") === "1") {
    return proxyWithRefresh(req, "/api/v1/admin/categories", { method: "GET" });
  }
  return proxyWithRefresh(req, "/api/v1/products/categories", { method: "GET" });
}

// 상태를 바꾸는 POST는 assertSameOrigin을 먼저 태운다 (8.2가 세운 규약).
// 검사가 없으면 임의 사이트의 폼 POST가 상류 401을 유발해 관리자를 강제 로그아웃시킬 수 있다.
export async function POST(req: NextRequest) {
  const forbidden = assertSameOrigin(req);
  if (forbidden) return forbidden;

  // { op: "create"|"rename"|"order"|"delete", ... }
  const body = await req.json().catch(() => ({}));
  const needsId = body.op === "rename" || body.op === "delete";
  if (needsId && (typeof body.id !== "string" || !/^[0-9a-f-]{36}$/.test(body.id))) {
    return Response.json({ code: "validation_error", message: "입력값이 올바르지 않습니다.", details: [] }, { status: 422 });
  }
  const json = { headers: { "Content-Type": "application/json" } };
  switch (body.op) {
    case "create":
      return proxyWithRefresh(req, "/api/v1/admin/categories", { method: "POST", ...json, body: JSON.stringify({ name: body.name }) });
    case "rename":
      return proxyWithRefresh(req, `/api/v1/admin/categories/${body.id}`, { method: "PATCH", ...json, body: JSON.stringify({ name: body.name }) });
    case "order":
      return proxyWithRefresh(req, "/api/v1/admin/categories/order", { method: "PUT", ...json, body: JSON.stringify({ ids: body.ids }) });
    case "delete":
      return proxyWithRefresh(req, `/api/v1/admin/categories/${body.id}`, { method: "DELETE" });
    default:
      return Response.json({ code: "validation_error", message: "입력값이 올바르지 않습니다.", details: [] }, { status: 422 });
  }
}
