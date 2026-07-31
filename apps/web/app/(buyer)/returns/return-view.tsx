"use client";

/* 반품·교환 — 신청 폼 + 내 신청 내역.

   기한 판정(변심 7일 / 하자·오배송 30일)은 **서버가 한다**. 화면은 서버가 거부하면 그 문구를
   그대로 보여준다 — 여기서 날짜를 계산하면 서버와 갈린다.

   신청 대상은 주문 상세에서 넘어온 판매자 묶음 하나다(회수가 판매자별로 일어난다). */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

type ReturnItem = { order_item_id: string; product_name: string; option_text: string; quantity: number };
type ReturnRow = {
  id: string;
  kind: string;
  reason: string;
  detail: string;
  status: string;
  admin_note: string;
  refund_amount: number;
  requested_at: string;
  items: ReturnItem[];
};

type OrderLine = { order_item_id?: string; product_name: string; option_text: string; quantity: number; status: string };

const KINDS = [
  { value: "return", label: "반품 (환불)" },
  { value: "exchange", label: "교환 (재발송)" },
];
const REASONS = [
  { value: "change_of_mind", label: "단순 변심", hint: "배송 완료 후 7일 이내" },
  { value: "defect", label: "상품 하자", hint: "배송 완료 후 30일 이내" },
  { value: "wrong_delivery", label: "오배송", hint: "배송 완료 후 30일 이내" },
  { value: "etc", label: "기타", hint: "배송 완료 후 7일 이내" },
];
const KIND_LABEL: Record<string, string> = { return: "반품", exchange: "교환" };
const REASON_LABEL: Record<string, string> = Object.fromEntries(REASONS.map((r) => [r.value, r.label]));
const STATUS_LABEL: Record<string, string> = {
  requested: "접수됨", approved: "승인 — 회수 중", rejected: "거부됨", completed: "처리 완료",
};

function formatDateTime(s: string) {
  return new Date(s).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Seoul" });
}

