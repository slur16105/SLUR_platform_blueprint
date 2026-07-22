"use client";

/* 판매자 묶음 하나 — 8.1의 <SellerPack> 슬롯을 채운다 (seller-pack.tsx는 수정하지 않는다).
   headEnd = 상태 라벨 / children = 상품 행 / foot = 송장 줄 + 배송비 + 액션.

   🚨 **주문 전체에 걸리는 상태·진행바·전체 취소 버튼을 만들지 않는다** (FR-15·18, UX-DR13).
      토림도예가 `배송준비`인 동시에 온실이 `배송중`일 수 있고, 화면은 그것을 하나로 뭉개지 않는다.
   🚨 취소 가능 판정은 응답의 **cancellable 한 필드**뿐이다 (D2, AD-12).
      display_status 문자열을 보고 자체 판단하면 "눌리는데 실패하는 버튼"이 생긴다.
   🚨 취소된 묶음에는 안내 문장도 버튼도 놓지 않는다 — 헤더의 `취소` 라벨이 이미 다 말했다 (D2).
      unavailable prop을 재사용하지 않는다: 그것은 "살 수 없는 물건"(8.4)의 표기이고
      취소는 "이미 끝난 거래"의 표기다.
   🚨 상품 사진이 없다 (D5). 송장은 번호 표시까지이며 추적 링크를 만들지 않는다 (FR-21). */

import SellerPack from "../../seller-pack";
import StatusLabel from "../../status-label";
import { formatWon } from "../../format";
import type { OrderSubView } from "../../orders-api";
import { CANCELED_STATUS, orderStatusView } from "../order-status";

const ASK = "이 묶음을 취소할까요?";
const CANCEL_LABEL = "주문 취소";
const NO_CANCEL = "배송준비 이후에는 취소할 수 없습니다.";
const CANCELED_TAG = "취소";
const FREE_SHIPPING = "무료배송";
const TRACKING_LABEL = "송장번호";

export type PackView = {
  /** 요청이 도는 묶음 — 그 묶음의 버튼만 잠근다. 스피너를 쓰지 않는다 */
  pendingId: string | null;
  /** 확인 줄이 열린 묶음 (한 번에 하나) */
  confirmId: string | null;
  /** 🚨 재조회가 지우지 않는 별도 상태 (D8) — 8.4의 rowError와 같은 형태 */
  packError: { subOrderId: string; message: string; notFound: boolean } | null;
  /** 마운트 시 포커스를 옮길 자리 */
  focusPack: { id: string; target: "confirm" | "cancel" } | null;
};

export type PackHandlers = {
  onAsk: (id: string) => void;
  onDismiss: (id: string) => void;
  onConfirm: (id: string) => void;
  /** 마운트 즉시 포커스를 가져가는 안정된 ref 콜백 */
  focusRef: (el: HTMLButtonElement | null) => void;
  /** not_found일 때만 문장 옆에 서는 이동 수단 */
  notFoundAction: React.ReactNode;
};

