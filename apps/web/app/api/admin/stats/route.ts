import { NextRequest } from "next/server";

import { proxyWithRefresh } from "@/lib/auth";

const PERIODS = new Set(["today", "7d", "30d"]);

export async function GET(req: NextRequest) {
  // 관리자 대시보드 통계 타일 — 기간 경계(KST 자정) 계산은 FastAPI가 소유한다
  const period = req.nextUrl.searchParams.get("period") ?? "today";
  if (!PERIODS.has(period)) {
    return Response.json({ code: "validation_error", message: "지원하지 않는 기간입니다.", details: [] }, { status: 422 });
  }
  return proxyWithRefresh(req, `/api/v1/admin/stats?period=${period}`, { method: "GET" });
}
