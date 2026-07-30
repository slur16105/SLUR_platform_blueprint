/* 주문완료 — `/orders/complete` (보호 라우트). **새 테마 적용 화면 (이전 5/N).**

   🚨 경로 경합: `/orders/[id]`와 같은 깊이지만 **정적 세그먼트가 동적을 이긴다** —
      Next가 판정하므로 [id] 쪽에서 `id === "complete"`를 걸러내는 코드를 쓰지 않는다.

   본체를 <Suspense>로 감싸는 이유: CompleteScreen이 useSearchParams(?order)를 쓴다.
   경계가 없으면 tsc·lint는 통과하고 next build만 깨진다 (Next 16 규약). */

import type { Metadata } from "next";
import { Suspense } from "react";
import { cookies } from "next/headers";

import { API_BASE } from "@/lib/auth";

import CompleteScreen from "./complete-screen";
import { SiteFooter, SiteHeader } from "../../site-chrome";
import type { NavCategory } from "../../labels";

import "../../theme.css";

export const metadata: Metadata = {
  title: "주문 완료 — SLUR 편집숍",
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

export default async function OrderCompletePage() {
  const [categories, cookieStore] = await Promise.all([
    getJson<NavCategory[]>("/api/v1/products/categories", []),
    cookies(),
  ]);
  const loggedIn = Boolean(cookieStore.get("slur_role"));

  return (
    <div className="slur min-h-screen">
      <SiteHeader categories={categories} loggedIn={loggedIn} />
      <Suspense
        fallback={
          <div className="mx-auto w-full max-w-[560px] px-5 py-16 text-center" aria-hidden="true">
            <div className="mx-auto h-8 w-56 animate-pulse bg-muted" />
            <div className="mx-auto mt-4 h-4 w-40 animate-pulse bg-muted" />
          </div>
        }
      >
        <CompleteScreen />
      </Suspense>
      <SiteFooter />
    </div>
  );
}
