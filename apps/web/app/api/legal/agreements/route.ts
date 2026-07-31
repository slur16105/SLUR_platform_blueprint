import { NextRequest } from "next/server";

import { proxyWithRefresh } from "@/lib/auth";

export async function GET(req: NextRequest) {
  // 시행 중인 약관 버전 — 가입 화면이 "무엇에 동의하는지" 표기하는 데 쓴다 (공개)
  return proxyWithRefresh(req, "/api/v1/legal/agreements", { method: "GET" });
}
