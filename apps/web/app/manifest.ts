import type { MetadataRoute } from "next";

/* PWA manifest — 앱 전체가 하나의 PWA다 (D5, NFR-7).
   `/manifest.webmanifest`로 나가고 Next가 <link rel="manifest">를 전 문서에 자동으로 붙인다.
   정적 manifest.json이 아니라 .ts인 이유는 타입 검사(MetadataRoute.Manifest)를 받기 위해서다 —
   오타 난 필드가 tsc에서 잡힌다.

   🚨 start_url은 `/`이고 그 화면은 **비로그인 공개**다 (UX-DR11, 미들웨어 matcher에 `/`가 없다).
      설치 직후 실행이 로그인 벽에 부딪히는 PWA는 첫인상에서 죽는다.
   🚨 scope를 `/`보다 좁히지 않는다 — 한 계정이 여러 역할을 가질 수 있고(FR-3), 설치된 창에서
      `/seller`로 가는 것이 정상 동선이다. 좁히면 그 이동이 외부 브라우저로 튀어나간다.
   🚨 theme_color는 문서별 <meta name="theme-color">((buyer)/layout.tsx, D6)와 같은 값이어야 한다.
   🚨 start_url에 추적 쿼리(?source=pwa 등)를 붙이지 않는다 — 홈 URL이 두 벌이 된다 (위험 10).
   🚨 shortcuts·screenshots·orientation·categories를 넣지 않는다 — 설치 판정에 필요 없다.
   🚨 설치 유도 배너·자동 팝업·beforeinstallprompt 가로채기를 만들지 않는다 (UX-DR16).
   🚨 service worker를 등록하지 않는다 (D7) — 캐시해도 되는 것은 이미 HTTP 캐시가 처리하고,
      캐시하면 안 되는 것(재고·장바구니·주문·인증)이 이 제품의 본체다.

   [ASSUMPTION] name·short_name의 정식 표기는 확정된 바 없다 (위험 5) — 로고와 PRD 제목이
   `SLUR`이라 그것을 쓴다. 실사업자 정보 교체(오픈 게이트) 때 표기를 함께 확정한다. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "SLUR",
    short_name: "SLUR",
    description: "큐레이션형 디자인 편집숍",
    lang: "ko",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#faf8f4",
    theme_color: "#faf8f4",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
