import { NextRequest } from "next/server";

import { proxyWithRefresh } from "@/lib/auth";

export async function GET(req: NextRequest) {
  return proxyWithRefresh(req, "/api/v1/sellers/me", { method: "GET" });
}

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return proxyWithRefresh(req, "/api/v1/sellers/me/shipping-fees", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
