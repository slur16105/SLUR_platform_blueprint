/* 주문 API 클라이언트 래퍼 — 주문서(8.5)·주문완료(8.5)·주문내역/주문상세(8.6)가 함께 쓴다.
   그래서 checkout/ 안이 아니라 라우트 그룹 루트에 평평하게 둔다.
   page/layout/route가 아니므로 라우트를 만들지 않는다.

   반환은 { ok: true, data } | { ok: false, error } 한 형태다 — throw하지 않는다.
   표시 규약 (R6): 분기는 error.code, 화면 표시는 error.message.
   🚨 HTTP 상태 코드·code 문자열을 화면에 렌더하지 않는다 (UX-DR9·15).
   🚨 클라이언트가 금액을 더하거나 빼지 않는다 — 파생 값은 전부 서버가 준다 (AD-12). */

import type { ErrorEnvelope } from "./auth-errors";
import { GENERIC_MESSAGE, NETWORK_MESSAGE, type ApiFailure } from "./buyer-feedback";

/* ── POST /api/v1/orders/preview ────────────────
   ⚠️ PreviewItem에 image_url이 없다. 사진은 GET /carts에서 cart_item_id로 붙인다 (D5, 위험 3). */
export type PreviewItem = {
  /** POST /orders의 cart_item_ids 소스 (D6) */
  cart_item_id: string;
  variant_id: string;
  product_name: string;
  /** 서버가 조립한다 (AD-12). 옵션이 없으면 "" */
  option_text: string;
  quantity: number;
  /** base + extra 단가 */
  final_price: number;
  /** 행 금액 — 장바구니와 달리 서버가 준다 */
  line_total: number;
};

export type PreviewSellerGroup = {
  seller_id: string;
  brand_name: string;
  items: PreviewItem[];
  item_total: number;
  /** 판매자 기본 배송비 */
  shipping_fee: number;
  /** 도서산간 추가비 (일반 지역 0) */
  remote_extra_fee: number;
  /** 묶음 헤더에 쓰는 값 = 기본 + 도서산간 */
  shipping_total: number;
};

export type OrderPreviewResponse = {
  seller_groups: PreviewSellerGroup[];
  item_total: number;
  /** 기본 배송비 **합** (도서산간 제외 — 요약 행을 분리 표시하려고 4.2가 나눴다) */
  shipping_total: number;
  remote_extra_total: number;
  grand_total: number;
  /** "jeju" | "island" | null(일반) */
  remote_area_kind: string | null;
};

/* ── POST /api/v1/orders ──────────────────────── */
export type OrderCreatePayload = {
  cart_item_ids: string[];
  /** 화면이 보여준 총액 그대로 — 불일치는 409 price_changed (4.4의 안전장치) */
  expected_grand_total: number;
  postal_code: string;
  recipient_name: string;
  /** 🚨 숫자만. 서버 계약이 ^\d{9,11}$이라 하이픈이 들어가면 422다 (D8, 위험 4) */
  recipient_phone: string;
  address1: string;
  address2: string;
  order_note: string;
};

/** 🚨 order_no가 없다 — 주문번호를 표시하려면 GET /orders/{id} 재조회가 필수다 (D3, 위험 2). */
export type OrderCreateResponse = {
  order_id: string;
  grand_total: number;
  deposit_account: string;
  deposit_due_at: string;
};

/* ── GET /api/v1/orders?page=n ─────────────────
   최신순(created_at DESC, id DESC). 응답에 **페이지 크기가 없다** — 화면은 누적 길이와 total만 비교한다 (D4).
   ⚠️ OrderCard에 image_url이 없다. 주문 라인은 스냅샷이고 이미지는 스냅샷 대상이 아니다 —
      사진 자리를 비워 두지 않고 아예 그리지 않는다 (D5, 위험 1).
   ⚠️ sub_orders에 sub_order_id가 없다 — 목록에서는 취소할 수 없다(의도된 설계). */
export type OrderCardSub = {
  brand_name: string;
  /** 묶음 상태. 목록은 브랜드명 나열에만 쓴다 (D3) */
  display_status: string;
};

