import { NextRequest } from "next/server";

import { assertSameOrigin, proxyWithRefresh } from "@/lib/auth";

/* 주문내역 BFF (8.6 D12).
   같은 경로의 POST 옆에 export를 더한다 — 새 파일을 만들면 같은 경로에 두 라우트가 생겨 빌드가 깨진다.

   🚨 GET에 assertSameOrigin을 붙이지 않는다. 읽기 요청에 CSRF 방어를 걸면 정상 내비게이션이 막힌다.
   🚨 page는 정수 1~10000만 통과시킨다 — 백엔드의 Query 제약과 같은 범위이며, 형식이 어긋난 값으로
      상류를 부르지 않는다. 화면은 페이지 크기를 알지 못하고 알 필요도 없다 (D4, AD-13). */
export async function GET(req: NextRequest) {
  const page = Number(req.nextUrl.searchParams.get("page") ?? "1");
  if (!Number.isInteger(page) || page < 1 || page > 10000) {
    return Response.json(
      { code: "validation_error", message: "요청 형식이 올바르지 않습니다.", details: [] },
      { status: 422 },
    );
  }
  return proxyWithRefresh(req, `/api/v1/orders?page=${page}`, { method: "GET" });
}

/* 주문 생성 BFF (8.5 D13).
   청약이 실제로 일어나는 자리다 — assertSameOrigin을 먼저 태운다.

   본문은 여덟 필드 화이트리스트로만 상류에 넘긴다. 클라이언트 본문을 통째로 흘리면
   FastAPI 스키마에 없는 키가 새어 들어가고, 나중에 필드가 늘 때 경계가 어디였는지 알 수 없게 된다.
   🚨 결제 수단은 여기에 없다 — OrderCreateRequest에 그런 필드가 없고, 화면에만 존재하는 사실 표기다.
   🚨 recipient_phone은 클라이언트가 숫자만 남겨 보낸다(^\d{9,11}$). BFF는 정규화하지 않는다 —
      두 곳에서 다듬으면 어느 쪽이 진실인지 알 수 없게 된다. */
export async function POST(req: NextRequest) {
  const forbidden = assertSameOrigin(req);
  if (forbidden) return forbidden;

  const body = await req.json().catch(() => ({}));
  return proxyWithRefresh(req, "/api/v1/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cart_item_ids: body.cart_item_ids,
      expected_grand_total: body.expected_grand_total,
      postal_code: body.postal_code,
      recipient_name: body.recipient_name,
      recipient_phone: body.recipient_phone,
      address1: body.address1,
      address2: body.address2,
      order_note: body.order_note,
    }),
  });
}
