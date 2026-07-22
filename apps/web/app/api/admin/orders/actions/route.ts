import { NextRequest } from "next/server";

import { assertSameOrigin, proxyWithRefresh } from "@/lib/auth";

// 표준 UUID — 하이픈 위치·hex 검증, 대소문자 허용 (FastAPI 전달 전 소문자 정규화)
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const RESPONSIBILITIES = new Set(["buyer", "seller", "admin"]);

function invalid(message = "입력값이 올바르지 않습니다.") {
  return Response.json({ code: "validation_error", message, details: [] }, { status: 422 });
}

/** 취소 공통 필드 검증 — reason 1~500(필수), responsibility(enum), note 0~500.
 *  defaultResponsibility 미지정이면 responsibility 누락은 422 (FastAPI 계약과 동일). */
function cancelPayload(
  body: Record<string, unknown>,
  defaultResponsibility?: string,
): { reason: string; responsibility: string; note?: string } | null {
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const responsibility = typeof body.responsibility === "string" ? body.responsibility : defaultResponsibility ?? "";
  if (!reason || reason.length > 500 || !RESPONSIBILITIES.has(responsibility)) return null;
  const payload: { reason: string; responsibility: string; note?: string } = { reason, responsibility };
  if (typeof body.note === "string" && body.note.trim()) payload.note = body.note.trim().slice(0, 500);
  return payload;
}

// 상태를 바꾸는 POST는 assertSameOrigin을 먼저 태운다 (8.2가 세운 규약).
// 검사가 없으면 임의 사이트의 폼 POST가 상류 401을 유발해 관리자를 강제 로그아웃시킬 수 있다.
export async function POST(req: NextRequest) {
  const forbidden = assertSameOrigin(req);
  if (forbidden) return forbidden;

  // { action: "cancel_order"|"cancel_item"|"sub_transition"|"mark_refunded", ... } → FastAPI 개입 엔드포인트 디스패치
  const body = await req.json().catch(() => ({}));

  if (body.action === "cancel_order") {
    // pending 주문 전체 취소 → { canceled_items }
    if (typeof body.order_id !== "string" || !UUID_RE.test(body.order_id)) return invalid();
    const payload = cancelPayload(body, "admin"); // 주문 전체 취소만 귀책 기본 admin (FastAPI 계약과 동일)
    if (!payload) return invalid("취소 사유는 1~500자로 입력해 주세요.");
    return proxyWithRefresh(req, `/api/v1/admin/orders/${body.order_id.toLowerCase()}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  if (body.action === "cancel_item") {
    // 라인 단위 취소 (배송 후 가능 — admin 예외) → { order_canceled }
    if (typeof body.order_item_id !== "string" || !UUID_RE.test(body.order_item_id)) return invalid();
    const payload = cancelPayload(body); // 라인 취소는 responsibility 필수 — 누락 시 422
    if (!payload) return invalid("취소 사유(1~500자)와 귀책을 입력해 주세요.");
    return proxyWithRefresh(req, `/api/v1/admin/order-items/${body.order_item_id.toLowerCase()}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  if (body.action === "sub_transition") {
    // 강제 배송 전이 (shipping|delivered) — 전이표 내에서만, 성공 시 204
    if (typeof body.sub_order_id !== "string" || !UUID_RE.test(body.sub_order_id)) return invalid();
    if (body.to_status !== "shipping" && body.to_status !== "delivered") return invalid("지원하지 않는 전이입니다.");
    const payload: Record<string, unknown> = { to_status: body.to_status };
    if (typeof body.carrier === "string" && body.carrier.trim()) payload.carrier = body.carrier.trim().slice(0, 50);
    if (typeof body.tracking_number === "string" && body.tracking_number.trim()) payload.tracking_number = body.tracking_number.trim().slice(0, 50);
    if (typeof body.note === "string" && body.note.trim()) payload.note = body.note.trim().slice(0, 500);
    return proxyWithRefresh(req, `/api/v1/admin/sub-orders/${body.sub_order_id.toLowerCase()}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  if (body.action === "mark_refunded") {
    // 환불 완료 시각 기록 — 성공 시 204, 중복 409 duplicate_request
    if (typeof body.cancellation_id !== "string" || !UUID_RE.test(body.cancellation_id)) return invalid();
    return proxyWithRefresh(req, `/api/v1/admin/cancellations/${body.cancellation_id.toLowerCase()}/refunded`, { method: "POST" });
  }

  return invalid("지원하지 않는 동작입니다.");
}
