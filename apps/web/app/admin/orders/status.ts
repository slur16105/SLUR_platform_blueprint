// 주문 표시 상태 라벨·뱃지 색 — 목록·상세 공용 (파생은 서버, 여기는 표기만 — AD-12)

export const STATUS_LABEL: Record<string, string> = {
  awaiting_payment: "입금대기",
  preparing: "배송준비",
  shipping: "배송중",
  delivered: "배송완료",
  confirmed: "구매확정",
  canceled: "취소",
};

export const STATUS_BADGE: Record<string, string> = {
  awaiting_payment: "m_warning",
  preparing: "m_brand",
  shipping: "m_brand m_solid",
  delivered: "m_success",
  confirmed: "m_success",
  canceled: "m_danger",
};

export function statusLabel(s: string) {
  return STATUS_LABEL[s] ?? s;
}

export function statusBadgeClass(s: string) {
  return `badge m_small ${STATUS_BADGE[s] ?? ""}`.trim();
}
