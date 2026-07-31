"use client";

/* 주문상세 본체 — **새 테마 판**. order-detail-view + order-pack의 로직 그대로, 마크업만 교체.

   · 순서: 주문번호 → **입금 안내(있으면)** → 주문 상품(판매자별) → 배송 정보 → 결제 정보 → 취소 안내.
     🚨 입금 상자는 최상단이다 — 다시 들어온 사람이 "얼마를 어디로 넣는가"를 스크롤 없이 봐야 한다.
     🚨 상자 분기는 **deposit_info 객체의 존재로만** 한다(display_status로 분기하면 부분 취소·
        관리자 개입이 만든 경계에서 상자가 잘못 뜬다).
   · 🚨 주문 **전체**에 걸리는 상태·진행바·전체 취소 버튼을 만들지 않는다 (FR-15·18).
        취소는 **판매자 묶음 단위**이고, 가능 판정은 응답의 `cancellable` 한 필드뿐이다 (AD-12).
   · 🚨 취소는 되돌릴 수 없다 — 인라인 확인 줄을 거친다. 취소된 묶음에는 버튼도 안내도 두지 않는다
        (헤더의 `취소` 라벨이 이미 다 말했다).
   · 🚨 결제 정보는 3행이다. 도서산간 줄을 만들지 않는다 — 응답에 분리 필드가 없다.
   · 배송 정보 값은 전부 **주문 시점 스냅샷**이다 (AD-7) — 지금의 배송지가 아니다. */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import DepositBoxThemed from "../../deposit-box-themed";
import { type ApiFailure } from "../../buyer-feedback";
import { formatOrderDateTime, formatPhone, formatWon } from "../../format";
import { cancelSubOrder, getOrder, isUuid, type OrderDetailResponse } from "../../orders-api";
import { orderStatusView } from "../order-status";

const NOT_FOUND = "주문을 찾을 수 없습니다.";
const CANCEL_NOTICE = "배송준비 전까지 판매자 묶음 단위로 취소할 수 있습니다.";
const PAY_METHOD = "무통장입금"; // API가 주지 않는 화면 고정 텍스트
const BLANK = "—";
const ASK = "이 묶음을 취소할까요?";
const CANCEL_LABEL = "주문 취소";
const NO_CANCEL = "배송준비 이후에는 취소할 수 없습니다.";
const FREE_SHIPPING = "무료배송";
const TRACKING_LABEL = "운송장";
const CANCELED_STATUS = "canceled";
const DELIVERED_STATUS = "delivered";
// 배송 완료 후에는 취소가 아니라 반품·교환이다 — 경로를 섞지 않는다(기한 판정은 서버 몫).
const RETURN_LABEL = "반품 · 교환 신청";

const TONE_CLASS: Record<string, string> = {
  waiting: "border-accent text-accent",
  moving: "border-border text-foreground",
  finished: "border-border text-muted-foreground",
};

function OrdersLink() {
  return (
    <Link href="/orders" className="inline-block border border-foreground px-6 py-3 text-[13px] font-medium">
      주문내역 보기
    </Link>
  );
}

function KvRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-6 border-b border-border py-3.5 last:border-b-0">
      <dt className="w-24 flex-none text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 break-words">{value || BLANK}</dd>
    </div>
  );
}

