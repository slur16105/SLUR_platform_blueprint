"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import ConsoleShell from "@/app/(console)/console-shell";
import { pageRange, pageWindow } from "@/app/(console)/pagination";
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
  { value: "", label: "전체" },
  { value: "awaiting_payment", label: "입금대기" },
  { value: "preparing", label: "배송준비" },
  { value: "shipping", label: "배송중" },
  { value: "delivered", label: "배송완료" },
  { value: "canceled", label: "취소" },
];

// 기간은 서버가 KST 자정 기준으로 계산한다(admin 라우터) — 화면 표시 시각과 같은 기준.
type PeriodFilter = "" | "today" | "7d" | "30d";
const PERIOD_OPTIONS: { value: PeriodFilter; label: string }[] = [
  { value: "", label: "전체 기간" },
  { value: "today", label: "오늘" },
  { value: "7d", label: "최근 7일" },
  { value: "30d", label: "최근 30일" },
];

function formatDateTime(s: string) {
  // 판매자·입금 확인 화면과 대사 시 시간 불일치 방지 — KST 고정
  return new Date(s).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Seoul" });
}

function shortUuid(id: string) {
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

function AdminOrdersInner() {
  const sp = useSearchParams();
  // 조회 화면 "주문 이력" 링크에서 ?q=이메일 로 진입 시 초기 검색어로 자동 조회 (2~100자 아니면 무시)
  const rawQ = (sp.get("q") ?? "").trim();
  const initialQ = rawQ.length >= 2 && rawQ.length <= 100 ? rawQ : "";
  // 대시보드 처리 대기 큐 딥링크(?status=preparing 등)로 진입 시 초기 상태 필터. 유효값만 수용.
  const rawStatus = sp.get("status") ?? "";
  const initialStatus: StatusFilter = STATUS_OPTIONS.some((o) => o.value === rawStatus && o.value !== "")
    ? (rawStatus as StatusFilter)
    : "";
  const router = useRouter();
  const [q, setQ] = useState(initialQ); // 입력 중 값
  const [appliedQ, setAppliedQ] = useState(initialQ); // 실제 조회에 쓰인 값
  const [status, setStatus] = useState<StatusFilter>(initialStatus);
  const [period, setPeriod] = useState<PeriodFilter>("");
  const [items, setItems] = useState<OrderCard[]>([]);
  const [total, setTotal] = useState(0);
  const [size, setSize] = useState(20); // 응답 size로 갱신 — 하드코딩 아님
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadSeq = useRef(0); // 요청 세대 카운터 — 검색·페이지 연타 시 늦은 응답 폐기

  const load = useCallback(async (query: string, st: StatusFilter, pd: PeriodFilter, p: number) => {
    const gen = ++loadSeq.current;
    setError(null);
    try {
      const sp = new URLSearchParams({ page: String(p) });
      if (query) sp.set("q", query);
      if (st) sp.set("status", st);
      if (pd) sp.set("period", pd);
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

  // 검색어·상태·기간·페이지 변경 시 재조회 — 로더 호출을 effect 안 async 함수로 감싼다(React 데이터 페칭 관례).
  useEffect(() => {
    void (async () => { await load(appliedQ, status, period, page); })();
  }, [appliedQ, status, period, page, load]);

  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
  }, []);

  function submitSearch() {
    const query = q.trim();
    if (query && query.length < 2) return void setError("검색어는 2자 이상 입력해 주세요.");
    if (query.length > 100) return void setError("검색어는 100자 이내로 입력해 주세요.");
    setError(null);
    setPage(1);
    if (query === appliedQ) load(query, status, period, 1); // 같은 조건 재검색 — effect가 안 돌므로 직접 조회
    else setAppliedQ(query);
  }

  function changeStatus(st: StatusFilter) {
    setStatus(st);
    setPage(1);
  }

  function changePeriod(pd: PeriodFilter) {
    setPeriod(pd);
    setPage(1);
  }

  const filtered = Boolean(appliedQ || status || period);

  // 초기화 버튼은 filtered일 때만 보이므로 셋 중 하나는 반드시 바뀐다 → effect가 재조회를 맡는다(중복 호출 없음).
  function resetFilters() {
    setQ("");
    setAppliedQ("");
    setStatus("");
    setPeriod("");
    setPage(1);
    setError(null);
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
    <ConsoleShell
      role="admin"
      title="주문 관리"
      description="전체 주문을 조회하고 상태를 처리합니다."
    >
      <div className="page_admin_orders">
      <nav className="tab_menu" aria-label="주문 상태">
        {STATUS_OPTIONS.map((o) => (
          <button key={o.value} type="button" className="i_tab"
            data-state={status === o.value ? "active" : undefined}
            onClick={() => changeStatus(o.value)}>
            {o.label}
          </button>
        ))}
      </nav>
      <form className="p_search" onSubmit={(e) => { e.preventDefault(); submitSearch(); }}>
        <input className="input_text" type="search" maxLength={100} value={q}
          placeholder="주문번호(8자/전체)·주문자 이름·이메일·브랜드 (2자 이상)"
          onChange={(e) => setQ(e.target.value)} />
        <select className="input_text m_select" aria-label="주문 기간" value={period}
          onChange={(e) => changePeriod(e.target.value as PeriodFilter)}>
          {PERIOD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button className="btn m_primary" type="submit">검색</button>
        {filtered && <button className="btn" type="button" onClick={resetFilters}>필터 초기화</button>}
      </form>
      {error && <div className="alert m_inline m_danger" role="alert">{error}</div>}
      {items.length === 0 ? (
        <p className="p_empty">{filtered ? "조건에 맞는 주문이 없습니다." : "주문이 없습니다."}</p>
      ) : (
        <div className="table_wrap">
          <div className="table_scroll"><table className="table_data">
            <thead>
              <tr>
                <th>주문번호</th>
                <th>주문 일시</th>
                <th>주문자</th>
                <th>브랜드</th>
                {/* 상태 탭으로 이미 걸러진 목록에서는 전 행이 같은 상태다 — 전체 탭에서만 컬럼을 둔다 */}
                {status === "" && <th>상태</th>}
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
                  {status === "" && (
                    <td><span className={statusBadgeClass(o.display_status)}>{statusLabel(o.display_status)}</span></td>
                  )}
                  <td className="m_num"><strong>{o.grand_total.toLocaleString()}원</strong></td>
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
      </div>
    </ConsoleShell>
  );
}

export default function AdminOrders() {
  // useSearchParams는 프리렌더 시 Suspense 경계가 필요 (Next 16 규약)
  return (
    <Suspense
      fallback={
        <ConsoleShell role="admin" title="주문 관리">
          <div className="page_admin_orders"><p className="p_empty" role="status">불러오는 중…</p></div>
        </ConsoleShell>
      }
    >
      <AdminOrdersInner />
    </Suspense>
  );
}
