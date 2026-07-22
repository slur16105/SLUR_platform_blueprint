/* 장바구니 API 클라이언트 래퍼 — 상품상세(담기)와 장바구니가 함께 쓴다.
   그래서 cart/ 안이 아니라 라우트 그룹 루트에 평평하게 둔다.
   page/layout/route가 아니므로 라우트를 만들지 않는다.

   반환은 { ok: true, data } | { ok: false, error } 한 형태다 — throw하지 않는다.
   표시 규약 (R6): 분기는 error.code, 화면 표시는 error.message.
   🚨 HTTP 상태 코드·code 문자열을 화면에 렌더하지 않는다 (UX-DR9·15).
   🚨 DELETE는 204라 본문이 없다 — res.json()을 부르면 TypeError가 난다. */

import type { ErrorEnvelope } from "./auth-errors";
import { GENERIC_MESSAGE, NETWORK_MESSAGE, type ApiFailure } from "./buyer-feedback";

/** GET /api/v1/carts의 항목. 서버 계약 그대로이며 클라이언트가 필드를 더하지 않는다.
 *  ⚠️ seller_id·line_total·배송비·재고 수량이 없다 (D1·D2·D12). */
export type CartItem = {
  /** cart_item_id — 수량 변경·삭제의 키 */
  id: string;
  /** null = 조합이 삭제됨(SET NULL) → 판매 종료 */
  variant_id: string | null;
  quantity: number;
  product_id: string | null;
  product_name: string;
  /** variant_id가 null이면 "" — D1이 `판매 종료` 묶음으로 모은다 */
  brand_name: string;
  /** 서버가 조립한다 (AD-12). 옵션이 없으면 "" */
  option_text: string;
  /** base + extra 단가. 판매 종료면 null */
  final_price: number | null;
  image_url: string | null;
  /** 단일 술어 결과 (AD-10) — 클라이언트가 재판단하지 않는다 */
  purchasable: boolean;
};

/** ⚠️ purchasable_total은 배송비 미포함이며 구매 가능 항목만의 상품 합계다 (D2). */
export type CartResponse = { items: CartItem[]; purchasable_total: number };

/** POST·PATCH의 응답. 합계가 없으므로 성공 후 GET /carts 재조회가 필요하다 (D6). */
export type CartItemBrief = { id: string; variant_id: string | null; quantity: number };

export type CartResult<T> = { ok: true; data: T } | { ok: false; error: ApiFailure };

async function request<T>(url: string, init?: RequestInit): Promise<CartResult<T>> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, cache: "no-store" });
  } catch {
    return { ok: false, error: { code: "network", message: NETWORK_MESSAGE } };
  }

  // 204 No Content — 본문을 읽지 않는다 (DELETE)
  if (res.status === 204) return { ok: true, data: undefined as T };

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    if (res.ok) return { ok: true, data: undefined as T };
    return { ok: false, error: { code: "service_unavailable", message: GENERIC_MESSAGE } };
  }
  if (!res.ok) {
    const env = (body ?? {}) as ErrorEnvelope;
    return { ok: false, error: { code: env.code ?? "http_error", message: env.message || GENERIC_MESSAGE } };
  }
  return { ok: true, data: body as T };
}

function jsonInit(method: string, payload: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) };
}

export function getCart(): Promise<CartResult<CartResponse>> {
  return request<CartResponse>("/api/carts");
}

/** 담기 수량은 항상 1이다 — 수량 조정은 장바구니가 소유한다 (AC 10) `[ASSUMPTION]`.
 *  같은 조합을 다시 담으면 서버가 합산하고 999에서 자른다. 화면이 합산을 흉내 내지 않는다. */
export function addItem(variantId: string): Promise<CartResult<CartItemBrief>> {
  return request<CartItemBrief>("/api/carts/items", jsonInit("POST", { variant_id: variantId, quantity: 1 }));
}

/** 합산이 아니라 절대값 지정이다. */
export function setQuantity(itemId: string, quantity: number): Promise<CartResult<CartItemBrief>> {
  return request<CartItemBrief>(`/api/carts/items/${encodeURIComponent(itemId)}`, jsonInit("PATCH", { quantity }));
}

/** 204 — 성공해도 data는 없다. */
export function removeItem(itemId: string): Promise<CartResult<void>> {
  return request<void>(`/api/carts/items/${encodeURIComponent(itemId)}`, { method: "DELETE" });
}
