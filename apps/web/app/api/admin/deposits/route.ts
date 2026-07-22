import { NextRequest } from "next/server";

import { assertSameOrigin, proxyWithRefresh } from "@/lib/auth";

export async function GET(req: NextRequest) {
  // 입금대기 주문 목록 — page 기반 페이지네이션
  const page = req.nextUrl.searchParams.get("page") ?? "1";
  return proxyWithRefresh(req, `/api/v1/admin/orders/pending?page=${encodeURIComponent(page)}`, { method: "GET" });
}

// 상태를 바꾸는 POST는 assertSameOrigin을 먼저 태운다 (8.2가 세운 규약).
// 검사가 없으면 임의 사이트의 폼 POST가 상류 401을 유발해 관리자를 강제 로그아웃시킬 수 있다.
export async function POST(req: NextRequest) {
  const forbidden = assertSameOrigin(req);
  if (forbidden) return forbidden;

  // { order_id, note?, expected_grand_total } → 입금 확인 (FastAPI confirm-payment, 성공 시 204)
  // expected_grand_total: 모달에 표시된 금액 — 서버 잔여 활성 금액과 불일치하면 409 price_changed (과입금 확인 방지)
  const body = await req.json().catch(() => ({}));
  if (
    typeof body.order_id !== "string" || !/^[0-9a-f-]{36}$/.test(body.order_id) ||
    typeof body.expected_grand_total !== "number" || !Number.isFinite(body.expected_grand_total)
  ) {
    return Response.json({ code: "validation_error", message: "입력값이 올바르지 않습니다.", details: [] }, { status: 422 });
  }
  const payload: Record<string, unknown> = { expected_grand_total: body.expected_grand_total };
  if (typeof body.note === "string" && body.note.trim()) payload.note = body.note.trim().slice(0, 500);
  return proxyWithRefresh(req, `/api/v1/admin/orders/${body.order_id}/confirm-payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
