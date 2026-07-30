/* 주문내역 — `/orders` (보호 라우트). **새 테마 적용 화면 (이전 8/N).** */

import type { Metadata } from "next";
import { cookies } from "next/headers";

import { API_BASE } from "@/lib/auth";

import OrdersScreen from "./orders-screen";
import { SiteFooter, SiteHeader } from "../site-chrome";
import type { NavCategory } from "../labels";

import "../theme.css";

export const metadata: Metadata = { title: "주문내역 — SLUR 편집숍" };

async function getJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${path}`, { next: { revalidate: 300 } });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

export default async function OrdersPage() {
  const [categories, cookieStore] = await Promise.all([
    getJson<NavCategory[]>("/api/v1/products/categories", []),
    cookies(),
  ]);

  return (
    <div className="slur min-h-screen">
      <SiteHeader categories={categories} loggedIn={Boolean(cookieStore.get("slur_role"))} />
      <div className="border-b border-border">
        <div className="mx-auto max-w-[1600px] px-5 py-12 text-center md:py-16">
          <h1 className="text-[34px] font-bold uppercase leading-none tracking-tight md:text-[44px]">ORDERS</h1>
        </div>
      </div>
      <div className="pt-10">
        <OrdersScreen />
      </div>
      <SiteFooter />
    </div>
  );
}
