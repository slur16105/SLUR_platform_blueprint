"use client";

/* 관리자 문의 관리 — 처리해야 할 대기열. 상태 탭 + 페이지 번호는 다른 콘솔 목록과 같은 구성.
   답변하면 작성자 화면에 바로 보이므로, 보내기 전에 내용을 확인하는 단계를 둔다. */

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import ConsoleShell from "@/app/(console)/console-shell";
import { pageRange, pageWindow } from "@/app/(console)/pagination";
import "./inquiries.css";

type Reply = { id: string; body: string; created_at: string };
type Inquiry = {
  id: string;
  category: string;
  title: string;
  body: string;
  status: string;
  order_id: string | null;
  created_at: string;
  answered_at: string | null;
  replies: Reply[];
  user_id: string;
  buyer_name: string;
  buyer_email: string;
};

type Tab = "" | "open" | "answered" | "closed";
const TABS: { key: Tab; label: string }[] = [
  { key: "open", label: "답변 대기" },
  { key: "answered", label: "답변 완료" },
  { key: "closed", label: "종료" },
  { key: "", label: "전체" },
];

const CATEGORY_LABEL: Record<string, string> = {
  order: "주문", product: "상품", account: "계정", etc: "기타",
};
const STATUS_LABEL: Record<string, string> = {
  open: "답변 대기", answered: "답변 완료", closed: "종료",
};
const STATUS_BADGE: Record<string, string> = { open: "m_warning", answered: "m_success", closed: "" };

function formatDateTime(s: string) {
  return new Date(s).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Seoul" });
}

function isTab(v: string | null): v is Tab {
  return v !== null && TABS.some((t) => t.key === v);
}

