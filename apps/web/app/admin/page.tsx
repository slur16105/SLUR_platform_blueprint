"use client";

import { useCallback, useEffect, useState } from "react";

import LogoutButton from "../logout-button";
import CategoryPanel from "./category-panel";
import "./admin.css";

type Application = {
  id: string;
  status: string;
  brand_name: string;
  brand_intro: string;
  company_name: string;
  representative_name: string;
  business_registration_number: string;
  mail_order_number: string;
  business_address: string;
  contact_phone: string;
  created_at: string;
  rejection_reason: string | null;
};

export default function AdminHome() {
  const [tab, setTab] = useState<"applications" | "categories">("applications");
  const [items, setItems] = useState<Application[]>([]);
  const [status, setStatus] = useState("pending");
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (s: string) => {
    setNotice(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/applications?status=${s}`);
      if (res.status === 401) return void (window.location.href = "/login");
      if (res.status === 403) return void (window.location.href = "/no-role"); // R7: FastAPI 판정 결과를 따른다
      if (!res.ok) {
        setError("목록을 불러오지 못했습니다. 새로고침해 주세요.");
        return;
      }
      const data = await res.json();
      setItems(data.items ?? []);
    } catch {
      setError("네트워크 연결을 확인해 주세요.");
    }
  }, []);

  useEffect(() => {
    load(status);
  }, [status, load]);

  async function act(id: string, action: "approve" | "reject") {
    setError(null);
    const res = await fetch("/api/admin/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action, reason: action === "reject" ? reason : undefined }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.details?.[0]?.reason ?? data.message ?? "처리에 실패했습니다.");
      return;
    }
    setNotice(
      action === "approve"
        ? `승인 완료 — 신청자가 다시 로그인하면 판매자 센터를 이용할 수 있습니다.`
        : "반려 처리했습니다. 신청자에게 사유가 표시됩니다.",
    );
    setRejecting(null);
    setReason("");
    load(status);
  }

  return (
    <main className="page_admin">
      <header className="p_head">
        <h1 className="p_title">SLUR 관리자</h1>
        <LogoutButton />
      </header>
      <div className="p_tabs">
        <button type="button" className={`btn m_small${tab === "applications" ? " m_primary" : " m_ghost"}`}
          onClick={() => setTab("applications")}>입점 신청</button>
        <button type="button" className={`btn m_small${tab === "categories" ? " m_primary" : " m_ghost"}`}
          onClick={() => setTab("categories")}>카테고리</button>
        <a className="btn m_small m_ghost" href="/admin/deposits">입금 확인</a>
      </div>
      {tab === "categories" ? <CategoryPanel /> : <>
      <div className="p_tabs">
        {(["pending", "approved", "rejected"] as const).map((s) => (
          <button key={s} type="button"
            className={`btn m_small${status === s ? " m_primary" : " m_ghost"}`}
            onClick={() => setStatus(s)}>
            {s === "pending" ? "심사 대기" : s === "approved" ? "승인됨" : "반려됨"}
          </button>
        ))}
      </div>
      {notice && <div className="alert m_inline m_success" role="status">{notice}</div>}
      {error && <div className="alert m_inline m_danger" role="alert">{error}</div>}
      {items.length === 0 && <p className="p_empty">해당 상태의 신청이 없습니다.</p>}
      <ul className="p_list">
        {items.map((a) => (
          <li className="card p_item" key={a.id}>
            <div className="i_head">
              <strong className="i_brand">{a.brand_name}</strong>
              <span className="badge">{a.company_name}</span>
            </div>
            <p className="i_intro">{a.brand_intro}</p>
            <dl className="i_meta">
              <div><dt>대표자</dt><dd>{a.representative_name}</dd></div>
              <div><dt>사업자번호</dt><dd>{a.business_registration_number}</dd></div>
              <div><dt>통판신고</dt><dd>{a.mail_order_number}</dd></div>
              <div><dt>주소</dt><dd>{a.business_address}</dd></div>
              <div><dt>연락처</dt><dd>{a.contact_phone}</dd></div>
            </dl>
            {a.status === "pending" && rejecting !== a.id && (
              <div className="i_actions">
                <button className="btn m_primary" type="button" onClick={() => act(a.id, "approve")}>승인</button>
                <button className="btn m_danger" type="button" onClick={() => setRejecting(a.id)}>반려</button>
              </div>
            )}
            {rejecting === a.id && (
              <div className="i_reject">
                <input className="input_text" placeholder="반려 사유 (신청자에게 표시됩니다)"
                  value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
                <div className="i_actions">
                  <button className="btn m_danger" type="button" onClick={() => act(a.id, "reject")}>반려 확정</button>
                  <button className="btn m_ghost" type="button" onClick={() => { setRejecting(null); setReason(""); }}>취소</button>
                </div>
              </div>
            )}
            {a.status === "rejected" && a.rejection_reason && (
              <p className="i_reason">반려 사유: {a.rejection_reason}</p>
            )}
          </li>
        ))}
      </ul>
      </>}
    </main>
  );
}