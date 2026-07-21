/* 금액 요약 — 뼈대. 장바구니·주문서·주문상세가 공유한다 (UX-DR13).
   데이터 연결은 8.4·8.5·8.6이 채운다.

   🚨 행 순서는 고정이다: 상품 금액 · 배송비 · 도서산간 추가 · 합계.
   🚨 도서산간 추가는 0원이어도 줄을 지우지 않는다 —
      배송지에 따라 늘어날 자리가 있다는 것을 미리 보여주기 위함이다.
      0원인 줄은 색만 물러난다(.m_zero). 조건부로 렌더에서 빼지 않는다. */

export type AmountSummaryData = {
  /** 상품 금액 */
  itemsTotal: number;
  /** 배송비 */
  shippingFee: number;
  /** 도서산간 추가 — 0이어도 줄을 지우지 않는다 */
  remoteAreaFee: number;
  /** 합계 */
  total: number;
};

/** 금액 형식은 `121,000원` 고정. 원화 기호·소수점·축약을 쓰지 않는다. */
export function formatWon(value: number): string {
  return `${value.toLocaleString("ko-KR")}원`;
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="i_row">
      <span className="i_label b_control">{label}</span>
      <span className={`i_value b_control${value === 0 ? " m_zero" : ""}`}>{formatWon(value)}</span>
    </div>
  );
}

export default function AmountSummary({ data }: { data: AmountSummaryData }) {
  return (
    <div className="b_amount_summary">
      <Row label="상품 금액" value={data.itemsTotal} />
      <Row label="배송비" value={data.shippingFee} />
      <Row label="도서산간 추가" value={data.remoteAreaFee} />
      <div className="i_total">
        <span className="i_total_label">합계</span>
        <span className="i_total_value b_price_total">{formatWon(data.total)}</span>
      </div>
    </div>
  );
}
