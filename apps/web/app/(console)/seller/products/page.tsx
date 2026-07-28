"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import ConsoleShell from "@/app/(console)/console-shell";
import "./list.css";

type Variant = { stock: number; is_active: boolean };
type Product = { id: string; name: string; base_price: number; status: string; images: { path: string }[]; variants: Variant[] };

const STATUS_LABEL: Record<string, string> = { active: "판매중", soldout: "품절", hidden: "숨김" };
const IMG_BASE = "https://ytzjlgqeezsvjkypeebq.supabase.co/storage/v1/object/public/product-images/";

export default function SellerProducts() {
  const router = useRouter();
  const [items, setItems] = useState<Product[]>([]);
  const [loaded, setLoaded] = useState(false); // 최초 fetch 완료 전엔 빈 상태 대신 로딩 표시 (거짓 "상품 없음" 깜빡임 방지)
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
    } finally {
      setLoaded(true); // 성공·실패·리다이렉트 무관하게 최초 로드 종료 표시
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
    <ConsoleShell
      role="seller"
      title="상품 관리"
      actions={<a className="btn m_primary" href="/seller/products/new">상품 등록</a>}
    >
      <div className="page_seller_products">
      {error && <div className="alert m_inline m_danger" role="alert">{error}</div>}
      {!loaded ? (
        <p className="p_empty" role="status">불러오는 중…</p>
      ) : items.length === 0 ? (
        <p className="p_empty">등록된 상품이 없습니다.</p>
      ) : (
        <div className="table_wrap">
          <div className="table_scroll"><table className="table_data">
            <thead>
              <tr>
                <th>상품</th>
                <th className="m_num">가격</th>
                <th className="m_num">재고</th>
                <th>상태</th>
                <th>처리</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => {
                const stock = p.variants.reduce((sum, v) => sum + v.stock, 0);
                return (
                  <tr key={p.id}>
                    <td>
                      <div className="i_prod">
                        {p.images[0] ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img className="i_thumb" src={`${IMG_BASE}${p.images[0].path}`} alt="" />
                        ) : (
                          <span className="i_thumb m_empty" aria-hidden="true" />
                        )}
                        <strong className="i_name">{p.name}</strong>
                      </div>
                    </td>
                    <td className="m_num">{p.base_price.toLocaleString()}원</td>
                    <td className="m_num">{stock.toLocaleString()}개</td>
                    <td><span className="badge" data-state={p.status}>{STATUS_LABEL[p.status]}</span></td>
                    <td>
                      <div className="i_actions">
                        {p.status !== "active" && <button className="btn m_small m_primary" type="button" onClick={() => setStatus(p, "active")}>판매 재개</button>}
                        {p.status === "active" && <button className="btn m_small m_ghost" type="button" onClick={() => setStatus(p, "soldout")}>품절 처리</button>}
                        {p.status !== "hidden" && <button className="btn m_small m_ghost" type="button" onClick={() => setStatus(p, "hidden")}>숨기기</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        </div>
      )}
      </div>
    </ConsoleShell>
  );
}
