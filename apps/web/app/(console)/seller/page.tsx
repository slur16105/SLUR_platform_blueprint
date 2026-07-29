"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import ConsoleShell from "@/app/(console)/console-shell";
import "./seller.css";

type Profile = {
  brand_name: string;
  brand_intro: string;
  company_name: string;
  base_shipping_fee: number;
  jeju_extra_fee: number;
  island_extra_fee: number;
};

type LowStockItem = {
  product_id: string;
  product_name: string;
  option_text: string;
  stock: number;
};

type Dashboard = {
  preparing_count: number;
  shipping_count: number;
  low_stock: LowStockItem[];
  low_stock_threshold: number;
};

const FEE_FIELDS = [
  { name: "base_shipping_fee", label: "기본 배송비 (0 = 무료배송)" },
  { name: "jeju_extra_fee", label: "제주 추가 배송비" },
  { name: "island_extra_fee", label: "도서산간 추가 배송비" },
] as const;

export default function SellerHome() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fees, setFees] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [dashError, setDashError] = useState<string | null>(null);

  // 대시보드 값은 전부 서버 응답 표시만 (AD-12) — 클라이언트 계산 없음
  const loadDashboard = useCallback(async () => {
    setDashError(null);
    setDashboard(null);
    try {
      const res = await fetch("/api/seller/dashboard");
      if (res.status === 401) return void router.replace("/login");
      if (res.status === 403) return void router.replace("/no-role");
      if (!res.ok) return void setDashError("대시보드를 불러오지 못했습니다.");
      setDashboard(await res.json());
    } catch {
      setDashError("네트워크 연결을 확인해 주세요.");
    }
  }, [router]);

  // 초기 로드 — 로더 호출을 effect 안 async 함수로 감싼다(React 데이터 페칭 관례).
  useEffect(() => {
    void (async () => { await loadDashboard(); })();
  }, [loadDashboard]);

  useEffect(() => {
    fetch("/api/sellers/me").then(async (r) => {
      if (r.status === 401) return void router.replace("/login");
      if (r.status === 403) return void router.replace("/no-role");
      const p: Profile = await r.json();
      setProfile(p);
      setFees({
        base_shipping_fee: String(p.base_shipping_fee),
        jeju_extra_fee: String(p.jeju_extra_fee),
        island_extra_fee: String(p.island_extra_fee),
      });
    }).catch(() => setError("네트워크 연결을 확인해 주세요."));
  }, [router]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const res = await fetch("/api/sellers/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base_shipping_fee: Number(fees.base_shipping_fee),
          jeju_extra_fee: Number(fees.jeju_extra_fee),
          island_extra_fee: Number(fees.island_extra_fee),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.details?.[0]?.reason ?? data.message ?? "저장에 실패했습니다.");
        return;
      }
      setNotice("배송비 설정을 저장했습니다.");
    } catch {
      setError("네트워크 연결을 확인해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  if (!profile)
    return (
      <ConsoleShell role="seller" title="판매자 센터">
        <p className="p_loading" role="status">불러오는 중…</p>
      </ConsoleShell>
    );

  return (
    <ConsoleShell role="seller" title={profile.brand_name} description={`${profile.company_name} · 판매자 센터`}>
      <div className="page_seller">
      <section className="p_dashboard" aria-label="대시보드">
        {dashError ? (
          <div className="alert m_inline m_danger" role="alert">
            {dashError}
            <button className="btn m_small" type="button" onClick={loadDashboard}>다시 시도</button>
          </div>
        ) : !dashboard ? (
          <p className="p_loading" role="status">대시보드를 불러오는 중…</p>
        ) : (
          <>
            <div className="p_stats">
              <a className="card p_stat" href="/seller/orders">
                <span className="i_label">신규 주문 (배송준비 대기)</span>
                <strong className="i_value">{dashboard.preparing_count}건</strong>
              </a>
              <a className="card p_stat" href="/seller/orders?status=shipping">
                <span className="i_label">배송중</span>
                <strong className="i_value">{dashboard.shipping_count}건</strong>
              </a>
            </div>
            <div className="card p_low_stock">
              <div className="i_head">
                <h2 className="p_subtitle">품절 임박 — 재고 {dashboard.low_stock_threshold}개 이하</h2>
                <a className="i_link" href="/seller/products">상품 관리로 →</a>
              </div>
              {dashboard.low_stock.length === 0 ? (
                <p className="i_empty">품절 임박 상품이 없습니다.</p>
              ) : (
                <ul className="i_stock_list">
                  {dashboard.low_stock.map((s, idx) => (
                    <li className="i_stock_row" key={`${s.product_id}-${idx}`}>
                      <span className="i_name">{s.product_name}</span>
                      {s.option_text && <span className="i_option">{s.option_text}</span>}
                      <strong className="i_stock">{s.stock}개</strong>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </section>
      <form className="card p_panel" onSubmit={save}>
        <h2 className="p_subtitle">배송비 설정</h2>
        {notice && <div className="alert m_inline m_success" role="status">{notice}</div>}
        {error && <div className="alert m_inline m_danger" role="alert">{error}</div>}
        {FEE_FIELDS.map((f) => (
          <div className="field" key={f.name}>
            <label className="i_label" htmlFor={f.name}>{f.label}</label>
            <input id={f.name} className="input_text" type="number" min={0} step={1} required
              value={fees[f.name] ?? ""}
              onChange={(e) => setFees((v) => ({ ...v, [f.name]: e.target.value }))} />
            <span className="i_help">원 단위 정수</span>
          </div>
        ))}
        <button className="btn m_primary" type="submit" disabled={busy}>저장</button>
      </form>
      <nav className="p_links">
        <a className="btn m_primary" href="/seller/products">내 상품 관리</a>
        <a className="btn m_primary" href="/seller/orders">주문 관리</a>
      </nav>
      </div>
    </ConsoleShell>
  );
}
