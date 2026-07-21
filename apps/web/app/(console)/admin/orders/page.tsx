"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import LogoutButton from "@/app/logout-button";
import { statusBadgeClass, statusLabel } from "./status";
import "./orders.css";

type OrderCardSub = {
  brand_name: string;
  display_status: string;
};

type OrderCard = {
  order_id: string;
  order_no: string;
  created_at: string;
  display_status: string;
  grand_total: number;
  buyer_name: string; // "(알 수 없는 사용자)"로 올 수 있음 — 일반 텍스트라 스타일 영향 없음
  buyer_email: string;
  sub_orders: OrderCardSub[];
};

type StatusFilter = "" | "awaiting_payment" | "preparing" | "shipping" | "delivered" | "canceled";
const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "", label: "전체 상태" },
  { value: "awaiting_payment", label: "입금대기" },
  { value: "preparing", label: "배송준비" },
  { value: "shipping", label: "배송중" },
  { value: "delivered", label: "배송완료" },
  { value: "canceled", label: "취소" },
];

function formatDateTime(s: string) {
  // 판매자·입금 확인 화면과 대사 시 시간 불일치 방지 — KST 고정
  return new Date(s).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Seoul" });
}

function shortUuid(id: string) {
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

function AdminOrdersInner() {
  // 조회 화면 "주문 이력" 링크에서 ?q=이메일 로 진입 시 초기 검색어로 자동 조회 (2~100자 아니면 무시)
  const rawQ = (useSearchParams().get("q") ?? "").trim();
  const initialQ = rawQ.length >= 2 && rawQ.length <= 100 ? rawQ : "";
  const router = useRouter();
  const [q, setQ] = useState(initialQ); // 입력 중 값
  const [appliedQ, setAppliedQ] = useState(initialQ); // 실제 조회에 쓰인 값
  const [status, setStatus] = useState<StatusFilter>("");
  const [items, setItems] = useState<OrderCard[]>([]);
  const [total, setTotal] = useState(0);
  const [size, setSize] = useState(20); // 응답 size로 갱신 — 하드코딩 아님
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadSeq = useRef(0); // 요청 세대 카운터 — 검색·페이지 연타 시 늦은 응답 폐기

  const load = useCallback(async (query: string, st: StatusFilter, p: number) => {
    const gen = ++loadSeq.current;
    setError(null);
    try {
      const sp = new URLSearchParams({ page: String(p) });
      if (query) sp.set("q", query);
      if (st) sp.set("status", st);
      const res = await fetch(`/api/admin/orders?${sp.toString()}`);
      if (gen !== loadSeq.current) return; // 더 최신 요청이 있음 — 이 응답은 폐기
      if (res.status === 401) return void router.replace("/login");
      if (res.status === 403) return void router.replace("/no-role"); // R7: FastAPI 판정 결과를 따른다
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        return void setError(data?.message ?? "목록을 불러오지 못했습니다. 새로고침해 주세요.");
      }
      const data = await res.json();
      if (gen !== loadSeq.current) return;
      const list: OrderCard[] = data.items ?? [];
      const t: number = data.total ?? 0;
      const s: number = data.size > 0 ? data.size : 20;
      setSize(s);
      // 빈 뒷페이지 갇힘 방지 — 조건 변경으로 페이지가 사라졌으면 마지막 페이지로 이동
      if (list.length === 0 && t > 0 && p > 1) {
        return void setPage(Math.min(Math.max(1, Math.ceil(t / s)), p - 1)); // 항상 앞 페이지로만 이동 — 루프 불가
      }
      setItems(list);
      setTotal(t);
    } catch {
      if (gen === loadSeq.current) setError("네트워크 연결을 확인해 주세요.");
    }
  }, [router]);

  // 검색어·상태·페이지 변경 시 재조회 — 로더 호출을 effect 안 async 함수로 감싼다(React 데이터 페칭 관례).
  useEffect(() => {
    void (async () => { await load(appliedQ, status, page); })();
  }, [appliedQ, status, page, load]);

  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
  }, []);

  function submitSearch() {
    const query = q.trim();
    if (query && query.length < 2) return void setError("검색어는 2자 이상 입력해 주세요.");
    if (query.length > 100) return void setError("검색어는 100자 이내로 입력해 주세요.");
    setError(null);
    setPage(1);
    if (query === appliedQ) load(query, status, 1); // 같은 조건 재검색 — effect가 안 돌므로 직접 조회
    else setAppliedQ(query);
  }

  function changeStatus(st: StatusFilter) {
    setStatus(st);
    setPage(1);
  }

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

  const lastPage = Math.max(1, Math.ceil(total / size));

  return (
    <main className="page_admin_orders">
      <header className="p_head">
        <h1 className="p_title">주문 관리</h1>
        <div className="p_head_actions">
          <button className="btn m_small m_ghost" type="button" onClick={() => load(appliedQ, status, page)}>새로고침</button>
          <a className="btn m_small m_ghost" href="/admin">← 관리자 홈</a>
          <LogoutButton />
        </div>
      </header>
      <form className="p_search" onSubmit={(e) => { e.preventDefault(); submitSearch(); }}>
        <input className="input_text" type="search" maxLength={100} value={q}
          placeholder="주문번호(8자/전체)·주문자 이름·이메일·브랜드 (2자 이상)"
          onChange={(e) => setQ(e.target.value)} />
        <select className="input_text m_select" aria-label="주문 상태" value={status}
          onChange={(e) => changeStatus(e.target.value as StatusFilter)}>
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button className="btn m_primary" type="submit">검색</button>
      </form>
      {error && <div className="alert m_inline m_danger" role="alert">{error}</div>}
      {items.length === 0 ? (
        <p className="p_empty">{appliedQ || status ? "조건에 맞는 주문이 없습니다." : "주문이 없습니다."}</p>
      ) : (
        <div className="table_wrap">
          <table className="table_data">
            <thead>
              <tr>
                <th>주문번호</th>
                <th>주문 일시</th>
                <th>주문자</th>
                <th>브랜드</th>
                <th>상태</th>
                <th className="m_num">금액</th>
              </tr>
            </thead>
            <tbody>
              {items.map((o) => (
                <tr className="i_row" key={o.order_id} tabIndex={0}
                  onClick={() => router.push(`/admin/orders/${o.order_id}`)}
                  onKeyDown={(e) => { if (e.key === "Enter") router.push(`/admin/orders/${o.order_id}`); }}>
                  <td>
                    <strong className="i_order_no">{o.order_no}</strong>
                    <button className="i_uuid" type="button" title="클릭하여 전체 주문 ID 복사"
                      onClick={(e) => { e.stopPropagation(); copyOrderId(o.order_id); }}>
                      {copied === o.order_id ? "복사됨" : shortUuid(o.order_id)}
                    </button>
                  </td>
                  <td className="m_muted">{formatDateTime(o.created_at)}</td>
                  <td>
                    <span className="i_buyer">{o.buyer_name}</span>
                    <span className="i_email">{o.buyer_email}</span>
                  </td>
                  <td>
                    <div className="i_brands">
                      {o.sub_orders.map((s, idx) => (
                        <span className="badge m_small" data-state={s.display_status === "canceled" ? "canceled" : undefined} key={idx}>
                          {s.brand_name}{s.display_status === "canceled" && " (취소)"}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td><span className={statusBadgeClass(o.display_status)}>{statusLabel(o.display_status)}</span></td>
                  <td className="m_num"><strong>{o.grand_total.toLocaleString()}원</strong></td>
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
    </main>
  );
}

export default function AdminOrders() {
  // useSearchParams는 프리렌더 시 Suspense 경계가 필요 (Next 16 규약)
  return (
    <Suspense fallback={<main className="page_admin_orders"><p className="p_empty" role="status">불러오는 중…</p></main>}>
      <AdminOrdersInner />
    </Suspense>
  );
}
