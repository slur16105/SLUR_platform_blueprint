import BuyerShell from "../../buyer-shell";
import BuyerPageHeading from "../../buyer-page-heading";
import OrderDetailView from "./order-detail-view";
import "./detail.css";

/* 주문상세 — `/orders/[id]` (보호 라우트).

   🚨 경로 경합: `/orders/complete`(8.5, 정적)가 이 동적 세그먼트를 이긴다 — Next가 판정하므로
      여기서 `id === "complete"`를 걸러내지 않는다 (8.1 위험 9 · 8.5 D4).
   🚨 params는 Next 16에서 Promise다 — await한다 (AGENTS.md).
   셸: 뒤로가기 + 제목이고 **탭바가 서지 않는다**. tab="orders"는 ≥768 상단 내비에서
      소속 최상위 항목(`주문내역`)을 활성으로 표시하기 위한 것이다 (EXPERIENCE IA 표). */
export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <BuyerShell tab="orders" topbar={{ variant: "back-title", title: "주문상세" }}>
      <div className="b_frame">
        <div className="b_col_read b_order_detail">
          <BuyerPageHeading title="주문상세" />
          <OrderDetailView orderId={id} />
        </div>
      </div>
    </BuyerShell>
  );
}
