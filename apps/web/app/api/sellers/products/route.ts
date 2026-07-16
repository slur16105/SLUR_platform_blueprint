import { NextRequest } from "next/server";

import { proxyWithRefresh } from "@/lib/auth";

export async function GET(req: NextRequest) {
  return proxyWithRefresh(req, "/api/v1/sellers/products", { method: "GET" });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (body.op === "presign") {
    return proxyWithRefresh(req, "/api/v1/sellers/products/images/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content_type: body.content_type }),
    });
  }
  if (body.op === "variants") {
    if (typeof body.id !== "string" || !/^[0-9a-f-]{36}$/.test(body.id)) {
      return Response.json({ code: "validation_error", message: "입력값이 올바르지 않습니다.", details: [] }, { status: 422 });
    }
    return proxyWithRefresh(req, `/api/v1/sellers/products/${body.id}/variants`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variants: body.variants }),
    });
  }
  return proxyWithRefresh(req, "/api/v1/sellers/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
