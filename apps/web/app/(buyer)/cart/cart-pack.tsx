"use client";

/* 판매자 묶음 하나 — 8.1의 <SellerPack> 슬롯을 채운다 (seller-pack.tsx는 수정하지 않는다).
   headStart = 상태 표시 체크박스 / headEnd = 구매 불가 태그 / children = 항목 행 / foot = 안내 상자.

   D4 — 구매 불가의 진실 단위는 **항목**이다. 묶음 헤더 태그와 하단 안내 상자는
        묶음의 모든 항목이 불가일 때만 붙는다. 한 묶음에 가능·불가가 섞여 있으면
        행이 흐려지고 그 행에 `구매 불가 · 품절` 태그가 붙는다 — 살 수 있는 물건이 있는
        묶음을 통째로 죽은 것처럼 그리지 않되, 색만으로 알리지도 않는다.
   D3 — 체크박스는 조작이 아니라 상태 표시다(disabled). POST /orders/preview에 항목 선택
        파라미터가 없어 부분 선택은 주문서 금액과 어긋난다. 세 상태(전부·일부·전무)를
        각각 체크·부분 선택·빈 칸으로 표시하고 aria-label이 같은 사실을 말한다.
   D7 — 삭제는 인라인 확인 줄이다. 모달·window.confirm·스와이프 삭제를 만들지 않는다. */

import SellerPack from "../seller-pack";
import { formatWon } from "../format";
import type { CartItem } from "../cart-api";
import { DEAD_PACK_NOTE, DEAD_PACK_TAG, MAX_CART_QTY, MIN_CART_QTY } from "./constants";

export type CartPackData = { key: string; brand: string; items: CartItem[] };

export type CartRowView = {
  /** 낙관적으로 바뀐 표시 수량 (D6) */
  overrides: Record<string, number>;
  /** 요청이 도는 행 — 그 행만 잠근다 */
  pendingId: string | null;
  /** 확인 줄이 열린 행 (한 번에 하나) */
  confirmId: string | null;
  /** 실패 문장이 붙은 행 — 타이머로 자동 소거하지 않는다 */
  rowError: { id: string; message: string } | null;
  /** 마운트 시 포커스를 옮길 자리 */
  focusRow: { id: string; target: "confirm" | "delete" } | null;
};

export type CartPackHandlers = {
  onStep: (item: CartItem, next: number) => void;
  onAsk: (id: string) => void;
  onCancel: (id: string) => void;
  onConfirmDelete: (id: string) => void;
  onRefresh: () => void;
  /** 마운트 즉시 포커스를 가져가는 안정된 ref 콜백 */
  focusRef: (el: HTMLButtonElement | null) => void;
};

