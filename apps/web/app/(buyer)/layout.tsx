import "@/app/styles/buyer/tokens.css";
import "@/app/styles/buyer/type.css";
import "./buyer.css";

import type { Metadata, Viewport } from "next";

import { CartCountProvider } from "./cart-count";
import { PolicyProvider } from "./legal/policy-modal";

/* theme-color · iOS standalone 메타는 **구매자 문서에만** 실린다 (8.7 D6·D9).

   메타 태그는 앱당 하나가 아니라 **문서당 하나**이고, 이 앱의 모든 문서는 (buyer)·(console)
   두 그룹 중 정확히 하나에 속한다(8.1 D2). Next의 viewport/metadata export는 라우트 세그먼트
   단위로 해석되므로, 여기 선언하면 충돌 없이 구매자 문서에만 붙는다 — 서버가 기기나 역할을
   판별하는 것이 아니라 라우트가 판별한다 (AD-14).

   🚨 app/layout.tsx(루트)와 (console)/layout.tsx에는 아무것도 선언하지 않는다.
      루트에 themeColor를 넣으면 콘솔 문서까지 종이색 크롬이 된다.
      콘솔에 흰색을 명시하는 것도 회귀 표면만 늘리는 변경이다 — 콘솔 <head>는 지금과 같다.
   🚨 maximumScale·userScalable을 선언하지 않는다 — 글자 200% 확대와 충돌한다 (UX-DR7).
   🚨 viewportFit("cover")를 선언하지 않는다 (D9). 그래서 8.1이 넣어둔
      calc(56px + env(safe-area-inset-bottom))의 env() 항은 **0으로 평가되며 그것이 의도된 상태**다 —
      cover가 없으면 브라우저가 안전영역을 시각 뷰포트에서 이미 빼 준다. 항 자체는 지우지 않는다
      (cover를 켜는 날 자동으로 맞는 값이 되고, 지금은 calc(56px + 0px)로 무해하다).
   🚨 statusBarStyle은 "default"(밝은 배경 위 어두운 글자)다 — black-translucent는 콘텐츠가
      상태바 아래로 들어가 cover와 같은 문제를 만든다. */
export const viewport: Viewport = { themeColor: "#faf8f4" };

export const metadata: Metadata = {
  appleWebApp: { capable: true, title: "SLUR", statusBarStyle: "default" },
};

/* 구매자 라우트 그룹 레이아웃.
   data-surface="buyer"는 여기 한 곳에만 붙는다 — 구매자 팔레트·먹색 포커스 링의
   스코프가 전부 이 속성에서 나온다 (D1). 판매자·관리자 문서에는 나타나지 않는다.
   푸터는 붙지 않는다 — FR-31·33은 /me(8.7)가 받는다.

   🚨 이 파일에 "use client"를 붙이지 않는다 — 레이아웃 전체가 클라이언트 컴포넌트가 된다.
      CartCountProvider(8.4 D5)는 자기 파일에서 클라이언트 경계를 긋고, 서버 레이아웃이
      그것으로 children을 감싸는 것은 정상 패턴이다. 래퍼를 하나 더 끼우지 않는다. */
export default function BuyerLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="b_surface" data-surface="buyer">
      <CartCountProvider>
        <PolicyProvider>{children}</PolicyProvider>
      </CartCountProvider>
    </div>
  );
}
