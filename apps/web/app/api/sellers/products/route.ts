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
  return proxyWithRefresh(req, "/api/v1/sellers/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
