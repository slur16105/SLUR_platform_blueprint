import { NextRequest } from "next/server";

import { assertSameOrigin, proxyWithRefresh } from "@/lib/auth";

export async function GET(req: NextRequest) {
  return proxyWithRefresh(req, "/api/v1/sellers/me", { method: "GET" });
}

// 상태를 바꾸는 PUT은 assertSameOrigin을 먼저 태운다 (8.2가 세운 규약).
// 검사가 없으면 임의 사이트의 크로스사이트 요청이 상류 401을 유발해 판매자를 강제 로그아웃시킬 수 있다.
export async function PUT(req: NextRequest) {
  const forbidden = assertSameOrigin(req);
  if (forbidden) return forbidden;

  const body = await req.json().catch(() => ({}));
  // { op: "payout" } → 정산 계좌, 그 외 → 배송비 설정
  if (body.op === "payout") {
    return proxyWithRefresh(req, "/api/v1/sellers/me/payout-account", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payout_bank: body.payout_bank ?? "",
        payout_account_no: body.payout_account_no ?? "",
        payout_holder: body.payout_holder ?? "",
      }),
    });
  }
  return proxyWithRefresh(req, "/api/v1/sellers/me/shipping-fees", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
