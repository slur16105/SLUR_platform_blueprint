"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import ConsoleShell from "@/app/(console)/console-shell";
import { pageRange, pageWindow } from "@/app/(console)/pagination";
import "./orders.css";

type OrderLine = {
  product_name: string;
  option_text: string;
  quantity: number;
  status: "ordered" | "canceled";
};

type SubOrder = {
  sub_order_id: string;
  order_id: string;
  order_no: string;
  created_at: string;
  recipient_name: string;
  recipient_phone: string;
  postal_code: string;
  address1: string;
  address2: string;
  order_note: string;
  all_canceled: boolean; // 서브주문 전 라인 취소 — 발송 대상 아님
  items: OrderLine[];
  shipping_fee: number;
  remote_extra_fee: number;
  shipping_status: string;
  carrier: string | null;
  tracking_number: string | null;
};

type Tab = "preparing" | "shipping" | "delivered";
const TABS: { key: Tab; label: string }[] = [
  { key: "preparing", label: "배송준비" },
  { key: "shipping", label: "배송중" },
  { key: "delivered", label: "배송완료" },
];

function formatDateTime(s: string) {
  // 관리자 화면과 대사 시 시간 불일치 방지 — KST 고정
  return new Date(s).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Seoul" });
}

function shortUuid(id: string) {
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

function isTab(v: string | null): v is Tab {
  return v !== null && TABS.some((t) => t.key === v);
}

function SellerOrdersInner() {
  // 대시보드 카드에서 ?status=shipping 으로 진입 시 해당 탭으로 시작 (미지정·오타는 preparing)
  const initialStatus = useSearchParams().get("status");
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(isTab(initialStatus) ? initialStatus : "preparing");
  const [items, setItems] = useState<SubOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [size, setSize] = useState(20); // 응답 size로 갱신 — 하드코딩 아님
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shipping, setShipping] = useState<SubOrder | null>(null); // 배송 시작 모달
  const [delivering, setDelivering] = useState<SubOrder | null>(null); // 배송 완료 확인 모달
  const [carrier, setCarrier] = useState("");
  const [tracking, setTracking] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadSeq = useRef(0); // 요청 세대 카운터 — 탭·페이지 연타 시 늦은 응답 폐기
  const carrierRef = useRef<HTMLInputElement | null>(null);
  const trackingRef = useRef<HTMLInputElement | null>(null);
  const deliverBtnRef = useRef<HTMLButtonElement | null>(null);

  function showNotice(msg: string) {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 5000); // 성공 토스트 5초 후 자동 소멸
  }

  // keepAlerts: 처리 직후 재조회 — 방금 띄운 토스트·에러 메시지를 지우지 않는다
  const load = useCallback(async (t: Tab, p: number, opts?: { keepAlerts?: boolean }) => {
    const gen = ++loadSeq.current;
    if (!opts?.keepAlerts) {
      setError(null);
      setNotice(null); // 목록 재조회 시 토스트 초기화
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    }
    try {
      const res = await fetch(`/api/seller/orders?status=${t}&page=${p}`);
      if (gen !== loadSeq.current) return; // 더 최신 요청이 있음 — 이 응답은 폐기
      if (res.status === 401) return void router.replace("/login");
      if (res.status === 403) return void router.replace("/no-role"); // 보안 판정은 항상 FastAPI
      if (!res.ok) return void setError("목록을 불러오지 못했습니다. 새로고침해 주세요.");
      const data = await res.json();
      if (gen !== loadSeq.current) return;
      const list: SubOrder[] = data.items ?? [];
      const t2: number = data.total ?? 0;
      const s: number = data.size > 0 ? data.size : 20;
      setSize(s);
      // 빈 뒷페이지 갇힘 방지 — 처리로 페이지가 사라졌으면 마지막 페이지로 이동
      if (list.length === 0 && t2 > 0 && p > 1) {
        return void setPage(Math.min(Math.max(1, Math.ceil(t2 / s)), p - 1)); // 항상 앞 페이지로만 이동 — 루프 불가
      }
      setItems(list);
      setTotal(t2);
    } catch {
      if (gen === loadSeq.current) setError("네트워크 연결을 확인해 주세요.");
    }
  }, [router]);

  // 탭·페이지 변경 시 재조회 — 로더 호출을 effect 안 async 함수로 감싼다(React 데이터 페칭 관례).
  useEffect(() => {
    void (async () => { await load(tab, page); })();
  }, [tab, page, load]);

  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
  }, []);

  // 모달 열림 — 초기 포커스 + ESC 닫기(제출 중 제외)
  useEffect(() => {
    if (!shipping && !delivering) return;
    if (shipping) carrierRef.current?.focus();
    else deliverBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) closeModals();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [shipping, delivering, submitting]);

  function closeModals() {
    setShipping(null);
    setDelivering(null);
    setCarrier("");
    setTracking("");
    setFormError(null);
  }

  function changeTab(t: Tab) {
    if (t === tab) return;
    setTab(t);
    setPage(1);
    // URL 쿼리를 현재 탭과 동기화 — 새로고침·공유 시 탭 유지 (히스토리 미적재)
    router.replace(`/seller/orders?status=${t}`, { scroll: false });
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

  /** ship·deliver 공통 제출 — 성공(204) 시 행 제거 + 토스트, 422·404는 메시지 표시 후 재조회 */
  async function submitAction(target: SubOrder, payload: Record<string, unknown>, successMsg: string) {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/seller/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, sub_order_id: target.sub_order_id }),
      });
      if (res.status === 401) return void router.replace("/login");
      if (res.status === 403) return void router.replace("/no-role");
      if (res.status === 204) {
        // 성공 — 토스트 후 재조회 (마지막 행 처리 시 빈 뒷페이지 이동 로직 재사용)
        showNotice(successMsg);
        closeModals();
        load(tab, page, { keepAlerts: true });
        return;
      }
      const data = await res.json().catch(() => null);
      setError(data?.message ?? "처리에 실패했습니다.");
      if (res.status === 422 || res.status === 404) {
        // 상태가 이미 바뀜(422 invalid_transition) 또는 없는 주문(404) — 메시지 유지한 채 목록 재조회
        closeModals();
        load(tab, page, { keepAlerts: true });
      }
    } catch {
      setError("네트워크 연결을 확인해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  function submitShip() {
    if (!shipping) return;
    const c = carrier.trim();
    const t = tracking.trim();
    if (!c || c.length > 50 || !t || t.length > 50) {
      setFormError("택배사와 송장번호를 각각 1~50자로 입력해 주세요.");
      return;
    }
    setFormError(null);
    submitAction(shipping, { action: "ship", carrier: c, tracking_number: t },
      `주문 ${shipping.order_no} 배송 시작 처리 완료 — 배송중 탭으로 이동했습니다.`);
  }

  function submitDeliver() {
    if (!delivering) return;
    submitAction(delivering, { action: "deliver" },
      `주문 ${delivering.order_no} 배송 완료 처리되었습니다.`);
  }

  const lastPage = Math.max(1, Math.ceil(total / size));

  return (
    <ConsoleShell
      role="seller"
      title="주문 관리"
    >
      <div className="page_seller_orders">
      <nav className="tab_menu" aria-label="배송 상태">
        {TABS.map((t) => (
          <button className="i_tab" type="button" key={t.key}
            data-state={tab === t.key ? "active" : undefined}
            onClick={() => changeTab(t.key)}>{t.label}</button>
        ))}
      </nav>
      {notice && <div className="alert m_inline m_success" role="status">{notice}</div>}
      {error && <div className="alert m_inline m_danger" role="alert">{error}</div>}
      {items.length === 0 ? (
        <p className="p_empty">{TABS.find((t) => t.key === tab)?.label} 주문이 없습니다.</p>
      ) : (
        <div className="table_wrap">
          <div className="table_scroll"><table className="table_data">
            <thead>
              <tr>
                <th>주문번호</th>
                <th>주문일</th>
                <th>수령인</th>
                <th>배송지·요청사항</th>
                <th>주문 상품</th>
                <th className="m_num">배송비</th>
                {tab !== "preparing" && <th>송장 정보</th>}
                {tab !== "delivered" && <th>처리</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((o) => (
                <tr key={o.sub_order_id}>
                  <td>
                    <strong className="i_order_no">{o.order_no}</strong>
                    <button className="i_uuid" type="button" title="클릭하여 전체 주문 ID 복사"
                      onClick={() => copyOrderId(o.order_id)}>
                      {copied === o.order_id ? "복사됨" : shortUuid(o.order_id)}
                    </button>
                    {o.all_canceled && <span className="badge m_small m_danger">전체 취소됨</span>}
                  </td>
                  <td className="m_muted">{formatDateTime(o.created_at)}</td>
                  <td>
                    <span className="i_recipient">{o.recipient_name}</span>
                    <span className="i_phone">{o.recipient_phone}</span>
                  </td>
                  <td className="i_address">
                    <span className="i_addr_line">[{o.postal_code}] {o.address1} {o.address2}</span>
                    {o.order_note && <span className="i_note">요청: {o.order_note}</span>}
                  </td>
                  <td>
                    <ul className="i_lines">
                      {o.items.map((line, idx) => (
                        <li className="i_line" data-state={line.status === "canceled" ? "canceled" : undefined} key={idx}>
                          <span className="i_line_name">{line.product_name}</span>
                          {line.option_text && <span className="i_line_option">{line.option_text}</span>}
                          <span className="i_line_qty">× {line.quantity}</span>
                          {line.status === "canceled" && <span className="badge m_small m_danger">취소</span>}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="m_num">
                    {o.all_canceled ? (
                      <span className="i_fee">-</span> /* 전체 취소 — 발송·배송비 없음 */
                    ) : (
                      <>
                        <span className="i_fee">기본 {o.shipping_fee.toLocaleString()}원</span>
                        {o.remote_extra_fee > 0 && <span className="i_fee">도서산간 +{o.remote_extra_fee.toLocaleString()}원</span>}
                      </>
                    )}
                  </td>
                  {tab !== "preparing" && (
                    <td>
                      <span className="i_carrier">{o.carrier ?? "-"}</span>
                      <span className="i_tracking">{o.tracking_number ?? "-"}</span>
                    </td>
                  )}
                  {tab === "preparing" && (
                    <td>
                      {/* 전체 취소된 서브주문은 발송 유도 자체를 제거 (유령 발송 방지) */}
                      {!o.all_canceled && (
                        <button className="btn m_small m_primary" type="button"
                          onClick={() => { setShipping(o); setCarrier(""); setTracking(""); setFormError(null); }}>배송 시작</button>
                      )}
                    </td>
                  )}
                  {tab === "shipping" && (
                    <td>
                      {!o.all_canceled && (
                        <button className="btn m_small m_primary" type="button"
                          onClick={() => setDelivering(o)}>배송 완료</button>
                      )}
                    </td>
                  )}
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
      {shipping && (
        <div className="modal_dialog" data-state="open" role="dialog" aria-modal="true" aria-labelledby="ship_title"
          onClick={(e) => { if (e.target === e.currentTarget && !submitting) closeModals(); }}>
          <div className="i_wrap">
            <div className="i_head">
              <h2 className="i_title" id="ship_title">배송 시작</h2>
              <button className="i_close" type="button" aria-label="닫기" disabled={submitting}
                onClick={closeModals}>✕</button>
            </div>
            <div className="i_body">
              <p className="i_text">택배사와 송장번호를 입력하면 이 주문이 배송중으로 전환되고 구매자에게 공개됩니다.</p>
              <dl className="i_summary">
                <div><dt>주문번호</dt><dd><strong>{shipping.order_no}</strong></dd></div>
                <div><dt>수령인</dt><dd>{shipping.recipient_name} ({shipping.recipient_phone})</dd></div>
              </dl>
              {formError && <div className="alert m_inline m_danger" role="alert">{formError}</div>}
              <label className="field">
                <span className="i_label">택배사</span>
                <input className="input_text" type="text" maxLength={50} ref={carrierRef}
                  placeholder="예: CJ대한통운" value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); trackingRef.current?.focus(); } }} />
              </label>
              <label className="field">
                <span className="i_label">송장번호</span>
                <input className="input_text" type="text" maxLength={50} ref={trackingRef}
                  placeholder="숫자·문자 그대로 입력 (1~50자)" value={tracking}
                  onChange={(e) => setTracking(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") submitShip(); }} />
              </label>
            </div>
            <div className="i_foot">
              <button className="btn" type="button" disabled={submitting} onClick={closeModals}>취소</button>
              <button className="btn m_primary" type="button" data-state={submitting ? "loading" : undefined}
                onClick={submitShip}>배송 시작</button>
            </div>
          </div>
        </div>
      )}
      {delivering && (
        <div className="modal_dialog" data-state="open" role="dialog" aria-modal="true" aria-labelledby="deliver_title"
          onClick={(e) => { if (e.target === e.currentTarget && !submitting) closeModals(); }}>
          <div className="i_wrap">
            <div className="i_head">
              <h2 className="i_title" id="deliver_title">배송 완료</h2>
              <button className="i_close" type="button" aria-label="닫기" disabled={submitting}
                onClick={closeModals}>✕</button>
            </div>
            <div className="i_body">
              <p className="i_text">아래 주문을 배송 완료 처리합니다. 처리 후에는 되돌릴 수 없습니다.</p>
              <dl className="i_summary">
                <div><dt>주문번호</dt><dd><strong>{delivering.order_no}</strong></dd></div>
                <div><dt>수령인</dt><dd>{delivering.recipient_name}</dd></div>
                <div><dt>송장</dt><dd>{delivering.carrier ?? "-"} {delivering.tracking_number ?? ""}</dd></div>
              </dl>
            </div>
            <div className="i_foot">
              <button className="btn" type="button" disabled={submitting} onClick={closeModals}>취소</button>
              <button className="btn m_primary" type="button" ref={deliverBtnRef}
                data-state={submitting ? "loading" : undefined}
                onClick={submitDeliver}>배송 완료</button>
            </div>
          </div>
        </div>
      )}
      </div>
    </ConsoleShell>
  );
}

export default function SellerOrders() {
  // useSearchParams는 프리렌더 시 Suspense 경계가 필요 (Next 16 규약)
  return (
    <Suspense
      fallback={
        <ConsoleShell role="seller" title="주문 관리">
          <div className="page_seller_orders"><p className="p_loading" role="status">불러오는 중…</p></div>
        </ConsoleShell>
      }
    >
      <SellerOrdersInner />
    </Suspense>
  );
}