function AdminInquiriesInner() {
  const initial = useSearchParams().get("status");
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(isTab(initial) ? initial : "open");
  const [items, setItems] = useState<Inquiry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [total, setTotal] = useState(0);
  const [size, setSize] = useState(20);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Inquiry | null>(null);
  const [reply, setReply] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const replyRef = useRef<HTMLTextAreaElement | null>(null);

  const load = useCallback(async (t: Tab, p: number) => {
    setError(null);
    try {
      const qs = new URLSearchParams({ page: String(p) });
      if (t) qs.set("status", t);
      const res = await fetch(`/api/admin/inquiries?${qs.toString()}`);
      if (res.status === 401) return void router.replace("/login");
      if (res.status === 403) return void router.replace("/no-role");
      if (!res.ok) return void setError("목록을 불러오지 못했습니다. 새로고침해 주세요.");
      const data = await res.json();
      const list: Inquiry[] = data.items ?? [];
      const t2: number = data.total ?? 0;
      const s: number = data.size > 0 ? data.size : 20;
      setSize(s);
      // 처리로 페이지가 비면 앞 페이지로 — 빈 뒷페이지 갇힘 방지 (다른 콘솔 목록과 같은 규칙)
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

  useEffect(() => {
    if (selected) replyRef.current?.focus();
  }, [selected]);

  function showNotice(msg: string) {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 5000);
  }

  function changeTab(t: Tab) {
    if (t === tab) return;
    setTab(t);
    setPage(1);
    router.replace(t ? `/admin/inquiries?status=${t}` : "/admin/inquiries", { scroll: false });
  }

  async function submit(op: "reply" | "close") {
    if (!selected || busy) return;
    if (op === "reply" && !reply.trim()) {
      setError("답변 내용을 입력해 주세요.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op, id: selected.id, body: reply.trim() }),
      });
      if (res.status === 401) return void router.replace("/login");
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setError(d?.message ?? "처리에 실패했습니다.");
        return;
      }
      showNotice(op === "reply"
        ? "답변을 보냈습니다. 작성자의 문의 내역에 바로 표시됩니다."
        : "문의를 종료했습니다. 더는 답변할 수 없습니다.");
      setSelected(null);
      setReply("");
      await load(tab, page);
    } catch {
      setError("네트워크 연결을 확인해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  const lastPage = Math.max(1, Math.ceil(total / size));

  return (
    <ConsoleShell role="admin" title="문의 관리" description="구매자 1:1 문의에 답변합니다.">
      <div className="page_admin_inquiries">
        <nav className="tab_menu" aria-label="문의 상태">
          {TABS.map((t) => (
            <button key={t.key || "all"} className="i_tab" type="button"
              data-state={tab === t.key ? "active" : undefined}
              onClick={() => changeTab(t.key)}>{t.label}</button>
          ))}
        </nav>
        {notice && <div className="alert m_inline m_success" role="status">{notice}</div>}
        {error && <div className="alert m_inline m_danger" role="alert">{error}</div>}

        {!loaded ? (
          <p className="p_empty" role="status">불러오는 중…</p>
        ) : items.length === 0 ? (
          <p className="p_empty">{tab === "open" ? "답변할 문의가 없습니다." : "문의가 없습니다."}</p>
        ) : (
          <div className="table_wrap">
            <div className="table_scroll"><table className="table_data">
              <thead>
                <tr>
                  <th>제목</th>
                  <th>유형</th>
                  <th>작성자</th>
                  <th>접수일</th>
                  {tab === "" && <th>상태</th>}
                  <th>처리</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <strong className="i_title">{i.title}</strong>
                      {i.order_id && (
                        <Link className="i_order" href={`/admin/orders/${i.order_id}`}>연결된 주문 보기</Link>
                      )}
                    </td>
                    <td className="m_muted">{CATEGORY_LABEL[i.category] ?? i.category}</td>
                    <td>
                      {i.buyer_name}
                      <span className="i_email">{i.buyer_email}</span>
                    </td>
                    <td className="m_muted">{formatDateTime(i.created_at)}</td>
                    {tab === "" && (
                      <td>
                        <span className={`badge m_small ${STATUS_BADGE[i.status] ?? ""}`.trim()}>
                          {STATUS_LABEL[i.status] ?? i.status}
                        </span>
                      </td>
                    )}
                    <td>
                      <button className="btn m_small m_primary" type="button"
                        onClick={() => { setSelected(i); setReply(""); setError(null); }}>
                        {i.status === "closed" ? "내용 보기" : "답변하기"}
                      </button>
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

        {selected && (
          <div className="modal_dialog" data-state="open" role="dialog" aria-modal="true" aria-labelledby="inq_title"
            onClick={(e) => { if (e.target === e.currentTarget && !busy) setSelected(null); }}>
            <div className="i_wrap">
              <div className="i_head">
                <h2 className="i_title" id="inq_title">{selected.title}</h2>
                <button className="i_close" type="button" aria-label="닫기" disabled={busy}
                  onClick={() => setSelected(null)}>✕</button>
              </div>
              <div className="i_body">
                <dl className="i_summary">
                  <div><dt>작성자</dt><dd>{selected.buyer_name} ({selected.buyer_email})</dd></div>
                  <div><dt>유형</dt><dd>{CATEGORY_LABEL[selected.category] ?? selected.category}</dd></div>
                  <div><dt>접수일</dt><dd>{formatDateTime(selected.created_at)}</dd></div>
                </dl>
                <p className="i_question">{selected.body}</p>
                {selected.replies.length > 0 && (
                  <ul className="i_replies">
                    {selected.replies.map((r) => (
                      <li key={r.id}>
                        <span className="i_rmeta">운영자 답변 · {formatDateTime(r.created_at)}</span>
                        <p className="i_rbody">{r.body}</p>
                      </li>
                    ))}
                  </ul>
                )}
                {selected.status !== "closed" && (
                  <label className="field">
                    <span className="i_label">답변</span>
                    <textarea className="input_text m_textarea" rows={5} maxLength={2000} ref={replyRef}
                      placeholder="답변 내용을 입력하세요. 보내면 작성자 화면에 바로 표시됩니다."
                      value={reply} onChange={(e) => setReply(e.target.value)} />
                  </label>
                )}
              </div>
              <div className="i_foot">
                <button className="btn" type="button" disabled={busy} onClick={() => setSelected(null)}>닫기</button>
                {selected.status !== "closed" && (
                  <>
                    <button className="btn" type="button" disabled={busy}
                      onClick={() => submit("close")}>문의 종료</button>
                    <button className="btn m_primary" type="button" disabled={busy || !reply.trim()}
                      data-state={busy ? "loading" : undefined}
                      onClick={() => submit("reply")}>답변 보내기</button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </ConsoleShell>
  );
}

export default function AdminInquiries() {
  return (
    <Suspense fallback={
      <ConsoleShell role="admin" title="문의 관리">
        <div className="page_admin_inquiries"><p className="p_empty" role="status">불러오는 중…</p></div>
      </ConsoleShell>
    }>
      <AdminInquiriesInner />
    </Suspense>
  );
}
