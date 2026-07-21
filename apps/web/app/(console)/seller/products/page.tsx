"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import "./list.css";

type Variant = { stock: number; is_active: boolean };
type Product = { id: string; name: string; base_price: number; status: string; images: { path: string }[]; variants: Variant[] };

const STATUS_LABEL: Record<string, string> = { active: "판매중", soldout: "품절", hidden: "숨김" };
const IMG_BASE = "https://ytzjlgqeezsvjkypeebq.supabase.co/storage/v1/object/public/product-images/";

export default function SellerProducts() {
  const router = useRouter();
  const [items, setItems] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/sellers/products");
      if (res.status === 401) return void router.replace("/login");
      if (res.status === 403) return void router.replace("/no-role");
      if (!res.ok) return void setError("목록을 불러오지 못했습니다.");
      setItems(await res.json());
    } catch {
      setError("네트워크 연결을 확인해 주세요.");
    }
  }, [router]);

  // 초기 로드 — 로더 호출을 effect 안에서 선언한 async 함수로 감싼다(React 데이터 페칭 관례).
  useEffect(() => {
    void (async () => { await load(); })();
  }, [load]);

  async function setStatus(p: Product, status: string) {
    setError(null);
    const res = await fetch("/api/sellers/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "patch", id: p.id, status }),
    }).catch(() => null);
    if (res?.status === 401) return void router.replace("/login");
    if (!res || !res.ok) return void setError("상태 변경에 실패했습니다.");
    load();
  }

  return (
    <main className="page_seller_products">
      <header className="p_head">
        <h1 className="p_title">내 상품</h1>
        <a className="btn m_primary" href="/seller/products/new">상품 등록</a>
      </header>
      {error && <div className="alert m_inline m_danger" role="alert">{error}</div>}
      {items.length === 0 && <p className="p_empty">등록된 상품이 없습니다.</p>}
      <ul className="p_list">
        {items.map((p) => {
          const stock = p.variants.reduce((sum, v) => sum + v.stock, 0);
          return (
            <li className="card p_item" key={p.id}>
              {p.images[0] && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img className="i_thumb" src={`${IMG_BASE}${p.images[0].path}`} alt="" />
              )}
              <div className="i_info">
                <strong className="i_name">{p.name}</strong>
                <span className="i_meta">{p.base_price.toLocaleString()}원 · 재고 {stock} · <span className="badge" data-state={p.status}>{STATUS_LABEL[p.status]}</span></span>
              </div>
              <div className="i_actions">
                {p.status !== "active" && <button className="btn m_small m_primary" type="button" onClick={() => setStatus(p, "active")}>판매 재개</button>}
                {p.status === "active" && <button className="btn m_small m_ghost" type="button" onClick={() => setStatus(p, "soldout")}>품절 처리</button>}
                {p.status !== "hidden" && <button className="btn m_small m_ghost" type="button" onClick={() => setStatus(p, "hidden")}>숨기기</button>}
              </div>
            </li>
          );
        })}
      </ul>
      <a className="p_back" href="/seller">← 판매자 센터</a>
    </main>
  );
}
