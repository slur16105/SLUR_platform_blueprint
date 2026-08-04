import { NextRequest, NextResponse } from "next/server";

import { assertSameOrigin, clearSessionCookies, proxyWithRefresh } from "@/lib/auth";

/* 계정 조회 BFF (8.7 Task 1) — GET /api/v1/auth/me.

   🚨 인증 경로다 — proxyWithRefresh를 쓴다. access 만료 시 refresh를 1회 회전해 재시도하고,
      회전된 세션 쿠키가 반환 NextResponse에 실려 있으므로 **가공하지 않고 그대로 돌려준다**.
      다시 감싸면 회전된 쿠키가 유실된다.
   🚨 assertSameOrigin을 붙이지 않는다 — 읽기(GET)다 (8.6 Task 1의 GET 규칙과 같다).
   🚨 lib/auth.ts는 import만 한다. 수정하지 않는다 — clearSessionCookies는 모든 BFF의
      세션 만료 처리를 공유한다 (8.2 D7).

   401이면 봉투가 그대로 내려오고 세션 쿠키가 지워진다 — 호출자(account-card)가
   /login?next=%2Fme로 보낸다. 미들웨어 통과는 인증이 아니다 (AD-1, R7). */
export async function GET(req: NextRequest) {
  return proxyWithRefresh(req, "/api/v1/auth/me", { method: "GET" });
}

/* 회원 탈퇴 BFF — DELETE /api/v1/auth/me. 되돌릴 수 없는 파괴적 동작이다.

   🚨 Origin 검사를 먼저 태운다 — 로그아웃보다 훨씬 무거운 상태 변경이다. 임의의 사이트가
      요청 하나로 SLUR 회원을 탈퇴시킬 수 있으면 안 된다 (8.2가 세운 규약).
   🚨 실패 응답(409 등)은 **봉투를 그대로 흘려보낸다**. 사용자에게 보일 한국어 문구
      ("배송 중이거나 입금 대기 중인 주문이 있어요…")는 서버가 갖고 있고, 화면이 그 문장을
      다시 쓰면 두 벌이 되어 어긋난다.
   🚨 성공했다면 쿠키를 **새 응답에** 지운다. proxyWithRefresh가 토큰을 회전시켰다면 그 응답에는
      방금 발급된 세션 쿠키가 실려 있다 — 같은 응답에 소거를 덧붙이면 어느 쪽이 이기는지가
      Set-Cookie 순서에 달린다. 탈퇴한 계정의 쿠키가 살아남는 쪽이 훨씬 나쁘므로 새로 만든다. */
export async function DELETE(req: NextRequest) {
  const forbidden = assertSameOrigin(req);
  if (forbidden) return forbidden;

  const res = await proxyWithRefresh(req, "/api/v1/auth/me", { method: "DELETE" });
  if (res.status !== 204) return res; // 차단(409)·인증 만료(401) — 봉투와 쿠키 처리를 그대로 전달

  const done = new NextResponse(null, { status: 204 });
  clearSessionCookies(done);
  done.headers.set("Cache-Control", "no-store, private");
  return done;
}
