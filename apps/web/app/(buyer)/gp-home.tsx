"use client";

/* 구매자 홈 — giftpop main.html 룩(스코프 .gp_home)에 v1 실데이터 연결.
   앱 껍데기(상단바·탭바)는 BuyerShell 유지. 할인·라벨·검색·게시판 등 v1 미보유 요소는 제외(사용자 승인). */

import { useEffect, useState } from "react";
import Link from "next/link";

import "./gp-home.css";

type ProductItem = {
  id: string;
  name: string;
  brand_name: string;
  price_from: number;
  main_image_url: string | null;
  sold_out: boolean;
};

type Hero = { title: string; lead_text: string | null; issue_label: string | null } | null;

function won(n: number) {
  return `${n.toLocaleString()}원`;
}

export default function GpHome() {
  const [hero, setHero] = useState<Hero>(null);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [home, prod] = await Promise.all([
          fetch("/api/home").then((r) => (r.ok ? r.json() : null)).catch(() => null),
          fetch("/api/products?page=1").then((r) => (r.ok ? r.json() : null)).catch(() => null),
        ]);
        if (!alive) return;
        setHero(home?.hero ?? null);
        setProducts(prod?.items ?? []);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div className="gp_home b_container">
      {hero && (
        <section className="gp_hero">
          <div className="gp_hero_inner">
            {hero.issue_label && <p className="gp_hero_eyebrow">{hero.issue_label}</p>}
            <h1 className="gp_hero_title">{hero.title}</h1>
            {hero.lead_text && <p className="gp_hero_lead">{hero.lead_text}</p>}
          </div>
        </section>
      )}
      <section className="gp_section">
        <h2 className="gp_section_title">상품</h2>
        {loading ? (
          <p className="gp_empty" role="status">불러오는 중…</p>
        ) : products.length === 0 ? (
          <p className="gp_empty">상품이 없습니다.</p>
        ) : (
          <ul className="gp_goods">
            {products.map((p) => (
              <li className="gp_goods_item" key={p.id} data-soldout={p.sold_out ? "" : undefined}>
                <Link href={`/products/${p.id}`}>
                  <span className="gp_thumb">
                    {p.main_image_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={p.main_image_url} alt={p.name} />
                    ) : null}
                  </span>
                  <span className="gp_brand">{p.brand_name}</span>
                  <span className="gp_name">{p.name}</span>
                  <span className="gp_price">{won(p.price_from)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
