import { NextRequest } from "next/server";

import { proxyWithRefresh } from "@/lib/auth";

export async function GET(req: NextRequest) {
  // 공지 공개 목록 — 게시된 것만 (로그인 불필요)
  const page = req.nextUrl.searchParams.get("page") ?? "1";
  return proxyWithRefresh(req, `/api/v1/notices?page=${encodeURIComponent(page)}`, { method: "GET" });
}
