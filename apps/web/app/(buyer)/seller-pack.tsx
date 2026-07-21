/* 판매자 묶음 카드 — 뼈대. 장바구니·주문서·주문상세에서 반복된다 (UX-DR13).
   헤더(브랜드 라벨 + 우측 배송비 또는 상태 라벨) → 상품 행 → 푸터(배송비 + 액션).
   묶음 사이는 1px hairline.

   화면별로 채우는 것 (여기서는 자리만 잡는다):
   - 장바구니(8.4): 헤더 좌측 체크박스, 상품 행에 수량 스테퍼와 `삭제`
   - 주문서(8.5): 읽기 전용
   - 주문상세(8.6): 헤더 우측 상태 라벨, 푸터에 `주문 취소`(취소 가능할 때만), 배송중이면 송장 줄

   🚨 주문 전체에 걸리는 상태나 전체 취소 버튼을 두지 않는다 (FR-15·18) —
      상태·배송비·취소는 언제나 묶음 단위다.
   🚨 구매 불가 묶음은 숨기지 않고 표기한다 (unavailable) */

import BrandLabel from "./brand-label";

export type SellerPackProps = {
  /** 판매자를 부를 때는 브랜드명 — `판매자 A`가 아니라 `토림도예` */
  brand: string;
  /** 헤더 좌측 슬롯 — 장바구니의 체크박스 자리 */
  headStart?: React.ReactNode;
  /** 헤더 우측 슬롯 — 배송비 또는 상태 라벨 */
  headEnd?: React.ReactNode;
  /** 상품 행들 */
  children?: React.ReactNode;
  /** 푸터 슬롯 — 배송비 + 액션(주문 취소·송장 줄) */
  foot?: React.ReactNode;
  /** 담은 뒤 품절 등 구매 불가 묶음 (FR-35) */
  unavailable?: boolean;
};

export default function SellerPack({
  brand,
  headStart,
  headEnd,
  children,
  foot,
  unavailable = false,
}: SellerPackProps) {
  return (
    <section className={`b_seller_pack${unavailable ? " m_unavailable" : ""}`}>
      <div className="i_head">
        <span className="i_head_start">
          {headStart}
          <BrandLabel size="pack">{brand}</BrandLabel>
        </span>
        {headEnd ? <span className="i_head_end">{headEnd}</span> : null}
      </div>
      {children ? <div className="i_items">{children}</div> : null}
      {foot ? <div className="i_foot">{foot}</div> : null}
    </section>
  );
}
