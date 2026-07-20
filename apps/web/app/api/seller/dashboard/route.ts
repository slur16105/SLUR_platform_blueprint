import { NextRequest } from "next/server";

import { proxyWithRefresh } from "@/lib/auth";

export async function GET(req: NextRequest) {
  // 판매자 대시보드 — 배송준비 대기·배송중 건수 + 품절 임박 목록 (표시 전용, AD-12)
  return proxyWithRefresh(req, "/api/v1/sellers/dashboard", { method: "GET" });
}
