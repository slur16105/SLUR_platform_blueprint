/* 표시 상태 표 (8.6 D1) — 주문내역·주문상세가 함께 쓴다.
   page/layout/route가 아니므로 라우트를 만들지 않는다.

   상태값은 영어 enum이고 한국어 문언은 클라이언트 표현 계층이다 (AD-8).
   다만 **어떤 값이 올 수 있는지는 서버가 정한다** — derive_sub_status·derive_order_status가
   낼 수 있는 값이 아래 여섯이며, 그 밖의 값이 오면 데이터 이상이다.

   🚨 `결제완료`라는 표시 상태는 존재하지 않는다. 백엔드는 입금 확인(paid) 시 활성 묶음을 즉시
      preparing으로 옮기므로 그 상태가 화면에 뜨는 순간이 없다 — 없는 상태를 위한 라벨을 만들지 않는다.
   🚨 `취소완료`가 아니라 `취소`다. DESIGN·EXPERIENCE·목업 확정본이 셋 다 `취소`다 (AD-14).
   🚨 액센트가 붙는 상태는 입금대기 하나뿐이다 (UX-DR8). 색은 StatusLabel이 소유하고
      여기서 색을 새로 선언하지 않는다.
   🚨 미지 값에 영어 원문을 그대로 노출하지 않는다 — code 문자열 미노출과 같은 종류의 사고다. */

import type { StatusTone } from "../status-label";

export type OrderStatusView = { label: string; tone: StatusTone };

const TABLE: Record<string, OrderStatusView> = {
  awaiting_payment: { label: "입금대기", tone: "waiting" },
  preparing: { label: "배송준비", tone: "moving" },
  shipping: { label: "배송중", tone: "moving" },
  delivered: { label: "배송완료", tone: "finished" },
  // v1 미사용 값(전이표 미등록). 묶음 상태로는 내려올 수 있어 영어가 새지 않게 매핑해 둔다 (위험 11)
  confirmed: { label: "배송완료", tone: "finished" },
  canceled: { label: "취소", tone: "finished" },
};

/** [ASSUMPTION] 실제로는 나올 수 없는 값이므로 방어 문구로만 둔다. */
const UNKNOWN: OrderStatusView = { label: "확인 중", tone: "moving" };

export function orderStatusView(displayStatus: string): OrderStatusView {
  return TABLE[displayStatus] ?? UNKNOWN;
}

/** 취소된 묶음인지 — 취소선·안내 문장 유무의 판정에만 쓴다.
 *  🚨 취소 **가능** 여부의 판정에는 절대 쓰지 않는다. 그것은 응답의 cancellable 한 필드뿐이다 (D2). */
export const CANCELED_STATUS = "canceled";
