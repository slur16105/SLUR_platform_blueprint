import { NextRequest, NextResponse } from "next/server";

// UX 라우팅 가드 — 보안 판정은 FastAPI가 한다 (AD-1). 여기는 편의 리다이렉트일 뿐.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // slur_role은 UX 힌트 쿠키(14일) — refresh는 /api/auth 전용 path라 페이지 요청에 없다
  const role = req.cookies.get("slur_role")?.value;
  const hasSession = role !== undefined;

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

export const config = { matcher: ["/seller/:path*", "/admin/:path*", "/apply/:path*", "/apply"] };
