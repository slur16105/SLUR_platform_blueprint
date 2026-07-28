"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import ConsoleShell from "@/app/(console)/console-shell";
import CategoryPanel from "../category-panel";
import "./settings.css";

type Setting = { key: string; value: string; description: string; updated_at?: string | null };

function formatDateTime(s: string) {
  // 다른 관리자 화면과 대사 시 시간 불일치 방지 — KST 고정
  return new Date(s).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Seoul" });
}

// 운영 수치 카드에 표시할 읽기 전용 키 — 라벨·단위는 화면 소유 (설명은 API description 우선)
const READONLY_ROWS: { key: string; label: string; unit: string; fallbackDesc: string }[] = [
  { key: "unpaid_cancel_days", label: "미입금 자동취소 기한", unit: "일", fallbackDesc: "입금대기 주문이 이 기한을 넘기면 자동 취소됩니다." },
  { key: "low_stock_threshold", label: "품절 임박 기준", unit: "개", fallbackDesc: "재고가 이 수량 이하이면 품절 임박으로 표시됩니다." },
];

export default function AdminSettings() {
  const router = useRouter();
  const [settings, setSettings] = useState<Record<string, Setting>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null); // 로딩 실패 — 재시도 버튼과 함께 표시
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [checking, setChecking] = useState(false); // 모달 열기 전 서버 값 재확인 중
  const [pendingTotal, setPendingTotal] = useState<number | null>(null); // 입금대기 건수 — 조회 실패 시 null
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
      if (res.status === 401) return void router.replace("/login");
      if (res.status === 403) return void router.replace("/no-role"); // R7: FastAPI 판정 결과를 따른다
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
  }, [router]);

  // 초기 로드 — 로더 호출을 effect 안 async 함수로 감싼다(React 데이터 페칭 관례).
  useEffect(() => {
    void (async () => { await load(); })();
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

  async function openConfirm() {
    if (checking) return;
    setSaveError(null);
    if (nextValue.length < 1 || nextValue.length > 200) {
      return void setSaveError("계좌 정보는 1~200자로 입력해 주세요.");
    }
    if (account && nextValue === account.value) {
      return void setSaveError("현재 계좌와 동일합니다. 변경할 내용이 없습니다.");
    }
    // 돈이 오가는 값 — 모달을 열기 전에 서버 현재 값을 재확인 (stale '이전 계좌' 방지)
    setChecking(true);
    try {
      const res = await fetch("/api/admin/settings");
      if (res.status === 401) return void router.replace("/login");
      if (res.status === 403) return void router.replace("/no-role");
      if (!res.ok) return void setSaveError("서버 확인에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      const data = await res.json();
      const map: Record<string, Setting> = {};
      for (const s of (data.items ?? []) as Setting[]) map[s.key] = s;
      const serverValue = map["deposit_account"]?.value ?? "";
      if (serverValue !== (account?.value ?? "")) {
        // 다른 관리자가 그 사이 변경 — 화면 값 갱신 후 경고, 모달은 열지 않음
        setSettings(map);
        return void setSaveError("다른 관리자가 방금 계좌를 변경했습니다. 갱신된 현재 계좌를 확인한 뒤 다시 시도해 주세요.");
      }
      setSettings(map);
      // 입금대기 건수 — 실패해도 저장은 막지 않고 건수만 미표시
      let total: number | null = null;
      try {
        const dep = await fetch("/api/admin/deposits?page=1");
        if (dep.ok) {
          const d = await dep.json();
          if (typeof d.total === "number") total = d.total;
        }
      } catch {
        // 건수 조회 실패 — null 유지
      }
      setPendingTotal(total);
      setConfirming(true);
    } catch {
      setSaveError("네트워크 연결을 확인해 주세요.");
    } finally {
      setChecking(false);
    }
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
      if (res.status === 401) return void router.replace("/login");
      if (res.status === 403) return void router.replace("/no-role");
      if (res.status === 204) {
        setSettings((prev) => ({
          ...prev,
          // updated_at은 서버가 응답에 싣지 않는 204 — 표시용으로 현재 시각 사용 (다음 GET에서 서버 값으로 대체)
          deposit_account: { key: "deposit_account", value: nextValue, description: prev.deposit_account?.description ?? "", updated_at: new Date().toISOString() },
        }));
        setConfirming(false);
        setDraft("");
        showNotice("입금 계좌가 변경되었습니다. 기존 입금대기 주문의 입금 안내에도 즉시 적용됩니다 — 옛 계좌로 입금될 수 있으니 입금대기 건을 확인하세요.");
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
    <ConsoleShell
      role="admin"
      title="설정"
      description="무통장입금 계좌·운영 수치·카테고리를 관리합니다."
      actions={
        <button className="btn m_small m_ghost" type="button" onClick={load}>새로고침</button>
      }
    >
      <div className="page_admin_settings">
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
              <dd>
                {account?.value ? <strong>{account.value}</strong> : <span className="m_muted">(미설정)</span>}
                {account?.updated_at && <span className="i_updated">마지막 변경: {formatDateTime(account.updated_at)}</span>}
              </dd>
            </dl>
            <form className="i_form" onSubmit={(e) => { e.preventDefault(); openConfirm(); }}>
              <input className="input_text" type="text" maxLength={200} value={draft}
                aria-label="새 입금 계좌"
                placeholder="예: 국민은행 123456-78-901234 (주)슬러"
                onChange={(e) => { setDraft(e.target.value); setSaveError(null); }} />
              <button className="btn m_primary" type="submit" disabled={!nextValue || checking}
                data-state={checking ? "loading" : undefined}>저장</button>
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
          <section className="card p_card">
            <h2 className="i_title">카테고리</h2>
            <p className="i_desc">상품 분류 카테고리를 추가·수정·정렬합니다.</p>
            <CategoryPanel />
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
              <p className="i_text">
                구매자에게 안내되는 입금 계좌를 변경합니다. 저장 시 <strong>기존 입금대기 주문의 입금 안내에도 즉시 적용</strong>됩니다
                — 구매자가 이미 복사한 옛 계좌로 입금할 수 있으니 입금대기 건을 확인하세요.
              </p>
              <dl className="i_summary">
                <div><dt>이전 계좌</dt><dd>{account?.value || "(미설정)"}</dd></div>
                <div><dt>새 계좌</dt><dd><strong>{nextValue}</strong></dd></div>
                {pendingTotal !== null && (
                  <div><dt>현재 입금대기</dt><dd><strong>{pendingTotal.toLocaleString()}건</strong></dd></div>
                )}
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
      </div>
    </ConsoleShell>
  );
}
