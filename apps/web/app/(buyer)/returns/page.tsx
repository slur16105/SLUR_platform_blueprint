/* 반품·교환 — `/returns` (로그인 필요). 전자상거래법 제17조 청약철회 창구.

   FAQ·공지와 달리 개인별 내역이라 보호 라우트다. 신청은 주문 상세에서 넘어온다
   (?order_id=&sub_order_id= — 회수는 판매자 묶음 단위로 일어난다). */

import type { Metadata } from "next";
import { Suspense } from "react";
import { cookies } from "next/headers";

import { API_BASE } from "@/lib/auth";

import ReturnView from "./return-view";
import { SiteFooter, SiteHeader } from "../site-chrome";
import type { NavCategory } from "../labels";

import "../theme.css";

export const metadata: Metadata = {
  title: "반품 · 교환 — SLUR 편집숍",
  description: "배송 완료된 주문의 반품·교환을 신청하고 진행 상태를 확인합니다.",
};

async function getCategories(): Promise<NavCategory[]> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/products/categories`, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    return (await res.json()) as NavCategory[];
  } catch {
    return [];
  }
}

export default async function ReturnsPage() {
  const [categories, cookieStore] = await Promise.all([getCategories(), cookies()]);

  return (
    <div className="slur min-h-screen">
      <SiteHeader categories={categories} loggedIn={Boolean(cookieStore.get("slur_role"))} />
      <main>
        {/* useSearchParams는 프리렌더 시 Suspense 경계가 필요 (Next 16 규약) */}
        <Suspense fallback={<div className="mx-auto w-full max-w-[720px] px-5 py-10 text-[14px] text-muted-foreground">불러오는 중…</div>}>
          <ReturnView />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}
