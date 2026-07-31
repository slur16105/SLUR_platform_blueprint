/* 1:1 문의 — `/support` (로그인 필요). 통신판매중개자의 소비자 불만·분쟁 처리 창구다.

   FAQ(/faq)는 공개 정적 지면, 여기는 개인별 문의라 로그인 뒤에 둔다.
   상단바·푸터는 다른 구매자 화면과 같은 셸을 쓴다. */

import type { Metadata } from "next";
import { cookies } from "next/headers";

import { API_BASE } from "@/lib/auth";

import InquiryView from "./inquiry-view";
import { SiteFooter, SiteHeader } from "../site-chrome";
import type { NavCategory } from "../labels";

import "../theme.css";

export const metadata: Metadata = {
  title: "1:1 문의 — SLUR 편집숍",
  description: "주문·배송·상품 문의를 남기고 운영자 답변을 확인합니다.",
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

export default async function SupportPage() {
  const [categories, cookieStore] = await Promise.all([getCategories(), cookies()]);

  return (
    <div className="slur min-h-screen">
      <SiteHeader categories={categories} loggedIn={Boolean(cookieStore.get("slur_role"))} />
      <main>
        <InquiryView />
      </main>
      <SiteFooter />
    </div>
  );
}