export default function OrderPack({
  sub,
  view,
  h,
}: {
  sub: OrderSubView;
  view: PackView;
  h: PackHandlers;
}) {
  const status = orderStatusView(sub.display_status);
  const canceled = sub.display_status === CANCELED_STATUS;
  const busy = view.pendingId === sub.sub_order_id;
  const confirming = view.confirmId === sub.sub_order_id;
  const error = view.packError?.subOrderId === sub.sub_order_id ? view.packError : null;
  const focusTarget = view.focusPack?.id === sub.sub_order_id ? view.focusPack.target : null;

  /* 묶음 배송비 = 기본 + 도서산간. 이 묶음의 두 필드를 합칠 뿐 합계를 만들지 않는다.
     🚨 취소된 묶음도 원래 값이 그대로 내려오지만 shipping_total 합계에서는 빠져 있다 —
        취소선 없이 그리면 숫자가 맞지 않아 보인다 (D10, 위험 9). */
  const shipping = sub.shipping_fee + sub.remote_extra_fee;

  /* 송장은 번호가 있을 때만 그린다. carrier만 있고 번호가 없으면 줄 자체를 만들지 않는다. */
  const tracking = sub.tracking_number
    ? [sub.carrier, sub.tracking_number].filter(Boolean).join(" ")
    : null;

  return (
    <SellerPack
      brand={sub.brand_name}
      headEnd={
        <StatusLabel tone={status.tone}>
          {/* 색만 다른 글자가 아니라 무엇의 상태인지 읽히게 한다 (UX-DR8) */}
          <span className="b_sr">{sub.brand_name} 묶음 상태 </span>
          {status.label}
        </StatusLabel>
      }
      foot={
        <div className="i_foot_stack">
          {tracking ? (
            <div className="b_track">
              <span className="i_key">{TRACKING_LABEL}</span>
              {/* 🚨 링크가 아니다 — 추적 연동은 v1 밖이다 (FR-21) */}
              <span className="i_value">{tracking}</span>
            </div>
          ) : null}

          <div className="i_foot_line">
            <span className={`i_ship${shipping === 0 ? " m_free" : ""}${canceled ? " m_struck" : ""}`}>
              {shipping === 0 ? <b>{FREE_SHIPPING}</b> : <>배송비 <b>{formatWon(shipping)}</b></>}
            </span>

            {confirming ? (
              <div
                className="b_confirm_row i_confirm"
                role="group"
                aria-label={`${sub.brand_name} 묶음 주문 취소 확인`}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.stopPropagation();
                    h.onDismiss(sub.sub_order_id);
                  }
                }}
              >
                <span className="i_ask b_control">{ASK}</span>
                <button
                  type="button"
                  className="i_btn m_yes b_control"
                  ref={focusTarget === "confirm" ? h.focusRef : undefined}
                  disabled={busy}
                  onClick={() => h.onConfirm(sub.sub_order_id)}
                >
                  취소하기
                </button>
                <button
                  type="button"
                  className="i_btn m_no b_control"
                  disabled={busy}
                  onClick={() => h.onDismiss(sub.sub_order_id)}
                >
                  아니요
                </button>
              </div>
            ) : sub.cancellable ? (
              /* 🚨 빨강을 쓰지 않는다 — 이 팔레트에 빨강이 없다 (DESIGN button-cancel) */
              <button
                type="button"
                className="b_btn_cancel"
                ref={focusTarget === "cancel" ? h.focusRef : undefined}
                disabled={busy}
                onClick={() => h.onAsk(sub.sub_order_id)}
              >
                {CANCEL_LABEL}
              </button>
            ) : null}
          </div>

          {/* 취소된 묶음에는 이 문장을 놓지 않는다 — 거짓말이 된다 (D2) */}
          {!canceled && !sub.cancellable ? <p className="i_no_cancel">{NO_CANCEL}</p> : null}

          {/* 🚨 HTTP 코드·code 문자열을 렌더하지 않는다 — 봉투의 message 문장 그대로다 */}
          {error ? (
            <p className="b_err_msg i_pack_err" role="status">
              {error.message}
              {error.notFound ? <span className="i_act">{h.notFoundAction}</span> : null}
            </p>
          ) : null}
        </div>
      }
    >
      {sub.items.map((item, i) => {
        const lineCanceled = item.status === CANCELED_STATUS;
        return (
          <div className="b_order_line b_row" key={`${item.product_name}-${i}`}>
            <p className="b_product_name_row i_name">{item.product_name}</p>
            <p className="b_meta i_option">
              {item.option_text || "—"} · 수량 {item.quantity}개
            </p>
            <p className="i_price_row">
              <span className={`b_price_item i_price${lineCanceled ? " m_struck" : ""}`}>
                {formatWon(item.line_total)}
              </span>
              {/* 취소된 라인을 숨기지 않는다 — 표기하고 자리에 남긴다 (UX-DR8, D10) */}
              {lineCanceled ? <span className="b_tag m_canceled">{CANCELED_TAG}</span> : null}
            </p>
          </div>
        );
      })}
    </SellerPack>
  );
}
