"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import ConsoleShell from "@/app/(console)/console-shell";
import { STATUS_LABEL, statusBadgeClass, statusLabel } from "../status";
import "./detail.css";

type Cancellation = {
  cancellation_id: string;
  reason: string;
  responsibility: "buyer" | "seller" | "admin";
  canceled_at: string;
  refunded_at: string | null;
};

type LineView = {
  order_item_id: string;
  product_name: string;
  option_text: string;
  unit_price: number;
  extra_price: number;
  quantity: number;
  line_total: number;
  status: "ordered" | "canceled";
  cancellation: Cancellation | null;
};

type SubView = {
  sub_order_id: string;
  brand_name: string;
  display_status: string;
  carrier: string | null;
  tracking_number: string | null;
  shipping_fee: number;
  remote_extra_fee: number;
  items: LineView[];
};

type OrderEvent = {
  created_at: string;
  entity_type: string;
  from_status: string | null;
  to_status: string;
  actor_role: string;
  note: string;
};

// 입금대기일 때만 내려온다 — grand_total은 활성 라인 기준(부분 취소 후 과입금 방지)
type DepositInfo = {
  grand_total: number;
  deposit_account: string | null;
  deposit_due_at: string;
  expired: boolean;
};

type OrderDetail = {
  order_id: string;
  order_no: string;
  created_at: string;
  display_status: string;
  buyer_name: string; // "(알 수 없는 사용자)"로 올 수 있음 — 일반 텍스트라 스타일 영향 없음
  buyer_email: string;
  recipient_name: string;
  recipient_phone: string;
  postal_code: string;
  address1: string;
  address2: string;
  order_note: string;
  sub_orders: SubView[];
  item_total: number;
  shipping_total: number; // 도서산간 추가비를 포함한 값 — 화면에서 remote_total만큼 쪼개 표시한다
  remote_total: number;
  grand_total: number;
  deposit_info: DepositInfo | null;
  events: OrderEvent[];
};

type Action =
  | { kind: "confirm_payment"; deposit: DepositInfo }
  | { kind: "cancel_order" }
  | { kind: "cancel_item"; sub: SubView; item: LineView }
  | { kind: "ship"; sub: SubView }
  | { kind: "deliver"; sub: SubView }
  | { kind: "refunded"; item: LineView; cancellation: Cancellation };

const RESP_LABEL: Record<string, string> = { buyer: "구매자 귀책", seller: "판매자 귀책", admin: "운영자 귀책" };
const ROLE_LABEL: Record<string, string> = { buyer: "구매자", seller: "판매자", admin: "관리자", system: "시스템" };
const ENTITY_LABEL: Record<string, string> = { order: "주문", sub_order: "판매자 묶음", order_item: "품목" };
// 타임라인은 표시 상태 외에 내부 상태(pending_payment 등)도 지나간다 — 표기만 보강
type Ledger = {
  payments: { id: string; method: string; status: string; amount: number; provider_tid: string; paid_at: string | null }[];
  refunds: { id: string; amount: number; reason: string; status: string; note: string; refunded_at: string | null }[];
  paid_total: number;
  refunded_total: number;
  net_total: number;
};

const REFUND_REASON_LABEL: Record<string, string> = {
  order_cancel: "주문 취소", item_cancel: "품목 취소", return: "반품", etc: "기타",
};

const EVENT_STATUS: Record<string, string> = { ...STATUS_LABEL, pending_payment: "입금대기", paid: "결제완료", ordered: "주문" };
// 표준 UUID — 하이픈 위치·hex 검증, 대소문자 허용 (소문자 정규화는 BFF가 담당)
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function eventStatusLabel(s: string | null) {
  if (s === null) return "생성";
  return EVENT_STATUS[s] ?? s;
}

function formatDateTime(s: string) {
  // 판매자·입금 확인 화면과 대사 시 시간 불일치 방지 — KST 고정
  return new Date(s).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Seoul" });
}

