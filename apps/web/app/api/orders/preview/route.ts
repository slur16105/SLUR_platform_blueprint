import { NextRequest } from "next/server";

import { assertSameOrigin, proxyWithRefresh } from "@/lib/auth";

/* 주문 미리보기 BFF (8.5 D13).
   읽기 전용이지만 POST이므로 assertSameOrigin을 먼저 태운다 —
   "상태를 바꾸는 신규 POST 라우트가 이 한 벌을 쓴다"(8.2 D1)를 메서드 기준으로 지킨다.
   갈래를 만들지 않는 편이 다음 사람이 틀릴 여지가 없다.

   🚨 인증 경로다 — lib/public-api.ts가 아니라 proxyWithRefresh를 쓴다.
      회전된 세션 쿠키가 반환 응답에 실려 있으므로 NextResponse를 다시 감싸지 않는다.
   🚨 정적 세그먼트 preview는 같은 깊이의 [id](동적)를 이긴다 — Next가 판정하므로
      [id] 쪽에서 "preview"를 문자열로 걸러내지 않는다 (D4). */
export async function POST(req: NextRequest) {
  const forbidden = assertSameOrigin(req);
  if (forbidden) return forbidden;

  const body = await req.json().catch(() => ({}));
  return proxyWithRefresh(req, "/api/v1/orders/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ postal_code: body.postal_code }),
  });
}
