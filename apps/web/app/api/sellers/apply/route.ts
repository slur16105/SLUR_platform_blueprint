import { NextRequest } from "next/server";

import { proxyWithRefresh } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return proxyWithRefresh(req, "/api/v1/sellers/applications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function GET(req: NextRequest) {
  return proxyWithRefresh(req, "/api/v1/sellers/applications/me", { method: "GET" });
}
