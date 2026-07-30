/* 주문서 — `/checkout` (보호 라우트). **새 테마 적용 화면 (이전 4/N).**

   화면 단위 통째 교체: 옛 셸(buyer-shell)·옛 CSS(checkout.css)를 쓰지 않고 새 테마만 쓴다.
   본체(CheckoutScreen)는 옛 checkout-view의 **로직을 그대로 옮긴 것**이라
   2단계 견적·우편번호별 배송비·주소 검증·주문 생성이 이전과 똑같이 동작한다.

   🚨 우편번호 오버레이(PostcodeOverlay)는 손대지 않고 그대로 쓴다 —
      그 컴포넌트가 쓰는 클래스는 전역 buyer.css에 있어 새 테마에서도 정상 표시된다. */

import type { Metadata } from "next";
import { cookies } from "next/headers";

import { API_BASE } from "@/lib/auth";

import CheckoutScreen from "./checkout-screen";
import { SiteFooter, SiteHeader } from "../site-chrome";
import type { NavCategory } from "../labels";

import "../theme.css";

export const metadata: Metadata = {
  title: "주문서 — SLUR 편집숍",
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

export default async function CheckoutPage() {
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
          <h1 className="text-[34px] font-bold uppercase leading-none tracking-tight md:text-[44px]">CHECKOUT</h1>
        </div>
      </div>

      <div className="pt-10">
        <CheckoutScreen />
      </div>

      <SiteFooter />
    </div>
  );
}
