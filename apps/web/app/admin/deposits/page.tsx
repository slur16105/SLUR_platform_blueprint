"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import LogoutButton from "../../logout-button";
import "./deposits.css";

type PendingOrder = {
  order_id: string;
  order_no: string;
  created_at: string;
  deposit_due_at: string;
  expired: boolean;
  buyer_name: string;
  buyer_email: string;
  grand_total: number;
  title: string;
};

const PAGE_SIZE = 20; // FastAPI settings.page_size와 동일

function formatDateTime(s: string) {
  return new Date(s).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" });
}

function shortUuid(id: string) {
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

export default function AdminDeposits() {
  const [items, setItems] = useState<PendingOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<PendingOrder | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (p: number) => {
    setError(null);
    try {
      const res = await fetch(`/api/admin/deposits?page=${p}`);
      if (res.status === 401) return void (window.location.href = "/login");
      if (res.status === 403) return void (window.location.href = "/no-role"); // R7: FastAPI 판정 결과를 따른다
      if (!res.ok) return void setError("목록을 불러오지 못했습니다. 새로고침해 주세요.");
      const data = await res.json();
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setError("네트워크 연결을 확인해 주세요.");
    }
  }, []);

  useEffect(() => {
    load(page);
  }, [page, load]);

  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); }, []);

  async function copyOrderId(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(id);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(null), 1500);
    } catch {
      // 클립보드 미지원 환경 — 무시
    }
  }

  async function confirmPayment() {
    if (!confirming || submitting) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/deposits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: confirming.order_id, note: note.trim() || undefined }),
      });
      if (res.status === 401) return void (window.location.href = "/login");
      if (res.status === 403) return void (window.location.href = "/no-role");
      if (res.status === 204) {
        // 성공 — 해당 행만 제거하고 토스트
        setItems((prev) => prev.filter((o) => o.order_id !== confirming.order_id));
        setTotal((t) => Math.max(0, t - 1));
        setNotice(`입금 확인 완료 — 주문 ${confirming.order_no} 이 결제완료로 전환되었습니다.`);
        setConfirming(null);
        setNote("");
        return;
      }
      const data = await res.json().catch(() => null);
      setError(data?.message ?? "처리에 실패했습니다.");
      if (res.status === 422) {
        // 이미 처리·취소된 주문 — 서버 메시지 표시 후 목록 재조회
        setConfirming(null);
        setNote("");
        load(page);
      }
    } catch {
      setError("네트워크 연결을 확인해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="page_admin_deposits">
      <header className="p_head">
        <h1 className="p_title">입금 확인</h1>
        <div className="p_head_actions">
          <button className="btn m_small m_ghost" type="button" onClick={() => load(page)}>새로고침</button>
          <LogoutButton />
        </div>
      </header>
      <nav className="p_tabs">
        <a className="btn m_small m_ghost" href="/admin">← 관리자 홈</a>
      </nav>
      {notice && <div className="alert m_inline m_success" role="status">{notice}</div>}
      {error && <div className="alert m_inline m_danger" role="alert">{error}</div>}
      {items.length === 0 ? (
        <p className="p_empty">입금대기 주문이 없습니다.</p>
      ) : (
        <div className="table_wrap">
          <table className="table_data">
            <thead>
              <tr>
                <th>주문번호</th>
                <th>주문 일시</th>
                <th>주문자</th>
                <th className="m_num">입금 예정 금액</th>
                <th>기한</th>
                <th>상품</th>
                <th aria-label="처리"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((o) => (
                <tr key={o.order_id}>
                  <td>
                    <strong className="i_order_no">{o.order_no}</strong>
                    <button className="i_uuid" type="button" title="클릭하여 전체 주문 ID 복사"
                      onClick={() => copyOrderId(o.order_id)}>
                      {copied === o.order_id ? "복사됨" : shortUuid(o.order_id)}
                    </button>
                  </td>
                  <td className="m_muted">{formatDateTime(o.created_at)}</td>
                  <td>
                    <span className="i_buyer">{o.buyer_name}</span>
                    <span className="i_email">{o.buyer_email}</span>
                  </td>
                  <td className="m_num"><strong>{o.grand_total.toLocaleString()}원</strong></td>
                  <td>
                    <span className="i_due">{formatDateTime(o.deposit_due_at)}</span>
                    {o.expired && <span className="badge m_danger">기한 경과</span>}
                  </td>
                  <td className="i_product">{o.title}</td>
                  <td>
                    <button className="btn m_small m_primary" type="button"
                      onClick={() => { setConfirming(o); setNote(""); }}>입금 확인</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="i_foot">
            <span className="i_count">총 {total}건</span>
            <div className="i_btn_wrap">
              <button className="btn m_small m_ghost" type="button" disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}>이전</button>
              <span className="i_page">{page} / {lastPage}</span>
              <button className="btn m_small m_ghost" type="button" disabled={page >= lastPage}
                onClick={() => setPage((p) => p + 1)}>다음</button>
            </div>
          </div>
        </div>
      )}
      {confirming && (
        <div className="modal_dialog" data-state="open" role="dialog" aria-modal="true" aria-labelledby="deposit_confirm_title"
          onClick={(e) => { if (e.target === e.currentTarget && !submitting) setConfirming(null); }}>
          <div className="i_wrap">
            <div className="i_head">
              <h2 className="i_title" id="deposit_confirm_title">입금 확인</h2>
              <button className="i_close" type="button" aria-label="닫기" onClick={() => setConfirming(null)}>✕</button>
            </div>
            <div className="i_body">
              <p className="i_text">아래 주문의 입금을 확인 처리합니다. 처리 후에는 되돌릴 수 없습니다.</p>
              <dl className="i_summary">
                <div><dt>주문번호</dt><dd><strong>{confirming.order_no}</strong></dd></div>
                <div><dt>주문자</dt><dd>{confirming.buyer_name} ({confirming.buyer_email})</dd></div>
                <div><dt>입금 예정 금액</dt><dd><strong>{confirming.grand_total.toLocaleString()}원</strong></dd></div>
              </dl>
              <label className="field">
                <span className="i_label">메모 (선택)</span>
                <textarea className="input_text m_textarea" rows={3} maxLength={500}
                  placeholder="입금자명이 다르거나 특이사항이 있으면 남겨 두세요 (500자 이내)"
                  value={note} onChange={(e) => setNote(e.target.value)} />
              </label>
            </div>
            <div className="i_foot">
              <button className="btn m_ghost" type="button" disabled={submitting} onClick={() => setConfirming(null)}>취소</button>
              <button className="btn m_primary" type="button" data-state={submitting ? "loading" : undefined}
                onClick={confirmPayment}>입금 확인</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
