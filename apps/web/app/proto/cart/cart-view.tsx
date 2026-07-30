"use client";

/* 장바구니 본체 — 판매자(브랜드)별 묶음 · 선택 · 수량 · 합계.
   프로토타입이라 실제 담기/주문은 하지 않는다(모양과 흐름 확인용). 실제 구현에는
   기존 장바구니 로직(낙관적 갱신·인라인 삭제 확인·서버 합계)이 이미 있으므로 그것을 쓴다. */

import Link from "next/link";
import { useState } from "react";

import { img, imgSeed, won, type Product } from "../data";

type Row = Product & { qty: number };

export default function CartView({ initial }: { initial: Product[] }) {
  const [rows, setRows] = useState<Row[]>(initial.map((p) => ({ ...p, qty: 1 })));
  const [checked, setChecked] = useState<string[]>(initial.filter((p) => !p.sold_out).map((p) => p.id));

  const toggle = (id: string) =>
    setChecked((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const setQty = (id: string, next: number) =>
    setRows((r) => r.map((x) => (x.id === id ? { ...x, qty: Math.min(99, Math.max(1, next)) } : x)));
  const remove = (id: string) => {
    setRows((r) => r.filter((x) => x.id !== id));
    setChecked((c) => c.filter((x) => x !== id));
  };

  /* 판매자(브랜드)별 묶음 — 배송비가 판매자마다 다르므로 구매자가 묶음을 인지해야 한다 */
  const packs = rows.reduce<Record<string, Row[]>>((acc, r) => {
    (acc[r.brand_name] ||= []).push(r);
    return acc;
  }, {});

  const selected = rows.filter((r) => checked.includes(r.id) && !r.sold_out);
  const itemsTotal = selected.reduce((s, r) => s + r.price_from * r.qty, 0);

  if (rows.length === 0) {
    return (
      <div className="py-32 text-center">
        <p className="text-[16px] text-muted-foreground">장바구니가 비어 있습니다.</p>
        <Link
          href="/proto/list"
          className="mt-6 inline-block border border-foreground px-10 py-4 text-[14px] font-semibold uppercase transition-colors hover:bg-foreground hover:text-background"
        >
          쇼핑 계속하기
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-10 pb-20 lg:grid-cols-[1fr_360px] lg:gap-14">
      {/* 좌 — 묶음 목록 */}
      <div>
        {Object.entries(packs).map(([brand, items]) => (
          <div key={brand} className="border-t border-border py-7 first:border-t-0 first:pt-0">
            <p className="mb-5 text-[15px] font-semibold uppercase tracking-wide">{brand}</p>

            <div className="space-y-6">
              {items.map((r) => {
                const on = checked.includes(r.id) && !r.sold_out;
                return (
                  <div key={r.id} className="flex gap-4">
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={r.sold_out}
                      onChange={() => toggle(r.id)}
                      aria-label={`${r.name} 선택`}
                      className="mt-1 h-4 w-4 flex-none accent-black disabled:opacity-40"
                    />

                    <Link href={`/proto/product/${r.id}`} className="flex flex-1 gap-4">
                      <div className="h-28 w-24 flex-none overflow-hidden bg-muted">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={img(imgSeed(r.id), 240, 300)}
                          alt=""
                          className={`h-full w-full object-cover ${r.sold_out ? "opacity-40 grayscale" : ""}`}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {r.brand_name}
                        </p>
                        <p className="mt-1 truncate text-[17px] font-medium">{r.name}</p>
                        <p className="mt-2 text-[15px] font-semibold tabular-nums">
                          {r.sold_out ? <span className="text-muted-foreground">품절</span> : won(r.price_from * r.qty)}
                        </p>
                      </div>
                    </Link>

                    {/* 수량·삭제는 링크 바깥 — 컨트롤 클릭이 상세 이동을 부르지 않게 */}
                    <div className="flex flex-none flex-col items-end justify-between">
                      <button
                        type="button"
                        onClick={() => remove(r.id)}
                        aria-label={`${r.name} 삭제`}
                        className="text-[18px] leading-none text-muted-foreground transition-colors hover:text-foreground"
                      >
                        ×
                      </button>
                      <div className="flex items-center border border-border">
                        <button
                          type="button"
                          onClick={() => setQty(r.id, r.qty - 1)}
                          aria-label="수량 줄이기"
                          disabled={r.sold_out}
                          className="h-9 w-9 transition-colors hover:bg-muted disabled:opacity-40"
                        >
                          −
                        </button>
                        <span className="w-9 text-center text-[14px] tabular-nums">{r.qty}</span>
                        <button
                          type="button"
                          onClick={() => setQty(r.id, r.qty + 1)}
                          aria-label="수량 늘리기"
                          disabled={r.sold_out}
                          className="h-9 w-9 transition-colors hover:bg-muted disabled:opacity-40"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="mt-5 border-t border-border pt-4 text-[13px] text-muted-foreground">
              배송비는 판매자마다 다르며 주문서에서 확인할 수 있습니다.
            </p>
          </div>
        ))}
      </div>

      {/* 우 — 합계 (데스크톱에서 따라다닌다) */}
      <aside className="lg:sticky lg:top-[124px] lg:self-start">
        <div className="border border-border p-7">
          <p className="mb-6 text-[15px] font-semibold uppercase tracking-wide">ORDER SUMMARY</p>
          <dl className="space-y-3 text-[14px]">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">선택 상품 {selected.length}건</dt>
              <dd className="tabular-nums">{won(itemsTotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">배송비</dt>
              <dd className="text-muted-foreground">주문서에서 확인</dd>
            </div>
          </dl>
          <div className="mt-6 flex items-baseline justify-between border-t border-border pt-5">
            <span className="text-[14px] font-semibold">총 상품 금액</span>
            <span className="text-[26px] font-semibold tabular-nums">{won(itemsTotal)}</span>
          </div>
          <button
            type="button"
            disabled={selected.length === 0}
            className="mt-6 h-14 w-full bg-foreground text-[15px] font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-default disabled:bg-muted disabled:text-muted-foreground"
          >
            주문하기 ({selected.length})
          </button>
          <p className="mt-4 text-[12px] leading-relaxed text-muted-foreground">
            SLUR는 통신판매중개자이며 통신판매의 당사자가 아닙니다.
          </p>
        </div>
      </aside>
    </div>
  );
}
