/* 금액 요약 — 장바구니·주문서·주문상세가 공유한다 (UX-DR13).

   🚨 행 순서는 고정이다: 상품 금액 · 배송비 · 도서산간 추가 · 합계.
   🚨 도서산간 추가는 0원이어도, 값이 미정이어도 줄을 지우지 않는다 —
      배송지에 따라 늘어날 자리가 있다는 것을 미리 보여주기 위함이다.
      0원인 줄은 색만 물러난다(.m_zero). 조건부로 렌더에서 빼지 않는다.

   8.4(D2) — 장바구니는 배송비·도서산간에 숫자를 낼 수 없다. 어떤 API도 장바구니 시점에
   판매자 배송비를 주지 않고, 유일한 계산 경로(POST /orders/preview)는 우편번호를 요구한다.
   그래서 null을 받으면 값 자리에 미확정 문구를 놓는다 — 지어낸 숫자를 내지 않는다 (AD-12).
   합계 라벨도 prop이다: 장바구니는 `상품 금액 합계`(배송비가 빠진 값에 `결제 예정 금액`을
   붙이면 화면이 거짓말을 한다), 주문서(8.5)는 `결제 예정 금액`. */

// 금액 표기 함수는 format.ts 하나뿐이다 (8.3 D13 · 8.4 D12). 모든 호출부가 거기서 직접 가져간다.
import { formatWon } from "./format";

export type AmountSummaryData = {
  /** 상품 금액 */
  itemsTotal: number;
  /** 배송비 — null이면 미확정 문구 */
  shippingFee: number | null;
  /** 도서산간 추가 — 0이어도, null이어도 줄을 지우지 않는다 */
  remoteAreaFee: number | null;
  /** 합계 — null이면 미확정 문구 (8.5: 우편번호 전에는 배송비를 모르므로 총액도 모른다) */
  total: number | null;
};

function Row({ label, value, pendingText }: { label: string; value: number | null; pendingText: string }) {
  const modifier = value === null ? " m_pending" : value === 0 ? " m_zero" : "";
  return (
    <div className="i_row">
      <span className="i_label b_control">{label}</span>
      <span className={`i_value b_control${modifier}`}>{value === null ? pendingText : formatWon(value)}</span>
    </div>
  );
}

export default function AmountSummary({
  data,
  totalLabel = "합계",
  pendingText = "주문서에서 확인",
}: {
  data: AmountSummaryData;
  /** 장바구니 `상품 금액 합계` / 주문서 `결제 예정 금액` */
  totalLabel?: string;
  /** 값이 null인 행에 놓을 문구 */
  pendingText?: string;
}) {
  return (
    <div className="b_amount_summary">
      <Row label="상품 금액" value={data.itemsTotal} pendingText={pendingText} />
      <Row label="배송비" value={data.shippingFee} pendingText={pendingText} />
      <Row label="도서산간 추가" value={data.remoteAreaFee} pendingText={pendingText} />
      <div className="i_total">
        <span className="i_total_label">{totalLabel}</span>
        {/* 미확정이면 21px 액센트를 쓰지 않는다 — 그 크기는 확정된 금액에만 허락된 자리이고
            (UX-DR13: 화면당 한 번), 문구를 21px로 키우면 지어낸 총액처럼 읽힌다.
            🚨 행 자체는 지우지 않는다. 값 자리의 문구로만 표현한다 (D9). */}
        {data.total === null ? (
          <span className="i_total_value m_pending b_control">{pendingText}</span>
        ) : (
          <span className="i_total_value b_price_total">{formatWon(data.total)}</span>
        )}
      </div>
    </div>
  );
}
