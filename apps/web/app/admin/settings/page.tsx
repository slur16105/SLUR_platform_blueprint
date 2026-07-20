"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import LogoutButton from "../../logout-button";
import "./settings.css";

type Setting = { key: string; value: string; description: string };

// 운영 수치 카드에 표시할 읽기 전용 키 — 라벨·단위는 화면 소유 (설명은 API description 우선)
const READONLY_ROWS: { key: string; label: string; unit: string; fallbackDesc: string }[] = [
  { key: "unpaid_cancel_days", label: "미입금 자동취소 기한", unit: "일", fallbackDesc: "입금대기 주문이 이 기한을 넘기면 자동 취소됩니다." },
  { key: "low_stock_threshold", label: "품절 임박 기준", unit: "개", fallbackDesc: "재고가 이 수량 이하이면 품절 임박으로 표시됩니다." },
];

export default function AdminSettings() {
  const [settings, setSettings] = useState<Record<string, Setting>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null); // 로딩 실패 — 재시도 버튼과 함께 표시
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadSeq = useRef(0); // 요청 세대 카운터 — 재시도 연타 시 늦은 응답 폐기

  function showNotice(msg: string) {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 5000); // 성공 토스트 5초 후 자동 소멸
  }

  const load = useCallback(async () => {
    const gen = ++loadSeq.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings");
      if (gen !== loadSeq.current) return; // 더 최신 요청이 있음 — 이 응답은 폐기
      if (res.status === 401) return void (window.location.href = "/login");
      if (res.status === 403) return void (window.location.href = "/no-role"); // R7: FastAPI 판정 결과를 따른다
      if (!res.ok) return void setError("설정을 불러오지 못했습니다.");
      const data = await res.json();
      if (gen !== loadSeq.current) return;
      const map: Record<string, Setting> = {};
      for (const s of (data.items ?? []) as Setting[]) map[s.key] = s;
      setSettings(map);
    } catch {
      if (gen === loadSeq.current) setError("네트워크 연결을 확인해 주세요.");
    } finally {
      if (gen === loadSeq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => () => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
  }, []);

  // 확인 모달 — ESC 닫기 (제출 중 제외)
  useEffect(() => {
    if (!confirming) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) setConfirming(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirming, submitting]);

  const account = settings["deposit_account"];
  const nextValue = draft.trim();

  function openConfirm() {
    setSaveError(null);
    if (nextValue.length < 1 || nextValue.length > 200) {
      return void setSaveError("계좌 정보는 1~200자로 입력해 주세요.");
    }
    if (account && nextValue === account.value) {
      return void setSaveError("현재 계좌와 동일합니다. 변경할 내용이 없습니다.");
    }
    setConfirming(true); // 돈이 오가는 값 — 이전/새 값 재확인 후 저장
  }

  async function save() {
    if (submitting) return;
    setSubmitting(true);
    setSaveError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: nextValue }),
      });
      if (res.status === 401) return void (window.location.href = "/login");
      if (res.status === 403) return void (window.location.href = "/no-role");
      if (res.status === 204) {
        setSettings((prev) => ({
          ...prev,
          deposit_account: { key: "deposit_account", value: nextValue, description: prev.deposit_account?.description ?? "" },
        }));
        setConfirming(false);
        setDraft("");
        showNotice("입금 계좌가 변경되었습니다. 이후 주문의 안내 계좌에 즉시 반영됩니다.");
        return;
      }
      const data = await res.json().catch(() => null);
      setSaveError(data?.message ?? "저장에 실패했습니다. 다시 시도해 주세요.");
      setConfirming(false);
    } catch {
      setSaveError("네트워크 연결을 확인해 주세요.");
      setConfirming(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page_admin_settings">
      <header className="p_head">
        <h1 className="p_title">설정</h1>
        <div className="p_head_actions">
          <button className="btn m_small m_ghost" type="button" onClick={load}>새로고침</button>
          <LogoutButton />
        </div>
      </header>
      <nav className="p_tabs">
        <a className="btn m_small m_ghost" href="/admin">← 관리자 홈</a>
      </nav>
      {notice && <div className="alert m_inline m_success" role="status">{notice}</div>}
      {loading ? (
        <p className="p_empty">설정을 불러오는 중…</p>
      ) : error ? (
        <div className="alert m_inline m_danger" role="alert">
          {error}
          <button className="btn m_small m_ghost" type="button" onClick={load}>재시도</button>
        </div>
      ) : (
        <>
          <section className="card p_card">
            <h2 className="i_title">무통장입금 계좌</h2>
            <p className="i_desc">{account?.description || "구매자 주문서·입금 안내에 표시되는 계좌입니다."}</p>
            <dl className="i_current">
              <dt>현재 계좌</dt>
              <dd>{account?.value ? <strong>{account.value}</strong> : <span className="m_muted">(미설정)</span>}</dd>
            </dl>
            <form className="i_form" onSubmit={(e) => { e.preventDefault(); openConfirm(); }}>
              <input className="input_text" type="text" maxLength={200} value={draft}
                aria-label="새 입금 계좌"
                placeholder="예: 국민은행 123456-78-901234 (주)슬러"
                onChange={(e) => { setDraft(e.target.value); setSaveError(null); }} />
              <button className="btn m_primary" type="submit" disabled={!nextValue}>저장</button>
            </form>
            {saveError && <div className="alert m_inline m_danger" role="alert">{saveError}</div>}
          </section>
          <section className="card p_card">
            <h2 className="i_title">운영 수치</h2>
            <dl className="i_numbers">
              {READONLY_ROWS.map((row) => {
                const s = settings[row.key];
                return (
                  <div className="i_row" key={row.key}>
                    <dt>{row.label}</dt>
                    <dd>
                      {s?.value ? <strong>{s.value}{row.unit}</strong> : <span className="m_muted">(미설정)</span>}
                      <span className="i_note">{s?.description || row.fallbackDesc}</span>
                    </dd>
                  </div>
                );
              })}
            </dl>
            <p className="i_hint">수치 변경은 DB에서 합니다.</p>
          </section>
        </>
      )}
      {confirming && (
        <div className="modal_dialog" data-state="open" role="dialog" aria-modal="true" aria-labelledby="settings_confirm_title"
          onClick={(e) => { if (e.target === e.currentTarget && !submitting) setConfirming(false); }}>
          <div className="i_wrap">
            <div className="i_head">
              <h2 className="i_title" id="settings_confirm_title">입금 계좌 변경</h2>
              <button className="i_close" type="button" aria-label="닫기" disabled={submitting}
                onClick={() => setConfirming(false)}>✕</button>
            </div>
            <div className="i_body">
              <p className="i_text">구매자에게 안내되는 입금 계좌를 변경합니다. 계좌가 정확한지 다시 확인해 주세요.</p>
              <dl className="i_summary">
                <div><dt>이전 계좌</dt><dd>{account?.value || "(미설정)"}</dd></div>
                <div><dt>새 계좌</dt><dd><strong>{nextValue}</strong></dd></div>
              </dl>
            </div>
            <div className="i_foot">
              <button className="btn m_ghost" type="button" disabled={submitting} onClick={() => setConfirming(false)}>취소</button>
              <button className="btn m_primary" type="button" data-state={submitting ? "loading" : undefined}
                onClick={save}>변경 확정</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
