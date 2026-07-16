import { NextRequest } from "next/server";

import { proxyWithRefresh } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const qs = req.nextUrl.searchParams.toString();
  return proxyWithRefresh(req, `/api/v1/admin/seller-applications${qs ? `?${qs}` : ""}`, { method: "GET" });
}

export async function POST(req: NextRequest) {
  // { id, action: "approve" | "reject", reason? }
  const body = await req.json().catch(() => ({}));
  const action = body.action === "reject" ? "reject" : "approve";
  return proxyWithRefresh(req, `/api/v1/admin/seller-applications/${body.id}/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: action === "reject" ? JSON.stringify({ reason: body.reason }) : undefined,
  });
}
