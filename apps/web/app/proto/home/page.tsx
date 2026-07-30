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

import { ProductCard, ProtoFooter, ProtoHeader } from "../chrome";
import { getJson, img, imgSeed, en, won, wide, type Category, type Home, type Product } from "../data";
import HeroSwiper, { type HeroSlide } from "./hero-swiper";

import "../proto.css";

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
      <ProtoHeader categories={categories} />

      {/* ── 히어로: 전체 폭 스와이퍼 ── */}
      <section>
        <HeroSwiper slides={heroSlides} />
      </section>

      {/* ── 에디토리얼 4열 (편성 슬롯 품목) ── */}
      <section className="mx-auto max-w-[1600px] px-5 py-12">
        <div className="grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-4">
          {features.flatMap((f) => f.items).slice(0, 4).map((p) => (
            <div key={p.id}>
              <ProductCard p={p} seed={imgSeed(p.id)} ratio="aspect-3/4" />
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
                <Link key={`${p.id}-${i}`} href={`/proto/product/${p.id}`} className="group block">
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
          <Link key={c.id} href={`/proto/list?category=${encodeURIComponent(c.id)}`} className="group relative block">
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
            {products.map((p) => (
              <ProductCard key={p.id} p={p} seed={imgSeed(p.id)} />
            ))}
          </div>
        )}
      </section>

      <ProtoFooter />
    </div>
  );
}
