/* 상품상세 — `/products/[id]` (공개 라우트). **새 테마 적용 화면 (이전 2/N).**

   화면 단위 통째 교체: 옛 셸(buyer-shell)·옛 CSS(browse.css)를 쓰지 않고 새 테마만 쓴다.
   본체(DetailView)는 옛 product-detail.tsx의 **로직을 그대로 옮긴 것**이라 담기·조합 선택·
   401 복귀 자동담기·배지 갱신이 이전과 똑같이 동작한다.

   본체를 <Suspense>로 감싸는 이유(D3): DetailView가 useSearchParams(?variant)를 쓴다.
   경계가 없으면 tsc·lint는 통과하고 next build만 깨진다 (Next 16 규약). */

import type { Metadata } from "next";
import { Suspense } from "react";
import { cookies } from "next/headers";

import { API_BASE } from "@/lib/auth";

import DetailView from "./detail-view";
import { SiteFooter, SiteHeader } from "../../site-chrome";
import type { NavCategory } from "../../labels";

import "../../theme.css";

async function getJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${path}`, { next: { revalidate: 60 } });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

/* 탭 타이틀 — 상품명·브랜드로. 없는 상품이면 기본 이름으로 둔다(404 화면은 본체가 그린다). */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const p = await getJson<{ name?: string; brand_name?: string } | null>(
    `/api/v1/products/${encodeURIComponent(id)}`,
    null,
  );
  if (!p?.name) return { title: "SLUR 편집숍" };
  return {
    title: `${p.name} — ${p.brand_name ?? "SLUR"} | SLUR 편집숍`,
    description: `${p.brand_name ?? ""} ${p.name} — SLUR 편집숍이 골라온 상품`.trim(),
  };
}

export default async function ProductDetailPage() {
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
          <div className="mx-auto grid max-w-[1600px] gap-10 px-5 py-10 md:grid-cols-2 md:gap-14">
            <div className="aspect-4/5 w-full animate-pulse bg-muted" />
            <div className="space-y-4 pt-2">
              <div className="h-4 w-24 animate-pulse bg-muted" />
              <div className="h-9 w-3/4 animate-pulse bg-muted" />
            </div>
          </div>
        }
      >
        <DetailView />
      </Suspense>
      <SiteFooter />
    </div>
  );
}
