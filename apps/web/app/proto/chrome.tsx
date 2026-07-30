/* 프로토타입 공통 크롬 — 상단 공지 바 + 헤더 + 푸터.
   모든 프로토타입 화면이 같은 부품을 쓴다(디자인 시스템의 "같은 재료" 지점). */

import Link from "next/link";

import { en, img, won, type Category, type Product } from "./data";

export function ProtoHeader({ categories }: { categories: Category[] }) {
  return (
    <>
      {/* 상단 공지 바 */}
      <div className="bg-foreground py-2 text-center text-[13px] tracking-wide text-background">
        <span className="font-semibold text-accent">이번 주 편성 공개</span> · 운영자가 직접 선별한 브랜드를 가장 먼저 만나보세요
      </div>

      <header className="sticky top-0 z-50 border-b border-border bg-background">
        <div className="mx-auto flex h-[100px] max-w-[1600px] items-center gap-8 px-5">
          <Link href="/proto/home" className="text-[30px] font-bold leading-none tracking-tight">
            SLUR.
          </Link>
          <nav className="hidden items-center gap-5 text-[13px] font-medium tracking-wide lg:flex">
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/proto/list?category=${encodeURIComponent(c.id)}`}
                className="uppercase transition-colors hover:opacity-60"
              >
                {en(c.name)}
              </Link>
            ))}
            <Link href="/proto/list" className="uppercase font-semibold text-accent transition-opacity hover:opacity-60">
              NEW IN
            </Link>
            <Link href="/proto/list" className="uppercase transition-colors hover:opacity-60">EXCLUSIVE</Link>
            <span className="ml-1 bg-accent px-2.5 py-1 text-[12px] font-semibold uppercase text-accent-foreground">
              THIS WEEK
            </span>
          </nav>
          <div className="ml-auto flex items-center gap-4 text-[13px]">
            <Link href="#" className="hover:opacity-60">LOGIN</Link>
            <Link href="#" className="hover:opacity-60">JOIN</Link>
            <Link href="/proto/cart" className="flex items-center gap-1 hover:opacity-60">
              CART<span className="bg-accent px-1.5 text-[12px] text-accent-foreground">0</span>
            </Link>
          </div>
        </div>
      </header>
    </>
  );
}

export function ProtoFooter() {
  return (
    <footer className="border-t border-border bg-muted/40">
      <div className="mx-auto max-w-[1600px] px-5 py-12">
        <div className="grid gap-10 md:grid-cols-[2fr_1fr_1fr_1fr]">
          <div>
            <p className="text-[28px] font-bold leading-none tracking-tight">SLUR.</p>
            <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-muted-foreground">
              운영자가 판매자를 직접 선별·초청하는 큐레이션형 디자인 편집숍입니다.
              통신판매중개자이며 통신판매의 당사자가 아닙니다.
            </p>
          </div>
          {[
            { h: "SUPPORT", items: ["NOTICE", "FAQ", "1:1 INQUIRY", "SHIPPING"] },
            { h: "ABOUT", items: ["BRAND STORY", "PARTNERSHIP", "CAREERS"] },
            { h: "POLICY", items: ["TERMS", "PRIVACY", "BUSINESS INFO"] },
          ].map((col) => (
            <div key={col.h}>
              <p className="mb-3.5 text-[15px] font-semibold">{col.h}</p>
              <ul className="space-y-2.5 text-[14px] text-muted-foreground">
                {col.items.map((it) => (
                  <li key={it} className="hover:text-foreground">{it}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 border-t border-border pt-5 text-[12px] leading-relaxed text-muted-foreground">
          <p>SLUR | 대표이사 이호성 | 사업자등록번호 123-45-67890 | 통신판매업신고 2026-서울서초-1234</p>
          <p className="mt-1">COPYRIGHT © SLUR. ALL RIGHTS RESERVED.</p>
        </div>
      </div>
    </footer>
  );
}

/* 상품 카드 — 목록·상세 추천 등 여러 지면이 공유한다 */
export function ProductCard({
  p,
  seed,
  ratio = "aspect-4/5",
}: {
  p: Product;
  seed: number;
  ratio?: string;
}) {
  return (
    <Link href={`/proto/product/${p.id}`} className="group block">
      <div className={`relative overflow-hidden bg-muted ${ratio}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img(seed)}
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
