/* 장바구니 상수 — 리터럴을 화면 코드에 흩뿌리지 않는다 (D12, AD-13).
   서버 계약(POST·PATCH의 quantity는 1 ≤ n ≤ 999)과 대칭이며,
   스테퍼가 이 값을 넘겨 보내지 않는 것이 validation_error를 방어적으로 만든다. */

export const MIN_CART_QTY = 1;
export const MAX_CART_QTY = 999;

/** brand_name이 빈 문자열인 묶음(variant_id: null — 조합이 삭제됨)의 표시명 (D1). */
export const DISCONTINUED_BRAND = "판매 종료";

/* 문구 — 스파인 Voice·Tone 표에 없는 세 개는 `[ASSUMPTION]`이며 Slur 확인 항목이다 (D2). */
export const SUMMARY_TOTAL_LABEL = "상품 금액 합계"; // 목업의 `결제 예정 금액`을 쓰지 않는다 — 배송비가 빠졌다
export const SUMMARY_PENDING_TEXT = "주문서에서 확인"; // [ASSUMPTION]
export const SHIPPING_NOTE = "배송비는 판매자마다 다르며 배송지를 입력하면 주문서에서 확정됩니다."; // [ASSUMPTION]
export const DEAD_PACK_TAG = "구매 불가 · 품절";
export const DEAD_PACK_NOTE = "담은 뒤 품절된 상품입니다. 주문에서 제외됩니다.";
export const EMPTY_MESSAGE = "장바구니가 비어 있습니다.";
