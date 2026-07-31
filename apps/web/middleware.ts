import { NextRequest, NextResponse } from "next/server";

// 구매자 보호 라우트 — prefix 판정. `/orders/complete`·`/orders/[id]`도 `/orders`가 덮는다.
const PROTECTED = ["/cart", "/checkout", "/orders", "/me", "/support", "/returns"];

// UX 라우팅 가드 — 보안 판정은 FastAPI가 한다 (AD-1). 여기는 편의 리다이렉트일 뿐.
// 미들웨어 통과 ≠ 인증: slur_role(14일)이 slur_access(30분)보다 오래 살아 있어
// 만료 세션도 보호 라우트를 통과한다. 보호 라우트의 페이지는 API 401을 스스로 처리해야 한다.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // slur_role은 UX 힌트 쿠키(14일) — refresh는 /api/auth 전용 path라 페이지 요청에 없다
  const role = req.cookies.get("slur_role")?.value;
  // 8.2가 이 쿠키에 buyer 값을 추가해도 !== undefined는 그대로 참이므로 여기는 수정이 필요 없다.
  // 8.1은 역할을 보지 않고 로그인 여부만 본다.
  const hasSession = role !== undefined;

  // 구매자 보호 라우트 — 공개 라우트(/ · /products/*)는 matcher에 없어 미들웨어가 아예 실행되지 않는다.
  // 기존 세 규칙과 판정 경로가 겹치지 않으므로(구매자 경로 ∩ /seller·/admin·/apply = ∅) 순서가 동작을 바꾸지 않는다.
  if (!hasSession && PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    // req.url이 프록시 뒤에서 내부 호스트를 담을 수 있어 신규 블록은 nextUrl.clone()을 쓴다.
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    // next에는 자체 경로(pathname + 원래 쿼리)만 싣는다 — 외부 URL이 실릴 수 없다(오픈 리다이렉트 방지).
    // 소비(로그인 성공 후 복귀)는 8.2 소관이며, 소비 측도 자체 경로 여부를 다시 확인해야 한다.
    url.searchParams.set("next", pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }

  if (!hasSession && (pathname.startsWith("/seller") || pathname.startsWith("/admin") || pathname.startsWith("/apply"))) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (pathname.startsWith("/admin") && role !== "admin") {
    return NextResponse.redirect(new URL(role === "seller" ? "/seller" : "/no-role", req.url));
  }
  if (pathname.startsWith("/seller") && role !== "seller" && role !== "admin") {
    return NextResponse.redirect(new URL("/no-role", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/seller/:path*", "/admin/:path*", "/apply/:path*", "/apply",   // 기존 그대로
    "/cart", "/checkout", "/orders", "/orders/:path*", "/me",        // 신규 (구매자 보호 라우트)
    "/support", "/returns",                                          // 문의·반품 — 개인별 내역이라 로그인 필요
  ],
};