export default function DetailScreen() {
  const { id: orderId } = useParams<{ id: string }>();
  const router = useRouter();
  const valid = isUuid(orderId);

  const [result, setResult] = useState<{ data: OrderDetailResponse | null; error: ApiFailure | null } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [packError, setPackError] = useState<{ subOrderId: string; message: string; notFound: boolean } | null>(null);

  const toLogin = useCallback(
    () => router.replace(`/login?next=${encodeURIComponent(`/orders/${orderId}`)}`),
    [router, orderId],
  );

  useEffect(() => {
    if (!valid) return;
    let alive = true;
    void (async () => {
      const r = await getOrder(orderId);
      if (!alive) return;
      if (!r.ok && r.error.code === "unauthorized") {
        toLogin();
        return;
      }
      setResult(r.ok ? { data: r.data, error: null } : { data: null, error: r.error });
    })();
    return () => {
      alive = false;
    };
  }, [orderId, valid, reloadKey, toLogin]);

  /* 조용한 재조회 — 골격으로 되돌아가지 않고 스크롤이 튀지 않는다 */
  const refetch = useCallback(async () => {
    const r = await getOrder(orderId);
    if (!r.ok) {
      if (r.error.code === "unauthorized") toLogin();
      return;
    }
    setResult({ data: r.data, error: null });
  }, [orderId, toLogin]);

  const retry = useCallback(() => {
    setResult(null);
    setReloadKey((n) => n + 1);
  }, []);

  /* 🚨 되돌릴 수 없는 동작이다 — 재고가 복원되고 취소 기록이 남으며 재취소는 거부된다. */
  const onConfirm = useCallback(
    (id: string) => {
      if (pendingId !== null) return; // 중복 제출 차단
      setPendingId(id);
      setPackError(null);
      void (async () => {
        const r = await cancelSubOrder(id);
        setPendingId(null);
        if (r.ok) {
          setConfirmId(null);
          await refetch(); // 응답에 갱신된 주문이 없다 — 재조회가 필수다
          return;
        }
        if (r.error.code === "unauthorized") {
          toLogin();
          return;
        }
        if (r.error.code === "invalid_transition") {
          /* 화면이 낡았다는 신호 — 다른 탭에서 관리자가 입금을 확인했거나 판매자가 배송을 시작했다.
             문장을 남긴 채 서버 값으로 상태를 정정한다. */
          setConfirmId(null);
          setPackError({ subOrderId: id, message: r.error.message, notFound: false });
          await refetch();
          return;
        }
        if (r.error.code === "not_found") {
          setConfirmId(null);
          setPackError({ subOrderId: id, message: NOT_FOUND, notFound: true });
          return;
        }
        // 네트워크·그 밖 — 서버 상태를 바꾸지 못했으므로 재조회하지 않는다. 확인 줄은 열린 채로 둔다.
        setPackError({ subOrderId: id, message: r.error.message, notFound: false });
      })();
    },
    [pendingId, refetch, toLogin],
  );

  const wrap = "mx-auto w-full max-w-[900px] px-5 pb-20";

  if (!valid) {
    return (
      <div className={`${wrap} py-24 text-center`}>
        <p className="text-[16px] text-muted-foreground">{NOT_FOUND}</p>
        <div className="mt-7"><OrdersLink /></div>
      </div>
    );
  }

  if (result === null) {
    return (
      <div className={wrap} aria-hidden="true">
        <div className="h-4 w-28 animate-pulse bg-muted" />
        <div className="mt-8 h-48 w-full animate-pulse bg-muted" />
      </div>
    );
  }

  if (result.error || !result.data) {
    const notFound = result.error?.code === "not_found";
    return (
      <div className={`${wrap} py-24 text-center`}>
        <p className="text-[16px] text-muted-foreground">{notFound ? NOT_FOUND : result.error?.message}</p>
        <div className="mt-7">
          {notFound ? (
            <OrdersLink />
          ) : (
            <button type="button" onClick={retry} className="border border-foreground px-10 py-4 text-[14px] font-semibold uppercase">
              다시 시도
            </button>
          )}
        </div>
      </div>
    );
  }

  const order = result.data;
  const deposit = order.deposit_info;
  const address = [order.address1, order.address2].filter(Boolean).join(" ");

  return (
    <div className={wrap}>
      <div className="border-b border-border pb-6">
        {/* 🚨 order_no를 그대로 쓴다 — 클라 가공 금지 */}
        <p className="text-[13px] tracking-wide text-muted-foreground">{order.order_no}</p>
        <p className="mt-1 text-[14px]">{formatOrderDateTime(order.created_at)}</p>
      </div>

      {/* 🚨 deposit_info 존재로만 분기. 위치는 최상단이다 (UX-DR14). */}
      {deposit ? (
        <div className="mt-8">
          <DepositBoxThemed
            amount={deposit.grand_total}
            account={deposit.deposit_account}
            bank={deposit.deposit_bank}
            accountNo={deposit.deposit_account_no}
            holder={deposit.deposit_holder}
            dueAt={deposit.deposit_due_at}
            expired={deposit.expired}
          />
        </div>
      ) : null}

      <section aria-labelledby="od_h_items" className="mt-10">
        <h2 id="od_h_items" className="mb-5 text-[12px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          주문 상품 · 판매자별 {order.sub_orders.length}건
        </h2>

        {order.sub_orders.map((sub) => {
          const status = orderStatusView(sub.display_status);
          const canceled = sub.display_status === CANCELED_STATUS;
          const busy = pendingId === sub.sub_order_id;
          const confirming = confirmId === sub.sub_order_id;
          const err = packError?.subOrderId === sub.sub_order_id ? packError : null;
          /* 🚨 취소된 묶음도 원래 값이 그대로 내려오지만 합계에서는 빠져 있다 —
             취소선 없이 그리면 숫자가 맞지 않아 보인다. */
          const shipping = sub.shipping_fee + sub.remote_extra_fee;
          const tracking = sub.tracking_number
            ? [sub.carrier, sub.tracking_number].filter(Boolean).join(" ")
            : null;

          return (
            <div key={sub.sub_order_id} className="mb-8 border border-border p-6 last:mb-0">
              <div className="mb-4 flex items-center justify-between gap-3 border-b border-border pb-3">
                <p className="text-[15px] font-semibold uppercase tracking-wide">{sub.brand_name}</p>
                <span className={`border px-2 py-0.5 text-[12px] font-medium ${TONE_CLASS[status.tone] ?? TONE_CLASS.moving}`}>
                  <span className="sr-only">{sub.brand_name} 묶음 상태 </span>
                  {status.label}
                </span>
              </div>

              <div className="space-y-4">
                {/* 🚨 주문 라인 응답에는 이미지가 없다(주문 시점 스냅샷은 이름·옵션·금액뿐) —
                    사진 자리를 만들어 비워두지 않는다. 라인 단위 취소는 관리자 몫이라
                    라인의 status가 canceled면 그 줄만 취소선으로 표시한다 (AD-6). */}
                {sub.items.map((it, idx) => {
                  const lineCanceled = canceled || it.status === CANCELED_STATUS;
                  return (
                    <div key={`${it.product_name}-${idx}`} className="flex items-baseline justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-[15px] ${lineCanceled ? "text-muted-foreground line-through" : ""}`}>
                          {it.product_name}
                        </p>
                        <p className="mt-1 text-[13px] text-muted-foreground">
                          {it.option_text ? `${it.option_text} · ${it.quantity}개` : `${it.quantity}개`}
                        </p>
                      </div>
                      <p className={`flex-none text-[14px] font-semibold tabular-nums ${lineCanceled ? "text-muted-foreground line-through" : ""}`}>
                        {formatWon(it.line_total)}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 border-t border-border pt-4">
                {tracking ? (
                  <p className="mb-3 text-[13px]">
                    <span className="text-muted-foreground">{TRACKING_LABEL} </span>
                    {tracking}
                  </p>
                ) : null}

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className={`text-[13px] ${canceled ? "text-muted-foreground line-through" : "text-muted-foreground"}`}>
                    {shipping === 0 ? <b className="text-foreground">{FREE_SHIPPING}</b> : <>배송비 <b className="text-foreground">{formatWon(shipping)}</b></>}
                  </span>

                  {/* 🚨 취소된 묶음에는 버튼도 안내도 두지 않는다 */}
                  {canceled ? null : confirming ? (
                    <div className="flex items-center gap-2" role="group" aria-label={`${sub.brand_name} 묶음 취소 확인`}>
                      <span className="text-[13px]">{ASK}</span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onConfirm(sub.sub_order_id)}
                        className="border border-foreground px-3 py-1.5 text-[13px] disabled:opacity-50"
                      >
                        {busy ? "취소 중" : "취소"}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setConfirmId(null);
                          setPackError(null);
                        }}
                        className="px-2 py-1.5 text-[13px] text-muted-foreground disabled:opacity-50"
                      >
                        아니요
                      </button>
                    </div>
                  ) : sub.cancellable ? (
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmId(sub.sub_order_id); // 한 번에 하나의 묶음만 확인 상태다
                        setPackError(null);
                      }}
                      className="border border-foreground px-4 py-2 text-[13px] font-medium transition-colors hover:bg-foreground hover:text-background"
                    >
                      {CANCEL_LABEL}
                    </button>
                  ) : sub.display_status === DELIVERED_STATUS ? (
                    <Link
                      href={`/returns?order_id=${order.order_id}&sub_order_id=${sub.sub_order_id}`}
                      className="border border-foreground px-4 py-2 text-[13px] font-medium transition-colors hover:bg-foreground hover:text-background"
                    >
                      {RETURN_LABEL}
                    </Link>
                  ) : (
                    <span className="text-[13px] text-muted-foreground">{NO_CANCEL}</span>
                  )}
                </div>

                {err ? (
                  <div className="mt-3">
                    <p className="text-[13px] text-accent" role="alert">{err.message}</p>
                    {err.notFound ? <div className="mt-2"><OrdersLink /></div> : null}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </section>

      <section aria-labelledby="od_h_ship" className="mt-10">
        <h2 id="od_h_ship" className="mb-4 text-[12px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          배송 정보
        </h2>
        {/* 값은 전부 주문 시점 스냅샷이다 (AD-7) */}
        <dl className="border border-border p-6 text-[14px]">
          <KvRow label="수령인" value={order.recipient_name} />
          <KvRow label="연락처" value={formatPhone(order.recipient_phone)} />
          <KvRow label="주소" value={address} />
          <KvRow label="요청사항" value={order.order_note} />
        </dl>
      </section>

      <section aria-labelledby="od_h_pay" className="mt-10">
        <h2 id="od_h_pay" className="mb-4 text-[12px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          결제 정보
        </h2>
        {/* 🚨 3행이다. 도서산간 줄을 만들지 않는다 — 응답에 분리 필드가 없다. */}
        <div className="border border-border p-6 text-[14px]">
          <div className="flex justify-between py-1.5">
            <span className="text-muted-foreground">상품 금액</span>
            <span className="tabular-nums">{formatWon(order.item_total)}</span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-muted-foreground">배송비</span>
            <span className="tabular-nums">{formatWon(order.shipping_total)}</span>
          </div>
          <div className="mt-3 flex items-baseline justify-between border-t border-border pt-4">
            <span className="font-semibold">합계</span>
            {/* 🚨 입금 안내 상자의 금액보다 커지지 않는다 — 이 화면에서 가장 중요한 것은 입금 금액이다 */}
            <span className="text-[20px] font-semibold tabular-nums">{formatWon(order.grand_total)}</span>
          </div>
          <div className="mt-4 flex justify-between border-t border-border pt-4">
            <span className="text-muted-foreground">결제수단</span>
            <span>{PAY_METHOD}</span>
          </div>
        </div>
      </section>

      {/* 항상 있다 — 버튼이 있는 묶음과 없는 묶음이 왜 나란한지 설명한다 */}
      <p className="mt-8 text-[13px] text-muted-foreground">{CANCEL_NOTICE}</p>
    </div>
  );
}
