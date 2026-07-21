"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import LogoutButton from "@/app/logout-button";
import "./deposits.css";

type PendingOrder = {
  order_id: string;
  order_no: string;
  created_at: string;
  deposit_due_at: string;
  expired: boolean;
  buyer_name: string; // "(알 수 없는 사용자)"로 올 수 있음 — 일반 텍스트라 스타일 영향 없음
  buyer_email: string;
  grand_total: number;
  title: string;
};

function formatDateTime(s: string) {
  // 판매자 화면과 대사 시 시간 불일치 방지 — KST 고정
  return new Date(s).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Seoul" });
}

function shortUuid(id: string) {
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

export default function AdminDeposits() {
  const router = useRouter();
  const [items, setItems] = useState<PendingOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [size, setSize] = useState(20); // 응답 size로 갱신 — 하드코딩 아님
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<PendingOrder | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadSeq = useRef(0); // 요청 세대 카운터 — 페이지 연타 시 늦은 응답 폐기
  const noteRef = useRef<HTMLTextAreaElement | null>(null);

  function showNotice(msg: string) {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 5000); // 성공 토스트 5초 후 자동 소멸
  }

  const load = useCallback(async (p: number) => {
    const gen = ++loadSeq.current;
    setError(null);
    setNotice(null); // 목록 재조회 시 토스트 초기화
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    try {
      const res = await fetch(`/api/admin/deposits?page=${p}`);
      if (gen !== loadSeq.current) return; // 더 최신 요청이 있음 — 이 응답은 폐기
      if (res.status === 401) return void router.replace("/login");
      if (res.status === 403) return void router.replace("/no-role"); // R7: FastAPI 판정 결과를 따른다
      if (!res.ok) return void setError("목록을 불러오지 못했습니다. 새로고침해 주세요.");
      const data = await res.json();
      if (gen !== loadSeq.current) return;
      const list: PendingOrder[] = data.items ?? [];
      const t: number = data.total ?? 0;
      const s: number = data.size > 0 ? data.size : 20;
      setSize(s);
      // 빈 뒷페이지 갇힘 방지 — 처리로 페이지가 사라졌으면 마지막 페이지로 이동
      if (list.length === 0 && t > 0 && p > 1) {
        return void setPage(Math.min(Math.max(1, Math.ceil(t / s)), p - 1)); // 항상 앞 페이지로만 이동 — 루프 불가
      }
      setItems(list);
      setTotal(t);
    } catch {
      if (gen === loadSeq.current) setError("네트워크 연결을 확인해 주세요.");
    }
  }, [router]);

  // 페이지 변경 시 재조회 — 로더 호출을 effect 안 async 함수로 감싼다(React 데이터 페칭 관례).
  useEffect(() => {
    void (async () => { await load(page); })();
  }, [page, load]);

  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
  }, []);

  // 모달 열림 — 메모 입력에 초기 포커스 + ESC 닫기(제출 중 제외)
  useEffect(() => {
    if (!confirming) return;
    noteRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) setConfirming(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirming, submitting]);

  async function copyOrderId(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(id);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(null), 1500);
    } catch {
      // 클립보드 미지원 환경 — 수동 복사 폴백
      window.prompt("아래 주문 ID를 직접 복사해 주세요.", id);
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
        body: JSON.stringify({
          order_id: confirming.order_id,
          note: note.trim() || undefined,
          expected_grand_total: confirming.grand_total, // 모달에 표시된 금액 그대로 — stale 금액 과입금 확인 방지
        }),
      });
      if (res.status === 401) return void router.replace("/login");
      if (res.status === 403) return void router.replace("/no-role");
      if (res.status === 204) {
        // 성공 — 해당 행만 제거하고 토스트
        setItems((prev) => prev.filter((o) => o.order_id !== confirming.order_id));
        setTotal((t) => Math.max(0, t - 1));
        showNotice(`입금 확인 완료 — 주문 ${confirming.order_no} 이 결제완료로 전환되었습니다.`);
        setConfirming(null);
        setNote("");
        return;
      }
      const data = await res.json().catch(() => null);
      if (res.status === 409 && data?.code === "price_changed") {
        // 주문 금액 변경(부분 취소 등) — 새 금액 안내 후 목록 갱신
        const next = data?.details?.[0]?.grand_total;
        setError(
          typeof next === "number"
            ? `주문 금액이 변경되었습니다 (현재 ${next.toLocaleString()}원). 목록을 갱신합니다.`
            : "주문 금액이 변경되었습니다. 목록을 갱신합니다.",
        );
        setConfirming(null);
        setNote("");
        load(page);
        return;
      }
      setError(data?.message ?? "처리에 실패했습니다.");
      if (res.status === 422 || res.status === 404) {
        // 이미 처리·취소됨(422) 또는 존재하지 않는 주문(404) — 메시지 표시 후 목록 재조회
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

  const lastPage = Math.max(1, Math.ceil(total / size));

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
              <button className="i_close" type="button" aria-label="닫기" disabled={submitting}
                onClick={() => setConfirming(null)}>✕</button>
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
                <textarea className="input_text m_textarea" rows={3} maxLength={500} ref={noteRef}
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
