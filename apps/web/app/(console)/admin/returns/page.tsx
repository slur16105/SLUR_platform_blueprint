"use client";

/* 관리자 반품·교환 처리 — 법정 의무(청약철회) 대응 화면.

   처리 흐름은 요청 → 승인/거부 → 완료(환불액 기록) 3단계다. 완료는 되돌릴 수 없으므로
   금액을 입력하게 하고, 무엇이 확정되는지 모달에서 문장으로 알린다. */

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import ConsoleShell from "@/app/(console)/console-shell";
import { pageRange, pageWindow } from "@/app/(console)/pagination";
import "./returns.css";

type ReturnItem = { order_item_id: string; product_name: string; option_text: string; quantity: number };
type ReturnRow = {
  id: string;
  sub_order_id: string;
  kind: string;
  reason: string;
  detail: string;
  status: string;
  admin_note: string;
  refund_amount: number;
  requested_at: string;
  items: ReturnItem[];
  user_id: string;
  buyer_name: string;
  buyer_email: string;
};

type Tab = "" | "requested" | "approved" | "rejected" | "completed";
const TABS: { key: Tab; label: string }[] = [
  { key: "requested", label: "접수" },
  { key: "approved", label: "승인(회수 중)" },
  { key: "completed", label: "완료" },
  { key: "rejected", label: "거부" },
  { key: "", label: "전체" },
];

const KIND_LABEL: Record<string, string> = { return: "반품", exchange: "교환" };
const REASON_LABEL: Record<string, string> = {
  change_of_mind: "단순 변심", defect: "상품 하자", wrong_delivery: "오배송", etc: "기타",
};
const STATUS_LABEL: Record<string, string> = {
  requested: "접수", approved: "승인(회수 중)", rejected: "거부", completed: "완료",
};
const STATUS_BADGE: Record<string, string> = {
  requested: "m_warning", approved: "m_brand", rejected: "", completed: "m_success",
};

function formatDateTime(s: string) {
  return new Date(s).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Seoul" });
}

function isTab(v: string | null): v is Tab {
  return v !== null && TABS.some((t) => t.key === v);
}

