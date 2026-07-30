/* 장바구니 — `/cart` (보호 라우트). **새 테마 적용 화면 (이전 3/N).**

   화면 단위 통째 교체: 옛 셸(buyer-shell)·옛 CSS(cart.css)를 쓰지 않고 새 테마만 쓴다.
   본체(CartScreen)는 옛 cart-view/cart-pack의 **로직을 그대로 옮긴 것**이라
   수량 변경·인라인 삭제 확인·낙관적 갱신·서버 합계 규약이 이전과 똑같이 동작한다. */

import type { Metadata } from "next";
import { cookies } from "next/headers";

import { API_BASE } from "@/lib/auth";

import CartScreen from "./cart-screen";
import { SiteFooter, SiteHeader } from "../site-chrome";
import type { NavCategory } from "../labels";

import "../theme.css";

export const metadata: Metadata = {
  title: "장바구니 — SLUR 편집숍",
};

async function getJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${path}`, { next: { revalidate: 300 } });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

export default async function CartPage() {
  const [categories, cookieStore] = await Promise.all([
    getJson<NavCategory[]>("/api/v1/products/categories", []),
    cookies(),
  ]);
  const loggedIn = Boolean(cookieStore.get("slur_role"));

  return (
    <div className="slur min-h-screen">
      <SiteHeader categories={categories} loggedIn={loggedIn} />

      <div className="border-b border-border">
        <div className="mx-auto max-w-[1600px] px-5 py-12 text-center md:py-16">
          <h1 className="text-[34px] font-bold uppercase leading-none tracking-tight md:text-[44px]">CART</h1>
        </div>
      </div>

      <div className="pt-10">
        <CartScreen />
      </div>

      <SiteFooter />
    </div>
  );
}