function shortUuid(id: string) {
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

export default function AdminOrderDetail() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === "string" ? params.id : "";
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  // 거래 원장은 별도 조회 — 실패해도 주문 상세는 보여야 한다(원장은 부가 정보)
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [reason, setReason] = useState("");
  const [responsibility, setResponsibility] = useState<"buyer" | "seller" | "admin">("admin");
  const [note, setNote] = useState("");
  const [carrier, setCarrier] = useState("");
  const [tracking, setTracking] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadSeq = useRef(0); // 요청 세대 카운터 — 재조회 연타 시 늦은 응답 폐기
  const reasonRef = useRef<HTMLTextAreaElement | null>(null);
  const carrierRef = useRef<HTMLInputElement | null>(null);
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);

  function showNotice(msg: string) {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 5000); // 성공 토스트 5초 후 자동 소멸
  }

  // keepAlerts: 처리 직후 재조회 — 방금 띄운 토스트·에러 메시지를 지우지 않는다
  const load = useCallback(async (opts?: { keepAlerts?: boolean }) => {
    if (!UUID_RE.test(id)) {
      setLoading(false);
      return void setError("올바르지 않은 주문 주소입니다.");
    }
    const gen = ++loadSeq.current;
    if (!opts?.keepAlerts) {
      setError(null);
      setNotice(null);
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    }
    try {
      const res = await fetch(`/api/admin/orders/${id}`);
      void fetch(`/api/admin/orders/${id}?view=ledger`)
        .then(async (r) => setLedger(r.ok ? await r.json() : null))
        .catch(() => setLedger(null));
      if (gen !== loadSeq.current) return; // 더 최신 요청이 있음 — 이 응답은 폐기
      if (res.status === 401) return void router.replace("/login");
      if (res.status === 403) return void router.replace("/no-role"); // R7: FastAPI 판정 결과를 따른다
      if (res.status === 404) return void setError("주문을 찾을 수 없습니다.");
      if (!res.ok) return void setError("주문을 불러오지 못했습니다. 새로고침해 주세요.");
      const data: OrderDetail = await res.json();
      if (gen !== loadSeq.current) return;
      setDetail(data);
    } catch {
      if (gen === loadSeq.current) setError("네트워크 연결을 확인해 주세요.");
    } finally {
      if (gen === loadSeq.current) setLoading(false);
    }
  }, [id, router]);

  // 초기 로드 — 로더 호출을 effect 안 async 함수로 감싼다(React 데이터 페칭 관례).
  useEffect(() => {
    void (async () => { await load(); })();
  }, [load]);

  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
  }, []);

  // 모달 열림 — 초기 포커스 + ESC 닫기(제출 중 제외)
  useEffect(() => {
    if (!action) return;
    if (action.kind === "cancel_order" || action.kind === "cancel_item") reasonRef.current?.focus();
    else if (action.kind === "ship") carrierRef.current?.focus();
    else confirmBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) closeModal();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [action, submitting]);

  function openAction(a: Action) {
    setAction(a);
    setReason("");
    setResponsibility("admin");
    setNote("");
    setCarrier("");
    setTracking("");
    setFormError(null);
  }

  function closeModal() {
    setAction(null);
    setFormError(null);
  }

  async function copyOrderId() {
    if (!detail) return;
    try {
      await navigator.clipboard.writeText(detail.order_id);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // 클립보드 미지원 환경 — 수동 복사 폴백
      window.prompt("아래 주문 ID를 직접 복사해 주세요.", detail.order_id);
    }
  }

  /** 액션 공통 제출 — 성공 시 토스트 + 상세 재조회, 422·409·404는 메시지 표시 후 재조회 */
  async function submitAction(payload: Record<string, unknown>, successMsg: string) {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/orders/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.status === 401) return void router.replace("/login");
      if (res.status === 403) return void router.replace("/no-role");
      if (res.ok) {
        showNotice(successMsg);
        closeModal();
        load({ keepAlerts: true });
        return;
      }
      const data = await res.json().catch(() => null);
      setError(data?.message ?? "처리에 실패했습니다.");
      if (res.status === 422 || res.status === 409 || res.status === 404) {
        // 상태가 이미 바뀜(invalid_transition)·중복 처리(duplicate_request)·삭제됨 — 메시지 유지한 채 재조회
        closeModal();
        load({ keepAlerts: true });
      }
    } catch {
      setError("네트워크 연결을 확인해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  function submitModal() {
    if (!action || !detail) return;
    if (action.kind === "cancel_order" || action.kind === "cancel_item") {
      const r = reason.trim();
      if (!r || r.length > 500) return void setFormError("취소 사유를 1~500자로 입력해 주세요.");
      setFormError(null);
      const common = { reason: r, responsibility, note: note.trim() || undefined };
      if (action.kind === "cancel_order") {
        submitAction({ action: "cancel_order", order_id: detail.order_id, ...common },
          `주문 ${detail.order_no} 전체 취소 처리되었습니다.`);
      } else {
        submitAction({ action: "cancel_item", order_item_id: action.item.order_item_id, ...common },
          `${action.item.product_name} 품목을 취소 처리했습니다.`);
      }
      return;
    }
    if (action.kind === "ship") {
      const c = carrier.trim();
      const t = tracking.trim();
      // 송장 필수 가드(서버 전이표)와 동일 — 빈 값 제출은 422만 유도하므로 클라에서 차단
      if (!c || c.length > 50 || !t || t.length > 50) {
        return void setFormError("택배사와 송장번호를 각각 1~50자로 입력해 주세요.");
      }
      setFormError(null);
      submitAction({
        action: "sub_transition", sub_order_id: action.sub.sub_order_id, to_status: "shipping",
        carrier: c, tracking_number: t, note: note.trim() || undefined,
      }, `${action.sub.brand_name} 묶음을 배송중 처리했습니다.`);
      return;
    }
    if (action.kind === "deliver") {
      submitAction({
        action: "sub_transition", sub_order_id: action.sub.sub_order_id, to_status: "delivered",
        note: note.trim() || undefined,
      }, `${action.sub.brand_name} 묶음을 배송완료 처리했습니다.`);
      return;
    }
    if (action.kind === "confirm_payment") {
      submitAction({
        action: "confirm_payment", order_id: detail.order_id,
        expected_grand_total: action.deposit.grand_total, // 모달에 표시된 금액 그대로 — stale 금액 확인 방지
        note: note.trim() || undefined,
      }, "입금 확인 완료 — 배송준비로 전환됐습니다. 이후 발송은 판매자가 진행합니다.");
      return;
    }
    submitAction({ action: "mark_refunded", cancellation_id: action.cancellation.cancellation_id },
      `${action.item.product_name} 환불 완료 처리했습니다.`);
  }

  const modalTitle = action === null ? "" : {
    confirm_payment: "입금 확인",
    cancel_order: "주문 전체 취소",
    cancel_item: "품목 취소",
    ship: "배송중 처리",
    deliver: "배송완료 처리",
    refunded: "환불 완료 처리",
  }[action.kind];

  return (
    <ConsoleShell role="admin" title="주문 상세">
      <div className="page_admin_order_detail">
      <Link className="p_back" href="/admin/orders"><span aria-hidden="true">←</span> 주문 관리로</Link>
      {notice && <div className="alert m_inline m_success" role="status">{notice}</div>}
      {error && <div className="alert m_inline m_danger" role="alert">{error}</div>}
      {loading && <p className="p_loading" role="status">불러오는 중…</p>}
      {!loading && detail && (
        <>
          <section className="card p_summary">
            <div className="i_head">
              <div className="i_ident">
                <div className="i_title_row">
                  <strong className="i_order_no">{detail.order_no}</strong>
                  <span className={statusBadgeClass(detail.display_status)}>{statusLabel(detail.display_status)}</span>
                </div>
                <button className="i_uuid" type="button" title="클릭하여 전체 주문 ID 복사" onClick={copyOrderId}>
                  {copied ? "복사됨" : shortUuid(detail.order_id)}
                </button>
              </div>
              {detail.display_status === "awaiting_payment" && (
                <div className="i_actions">
                  {/* 입금 확인은 주문 단위 액션 — 입금 확인 화면까지 가지 않고 여기서 바로 처리한다 */}
                  {detail.deposit_info && (
                    <button className="btn m_small m_primary" type="button"
                      onClick={() => openAction({ kind: "confirm_payment", deposit: detail.deposit_info! })}>
                      입금 확인
                    </button>
                  )}
                  <button className="btn m_small m_danger" type="button"
                    onClick={() => openAction({ kind: "cancel_order" })}>주문 전체 취소</button>
                </div>
              )}
            </div>
            <dl className="i_meta">
              <div><dt>주문 일시</dt><dd>{formatDateTime(detail.created_at)}</dd></div>
              <div><dt>주문자</dt><dd>{detail.buyer_name} ({detail.buyer_email})</dd></div>
            </dl>
          </section>

          <div className="i_work">
          {detail.sub_orders.map((sub) => (
            <section className="card p_sub" key={sub.sub_order_id}>
              <div className="i_head">
                <div className="i_brand_wrap">
                  <span className="i_sub_label">판매자 묶음</span>
                  <strong className="i_brand">{sub.brand_name}</strong>
                  <span className={statusBadgeClass(sub.display_status)}>{statusLabel(sub.display_status)}</span>
                </div>
                {(sub.carrier || sub.tracking_number) && (
                  <div className="i_head_side">
                    <span className="i_tracking">{sub.carrier ?? "-"} {sub.tracking_number ?? ""}</span>
                  </div>
                )}
              </div>
              <ul className="i_lines">
                {sub.items.map((line) => (
                  <li className="i_line" data-state={line.status === "canceled" ? "canceled" : undefined}
                    key={line.order_item_id}>
                    <div className="i_line_main">
                      <span className="i_line_name">{line.product_name}</span>
                      {line.option_text && <span className="i_line_option">{line.option_text}</span>}
                      <span className="i_line_qty">× {line.quantity}</span>
                      <span className="i_line_total">{line.line_total.toLocaleString()}원</span>
                      {line.status === "canceled" ? (
                        <span className="badge m_small m_danger">취소</span>
                      ) : (
                        <button className="btn m_small m_line_cancel" type="button"
                          onClick={() => openAction({ kind: "cancel_item", sub, item: line })}>품목 취소</button>
                      )}
                    </div>
                    {line.cancellation && (
                      <div className="i_cancel_info">
                        <span>사유: {line.cancellation.reason}</span>
                        <span>{RESP_LABEL[line.cancellation.responsibility] ?? line.cancellation.responsibility}</span>
                        <span>취소 {formatDateTime(line.cancellation.canceled_at)}</span>
                        {line.cancellation.refunded_at ? (
                          <span className="i_refunded">환불 완료 {formatDateTime(line.cancellation.refunded_at)}</span>
                        ) : (
                          <button className="btn m_small" type="button"
                            onClick={() => openAction({ kind: "refunded", item: line, cancellation: line.cancellation! })}>
                            환불 완료 처리
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              <div className="i_sub_foot">
                <div className="i_fees">
                  <span>배송비 {sub.shipping_fee.toLocaleString()}원</span>
                  {sub.remote_extra_fee > 0 && <span>도서산간 +{sub.remote_extra_fee.toLocaleString()}원</span>}
                </div>
                {sub.display_status === "preparing" && (
                  <button className="btn m_small m_primary i_sub_action" type="button"
                    onClick={() => openAction({ kind: "ship", sub })}>배송중 처리 →</button>
                )}
                {sub.display_status === "shipping" && (
                  <button className="btn m_small m_primary i_sub_action" type="button"
                    onClick={() => openAction({ kind: "deliver", sub })}>배송완료 처리 →</button>
                )}
              </div>
            </section>
          ))}
          </div>

          <aside className="i_aside">
            <section className="card p_address">
              <h2 className="i_title">배송지</h2>
              <dl className="i_meta">
                <div><dt>수령인</dt><dd>{detail.recipient_name} ({detail.recipient_phone})</dd></div>
                <div><dt>주소</dt><dd>[{detail.postal_code}] {detail.address1} {detail.address2}</dd></div>
                {detail.order_note && <div><dt>요청사항</dt><dd>{detail.order_note}</dd></div>}
              </dl>
            </section>

            <section className="card p_payment">
              <h2 className="i_title">결제 정보</h2>
              <dl className="i_meta">
                <div><dt>결제수단</dt><dd>무통장입금</dd></div>
                {detail.deposit_info ? (
                  <>
                    <div><dt>입금계좌</dt><dd>{detail.deposit_info.deposit_account || "미설정 — 설정 화면에서 등록"}</dd></div>
                    <div><dt>입금기한</dt><dd>{formatDateTime(detail.deposit_info.deposit_due_at)}</dd></div>
                    <div><dt>확인 금액</dt><dd><strong>{detail.deposit_info.grand_total.toLocaleString()}원</strong></dd></div>
                  </>
                ) : (
                  <div><dt>입금상태</dt><dd>입금 확인됨</dd></div>
                )}
              </dl>
              {detail.deposit_info?.expired && (
                <p className="i_note" role="status">입금기한이 지났습니다 — 자동취소 대상입니다.</p>
              )}
              {/* 거래 원장 — 받은 돈과 돌려준 돈. PG 연동 후에는 승인번호가 함께 보인다 */}
              {ledger && ledger.payments.length > 0 && (
                <dl className="i_meta i_ledger">
                  <div><dt>받은 금액</dt><dd><strong>{ledger.paid_total.toLocaleString()}원</strong></dd></div>
                  {ledger.refunded_total > 0 && (
                    <>
                      <div><dt>환불 금액</dt><dd>{ledger.refunded_total.toLocaleString()}원</dd></div>
                      <div><dt>실수령</dt><dd><strong>{ledger.net_total.toLocaleString()}원</strong></dd></div>
                    </>
                  )}
                  {ledger.refunds.map((r) => (
                    <div key={r.id}>
                      <dt>환불 내역</dt>
                      <dd>
                        {r.amount.toLocaleString()}원 · {REFUND_REASON_LABEL[r.reason] ?? r.reason}
                        {r.refunded_at ? ` · ${formatDateTime(r.refunded_at)}` : ""}
                        {r.note ? ` · ${r.note}` : ""}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>

            <section className="card p_amounts">
              <h2 className="i_title">금액 요약</h2>
              <dl className="i_rows">
                <div><dt>상품 금액</dt><dd>{detail.item_total.toLocaleString()}원</dd></div>
                {/* 배송비 = shipping_total − remote_total. 쪼개기 기준은 서버가 정한다(remote_total) */}
                <div><dt>배송비</dt><dd>{(detail.shipping_total - detail.remote_total).toLocaleString()}원</dd></div>
                {detail.remote_total > 0 && (
                  <div><dt>도서산간 추가</dt><dd>{detail.remote_total.toLocaleString()}원</dd></div>
                )}
                <div className="m_total"><dt>총 결제 금액</dt><dd>{detail.grand_total.toLocaleString()}원</dd></div>
              </dl>
            </section>
          </aside>

          <section className="card p_timeline">
            <h2 className="i_title">타임라인</h2>
            {detail.events.length === 0 ? (
              <p className="i_empty">기록된 이벤트가 없습니다.</p>
            ) : (
              <ol className="i_events">
                {detail.events.map((e, idx) => (
                  <li className="i_event" key={idx}>
                    <span className="i_event_time">{formatDateTime(e.created_at)}</span>
                    <span className="badge m_small">{ENTITY_LABEL[e.entity_type] ?? e.entity_type}</span>
                    <span className="i_event_move">{eventStatusLabel(e.from_status)} → {eventStatusLabel(e.to_status)}</span>
                    <span className="i_event_actor">{ROLE_LABEL[e.actor_role] ?? e.actor_role}</span>
                    {e.note && <span className="i_event_note">{e.note}</span>}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}
      {action && detail && (
        <div className="modal_dialog" data-state="open" role="dialog" aria-modal="true" aria-labelledby="admin_action_title"
          onClick={(e) => { if (e.target === e.currentTarget && !submitting) closeModal(); }}>
          <div className="i_wrap">
            <div className="i_head">
              <h2 className="i_title" id="admin_action_title">{modalTitle}</h2>
              <button className="i_close" type="button" aria-label="닫기" disabled={submitting}
                onClick={closeModal}>✕</button>
            </div>
            <div className="i_body">
              {action.kind === "confirm_payment" && (
                <p className="i_text">
                  통장에 <strong>{action.deposit.grand_total.toLocaleString()}원</strong>이 실제로 들어왔는지 확인한 뒤 눌러 주세요.
                  주문 상태가 <strong>배송준비</strong>로 바뀌고, 이후 발송은 판매자가 진행합니다.
                  {action.deposit.expired && " 입금기한이 지난 주문입니다."}
                </p>
              )}
              {action.kind === "cancel_order" && (
                <p className="i_text">주문의 모든 활성 품목을 취소하고 주문을 취소 상태로 전환합니다. 처리 후에는 되돌릴 수 없습니다.</p>
              )}
              {action.kind === "cancel_item" && (
                <p className="i_text">아래 품목을 취소합니다. 배송 상태와 무관하게 처리되며, 되돌릴 수 없습니다.</p>
              )}
              {action.kind === "ship" && (
                <p className="i_text">이 묶음을 배송중으로 강제 전환합니다. 택배사와 송장번호는 필수입니다.</p>
              )}
              {action.kind === "deliver" && (
                <p className="i_text">이 묶음을 배송완료로 강제 전환합니다. 처리 후에는 되돌릴 수 없습니다.</p>
              )}
              {action.kind === "refunded" && (
                <p className="i_text">무통장입금이라 실제 환불은 <strong>구매자 계좌로 직접 송금</strong>합니다. 송금을 마친 뒤 눌러 환불 완료를 기록하세요. 이미 처리된 건은 중복되지 않습니다.</p>
              )}
              <dl className="i_summary">
                <div><dt>주문번호</dt><dd><strong>{detail.order_no}</strong></dd></div>
                {(action.kind === "cancel_item" || action.kind === "refunded") && (
                  <div><dt>상품</dt><dd>{action.item.product_name}{action.item.option_text && ` (${action.item.option_text})`} × {action.item.quantity}</dd></div>
                )}
                {(action.kind === "ship" || action.kind === "deliver") && (
                  <div><dt>브랜드</dt><dd>{action.sub.brand_name}</dd></div>
                )}
                {action.kind === "deliver" && (
                  <div><dt>송장</dt><dd>{action.sub.carrier ?? "-"} {action.sub.tracking_number ?? ""}</dd></div>
                )}
                {action.kind === "refunded" && (
                  <div><dt>취소 사유</dt><dd>{action.cancellation.reason}</dd></div>
                )}
                {action.kind === "confirm_payment" && (
                  <>
                    <div><dt>확인 금액</dt><dd><strong>{action.deposit.grand_total.toLocaleString()}원</strong></dd></div>
                    <div><dt>입금기한</dt><dd>{formatDateTime(action.deposit.deposit_due_at)}</dd></div>
                  </>
                )}
              </dl>
              {formError && <div className="alert m_inline m_danger" role="alert">{formError}</div>}
              {(action.kind === "cancel_order" || action.kind === "cancel_item") && (
                <>
                  <label className="field">
                    <span className="i_label">취소 사유 (필수)</span>
                    <textarea className="input_text m_textarea" rows={2} maxLength={500} ref={reasonRef}
                      placeholder="구매자·판매자에게 남는 기록입니다 (1~500자)"
                      value={reason} onChange={(e) => setReason(e.target.value)} />
                  </label>
                  <label className="field">
                    <span className="i_label">귀책</span>
                    <select className="input_text" value={responsibility}
                      onChange={(e) => setResponsibility(e.target.value as "buyer" | "seller" | "admin")}>
                      <option value="admin">운영자 귀책</option>
                      <option value="buyer">구매자 귀책</option>
                      <option value="seller">판매자 귀책</option>
                    </select>
                  </label>
                </>
              )}
              {action.kind === "ship" && (
                <>
                  <label className="field">
                    <span className="i_label">택배사 (필수)</span>
                    <input className="input_text" type="text" maxLength={50} ref={carrierRef}
                      placeholder="예: CJ대한통운" value={carrier} onChange={(e) => setCarrier(e.target.value)} />
                  </label>
                  <label className="field">
                    <span className="i_label">송장번호 (필수)</span>
                    <input className="input_text" type="text" maxLength={50}
                      placeholder="숫자·문자 그대로 입력 (1~50자)" value={tracking}
                      onChange={(e) => setTracking(e.target.value)} />
                  </label>
                </>
              )}
              {action.kind !== "refunded" && (
                <label className="field">
                  <span className="i_label">메모 (선택)</span>
                  <textarea className="input_text m_textarea" rows={2} maxLength={500}
                    placeholder="개입 이유 등 내부 기록 (500자 이내)"
                    value={note} onChange={(e) => setNote(e.target.value)} />
                </label>
              )}
            </div>
            <div className="i_foot">
              <button className="btn" type="button" disabled={submitting} onClick={closeModal}>취소</button>
              <button
                className={`btn ${action.kind === "cancel_order" || action.kind === "cancel_item" ? "m_danger" : "m_primary"}`}
                type="button" ref={confirmBtnRef} data-state={submitting ? "loading" : undefined}
                disabled={action.kind === "ship" && (!carrier.trim() || !tracking.trim())}
                onClick={submitModal}>{modalTitle}</button>
            </div>
          </div>
        </div>
      )}
      </div>
    </ConsoleShell>
  );
}
