"use client";

import { useEffect, useState } from "react";

import LogoutButton from "../logout-button";
import "./seller.css";

type Profile = {
  brand_name: string;
  brand_intro: string;
  company_name: string;
  base_shipping_fee: number;
  jeju_extra_fee: number;
  island_extra_fee: number;
};

const FEE_FIELDS = [
  { name: "base_shipping_fee", label: "기본 배송비 (0 = 무료배송)" },
  { name: "jeju_extra_fee", label: "제주 추가 배송비" },
  { name: "island_extra_fee", label: "도서산간 추가 배송비" },
] as const;

export default function SellerHome() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fees, setFees] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/sellers/me").then(async (r) => {
      if (r.status === 401) return void (window.location.href = "/login");
      if (r.status === 403) return void (window.location.href = "/no-role");
      const p: Profile = await r.json();
      setProfile(p);
      setFees({
        base_shipping_fee: String(p.base_shipping_fee),
        jeju_extra_fee: String(p.jeju_extra_fee),
        island_extra_fee: String(p.island_extra_fee),
      });
    }).catch(() => setError("네트워크 연결을 확인해 주세요."));
  }, []);

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

  if (!profile) return null;

  return (
    <main className="page_seller">
      <header className="p_head">
        <div>
          <h1 className="p_title">{profile.brand_name}</h1>
          <p className="p_desc">{profile.company_name} · 판매자 센터</p>
        </div>
        <LogoutButton />
      </header>
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
      <a className="btn m_primary" href="/seller/products/new">상품 등록</a>
      <p className="p_note">상품 목록·수정은 다음 스토리에서 이어집니다.</p>
    </main>
  );
}