export default function ReturnView() {
  const router = useRouter();
  const params = useSearchParams();
  const subOrderId = params.get("sub_order_id") ?? "";

  const [rows, setRows] = useState<ReturnRow[] | null>(null);
  const [lines, setLines] = useState<OrderLine[] | null>(null);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [kind, setKind] = useState("return");
  const [reason, setReason] = useState("change_of_mind");
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadMine = useCallback(async () => {
    try {
      const res = await fetch("/api/returns");
      if (res.status === 401) return void router.replace("/login?next=/returns");
      setRows(res.ok ? (await res.json()).items ?? [] : []);
    } catch {
      setRows([]);
    }
  }, [router]);

  // 신청 대상 묶음의 품목 — 주문 상세에서 가져온다(별도 API를 만들지 않는다)
  const loadLines = useCallback(async () => {
    if (!subOrderId) return void setLines([]);
    const orderId = params.get("order_id") ?? "";
    if (!orderId) return void setLines([]);
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      if (res.status === 401) return void router.replace("/login?next=/returns");
      if (!res.ok) return void setLines([]);
      const order = await res.json();
      const sub = (order.sub_orders ?? []).find((s: { sub_order_id: string }) => s.sub_order_id === subOrderId);
      setLines((sub?.items ?? []).filter((i: OrderLine) => i.status !== "canceled"));
    } catch {
      setLines([]);
    }
  }, [subOrderId, params, router]);

  useEffect(() => { void (async () => { await loadMine(); })(); }, [loadMine]);
  useEffect(() => { void (async () => { await loadLines(); })(); }, [loadLines]);
  useEffect(() => () => { if (noticeTimer.current) clearTimeout(noticeTimer.current); }, []);

  function toggle(line: OrderLine, on: boolean) {
    const id = line.order_item_id;
    if (!id) return;
    setPicked((prev) => {
      const next = { ...prev };
      if (on) next[id] = prev[id] ?? 1;
      else delete next[id];
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const items = Object.entries(picked).map(([order_item_id, quantity]) => ({ order_item_id, quantity }));
    if (items.length === 0) {
      setError("반품·교환할 상품을 선택해 주세요.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sub_order_id: subOrderId, kind, reason, detail: detail.trim(), items }),
      });
      if (res.status === 401) return void router.replace("/login?next=/returns");
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        // 기한 초과·수량 초과 등 서버 판정 문구를 그대로 보여준다
        setError(d?.details?.[0]?.reason ?? d?.message ?? "신청에 실패했습니다.");
        return;
      }
      setPicked({});
      setDetail("");
      setNotice("신청이 접수됐습니다. 운영자 확인 후 회수·환불이 진행됩니다.");
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
      noticeTimer.current = setTimeout(() => setNotice(null), 6000);
      await loadMine();
    } catch {
      setError("네트워크 연결을 확인해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  const selectable = (lines ?? []).filter((l) => l.order_item_id);

  return (
    <div className="mx-auto w-full max-w-[720px] px-5 py-10">
      <h1 className="text-[24px] font-semibold tracking-tight">반품 · 교환</h1>
      <p className="mt-2 text-[14px] text-muted-foreground">
        배송 완료 후 신청할 수 있습니다. 단순 변심은 7일, 상품 하자·오배송은 30일 이내입니다.
      </p>

      {notice && <p className="mt-5 border border-border bg-muted/40 px-4 py-3 text-[14px]" role="status">{notice}</p>}
      {error && <p className="mt-5 border border-accent/40 px-4 py-3 text-[14px] text-accent" role="alert">{error}</p>}

      {subOrderId ? (
        <form onSubmit={submit} className="mt-7 space-y-5 border-t border-border pt-7">
          <div className="space-y-1.5">
            <span className="block text-[13px] font-medium">신청할 상품</span>
            {lines === null ? (
              <p className="text-[14px] text-muted-foreground" role="status">불러오는 중…</p>
            ) : selectable.length === 0 ? (
              <p className="text-[14px] text-muted-foreground">
                신청할 수 있는 상품이 없습니다. <Link href="/orders" className="underline underline-offset-4">주문 내역</Link>에서 다시 선택해 주세요.
              </p>
            ) : (
              <ul className="divide-y divide-border border-y border-border">
                {selectable.map((l) => {
                  const id = l.order_item_id as string;
                  const on = id in picked;
                  return (
                    <li key={id} className="flex items-center gap-3 py-3">
                      <input type="checkbox" checked={on} onChange={(e) => toggle(l, e.target.checked)}
                        className="h-4 w-4 accent-black" aria-label={`${l.product_name} 선택`} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px]">{l.product_name}</span>
                        <span className="block text-[13px] text-muted-foreground">
                          {l.option_text ? `${l.option_text} · ` : ""}주문 {l.quantity}개
                        </span>
                      </span>
                      {on && (
                        <input type="number" min={1} max={l.quantity} value={picked[id]}
                          aria-label={`${l.product_name} 수량`}
                          onChange={(e) => setPicked((p) => ({ ...p, [id]: Number(e.target.value) }))}
                          className="h-9 w-20 border border-border bg-background px-2 text-right text-[14px] tabular-nums" />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="ret_kind" className="block text-[13px] font-medium">신청 유형</label>
            <select id="ret_kind" value={kind} onChange={(e) => setKind(e.target.value)}
              className="h-11 w-full border border-border bg-background px-3 text-[14px]">
              {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="ret_reason" className="block text-[13px] font-medium">사유</label>
            <select id="ret_reason" value={reason} onChange={(e) => setReason(e.target.value)}
              className="h-11 w-full border border-border bg-background px-3 text-[14px]">
              {REASONS.map((r) => <option key={r.value} value={r.value}>{r.label} — {r.hint}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="ret_detail" className="block text-[13px] font-medium">상세 내용</label>
            <textarea id="ret_detail" rows={4} maxLength={1000} value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="하자라면 어느 부분인지 적어 주시면 처리가 빨라집니다."
              className="w-full border border-border bg-background p-3 text-[14px]" />
          </div>

          <button type="submit" disabled={busy}
            className="h-11 w-full bg-foreground text-[14px] font-medium text-background disabled:opacity-50">
            {busy ? "접수 중…" : "신청하기"}
          </button>
        </form>
      ) : (
        <p className="mt-7 border-t border-border pt-7 text-[14px] text-muted-foreground">
          신청은 <Link href="/orders" className="underline underline-offset-4">주문 내역</Link>의 배송 완료된 주문에서 시작할 수 있습니다.
        </p>
      )}

      <section className="mt-12">
        <h2 className="text-[15px] font-semibold">내 신청 내역</h2>
        {rows === null ? (
          <p className="mt-4 text-[14px] text-muted-foreground" role="status">불러오는 중…</p>
        ) : rows.length === 0 ? (
          <p className="mt-4 text-[14px] text-muted-foreground">신청 내역이 없습니다.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border border-y border-border">
            {rows.map((r) => (
              <li key={r.id} className="py-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="border border-border px-2 py-0.5 text-[12px] text-muted-foreground">
                    {KIND_LABEL[r.kind] ?? r.kind}
                  </span>
                  <span className="text-[12px] text-muted-foreground">{formatDateTime(r.requested_at)}</span>
                  <span className={`ml-auto text-[12px] ${r.status === "rejected" ? "text-accent" : "text-muted-foreground"}`}>
                    {STATUS_LABEL[r.status] ?? r.status}
                  </span>
                </div>
                <p className="mt-2 text-[15px]">
                  {r.items.map((i) => `${i.product_name} × ${i.quantity}`).join(", ")}
                </p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  사유: {REASON_LABEL[r.reason] ?? r.reason}
                  {r.detail ? ` · ${r.detail}` : ""}
                </p>
                {r.status === "completed" && (
                  <p className="mt-2 text-[14px]">환불 금액 <b className="tabular-nums">{r.refund_amount.toLocaleString()}원</b></p>
                )}
                {r.admin_note && (
                  <div className="mt-3 border-l-2 border-foreground/70 bg-muted/40 px-4 py-3">
                    <p className="text-[12px] text-muted-foreground">운영자 안내</p>
                    <p className="mt-1 whitespace-pre-wrap text-[14px]">{r.admin_note}</p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
