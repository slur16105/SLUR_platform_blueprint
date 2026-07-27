import { NextRequest } from "next/server";

import { assertSameOrigin, proxyWithRefresh } from "@/lib/auth";

// 홈 편성 목록 (Story 9.2) — 히어로/슬롯 전체 (기간·활성 여부 무관, 관리자 화면용).
export async function GET(req: NextRequest) {
  return proxyWithRefresh(req, "/api/v1/admin/home/features", { method: "GET" });
}

// 편성 생성 — 상태를 바꾸는 POST는 assertSameOrigin을 먼저 태운다 (8.2가 세운 규약).
// 검사가 없으면 임의 사이트의 폼 POST가 상류 401을 유발해 관리자를 강제 로그아웃시킬 수 있다.
// 본문 검증(kind·layout·title·product_ids 등)은 상류 FastAPI가 소유한다 — 봉투를 그대로 흘린다.
export async function POST(req: NextRequest) {
  const forbidden = assertSameOrigin(req);
  if (forbidden) return forbidden;

  const body = await req.json().catch(() => ({}));
  return proxyWithRefresh(req, "/api/v1/admin/home/features", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