function AdminReturnsInner() {
  const initial = useSearchParams().get("status");
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(isTab(initial) ? initial : "requested");
  const [items, setItems] = useState<ReturnRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [total, setTotal] = useState(0);
  const [size, setSize] = useState(20);
  const [page, setPage] = useState(1);
  const [acting, setActing] = useState<{ row: ReturnRow; op: "approve" | "reject" | "complete" } | null>(null);
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (t: Tab, p: number) => {
    setError(null);
    try {
      const qs = new URLSearchParams({ page: String(p) });
      if (t) qs.set("status", t);
      const res = await fetch(`/api/admin/returns?${qs.toString()}`);
      if (res.status === 401) return void router.replace("/login");
      if (res.status === 403) return void router.replace("/no-role");
      if (!res.ok) return void setError("목록을 불러오지 못했습니다. 새로고침해 주세요.");
      const data = await res.json();
      const list: ReturnRow[] = data.items ?? [];
      const t2: number = data.total ?? 0;
      const s: number = data.size > 0 ? data.size : 20;
      setSize(s);
      if (list.length === 0 && t2 > 0 && p > 1) {
        return void setPage(Math.min(Math.max(1, Math.ceil(t2 / s)), p - 1));
      }
      setItems(list);
      setTotal(t2);
    } catch {
      setError("네트워크 연결을 확인해 주세요.");
    } finally {
      setLoaded(true);
    }
  }, [router]);

  useEffect(() => {
    void (async () => { await load(tab, page); })();
  }, [tab, page, load]);

  useEffect(() => () => { if (noticeTimer.current) clearTimeout(noticeTimer.current); }, []);

  function showNotice(msg: string) {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 5000);
  }

  function changeTab(t: Tab) {
    if (t === tab) return;
    setTab(t);
    setPage(1);
    router.replace(t ? `/admin/returns?status=${t}` : "/admin/returns", { scroll: false });
  }

  function openAction(row: ReturnRow, op: "approve" | "reject" | "complete") {
    setError(null);
    setNote("");
    setAmount("");
    setActing({ row, op });
  }

  async function submit() {
    if (!acting || busy) return;
    if (acting.op === "complete" && !amount.trim()) {
      setError("환불 금액을 입력해 주세요. 0원이면 0을 입력합니다.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: acting.op, id: acting.row.id, note: note.trim(),
          ...(acting.op === "complete" ? { refund_amount: Number(amount) } : {}),
        }),
      });
      if (res.status === 401) return void router.replace("/login");
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setError(d?.message ?? "처리에 실패했습니다.");
        return;
      }
      showNotice({
        approve: "승인했습니다. 회수가 끝나면 완료 처리하며 환불 금액을 기록하세요.",
        reject: "거부 처리했습니다. 구매자 화면에 사유가 표시됩니다.",
        complete: "완료 처리했습니다. 환불 금액이 기록됐습니다.",
      }[acting.op]);
      setActing(null);
      await load(tab, page);
    } catch {
      setError("네트워크 연결을 확인해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  const lastPage = Math.max(1, Math.ceil(total / size));

  return (
    <ConsoleShell role="admin" title="반품·교환" description="배송 완료 후 접수된 반품·교환 신청을 처리합니다.">
      <div className="page_admin_returns">
        <nav className="tab_menu" aria-label="처리 상태">
          {TABS.map((t) => (
            <button key={t.key || "all"} className="i_tab" type="button"
              data-state={tab === t.key ? "active" : undefined}
              onClick={() => changeTab(t.key)}>{t.label}</button>
          ))}
        </nav>
        {notice && <div className="alert m_inline m_success" role="status">{notice}</div>}
        {error && !acting && <div className="alert m_inline m_danger" role="alert">{error}</div>}

        {!loaded ? (
          <p className="p_empty" role="status">불러오는 중…</p>
        ) : items.length === 0 ? (
          <p className="p_empty">{tab === "requested" ? "처리할 신청이 없습니다." : "신청이 없습니다."}</p>
        ) : (
          <div className="table_wrap">
            <div className="table_scroll"><table className="table_data">
              <thead>
                <tr>
                  <th>신청</th>
                  <th>품목</th>
                  <th>신청자</th>
                  <th>접수일</th>
                  {tab === "" && <th>상태</th>}
                  <th className="m_num">환불액</th>
                  <th>처리</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{KIND_LABEL[r.kind] ?? r.kind}</strong>
                      <span className="i_reason">{REASON_LABEL[r.reason] ?? r.reason}</span>
                      {r.detail && <span className="i_detail">{r.detail}</span>}
                    </td>
                    <td>
                      <ul className="i_lines">
                        {r.items.map((it) => (
                          <li key={it.order_item_id}>
                            {it.product_name}
                            {it.option_text && <span className="i_option"> · {it.option_text}</span>}
                            <span className="i_qty"> × {it.quantity}</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td>
                      {r.buyer_name}
                      <span className="i_email">{r.buyer_email}</span>
                    </td>
                    <td className="m_muted">{formatDateTime(r.requested_at)}</td>
                    {tab === "" && (
                      <td><span className={`badge m_small ${STATUS_BADGE[r.status] ?? ""}`.trim()}>
                        {STATUS_LABEL[r.status] ?? r.status}</span></td>
                    )}
                    <td className="m_num">
                      {r.status === "completed" ? `${r.refund_amount.toLocaleString()}원` : <span className="m_muted">-</span>}
                    </td>
                    <td>
                      <div className="i_actions">
                        {r.status === "requested" && (
                          <>
                            <button className="btn m_small m_primary" type="button"
                              onClick={() => openAction(r, "approve")}>승인</button>
                            <button className="btn m_small" type="button"
                              onClick={() => openAction(r, "reject")}>거부</button>
                          </>
                        )}
                        {r.status === "approved" && (
                          <button className="btn m_small m_primary" type="button"
                            onClick={() => openAction(r, "complete")}>완료 처리</button>
                        )}
                        {(r.status === "completed" || r.status === "rejected") && r.admin_note && (
                          <span className="i_note">{r.admin_note}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
            <div className="i_foot">
              <span className="i_count">총 {total}건 · {pageRange(page, size, items.length)} 표시</span>
              <div className="i_btn_wrap">
                <button className="btn m_small" type="button" disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}>이전</button>
                {pageWindow(page, lastPage).map((n) => (
                  <button key={n} className="btn m_small" type="button"
                    data-state={n === page ? "active" : undefined}
                    aria-current={n === page ? "page" : undefined}
                    onClick={() => setPage(n)}>{n}</button>
                ))}
                <button className="btn m_small" type="button" disabled={page >= lastPage}
                  onClick={() => setPage((p) => p + 1)}>다음</button>
              </div>
            </div>
          </div>
        )}

        {acting && (
          <div className="modal_dialog" data-state="open" role="dialog" aria-modal="true" aria-labelledby="ret_title"
            onClick={(e) => { if (e.target === e.currentTarget && !busy) setActing(null); }}>
            <div className="i_wrap">
              <div className="i_head">
                <h2 className="i_title" id="ret_title">
                  {{ approve: "반품 승인", reject: "반품 거부", complete: "완료 처리" }[acting.op]}
                </h2>
                <button className="i_close" type="button" aria-label="닫기" disabled={busy}
                  onClick={() => setActing(null)}>✕</button>
              </div>
              <div className="i_body">
                <p className="i_text">
                  {{
                    approve: "회수를 진행합니다. 물건을 받은 뒤 완료 처리하며 환불 금액을 기록하세요.",
                    reject: "신청을 거부합니다. 사유는 구매자 화면에 그대로 표시되니 분명하게 적어 주세요.",
                    complete: "환불(또는 재발송)이 끝났음을 확정합니다. 처리 후에는 되돌릴 수 없습니다.",
                  }[acting.op]}
                </p>
                <dl className="i_summary">
                  <div><dt>신청자</dt><dd>{acting.row.buyer_name} ({acting.row.buyer_email})</dd></div>
                  <div><dt>유형</dt><dd>{KIND_LABEL[acting.row.kind]} · {REASON_LABEL[acting.row.reason]}</dd></div>
                  <div><dt>품목</dt><dd>{acting.row.items.map((i) => `${i.product_name} × ${i.quantity}`).join(", ")}</dd></div>
                </dl>
                {error && <div className="alert m_inline m_danger" role="alert">{error}</div>}
                {acting.op === "complete" && (
                  <label className="field">
                    <span className="i_label">환불 금액</span>
                    <input className="input_text" type="number" min={0} step={1} value={amount}
                      placeholder="예: 12000"
                      onChange={(e) => { setAmount(e.target.value); setError(null); }} />
                    <span className="i_help">실제 환불한 금액입니다. 나중에 정산·세무에서 이 값을 씁니다.</span>
                  </label>
                )}
                <label className="field">
                  <span className="i_label">메모{acting.op === "reject" ? " (구매자에게 표시)" : ""}</span>
                  <textarea className="input_text m_textarea" rows={3} maxLength={1000} value={note}
                    onChange={(e) => setNote(e.target.value)} />
                </label>
              </div>
              <div className="i_foot">
                <button className="btn" type="button" disabled={busy} onClick={() => setActing(null)}>취소</button>
                <button className={`btn ${acting.op === "reject" ? "m_danger" : "m_primary"}`} type="button"
                  disabled={busy} data-state={busy ? "loading" : undefined} onClick={submit}>
                  {{ approve: "승인", reject: "거부", complete: "완료 확정" }[acting.op]}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ConsoleShell>
  );
}

export default function AdminReturns() {
  return (
    <Suspense fallback={
      <ConsoleShell role="admin" title="반품·교환">
        <div className="page_admin_returns"><p className="p_empty" role="status">불러오는 중…</p></div>
      </ConsoleShell>
    }>
      <AdminReturnsInner />
    </Suspense>
  );
}
