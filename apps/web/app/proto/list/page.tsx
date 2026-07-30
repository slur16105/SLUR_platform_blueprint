/* 프로토타입 — 상품 목록(카테고리 지면). 헤더 카테고리 메뉴가 닿는 화면.
   구성: 지면 머리(카테고리명·개수) → 필터 줄(카테고리 칩 + 정렬) → 조밀한 5열 그리드 → 더 보기.
   데이터는 실 API(상품·카테고리), `?category=` 를 실제로 반영한다. 기존 화면 영향 0. */

import Link from "next/link";

import { ProductCard, ProtoFooter, ProtoHeader } from "../chrome";
import { getJson, imgSeed, en, type Category, type Product } from "../data";

import "../proto.css";

const SORTS = [
  { key: "new", label: "NEW" },
  { key: "low", label: "PRICE LOW" },
  { key: "high", label: "PRICE HIGH" },
];

export default async function ProtoList({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const category = typeof sp.category === "string" ? sp.category : undefined;
  const sort = typeof sp.sort === "string" ? sp.sort : "new";

  const [list, categories] = await Promise.all([
    getJson<{ items?: Product[] }>(
      `/api/v1/products?page=1${category ? `&category=${encodeURIComponent(category)}` : ""}`,
      {},
    ),
    getJson<Category[]>("/api/v1/products/categories", []),
  ]);

  const items = [...(list.items ?? [])];
  if (sort === "low") items.sort((a, b) => a.price_from - b.price_from);
  if (sort === "high") items.sort((a, b) => b.price_from - a.price_from);

  const current = category ? categories.find((c) => c.id === category) : undefined;
  const href = (next: { category?: string | null; sort?: string }) => {
    const q = new URLSearchParams();
    const c = next.category === undefined ? category : next.category;
    const s = next.sort ?? sort;
    if (c) q.set("category", c);
    if (s && s !== "new") q.set("sort", s);
    const qs = q.toString();
    return `/proto/list${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="proto min-h-screen">
      <ProtoHeader categories={categories} />

      <main className="mx-auto max-w-[1600px] px-5">
        {/* 지면 머리 */}
        <div className="border-b border-border py-12 text-center">
          <h1 className="text-[40px] font-bold uppercase leading-none tracking-tight">
            {current ? en(current.name) : "ALL PRODUCTS"}
          </h1>
          <p className="mt-3 text-[14px] text-muted-foreground">
            <span className="font-semibold text-accent">{items.length}</span>개의 상품
          </p>
        </div>

        {/* 필터 줄 — 카테고리 칩 + 정렬 */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border py-5">
          <div className="flex flex-wrap gap-2">
            <Link
              href={href({ category: null })}
              className={`border px-4 py-2 text-[13px] font-medium uppercase transition-colors ${
                !category ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground"
              }`}
            >
              ALL
            </Link>
            {categories.map((c) => (
              <Link
                key={c.id}
                href={href({ category: c.id })}
                className={`border px-4 py-2 text-[13px] font-medium uppercase transition-colors ${
                  category === c.id
                    ? "border-foreground bg-foreground text-background"
                    : "border-border hover:border-foreground"
                }`}
              >
                {en(c.name)}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-4 text-[13px]">
            {SORTS.map((s) => (
              <Link
                key={s.key}
                href={href({ sort: s.key })}
                className={`uppercase transition-colors ${
                  sort === s.key ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s.label}
              </Link>
            ))}
          </div>
        </div>

        {/* 그리드 */}
        {items.length === 0 ? (
          <p className="py-32 text-center text-[15px] text-muted-foreground">해당하는 상품이 없습니다.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-x-3 gap-y-10 py-10 md:grid-cols-4 lg:grid-cols-5">
              {items.map((p) => (
                <ProductCard key={p.id} p={p} seed={imgSeed(p.id)} />
              ))}
            </div>
            <div className="pb-20 text-center">
              <button
                type="button"
                className="border border-foreground px-12 py-4 text-[14px] font-semibold uppercase tracking-wide transition-colors hover:bg-foreground hover:text-background"
              >
                MORE
              </button>
            </div>
          </>
        )}
      </main>

      <ProtoFooter />
    </div>
  );
}
