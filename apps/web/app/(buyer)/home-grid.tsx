"use client";

/* 홈 상품 그리드 (새 테마) — 기존 홈이 갖고 있던 기능을 그대로 유지한다:
   · 카테고리 필터 — URL(`?category=`)이 상태의 저장소다. 칩은 링크이며 서버가 다시 그린다.
   · `더 보기` 페이지네이션 — 스크롤 관찰자·자동 로드를 만들지 않는다 (UX-DR16).
   · 스크롤 복원 — 상품상세에 다녀오면 보던 자리로 돌아온다 (기존 home-scroll 유틸 재사용).
   🚨 이름·순서·개수를 코드에 하드코딩하지 않는다 (FR-34) — 카테고리는 서버가 정렬해 내려준 그대로.
   🚨 기능 로직은 새로 짜지 않고 기존 공개 API(/api/products)를 그대로 쓴다. */

import Link from "next/link";
import { useEffect, useState } from "react";

import { armHomeScroll, consumeHomeScroll, restoreHomeScroll } from "./home-scroll";
import { en, type NavCategory } from "./labels";

export type GridProduct = {
  id: string;
  name: string;
  brand_name: string;
  price_from: number;
  main_image_url: string | null;
  sold_out: boolean;
  category_id: string | null;
};

/* 편집숍 톤 데모 이미지 — 실 상품 사진이 플레이스홀더라 상품 id로 안정적으로 배정한다.
   ⚠️ 실 상품 사진이 준비되면 main_image_url로 교체한다(오픈 게이트). */
const OBJ = [
  "1493957988430-a5f2e15f39a3", "1534349762230-e0cadf78f5da", "1556909212-d5b604d0c90d",
  "1513694203232-719a280e022f", "1567016432779-094069958ea5", "1540932239986-30128078f3c5",
  "1522708323590-d24dbb6b0267", "1556910103-1c02745aae4d", "1600607687939-ce8a6c25118c",
];
export const seedOf = (id: string) => id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
export const demoImg = (seed: number, w = 600, h = 750) =>
  `https://images.unsplash.com/photo-${OBJ[Math.abs(seed) % OBJ.length]}?w=${w}&h=${h}&fit=crop&q=80&auto=format`;
export const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

export function ProductCard({ p, ratio = "aspect-4/5" }: { p: GridProduct; ratio?: string }) {
  return (
    <Link href={`/products/${p.id}`} className="group block" onClick={armHomeScroll}>
      <div className={`relative overflow-hidden bg-muted ${ratio}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={demoImg(seedOf(p.id))}
          alt=""
          className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] ${
            p.sold_out ? "opacity-40 grayscale" : ""
          }`}
        />
        {p.sold_out ? (
          <span className="absolute left-0 top-0 bg-foreground px-2.5 py-1 text-[12px] font-medium text-background">
            SOLD OUT
          </span>
        ) : null}
      </div>
      <div className="mt-3">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">{p.brand_name}</p>
        <p className="mt-1.5 truncate text-[20px] font-medium leading-snug">{p.name}</p>
        <p className="mt-1.5 text-[16px] font-semibold tabular-nums">{won(p.price_from)}</p>
      </div>
    </Link>
  );
}

export default function HomeGrid({
  initialItems,
  total,
  categories,
  category,
}: {
  initialItems: GridProduct[];
  total: number;
  categories: NavCategory[];
  category: string | null;
}) {
  const [items, setItems] = useState(initialItems);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* 카테고리가 바뀌면 부모가 key를 바꿔 이 컴포넌트를 새로 마운트한다 —
     effect로 상태를 되돌리지 않는다(연쇄 렌더를 만들고 React 규칙에도 어긋난다). */

  /* 상품상세에서 돌아왔을 때 보던 자리로 (기존 동작 유지) */
  useEffect(() => {
    const y = consumeHomeScroll();
    if (y !== null) restoreHomeScroll(y);
  }, []);

  async function loadMore() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      if (category) q.set("category", category);
      q.set("page", String(page + 1));
      const res = await fetch(`/api/products?${q.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { items?: GridProduct[]; page?: number };
      setItems((prev) => [...prev, ...(data.items ?? [])]);
      setPage(data.page ?? page + 1);
    } catch {
      setError("목록을 더 불러오지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  const hasMore = items.length < total;
  const catHref = (id: string | null) => (id ? `/?category=${encodeURIComponent(id)}` : "/");

  return (
    <section className="mx-auto max-w-[1600px] px-5 pb-20">
      {/* 카테고리 칩 */}
      <div className="flex flex-wrap gap-2 py-8">
        <Link
          href={catHref(null)}
          className={`border px-4 py-2 text-[13px] font-medium uppercase transition-colors ${
            !category ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground"
          }`}
        >
          ALL
        </Link>
        {categories.map((c) => (
          <Link
            key={c.id}
            href={catHref(c.id)}
            className={`border px-4 py-2 text-[13px] font-medium uppercase transition-colors ${
              category === c.id ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground"
            }`}
          >
            {en(c.name)}
          </Link>
        ))}
      </div>

      {/* 카테고리 지면은 위쪽 지면 머리가 이름·개수를 이미 말하므로 이 줄을 두지 않는다 */}
      {!category ? (
        <div className="mb-6 flex items-baseline justify-between border-b border-border pb-3">
          <h2 className="text-[22px] font-semibold uppercase tracking-wide">ALL PRODUCTS</h2>
          <p className="text-[14px] text-muted-foreground">
            <span className="font-semibold text-accent">{total}</span>개
          </p>
        </div>
      ) : null}

      {items.length === 0 ? (
        <p className="py-24 text-center text-[15px] text-muted-foreground">
          {category ? "이 카테고리에는 아직 상품이 없습니다." : "등록된 상품이 없습니다."}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-x-3 gap-y-10 md:grid-cols-4 lg:grid-cols-5">
            {items.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>

          {error ? <p className="mt-8 text-center text-[14px] text-accent">{error}</p> : null}

          {hasMore ? (
            <div className="mt-12 text-center">
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={busy}
                className="border border-foreground px-12 py-4 text-[14px] font-semibold uppercase tracking-wide transition-colors hover:bg-foreground hover:text-background disabled:opacity-50"
              >
                {busy ? "불러오는 중" : "더 보기"}
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
