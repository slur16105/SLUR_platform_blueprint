/* 프로토타입 — 구매자 홈. **EQL(wch.eqlstore.com) 시각 언어** + 모노크롬(블랙&화이트 + 강조 빨강).
   목적: 테마 도입 판단용. 기존 화면·콘솔 영향 0 — app/proto 폴더만 지우면 원복된다.

   EQL에서 가져온 문법 (레퍼런스 imports/pc.jpg 관찰):
   · 슬림·조밀한 헤더 — 작은 대문자 내비, 우측 유틸 묶음, 상단 공지 바
   · 히어로 — **전체 폭 스와이퍼**(가운데 + 양옆 peek) + 아래 검은 캡션 바
   · 검은 면 타이포 블록 — 대형 단어 하나(CURATED.)로 정체성 (EQL 키워드 블록의 SLUR 버전)
   · 검은 배경 상품 스트립 · 전면 캠페인 배너 · 라벨 바 얹은 3분할 카테고리 타일
   · 조밀한 4~5열 상품 그리드 · 다단 푸터
   ⚠️ 기존 UX 스펙(home-c-spec)의 "오버레이 금지·검은 면 기각"과는 반대 방향이다 —
      "EQL처럼 만들고 싶다"는 지시(2026-07-30)를 따른 것. 채택 시 스펙 개정 필요.

   데이터는 전부 실 API(편성·상품·카테고리). 이미지만 데모(실 상품 사진 확보 전). */

import Link from "next/link";

import { API_BASE } from "@/lib/auth";

import HeroSwiper, { type HeroSlide } from "./hero-swiper";

import "../proto.css";

type Product = { id: string; name: string; brand_name: string; price_from: number; sold_out: boolean };
type Category = { id: string; name: string };
type Feature = {
  id: string;
  kind: "hero" | "slot";
  issue_no: string | null;
  issue_label: string | null;
  title: string;
  lead_text: string | null;
  layout: "feature" | "strip";
  items: Product[];
};
type Home = { hero: Feature | null; slots: Feature[] };

/* 편집숍 톤 정물·오브제 (인물 없음). 실 상품 사진 확보 전 데모. */
const OBJ = [
  "1493957988430-a5f2e15f39a3", "1534349762230-e0cadf78f5da", "1556909212-d5b604d0c90d",
  "1513694203232-719a280e022f", "1567016432779-094069958ea5", "1540932239986-30128078f3c5",
  "1522708323590-d24dbb6b0267", "1556910103-1c02745aae4d", "1600607687939-ce8a6c25118c",
];
const img = (i: number, w = 600, h = 750) =>
  `https://images.unsplash.com/photo-${OBJ[i % OBJ.length]}?w=${w}&h=${h}&fit=crop&q=80&auto=format`;
const wide = (id: string, w = 1800, h = 620) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&fit=crop&q=80&auto=format`;

async function getJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${path}`, { next: { revalidate: 60 } });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

/* 내비 표기용 영문 라벨 — 데이터(카테고리명)는 한글 그대로 두고 **표시만** 영문으로 옮긴다.
   매핑에 없는 이름은 원본을 그대로 보여준다(운영자가 새 카테고리를 추가해도 깨지지 않는다). */
const EN: Record<string, string> = {
  문구: "STATIONERY",
  생활: "LIVING",
  패션: "FASHION",
  리빙: "INTERIOR",
  뷰티: "BEAUTY",
  테크: "TECH",
  푸드: "FOOD",
};
const en = (name: string) => EN[name] ?? name;