function CartRow({
  item,
  view,
  h,
}: {
  item: CartItem;
  view: CartRowView;
  h: CartPackHandlers;
}) {
  const qty = view.overrides[item.id] ?? item.quantity;
  const busy = view.pendingId === item.id;
  const confirming = view.confirmId === item.id;
  const error = view.rowError?.id === item.id ? view.rowError.message : null;
  const dead = !item.purchasable;
  const focusTarget = view.focusRow?.id === item.id ? view.focusRow.target : null;

  // 클라이언트가 하는 유일한 산술 — 응답에 line_total이 없다 (D12).
  // 합계는 절대 더하지 않는다: purchasable_total을 그대로 쓴다.
  const lineTotal = item.final_price === null ? null : item.final_price * qty;

  return (
    <div className="i_item b_cart_item" data-unavailable={dead ? "true" : undefined}>
      <span className="i_thumb">
        {item.image_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img className="i_img" src={item.image_url} alt={item.product_name} loading="lazy" decoding="async" />
        ) : null}
      </span>
      <div className="i_info">
        <p className="b_product_name_row i_name">{item.product_name}</p>
        {/* 옵션이 없는 조합은 `—`로 자리를 지킨다 — 행 높이가 흔들리지 않게 (AC 1) */}
        <p className="b_meta i_option">{item.option_text || "—"}</p>
        {/* 🚨 색만으로 상태를 전달하지 않는다 (EXPERIENCE) — 회색조·취소선 옆에 글자가 함께 선다.
            묶음 헤더 태그는 묶음 전체가 불가일 때만 나오므로 섞인 묶음은 이 행 태그가 유일한 단서다. */}
        {dead ? (
          <p className="i_flag">
            <span className="b_tag m_unavailable">{DEAD_PACK_TAG}</span>
          </p>
        ) : null}
        <p className="b_price_item i_price">{lineTotal === null ? "—" : formatWon(lineTotal)}</p>

        {confirming ? (
          <div
            className="b_confirm_row i_ops b_row"
            role="group"
            aria-label={`${item.product_name} 삭제 확인`}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                h.onCancel(item.id);
              }
            }}
          >
            <span className="i_ask b_control">삭제할까요?</span>
            <button
              type="button"
              className="i_btn m_yes b_control"
              ref={focusTarget === "confirm" ? h.focusRef : undefined}
              disabled={busy}
              onClick={() => h.onConfirmDelete(item.id)}
            >
              삭제
            </button>
            <button type="button" className="i_btn m_no b_control" disabled={busy} onClick={() => h.onCancel(item.id)}>
              취소
            </button>
          </div>
        ) : (
          <div className="i_ops b_row">
            <div className="b_stepper" role="group" aria-label={`${item.product_name} 수량`}>
              {/* 수량 1에서 `−`는 비활성이다 — 삭제와 구분한다 (AC 4) */}
              <button
                type="button"
                className="i_step"
                aria-label="수량 줄이기"
                disabled={dead || busy || qty <= MIN_CART_QTY}
                onClick={() => h.onStep(item, qty - 1)}
              >
                −
              </button>
              <span className="i_qty">{qty}</span>
              <button
                type="button"
                className="i_step"
                aria-label="수량 늘리기"
                disabled={dead || busy || qty >= MAX_CART_QTY}
                onClick={() => h.onStep(item, qty + 1)}
              >
                +
              </button>
            </div>
            {/* 구매 불가 항목에서도 `삭제`는 계속 동작한다 — 지워지지도, 몰래 결제되지도 않는다 */}
            <button
              type="button"
              className="b_del b_meta"
              ref={focusTarget === "delete" ? h.focusRef : undefined}
              disabled={busy}
              onClick={() => h.onAsk(item.id)}
            >
              삭제
            </button>
          </div>
        )}

        {error ? (
          <p className="b_err_msg i_row_err" role="status">
            {error}
            <button type="button" className="i_refresh" onClick={h.onRefresh}>
              새로고침
            </button>
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default function CartPack({
  pack,
  view,
  h,
}: {
  pack: CartPackData;
  view: CartRowView;
  h: CartPackHandlers;
}) {
  const purchasableCount = pack.items.filter((i) => i.purchasable).length;
  const allDead = purchasableCount === 0;
  /* 섞인 묶음은 체크도 빈 칸도 사실이 아니다 — 안의 불가 항목은 이미 합계와 `주문하기 (N건)`에서
     빠져 있다. 네이티브 부분 선택 상태(indeterminate)로 표시하고 낭독 문장도 건수를 말한다. */
  const partial = !allDead && purchasableCount < pack.items.length;

  return (
    <SellerPack
      brand={pack.brand}
      unavailable={allDead}
      headStart={
        <input
          type="checkbox"
          className="b_checkbox"
          checked={!allDead && !partial}
          ref={(el) => {
            if (el) el.indeterminate = partial;
          }}
          disabled
          readOnly
          aria-label={
            allDead
              ? "구매 불가 — 주문에서 제외"
              : partial
                ? `${pack.items.length}건 중 ${purchasableCount}건만 주문에 포함`
                : "주문에 포함"
          }
        />
      }
      headEnd={allDead ? <span className="b_tag m_unavailable">{DEAD_PACK_TAG}</span> : undefined}
      foot={allDead ? <p className="b_deadnote">{DEAD_PACK_NOTE}</p> : undefined}
    >
      {pack.items.map((item) => (
        <CartRow key={item.id} item={item} view={view} h={h} />
      ))}
    </SellerPack>
  );
}
