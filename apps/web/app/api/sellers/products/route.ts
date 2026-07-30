import { NextRequest } from "next/server";

import { assertSameOrigin, proxyWithRefresh } from "@/lib/auth";

export async function GET(req: NextRequest) {
  return proxyWithRefresh(req, "/api/v1/sellers/products", { method: "GET" });
}

// 상태를 바꾸는 POST는 assertSameOrigin을 먼저 태운다 (8.2가 세운 규약).
// 검사가 없으면 임의 사이트의 폼 POST가 상류 401을 유발해 판매자를 강제 로그아웃시킬 수 있다.
export async function POST(req: NextRequest) {
  const forbidden = assertSameOrigin(req);
  if (forbidden) return forbidden;

  const body = await req.json().catch(() => ({}));
  if (body.op === "presign") {
    return proxyWithRefresh(req, "/api/v1/sellers/products/images/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content_type: body.content_type }),
    });
  }
  if (body.op === "patch") {
    if (typeof body.id !== "string" || !/^[0-9a-f-]{36}$/.test(body.id)) {
      return Response.json({ code: "validation_error", message: "입력값이 올바르지 않습니다.", details: [] }, { status: 422 });
    }
    // op·id는 라우팅용이라 백엔드로 전달하지 않는다 (나머지 필드만 PATCH 본문)
    const fields = { ...body };
    delete fields.op;
    delete fields.id;
    return proxyWithRefresh(req, `/api/v1/sellers/products/${body.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
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
  if (body.op === "images") {
    if (typeof body.id !== "string" || !/^[0-9a-f-]{36}$/.test(body.id)) {
      return Response.json({ code: "validation_error", message: "입력값이 올바르지 않습니다.", details: [] }, { status: 422 });
    }
    return proxyWithRefresh(req, `/api/v1/sellers/products/${body.id}/images`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_paths: body.image_paths }),
    });
  }
  return proxyWithRefresh(req, "/api/v1/sellers/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
