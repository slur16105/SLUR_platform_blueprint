import "@/app/styles/buyer/tokens.css";
import "@/app/styles/buyer/type.css";
import "./buyer.css";

import { CartCountProvider } from "./cart-count";

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
      <CartCountProvider>{children}</CartCountProvider>
    </div>
  );
}
