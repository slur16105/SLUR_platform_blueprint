"use client";

/* 관리자 공지 관리 — 약관 개정 고지(시행 7일 전, 불리한 변경은 30일 전)를 이행하는 지면.

   게시 상태는 published_at 하나로 표현한다: 비어 있으면 임시저장, 미래면 예약, 과거면 공개.
   운영자가 그 규칙을 외우지 않아도 되게 화면이 상태를 문장으로 말해 준다. */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import ConsoleShell from "@/app/(console)/console-shell";
import ConfirmModal from "@/app/(console)/confirm-modal";
import { pageRange, pageWindow } from "@/app/(console)/pagination";
import "./notices.css";

type Notice = {
  id: string;
  title: string;
  body: string;
  is_pinned: boolean;
  published_at: string | null;
  created_at: string;
};

function formatDateTime(s: string) {
  return new Date(s).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Seoul" });
}

/** 화면 표시용 상태 — published_at 하나에서 파생한다(별도 상태 컬럼을 두지 않는다). */
function displayState(n: Notice): { label: string; badge: string; hint: string } {
  if (!n.published_at) return { label: "임시저장", badge: "", hint: "구매자에게 보이지 않습니다" };
  const at = new Date(n.published_at).getTime();
  if (at > Date.now()) {
    return { label: "예약", badge: "m_warning", hint: `${formatDateTime(n.published_at)}에 공개됩니다` };
  }
  return { label: "게시중", badge: "m_success", hint: `${formatDateTime(n.published_at)}부터 공개` };
}

