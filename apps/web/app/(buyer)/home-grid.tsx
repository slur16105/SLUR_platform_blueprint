"use client";

/* 홈·카테고리 상품 그리드 (새 테마) — 기존 홈의 기능을 그대로 유지한다:
   · 카테고리 선택 — 헤더 메뉴가 소유한다(여기에 칩을 또 두지 않는다. 같은 메뉴가 두 번 나오면
     사용자는 둘이 다른 것인 줄 안다 — 오너 지적 2026-07-30).
   · `더 보기` 페이지네이션 — 스크롤 관찰자·자동 로드를 만들지 않는다 (UX-DR16).
   · 스크롤 복원 — 상품상세에 다녀오면 보던 자리로 (기존 home-scroll 유틸 재사용).

   ── 필터·정렬에 대한 정직한 설명 ──
   🚨 백엔드 목록 API에는 정렬·필터 파라미터가 없다(BFF도 category·page만 통과시킨다).
      그래서 정렬·품절 제외는 **받아온 목록 위에서** 처리한다. 다만 일부만 받아온 상태로 정렬하면
      "가격 낮은 순"이 거짓말이 되므로, 정렬·필터를 켜면 **남은 쪽을 모두 받아온 뒤** 적용한다.
      카탈로그가 커지면 이 방식은 한계가 있다 → 그때는 백엔드 정렬을 추가해야 한다. */

import Link from "next/link";
import { useEffect, useState } from "react";

import { armHomeScroll, consumeHomeScroll, restoreHomeScroll } from "./home-scroll";

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

type Sort = "new" | "low" | "high";
const SORTS: { key: Sort; label: string }[] = [
  { key: "new", label: "신상품순" },
  { key: "low", label: "가격 낮은순" },
  { key: "high", label: "가격 높은순" },
];

export default function HomeGrid({
  initialItems,
  total,
  category,
}: {
  initialItems: GridProduct[];
  total: number;
  category: string | null;
}) {
  const [items, setItems] = useState(initialItems);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("new");
  const [hideSoldOut, setHideSoldOut] = useState(false);

  /* 카테고리가 바뀌면 부모가 key를 바꿔 이 컴포넌트를 새로 마운트한다 —
     effect로 상태를 되돌리지 않는다(연쇄 렌더를 만들고 React 규칙에도 어긋난다). */

  /* 상품상세에서 돌아왔을 때 보던 자리로 (기존 동작 유지) */
  useEffect(() => {
    const y = consumeHomeScroll();
    if (y !== null) restoreHomeScroll(y);
  }, []);

  const url = (p: number) => {
    const q = new URLSearchParams();
    if (category) q.set("category", category);
    q.set("page", String(p));
    return `/api/products?${q.toString()}`;
  };

  async function fetchPage(p: number): Promise<GridProduct[]> {
    const res = await fetch(url(p), { cache: "no-store" });
    if (!res.ok) throw new Error();
    const data = (await res.json()) as { items?: GridProduct[] };
    return data.items ?? [];
  }

  async function loadMore() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const next = await fetchPage(page + 1);
      setItems((prev) => [...prev, ...next]);
      setPage((p) => p + 1);
    } catch {
      setError("목록을 더 불러오지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  /* 정렬·필터를 켤 때 남은 쪽을 모두 받아온다 — 부분 목록 위의 정렬은 사실과 다르기 때문. */
  async function ensureAllLoaded() {
    if (busy) return true;
    if (items.length >= total) return true;
    setBusy(true);
    setError(null);
    try {
      const collected = [...items];
      let p = page;
      while (collected.length < total) {
        p += 1;
        const next = await fetchPage(p);
        if (next.length === 0) break;
        collected.push(...next);
      }
      setItems(collected);
      setPage(p);
      return true;
    } catch {
      setError("전체 목록을 불러오지 못해 정렬을 적용하지 못했습니다.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function applySort(next: Sort) {
    if (next !== "new" && !(await ensureAllLoaded())) return;
    setSort(next);
  }

  async function applyHideSoldOut(next: boolean) {
    if (next && !(await ensureAllLoaded())) return;
    setHideSoldOut(next);
  }

  /* 보이는 목록 — 받아온 것 위에서 거르고 정렬한다(원본 순서는 보존) */
  const view = (() => {
    const base = hideSoldOut ? items.filter((p) => !p.sold_out) : items;
    if (sort === "low") return [...base].sort((a, b) => a.price_from - b.price_from);
    if (sort === "high") return [...base].sort((a, b) => b.price_from - a.price_from);
    return base;
  })();

  /* 정렬·필터가 켜져 있으면 이미 전부 받아온 상태이므로 `더 보기`를 두지 않는다 */
  const filtering = sort !== "new" || hideSoldOut;
  const hasMore = !filtering && items.length < total;

  return (
    <section className="mx-auto max-w-[1600px] px-5 pb-20">
      {/* ── 필터 줄 ── 좌: 개수 / 우: 정렬 · 품절 제외 */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border py-5">
        <p className="text-[14px] text-muted-foreground">
          <span className="font-semibold text-accent">{view.length}</span>
          {view.length !== total ? <span className="text-muted-foreground"> / {total}</span> : null}개
        </p>

        <div className="flex flex-wrap items-center gap-5">
          <label className="flex cursor-pointer items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              checked={hideSoldOut}
              onChange={(e) => void applyHideSoldOut(e.target.checked)}
              disabled={busy}
              className="h-4 w-4 accent-black"
            />
            품절 제외
          </label>

          <div className="flex items-center gap-4 text-[13px]">
            {SORTS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => void applySort(s.key)}
                disabled={busy}
                aria-pressed={sort === s.key}
                className={`transition-colors disabled:opacity-50 ${
                  sort === s.key ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view.length === 0 ? (
        <p className="py-24 text-center text-[15px] text-muted-foreground">
          {hideSoldOut && items.length > 0
            ? "구매 가능한 상품이 없습니다."
            : category
              ? "이 카테고리에는 아직 상품이 없습니다."
              : "등록된 상품이 없습니다."}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-x-3 gap-y-10 pt-10 md:grid-cols-4 lg:grid-cols-5">
            {view.map((p) => (
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
