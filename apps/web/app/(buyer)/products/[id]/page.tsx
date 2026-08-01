/* 상품상세 — `/products/[id]` (공개 라우트). **새 테마 적용 화면 (이전 2/N).**

   화면 단위 통째 교체: 옛 셸(buyer-shell)·옛 CSS(browse.css)를 쓰지 않고 새 테마만 쓴다.
   본체(DetailView)는 옛 product-detail.tsx의 **로직을 그대로 옮긴 것**이라 담기·조합 선택·
   401 복귀 자동담기·배지 갱신이 이전과 똑같이 동작한다.

   본체를 <Suspense>로 감싸는 이유(D3): DetailView가 useSearchParams(?variant)를 쓴다.
   경계가 없으면 tsc·lint는 통과하고 next build만 깨진다 (Next 16 규약). */

import type { Metadata } from "next";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

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

/* 탭 타이틀 — 상품명·브랜드로. 없는 상품은 본체에서 notFound()로 끊는다. */
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

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, categories, cookieStore] = await Promise.all([
    getJson<{ id?: string } | null>(`/api/v1/products/${encodeURIComponent(id)}`, null),
    getJson<NavCategory[]>("/api/v1/products/categories", []),
    cookies(),
  ]);
  // 없는 상품·숨김 상품은 404로 끊는다. 예전에는 헤더·푸터만 있는 빈 화면이 200으로 나가
  // 손님은 무엇이 잘못됐는지 알 수 없었고, 검색엔진에도 빈 페이지가 노출됐다.
  if (!product?.id) notFound();
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
