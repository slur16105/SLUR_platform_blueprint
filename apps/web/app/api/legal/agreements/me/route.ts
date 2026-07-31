import { NextRequest } from "next/server";

import { proxyWithRefresh } from "@/lib/auth";

export async function GET(req: NextRequest) {
  // 내 동의 이력 — 내 정보 화면에서 언제 어떤 버전에 동의했는지 확인
  return proxyWithRefresh(req, "/api/v1/legal/agreements/me", { method: "GET" });
}
