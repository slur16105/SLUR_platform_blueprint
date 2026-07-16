import { NextRequest, NextResponse } from "next/server";

// UX 라우팅 가드 — 보안 판정은 FastAPI가 한다 (AD-1). 여기는 편의 리다이렉트일 뿐.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = req.cookies.has("slur_refresh");
  const role = req.cookies.get("slur_role")?.value;

  if (!hasSession && (pathname.startsWith("/seller") || pathname.startsWith("/admin"))) {
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

export const config = { matcher: ["/seller/:path*", "/admin/:path*"] };
