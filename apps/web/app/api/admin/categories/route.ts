import { NextRequest } from "next/server";

import { proxyWithRefresh } from "@/lib/auth";

export async function GET(req: NextRequest) {
  return proxyWithRefresh(req, "/api/v1/products/categories", { method: "GET" });
}

export async function POST(req: NextRequest) {
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
