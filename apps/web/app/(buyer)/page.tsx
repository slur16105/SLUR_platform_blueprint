/* 구매자 홈 — `/`. **새 테마(블랙&화이트) 적용 화면.**
   비로그인도 볼 수 있는 공개 라우트다. 역할로 분기하지 않는다 (FR-3).

   화면 단위 통째 교체 원칙: 이 화면은 옛 셸(buyer-shell)·옛 CSS(browse/home.css)를 쓰지 않고
   새 테마(theme.css, `.slur` 스코프)와 새 크롬(site-chrome)만 쓴다. 아직 이전하지 않은 화면들은
   옛 CSS를 그대로 쓰며 서로 영향이 없다 — 공용 파일(tokens.css·buyer.css)은 건드리지 않았다.

   유지한 기능(새로 짜지 않고 기존 것을 그대로 씀):
   · 편성 지면 — GET /api/v1/home (히어로·슬롯). 여러 건이면 슬라이드로 돈다.
   · 카테고리 필터 — `?category=`가 상태의 저장소(FR-34, 이름·순서는 서버가 소유)
   · `더 보기` 페이지네이션 · 상품상세 왕복 스크롤 복원 (home-grid)
   · 장바구니 배지·로그아웃·법정 고지 (site-chrome) */

import { cookies } from "next/headers";

import { API_BASE } from "@/lib/auth";

import HomeGrid, { type GridProduct } from "./home-grid";
import HomeHero, { type HeroSlide } from "./home-hero";
import { SiteFooter, SiteHeader, type NavCategory } from "./site-chrome";

import "./theme.css";

type Feature = {
  id: string;
  kind: "hero" | "slot";
  issue_no: string | null;
  issue_label: string | null;
  title: string;
  lead_text: string | null;
  image_url: string | null;
  layout: "feature" | "strip";
  items: GridProduct[];
};
type HomeResponse = { hero: Feature | null; slots: Feature[] };

/* 히어로 이미지가 아직 준비되지 않은 경우의 데모 사진 (편집숍 톤).
   ⚠️ 운영자가 편성 이미지를 등록하면 그 이미지가 우선한다. */
const DEMO_HERO = [
  "1513694203232-719a280e022f",
  "1567016432779-094069958ea5",
  "1540932239986-30128078f3c5",
].map((id) => `https://images.unsplash.com/photo-${id}?w=1600&h=1000&fit=crop&q=80&auto=format`);

async function getJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${path}`, { next: { revalidate: 60 } });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    /* 편성·목록 조회 실패가 홈 전체를 죽이지 않는다 — 비어 있는 지면으로 내려앉는다 */
    return fallback;
  }
}

export default async function BuyerHomePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const category = typeof sp.category === "string" ? sp.category : null;

  const [home, list, categories, cookieStore] = await Promise.all([
    getJson<HomeResponse>("/api/v1/home", { hero: null, slots: [] }),
    getJson<{ items?: GridProduct[]; total?: number }>(
      `/api/v1/products?page=1${category ? `&category=${encodeURIComponent(category)}` : ""}`,
      {},
    ),
    getJson<NavCategory[]>("/api/v1/products/categories", []),
    cookies(),
  ]);

  /* 로그인 여부는 slur_role 쿠키(UX 힌트)로 판정한다 — 장바구니 배지와 같은 신호(AD-1).
     로그인·로그아웃 직후 router.refresh()가 이 서버 컴포넌트를 다시 그려 헤더가 동기화된다. */
  const loggedIn = Boolean(cookieStore.get("slur_role"));

  /* 히어로 슬라이드 — 편성 히어로 + 편성 슬롯을 차례로. 운영자가 히어로를 여러 건 활성화하면
     그만큼 늘어난다(현재 API는 히어로 1건을 내려준다 — 다건 노출은 후속 작업). */
  const features: Feature[] = [...(home.hero ? [home.hero] : []), ...home.slots];
  const heroSlides: HeroSlide[] = features.map((f, i) => ({
    image: f.image_url ?? DEMO_HERO[i % DEMO_HERO.length],
    eyebrow: [f.issue_no, f.issue_label].filter(Boolean).join(" · ") || (f.kind === "slot" ? "EDITORIAL" : null),
    title: f.title,
    lead: f.lead_text,
  }));

  return (
    <div className="slur min-h-screen">
      <SiteHeader categories={categories} loggedIn={loggedIn} activeCategory={category} />

      {/* 편성 지면 — 편성이 없으면(초기 상태) 히어로를 그리지 않고 목록만 보인다 */}
      {heroSlides.length > 0 ? <HomeHero slides={heroSlides} /> : null}

      {/* 큐레이션 선언 */}
      <section className="bg-foreground py-20 text-background md:py-24">
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

      <HomeGrid
        /* 카테고리가 바뀌면 새로 마운트해 목록·페이지 상태를 초기화한다 */
        key={category ?? "all"}
        initialItems={list.items ?? []}
        total={list.total ?? (list.items?.length ?? 0)}
        categories={categories}
        category={category}
      />

      <SiteFooter />
    </div>
  );
}