export type OrderCard = {
  order_id: string;
  /** UUID 뒤 8자리 대문자 — 🚨 클라 가공 금지 */
  order_no: string;
  /** ISO(UTC) */
  created_at: string;
  /** 대표 상태 — 서버 파생 (AD-12). 묶음 상태들로 클라이언트가 계산하지 않는다 */
  display_status: string;
  /** 활성 라인만 합산 (전-취소 주문은 원 주문 금액 폴백) */
  grand_total: number;
  /** 서버가 조립한 `유광 도자 머그 외 1건` — 클라가 "외 n건"을 만들지 않는다 */
  title: string;
  sub_orders: OrderCardSub[];
};

export type OrderListResponse = {
  items: OrderCard[];
  /** 전체 건수 — `더 보기` 판정의 유일한 기준 (누적 길이 < total) */
  total: number;
  page: number;
};

/* ── GET /api/v1/orders/{id} ─────────────────── */
export type DepositInfo = {
  /** 잔여 활성분 — 부분 취소를 반영한 값이다 (5.1, 과입금 방지) */
  grand_total: number;
  /** 서버가 조립한 한 줄 표기 — 분리 필드가 비었을 때의 폴백 (화면이 직접 쪼개지 않는다) */
  deposit_account: string;
  /** 2026-07-31 분리 도입 — 구매자 안내가 '예금주' 줄을 따로 보여줄 수 있어야 한다 */
  deposit_bank?: string;
  deposit_account_no?: string;
  deposit_holder?: string;
  deposit_due_at: string;
  /** 기한 경과(자동취소 배치 전 창) — 서버 파생 (AD-12) */
  expired: boolean;
};

/** 주문 라인 — 스냅샷이다 (AD-7).
 *  ⚠️ image_url도 variant_id도 없다. 사진을 그릴 경로가 존재하지 않는다 (D5, 위험 1). */
export type OrderLineView = {
  product_name: string;
  /** 서버가 조립한다. 옵션이 없으면 "" */
  option_text: string;
  unit_price: number;
  extra_price: number;
  quantity: number;
  line_total: number;
  /** "ordered" | "canceled" — 라인 단위 부분 취소는 관리자 몫이다 (AD-6, D10) */
  status: string;
};

export type OrderSubView = {
  /** 취소 API의 키 */
  sub_order_id: string;
  brand_name: string;
  /** 묶음 독립 상태 (FR-15) — 주문 전체로 뭉개지 않는다 */
  display_status: string;
  /** 배송중 전에는 null */
  carrier: string | null;
  /** FR-21 — 표시만. 추적 링크·외부 연동을 만들지 않는다 */
  tracking_number: string | null;
  /** 🚨 취소된 묶음도 원래 값 그대로 온다 (합계에서는 빠져 있다 — D10이 취소선으로 처리) */
  shipping_fee: number;
  remote_extra_fee: number;
  /** 🚨 취소 버튼의 유일한 판정 근거 — 서버 파생 (AD-12). display_status로 자체 판단하지 않는다 (D2) */
  cancellable: boolean;
  items: OrderLineView[];
};

export type OrderDetailResponse = {
  order_id: string;
  /** UUID 뒤 8자리 대문자 — 🚨 클라 가공 금지 (위험 6) */
  order_no: string;
  /** ISO(UTC) */
  created_at: string;
  /** 대표 상태 — 서버 파생 (AD-12) */
  display_status: string;
  recipient_name: string;
  /** 🚨 숫자만 온다 (^\d{9,11}$). 하이픈은 표시 계층이 넣는다 (D11) */
  recipient_phone: string;
  postal_code: string;
  address1: string;
  /** 빈 문자열 가능 — 행을 지우지 않고 `—`로 자리를 지킨다 */
  address2: string;
  /** 빈 문자열 가능 */
  order_note: string;
  sub_orders: OrderSubView[];
  item_total: number;
  /** 🚨 기본 배송비 + 도서산간의 **합**이다. 분리 필드가 없어 도서산간 줄을 만들 수 없다 (D6, 위험 2) */
  shipping_total: number;
  grand_total: number;
  /** 🚨 null이면 입금 안내 상자를 그리지 않는다. 상태 문자열로 분기하지 않는다 (AD-12, 5.1) */
  deposit_info: DepositInfo | null;
};

/* ── POST /api/v1/orders/sub-orders/{id}/cancel ──
   🚨 응답에 갱신된 주문이 없다 — 화면을 맞추려면 GET /orders/{id} 재조회가 필수다 (D8). */
export type SubOrderCancelResponse = {
  /** 이번 호출에서 취소된 ordered 라인 수 (선취소분 제외) */
  canceled_items: number;
  /** 전 묶음 취소로 order 층까지 canceled 전이됐는지 */
  order_canceled: boolean;
};