/* 상품 카드 — EQL식: 이미지 + 아래 브랜드(대문자)·상품명·가격 */
function Card({ p, i, ratio = "aspect-4/5" }: { p: Product; i: number; ratio?: string }) {
  return (
    <Link href="#" className="group block">
      <div className={`relative overflow-hidden bg-muted ${ratio}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img(i)}
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

export default async function ProtoHome() {
  const [home, list, categories] = await Promise.all([
    getJson<Home>("/api/v1/home", { hero: null, slots: [] }),
    getJson<{ items?: Product[] }>("/api/v1/products?page=1", {}),
    getJson<Category[]>("/api/v1/products/categories", []),
  ]);
  const products = list.items ?? [];
  const slots = home.slots;
  const strip = slots.find((s) => s.layout === "strip");
  const features = slots.filter((s) => s.layout === "feature");

  /* 히어로 스와이퍼 슬라이드 — 편성 히어로를 첫 장으로, 편성 슬롯을 이어 붙인다(전부 실 데이터) */
  const heroSlides: HeroSlide[] = [
    ...(home.hero
      ? [{
          image: wide("1513694203232-719a280e022f", 1200, 1040),
          eyebrow: [home.hero.issue_no, home.hero.issue_label].filter(Boolean).join(" · ") || null,
          title: home.hero.title,
          lead: home.hero.lead_text,
        }]
      : []),
    ...slots.map((sl, i) => ({
      image: wide(["1567016432779-094069958ea5", "1540932239986-30128078f3c5", "1556910103-1c02745aae4d"][i % 3], 1200, 1040),
      eyebrow: "EDITORIAL",
      title: sl.title,
      lead: sl.lead_text,
    })),
  ];

  return (
    <div className="proto min-h-screen">
      {/* ── 상단 공지 바 ── */}
      <div className="bg-foreground py-2 text-center text-[13px] tracking-wide text-background">
        <span className="font-semibold text-accent">이번 주 편성 공개</span> · 운영자가 직접 선별한 브랜드를 가장 먼저 만나보세요
      </div>

      {/* ── 헤더 (슬림·조밀) ── */}
      <header className="sticky top-0 z-50 border-b border-border bg-background">
        <div className="mx-auto flex h-[100px] max-w-[1600px] items-center gap-8 px-5">
          <Link href="/proto/home" className="text-[30px] font-bold leading-none tracking-tight">
            SLUR.
          </Link>
          <nav className="hidden items-center gap-5 text-[13px] font-medium tracking-wide lg:flex">
            {categories.map((c) => (
              <Link key={c.id} href="#" className="uppercase transition-colors hover:opacity-60">
                {en(c.name)}
              </Link>
            ))}
            <Link href="#" className="uppercase font-semibold text-accent transition-opacity hover:opacity-60">
              NEW IN
            </Link>
            <Link href="#" className="uppercase transition-colors hover:opacity-60">EXCLUSIVE</Link>
            <span className="ml-1 bg-accent px-2.5 py-1 text-[12px] font-semibold uppercase text-accent-foreground">
              THIS WEEK
            </span>
          </nav>
          <div className="ml-auto flex items-center gap-4 text-[13px]">
            <Link href="#" className="hover:opacity-60">LOGIN</Link>
            <Link href="#" className="hover:opacity-60">JOIN</Link>
            <Link href="#" className="flex items-center gap-1 hover:opacity-60">
              CART<span className="bg-accent px-1.5 text-[12px] text-accent-foreground">0</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ── 히어로: 전체 폭 스와이퍼 ── */}
      <section>
        <HeroSwiper slides={heroSlides} />
      </section>

      {/* ── 에디토리얼 4열 (편성 슬롯 품목) ── */}
      <section className="mx-auto max-w-[1600px] px-5 py-12">
        <div className="grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-4">
          {features.flatMap((f) => f.items).slice(0, 4).map((p, i) => (
            <div key={p.id}>
              <Card p={p} i={i} ratio="aspect-3/4" />
            </div>
          ))}
        </div>
      </section>

      {/* ── 검은 면 타이포 블록 — 큐레이션 정체성을 단어 하나로 (EQL 시그니처의 SLUR 버전) ── */}
      <section className="relative overflow-hidden bg-foreground py-20 text-background md:py-24">
        <div className="mx-auto max-w-[1600px] px-5">
          <p className="text-[13px] tracking-[0.35em] opacity-50">SEOUL · SINCE 2026</p>
          <h2 className="mt-5 flex items-start text-[64px] font-bold leading-[0.9] tracking-[-0.03em] md:text-[110px]">
            CURATED
            <span className="text-accent">.</span>
          </h2>
          <p className="mt-7 max-w-md text-[15px] leading-relaxed opacity-60">
            운영자가 직접 만나고 고른 브랜드만 소개합니다. 많이 파는 대신, 오래 남을 것을 고릅니다.
          </p>
        </div>
      </section>

      {/* ── 검은 배경 상품 스트립 ── */}
      {strip ? (
        <section className="bg-foreground px-5 pb-16 text-background">
          <div className="mx-auto max-w-[1600px]">
            <div className="mb-5 flex items-baseline gap-3">
              <h2 className="text-[22px] font-semibold">
                <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-accent align-middle" />
                {strip.title}
              </h2>
              <p className="text-[14px] opacity-60">{strip.lead_text}</p>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-6 md:grid-cols-6">
              {strip.items.concat(products.slice(0, 3)).slice(0, 6).map((p, i) => (
                <Link key={`${p.id}-${i}`} href="#" className="group block">
                  <div className="aspect-square overflow-hidden bg-white/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img(i + 4, 400, 400)}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <p className="mt-2.5 text-[13px] font-semibold uppercase opacity-70">{p.brand_name}</p>
                  <p className="mt-1 truncate text-[18px] font-medium">{p.name}</p>
                  <p className="mt-1 text-[15px] font-semibold tabular-nums">{won(p.price_from)}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ── 전면 캠페인 배너 ── */}
      <section className="relative h-[300px] w-full overflow-hidden bg-muted md:h-[420px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={wide("1567016432779-094069958ea5")} alt="" className="h-full w-full object-cover" />
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-background px-6 py-3 text-center">
          <p className="text-[16px] font-semibold">
            <span className="text-accent">NEW</span> BRANDS THIS SEASON
          </p>
        </div>
      </section>

      {/* ── 3분할 카테고리 타일 (라벨 바) ── */}
      <section className="mx-auto grid max-w-[1600px] grid-cols-1 gap-3 px-5 py-12 md:grid-cols-3">
        {categories.slice(0, 3).map((c, i) => (
          <Link key={c.id} href="#" className="group relative block">
            <div className="aspect-4/3 overflow-hidden bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img(i + 6, 800, 600)}
                alt=""
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
            </div>
            <div className="absolute bottom-0 left-0 right-0">
              <p className="bg-foreground px-4 py-3 text-center text-[15px] font-semibold uppercase tracking-wider text-background">
                {en(c.name)}
              </p>
            </div>
          </Link>
        ))}
      </section>

      {/* ── 조밀한 상품 그리드 (5열) ── */}
      <section className="mx-auto max-w-[1600px] px-5 pb-16">
        <div className="mb-6 flex items-baseline justify-between border-b border-border pb-3">
          <h2 className="text-[22px] font-semibold uppercase tracking-wide">ALL PRODUCTS</h2>
          <p className="text-[14px] text-muted-foreground">
            <span className="font-semibold text-accent">{products.length}</span>개
          </p>
        </div>
        {products.length === 0 ? (
          <p className="py-20 text-center text-sm text-muted-foreground">등록된 상품이 없습니다.</p>
        ) : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-9 md:grid-cols-4 lg:grid-cols-5">
            {products.map((p, i) => (
              <Card key={p.id} p={p} i={i} />
            ))}
          </div>
        )}
      </section>

      {/* ── 다단 조밀 푸터 ── */}
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
    </div>
  );
}
