"use client";

/* 구매 상자 — 옵션 선택 · 수량 · 합계 · CTA. 프로토타입이라 실제 담기/주문은 하지 않는다
   (모양과 흐름을 보기 위한 화면). 옵션이 없는 상품(더미)은 옵션 줄을 그리지 않는다. */

import { useState } from "react";

import { won, type Variant } from "../../data";

export default function BuyBox({ variants, soldOut }: { variants: Variant[]; soldOut: boolean }) {
  /* 옵션 이름이 비어 있으면 "옵션 없는 단일 상품"이다 — 선택 UI를 만들지 않는다. */
  const hasOptions = variants.some((v) => v.option1_name);
  const [variantId, setVariantId] = useState(variants[0]?.id ?? "");
  const [qty, setQty] = useState(1);

  const variant = variants.find((v) => v.id === variantId) ?? variants[0];
  const unit = variant?.final_price ?? 0;
  const disabled = soldOut || !variant?.purchasable;

  return (
    <div>
      {hasOptions ? (
        <div className="border-t border-border py-6">
          <p className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
            {variants[0].option1_name}
          </p>
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => {
              const on = v.id === variantId;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVariantId(v.id)}
                  disabled={!v.purchasable}
                  className={`border px-4 py-2.5 text-[14px] transition-colors ${
                    on ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground"
                  } ${!v.purchasable ? "cursor-default text-muted-foreground line-through opacity-50" : ""}`}
                >
                  {v.option1_value}
                  {v.option2_value ? ` / ${v.option2_value}` : ""}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* 수량 */}
      <div className="flex items-center justify-between border-t border-border py-6">
        <span className="text-[14px] text-muted-foreground">수량</span>
        <div className="flex items-center border border-border">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            aria-label="수량 줄이기"
            className="h-11 w-11 text-[18px] transition-colors hover:bg-muted"
          >
            −
          </button>
          <span className="w-12 text-center text-[15px] tabular-nums">{qty}</span>
          <button
            type="button"
            onClick={() => setQty((q) => Math.min(99, q + 1))}
            aria-label="수량 늘리기"
            className="h-11 w-11 text-[18px] transition-colors hover:bg-muted"
          >
            +
          </button>
        </div>
      </div>

      {/* 합계 */}
      <div className="flex items-baseline justify-between border-t border-border py-6">
        <span className="text-[14px] text-muted-foreground">총 상품 금액</span>
        <span className="text-[28px] font-semibold tabular-nums">{won(unit * qty)}</span>
      </div>

      {/* CTA */}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={disabled}
          className="h-14 flex-1 border border-foreground text-[15px] font-semibold transition-colors hover:bg-muted disabled:cursor-default disabled:border-border disabled:text-muted-foreground"
        >
          장바구니
        </button>
        <button
          type="button"
          disabled={disabled}
          className="h-14 flex-[2] bg-foreground text-[15px] font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-default disabled:bg-muted disabled:text-muted-foreground"
        >
          {disabled ? "품절" : "바로 구매"}
        </button>
      </div>

      <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
        배송비는 판매자마다 다르며 주문서에서 확인할 수 있습니다.
      </p>
    </div>
  );
}