/* ── 실패 봉투 ─────────────────────────────────
   details는 code마다 모양이 다르다. 형식이 어긋나면 항목 나열 없이 message만 보여준다 (R2). */
export type OutOfStockItem = { product_name: string; option_text: string };

export type OrderFailure = ApiFailure & {
  /** out_of_stock에서만 채워진다. 형식이 어긋나면 undefined — 그때는 message만 낸다 */
  outOfStock?: OutOfStockItem[];
  /** validation_error의 필드 매핑용 (auth-errors의 mapFieldErrors가 소비한다) */
  details?: ErrorEnvelope["details"];
};

export type OrderResult<T> = { ok: true; data: T } | { ok: false; error: OrderFailure };

/** out_of_stock의 details를 좁힌다. 배열이 아니거나 항목 모양이 다르면 undefined —
 *  그때 화면은 message만 낸다. 외부 응답 이형에 화면이 깨지지 않게 한다. */
function narrowOutOfStock(details: unknown): OutOfStockItem[] | undefined {
  if (!Array.isArray(details)) return undefined;
  const rows: OutOfStockItem[] = [];
  for (const d of details) {
    if (typeof d !== "object" || d === null) return undefined;
    const row = d as Record<string, unknown>;
    if (typeof row.product_name !== "string") return undefined;
    rows.push({
      product_name: row.product_name,
      option_text: typeof row.option_text === "string" ? row.option_text : "",
    });
  }
  return rows.length > 0 ? rows : undefined;
}

async function request<T>(url: string, init?: RequestInit): Promise<OrderResult<T>> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, cache: "no-store" });
  } catch {
    return { ok: false, error: { code: "network", message: NETWORK_MESSAGE } };
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    if (res.ok) return { ok: true, data: undefined as T };
    return { ok: false, error: { code: "service_unavailable", message: GENERIC_MESSAGE } };
  }

  if (!res.ok) {
    const env = (body ?? {}) as ErrorEnvelope & { details?: unknown };
    const code = env.code ?? "http_error";
    const error: OrderFailure = { code, message: env.message || GENERIC_MESSAGE };
    if (code === "out_of_stock") error.outOfStock = narrowOutOfStock(env.details);
    if (code === "validation_error" && Array.isArray(env.details)) {
      error.details = env.details as ErrorEnvelope["details"];
    }
    return { ok: false, error };
  }
  return { ok: true, data: body as T };
}

function jsonInit(payload: unknown): RequestInit {
  return { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) };
}

/** 항목 선택 파라미터가 없다 — 장바구니의 구매 가능 항목 전체를 계산한다 (D6). */
export function postPreview(postalCode: string): Promise<OrderResult<OrderPreviewResponse>> {
  return request<OrderPreviewResponse>("/api/orders/preview", jsonInit({ postal_code: postalCode }));
}

export function createOrder(payload: OrderCreatePayload): Promise<OrderResult<OrderCreateResponse>> {
  return request<OrderCreateResponse>("/api/orders", jsonInit(payload));
}

/** 남의 주문·없는 주문은 404 not_found다(403이 아니다 — 존재 노출 방지). */
export function getOrder(orderId: string): Promise<OrderResult<OrderDetailResponse>> {
  return request<OrderDetailResponse>(`/api/orders/${encodeURIComponent(orderId)}`);
}

/** 주문내역 한 페이지. page < 1 · page > 10000은 BFF가 422로 끊는다 (D4). */
export function listOrders(page: number): Promise<OrderResult<OrderListResponse>> {
  return request<OrderListResponse>(`/api/orders?page=${page}`);
}

/** 묶음 취소 — 🚨 본문을 보내지 않는다 (D7: 사유를 입력받지 않는다).
 *  성공해도 갱신된 주문이 오지 않으므로 호출부가 getOrder로 재조회한다 (D8). */
export function cancelSubOrder(subOrderId: string): Promise<OrderResult<SubOrderCancelResponse>> {
  return request<SubOrderCancelResponse>(`/api/orders/sub-orders/${encodeURIComponent(subOrderId)}/cancel`, {
    method: "POST",
  });
}

/** 36자 표준 UUID인지 — 서버를 부르기 전에 ?order= 값을 걸러낸다 (AC 12). */
export function isUuid(v: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v);
}
