"use client";

import { Fragment, useEffect, useState } from "react";

import ProductCard, { type ProductItem } from "./product-card";
import ProductList from "./product-list";
import { getPublicJson } from "./buyer-feedback";
import { consumeHomeScroll, restoreHomeScroll } from "./home-scroll";

/* 구매자 홈 편성 지면 (시안 C · 9.4).
   운영자가 편성한 히어로 → 편성 슬롯(비대칭 5:7) → 가로 스트립을 상품 그리드 앞에 세운다.
   편성 데이터는 /api/home(공개, 인증 불필요)에서 온다. 상품 그리드·카테고리 칩은 편성과
   무관하게 기존 ProductList가 그대로 받는다 — 편성 위/아래에 항상 선다(스펙 §5).

   폴백(§6):
   · 활성 히어로 없음(hero=null) 또는 조회 실패 → 편성 영역을 그리지 않고 ProductList를
     서문형("골라온 것들을 천천히 봅니다")으로 강등한다(heading="preface").
   · 히어로가 있으면 편성 영역을 세우고 그리드는 `전체 상품` 지면 머리로 받는다(heading="catalog").
   · 슬롯 품목이 0이면 그 섹션만 접는다(서버가 이미 제외하나 방어적으로 한 번 더 거른다).
   · 히어로/슬롯 품목의 품절은 숨기지 않는다 — ProductCard의 sold_out 규칙을 그대로 상속한다.

   로딩 동안에는 편성 영역을 비우고 ProductList가 서문 + 카드 골격을 보인다(기존 형태).
   중앙 스피너를 만들지 않는다(스펙 §6). */

/** /api/home의 FeatureOut. items는 ProductCard가 받는 형태와 같다(category_id는 편성엔 없다). */
type Feature = {
  id: string;
  kind: "hero" | "slot";
  issue_no: string | null;
  issue_label: string | null;
  title: string;
  lead_text: string | null;
  image_url: string | null;
  layout: "feature" | "strip";
  items: ProductItem[];
};

type HomeResponse = { hero: Feature | null; slots: Feature[] };

/* undefined = 로딩 · null = 편성 없음/오류(폴백) · 객체 = 편성 응답 */
type HomeState = HomeResponse | null | undefined;

export default function HomeFeed() {
  const [home, setHome] = useState<HomeState>(undefined);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const r = await getPublicJson<HomeResponse>("/api/home");
      if (!alive) return;
      setHome(r.ok ? r.data : null);
    })();
    return () => {
      alive = false;
    };
  }, []);

  /* 스크롤 복원 — 편성 응답이 도착해 지면 골격이 선 뒤 무장돼 있으면 복원한다.
     실제 높이가 찰 때까지는 restoreHomeScroll이 프레임 단위로 기다린다(그리드 비동기 적재). */
  useEffect(() => {
    if (home === undefined) return; // 편성 로딩 중 — 높이가 아직 안 섬
    const y = consumeHomeScroll();
    if (y !== null) restoreHomeScroll(y);
  }, [home]);

  const hero = home && home.hero ? home.hero : null;
  const slots =
    home && home.hero
      ? (home.slots ?? []).filter((s) => Array.isArray(s.items) && s.items.length > 0)
      : [];

  return (
    <>
      {hero ? (
        <>
          <FeatureHero feature={hero} />
          <div className="b_band" role="presentation" />
          {slots.map((slot) => (
            <Fragment key={slot.id}>
              {slot.layout === "strip" ? (
                <FeatureStrip feature={slot} />
              ) : (
                <FeatureSplit feature={slot} />
              )}
              <div className="b_band" role="presentation" />
            </Fragment>
          ))}
        </>
      ) : null}

      <ProductList heading={hero ? "catalog" : "preface"} />
    </>
  );
}

/* ── 히어로 — 전면 이미지 + 그 아래 표제 블록 (스펙 §3.2) ──────────────
   이미지 위에 글을 얹지 않는다(절대 규칙). 표제·눈썹·서문은 이미지 아래 블록.
   CTA `지면 보기`는 API가 목적지(href)를 주지 않으므로 만들지 않는다 — 죽은 링크를 그리지 않는다.
   품목(items)은 히어로 시각 계약에 없으므로(§3.2) 카드로 펼치지 않는다. */
function FeatureHero({ feature }: { feature: Feature }) {
  const titleId = `home-hero-${feature.id}`;
  // 스펙 §3.2: "NO. 07 · 2026.07" — issue_no + issue_label를 함께(있는 것만) 표기.
  const issueText = [feature.issue_no, feature.issue_label].filter(Boolean).join(" · ");
  return (
    <section className="p_hero" aria-labelledby={titleId}>
      <div className="i_media" role="img" aria-label={feature.title}>
        {feature.image_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img className="i_img" src={feature.image_url} alt="" decoding="async" />
        ) : null}
      </div>
      <div className="b_container i_body">
        <p className="i_issue">
          <span className="b_eyebrow">이번 지면</span>
          {issueText ? <span className="i_no">{issueText}</span> : null}
        </p>
        <h1 className="b_display i_title" id={titleId}>
          {feature.title}
        </h1>
        {feature.lead_text ? <p className="b_body i_lede">{feature.lead_text}</p> : null}
      </div>
    </section>
  );
}

/* ── 편성 슬롯 — 비대칭 5:7 (스펙 §3.3) ──────────────
   좌: 편집 문장(라벨 + 표제 + 문장) · 우: 고른 품목 2열 카드.
   `모두 보기` 링크는 API가 href를 주지 않으므로 그리지 않는다 — 카드가 곧 상세로 가는 길이다. */
function FeatureSplit({ feature }: { feature: Feature }) {
  const titleId = `home-feat-${feature.id}`;
  return (
    <section className="b_container p_feature" aria-labelledby={titleId}>
      <div className="i_split">
        <div className="i_prose">
          {feature.issue_label ? (
            <span className="b_section_label i_kicker">{feature.issue_label}</span>
          ) : null}
          <h2 className="b_title_sm i_head" id={titleId}>
            {feature.title}
          </h2>
          {feature.lead_text ? <p className="b_body i_text">{feature.lead_text}</p> : null}
        </div>
        <div className="i_picks">
          {feature.items.map((item) => (
            <ProductCard key={item.id} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── 가로 스트립 — 한 줄로 흘려 보는 묶음 (스펙 §3.4) ──────────────
   🚨 scroll-snap 금지(실측 결함). 우측 페이드도 두지 않는다. */
function FeatureStrip({ feature }: { feature: Feature }) {
  const titleId = `home-slot-${feature.id}`;
  return (
    <section className="p_slot" aria-labelledby={titleId}>
      <div className="i_line">
        <span className="b_section_label" id={titleId}>
          {feature.title}
        </span>
        {feature.lead_text ? <p className="b_body i_text">{feature.lead_text}</p> : null}
      </div>
      <div className="b_strip">
        {feature.items.map((item) => (
          <ProductCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}