/** datetime-local 입력 ↔ ISO 변환. 입력값은 브라우저 로컬 시각이다. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const EMPTY = { id: "", title: "", body: "", is_pinned: false, publishedInput: "", publish: true };

export default function AdminNotices() {
  const router = useRouter();
  const [items, setItems] = useState<Notice[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [total, setTotal] = useState(0);
  const [size, setSize] = useState(20);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [removing, setRemoving] = useState<Notice | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (p: number) => {
    setError(null);
    try {
      const res = await fetch(`/api/admin/notices?page=${p}`);
      if (res.status === 401) return void router.replace("/login");
      if (res.status === 403) return void router.replace("/no-role");
      if (!res.ok) return void setError("목록을 불러오지 못했습니다. 새로고침해 주세요.");
      const data = await res.json();
      const list: Notice[] = data.items ?? [];
      const t: number = data.total ?? 0;
      const s: number = data.size > 0 ? data.size : 20;
      setSize(s);
      if (list.length === 0 && t > 0 && p > 1) {
        return void setPage(Math.min(Math.max(1, Math.ceil(t / s)), p - 1));
      }
      setItems(list);
      setTotal(t);
    } catch {
      setError("네트워크 연결을 확인해 주세요.");
    } finally {
      setLoaded(true);
    }
  }, [router]);

  useEffect(() => {
    void (async () => { await load(page); })();
  }, [page, load]);

  useEffect(() => () => { if (noticeTimer.current) clearTimeout(noticeTimer.current); }, []);

  function showNotice(msg: string) {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 5000);
  }

  function openNew() {
    setError(null);
    setForm({ ...EMPTY, publishedInput: toLocalInput(new Date().toISOString()) });
  }

  function openEdit(n: Notice) {
    setError(null);
    setForm({
      id: n.id, title: n.title, body: n.body, is_pinned: n.is_pinned,
      publishedInput: toLocalInput(n.published_at), publish: Boolean(n.published_at),
    });
  }

  async function save() {
    if (!form || busy) return;
    if (!form.title.trim() || !form.body.trim()) {
      setError("제목과 내용을 입력해 주세요.");
      return;
    }
    if (form.publish && !form.publishedInput) {
      setError("게시 일시를 지정해 주세요. 지금 게시하려면 현재 시각을 넣으면 됩니다.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/notices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: form.id ? "update" : "create",
          id: form.id || undefined,
          title: form.title.trim(),
          body: form.body.trim(),
          is_pinned: form.is_pinned,
          // 게시 안 함 = null(임시저장). 입력 시각은 로컬 → ISO로 보낸다.
          published_at: form.publish ? new Date(form.publishedInput).toISOString() : null,
        }),
      });
      if (res.status === 401) return void router.replace("/login");
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setError(d?.details?.[0]?.reason ?? d?.message ?? "저장에 실패했습니다.");
        return;
      }
      showNotice(form.publish ? "공지를 저장했습니다." : "임시저장했습니다. 구매자에게는 보이지 않습니다.");
      setForm(null);
      await load(page);
    } catch {
      setError("네트워크 연결을 확인해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!removing || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/notices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "delete", id: removing.id }),
      });
      if (!res.ok) {
        setError("삭제에 실패했습니다.");
        return;
      }
      showNotice("공지를 삭제했습니다.");
      setRemoving(null);
      await load(page);
    } finally {
      setBusy(false);
    }
  }

  const lastPage = Math.max(1, Math.ceil(total / size));

  return (
    <ConsoleShell
      role="admin"
      title="공지사항"
      description="약관 개정은 시행 7일 전(구매자에게 불리한 변경은 30일 전)에 공지해야 합니다."
      actions={<button className="btn m_primary" type="button" onClick={openNew}>공지 작성</button>}
    >
      <div className="page_admin_notices">
        {notice && <div className="alert m_inline m_success" role="status">{notice}</div>}
        {error && !form && <div className="alert m_inline m_danger" role="alert">{error}</div>}

        {!loaded ? (
          <p className="p_empty" role="status">불러오는 중…</p>
        ) : items.length === 0 ? (
          <p className="p_empty">공지가 없습니다. 첫 공지를 작성해 주세요.</p>
        ) : (
          <div className="table_wrap">
            <div className="table_scroll"><table className="table_data">
              <thead>
                <tr>
                  <th>제목</th>
                  <th>상태</th>
                  <th>게시 일시</th>
                  <th>처리</th>
                </tr>
              </thead>
              <tbody>
                {items.map((n) => {
                  const st = displayState(n);
                  return (
                    <tr key={n.id}>
                      <td>
                        {n.is_pinned && <span className="badge m_small m_brand i_pin">상단 고정</span>}
                        <strong className="i_title">{n.title}</strong>
                      </td>
                      <td><span className={`badge m_small ${st.badge}`.trim()}>{st.label}</span></td>
                      <td className="m_muted">{st.hint}</td>
                      <td>
                        <div className="i_actions">
                          <button className="btn m_small" type="button" onClick={() => openEdit(n)}>수정</button>
                          <button className="btn m_small m_danger" type="button" onClick={() => setRemoving(n)}>삭제</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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

        {form && (
          <div className="modal_dialog" data-state="open" role="dialog" aria-modal="true" aria-labelledby="notice_form_title"
            onClick={(e) => { if (e.target === e.currentTarget && !busy) setForm(null); }}>
            <div className="i_wrap">
              <div className="i_head">
                <h2 className="i_title" id="notice_form_title">{form.id ? "공지 수정" : "공지 작성"}</h2>
                <button className="i_close" type="button" aria-label="닫기" disabled={busy}
                  onClick={() => setForm(null)}>✕</button>
              </div>
              <div className="i_body">
                {error && <div className="alert m_inline m_danger" role="alert">{error}</div>}
                <label className="field">
                  <span className="i_label">제목</span>
                  <input className="input_text" maxLength={200} value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </label>
                <label className="field">
                  <span className="i_label">내용</span>
                  <textarea className="input_text m_textarea" rows={8} maxLength={20000} value={form.body}
                    onChange={(e) => setForm({ ...form, body: e.target.value })} />
                </label>
                <label className="i_check">
                  <input type="checkbox" checked={form.is_pinned}
                    onChange={(e) => setForm({ ...form, is_pinned: e.target.checked })} />
                  상단 고정 (목록 맨 위에 붙습니다)
                </label>
                <label className="i_check">
                  <input type="checkbox" checked={form.publish}
                    onChange={(e) => setForm({ ...form, publish: e.target.checked })} />
                  게시하기 (끄면 임시저장 — 구매자에게 보이지 않습니다)
                </label>
                {form.publish && (
                  <label className="field">
                    <span className="i_label">게시 일시</span>
                    <input className="input_text" type="datetime-local" value={form.publishedInput}
                      onChange={(e) => setForm({ ...form, publishedInput: e.target.value })} />
                    <span className="i_help">미래로 잡으면 그 시각에 자동 공개됩니다(예약).</span>
                  </label>
                )}
              </div>
              <div className="i_foot">
                <button className="btn" type="button" disabled={busy} onClick={() => setForm(null)}>취소</button>
                <button className="btn m_primary" type="button" disabled={busy}
                  data-state={busy ? "loading" : undefined} onClick={save}>저장</button>
              </div>
            </div>
          </div>
        )}

        {removing && (
          <ConfirmModal
            open
            title="공지 삭제"
            message={`‘${removing.title}’을(를) 삭제합니다. 되돌릴 수 없습니다. 고지 이력을 남겨야 한다면 삭제 대신 게시를 해제하세요.`}
            confirmLabel="삭제"
            danger
            submitting={busy}
            onConfirm={remove}
            onCancel={() => setRemoving(null)}
          />
        )}
      </div>
    </ConsoleShell>
  );
}
