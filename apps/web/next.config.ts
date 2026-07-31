import type { NextConfig } from "next";

/* 보안 헤더 — 실서비스 오픈 게이트 항목.

   CSP는 "우리가 실제로 부르는 곳"만 허용한다. 목록을 넓게 잡으면 있으나 마나 하므로,
   출처를 늘릴 때는 왜 필요한지 주석으로 남긴다.

   현재 외부 의존:
   - cdn.jsdelivr.net    : Pretendard 폰트 CSS·폰트 파일 (app/layout.tsx)
   - t1.daumcdn.net      : 우편번호 검색 스크립트 (checkout/postcode-overlay.tsx)
   - *.daum.net          : 우편번호 검색이 여는 iframe·리소스
   - images.unsplash.com : 데모 상품 이미지 (실사진 교체 시 제거 대상 — 오픈 게이트)
   - *.supabase.co       : 상품 이미지 Storage 공개 URL + 사전서명 업로드 PUT

   🚨 script-src에 'unsafe-inline'이 남아 있다 — Next.js가 하이드레이션용 인라인 스크립트를
      넣기 때문이다. 없애려면 요청마다 nonce를 발급하는 미들웨어가 선행이라 별도 작업으로 둔다.
      대신 object-src·base-uri·frame-ancestors를 잠가 피해 범위를 줄인다. */
const isDev = process.env.NODE_ENV !== "production";

const csp = [
  "default-src 'self'",
  // 개발 모드는 React Fast Refresh가 eval을 쓴다 — 프로덕션 빌드에는 넣지 않는다
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://t1.daumcdn.net`,
  "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
  "font-src 'self' data: https://cdn.jsdelivr.net",
  "img-src 'self' data: blob: https://images.unsplash.com https://*.supabase.co https://*.daumcdn.net",
  `connect-src 'self' https://*.supabase.co${isDev ? " ws: wss:" : ""}`,
  "frame-src https://*.daumcdn.net https://*.daum.net",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'", // 클릭재킹 차단 — 우리 화면이 남의 iframe에 실리지 않게
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // 쓰지 않는 브라우저 기능 차단 — 서드파티 스크립트가 몰래 켜는 경로를 없앤다
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false, // 서버 스택 노출 제거
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
