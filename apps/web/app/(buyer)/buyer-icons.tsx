"use client";

/* 구매자 표면 아이콘 — 22px 인라인 SVG.
   아이콘 폰트·이모지·외부 CDN을 쓰지 않는다 (UX-DR16).
   선 굵기는 attribute가 아니라 CSS(stroke-width: var(--b-tab-stroke))로 준다 —
   presentation attribute는 var()를 해석하지 않기 때문이다.

   "use client"는 CartBadge가 배지 컨텍스트를 읽기 때문에 붙는다 (8.4 D5).
   값 소비자(탭바·상단 내비·상단바)는 원래부터 전부 클라이언트 컴포넌트였고,
   서버 컴포넌트(buyer-shell)는 이 모듈에서 타입만 가져간다(import type — 컴파일에서 지워진다). */

import type { ComponentType } from "react";

import { useCartCount } from "./cart-count";

export type BuyerTab = "home" | "cart" | "orders" | "me";

type IconProps = { className?: string };

const BASE = {
  viewBox: "0 0 24 24",
  width: 22,
  height: 22,
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  focusable: false,
  "aria-hidden": true,
};

export function IconHome({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M3.2 11.2 12 3.8l8.8 7.4" />
      <path d="M5.6 9.6V20h12.8V9.6" />
    </svg>
  );
}

export function IconCart({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M3.6 8.6h16.8l-1.4 11.2a1 1 0 0 1-1 .9H6a1 1 0 0 1-1-.9L3.6 8.6Z" />
      <path d="M8.5 8.6a3.5 3.5 0 0 1 7 0" />
    </svg>
  );
}

export function IconOrders({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <rect x="4.8" y="3" width="14.4" height="18" rx="2" />
      <path d="M8.4 8.4h7.2" />
      <path d="M8.4 12h7.2" />
      <path d="M8.4 15.6h4" />
    </svg>
  );
}

export function IconMe({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <circle cx="12" cy="8.2" r="3.6" />
      <path d="M4.8 20.6c0-3.8 3.2-6.2 7.2-6.2s7.2 2.4 7.2 6.2" />
    </svg>
  );
}

export function IconBack({ className }: IconProps) {
  return (
    <svg {...BASE} className={className}>
      <path d="M14.8 5.2 8 12l6.8 6.8" />
    </svg>
  );
}

/* 장바구니 개수 배지 — 값은 (buyer) 레이아웃의 컨텍스트 하나가 소유한다 (8.4 D5).
   담긴 항목 수 전체(구매 불가 포함)이며 수량의 합이 아니다.
   값이 없으면(비로그인·조회 전·401) 아무것도 그리지 않는다.
   count prop은 override로 남긴다 — 세 호출부는 prop 없이 부르고 있고 그대로 둔다. */
export function CartBadge({ count }: { count?: number }) {
  const { count: fromContext } = useCartCount();
  const value = count ?? fromContext;
  if (value === undefined || value <= 0) return null;
  return (
    <span className="b_badge" aria-label={`장바구니 ${value}건`}>
      {value}
    </span>
  );
}

/* 최상위 4항목 — 탭바와 상단 내비가 같은 정의를 공유한다 (단일 배열 상수). */
export const BUYER_NAV_ITEMS: ReadonlyArray<{
  key: BuyerTab;
  label: string;
  href: string;
  Icon: ComponentType<IconProps>;
}> = [
  { key: "home", label: "홈", href: "/", Icon: IconHome },
  { key: "cart", label: "장바구니", href: "/cart", Icon: IconCart },
  { key: "orders", label: "주문내역", href: "/orders", Icon: IconOrders },
  { key: "me", label: "내 정보", href: "/me", Icon: IconMe },
];
