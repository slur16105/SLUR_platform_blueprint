import BuyerShell from "../buyer-shell";
import BuyerPageHeading from "../buyer-page-heading";
import OrdersView from "./orders-view";
import "./orders.css";

/* 주문내역 — `/orders` (보호 라우트).

   🚨 셸 호출 세 값(tab="orders" · showTabbar · topbar title)은 8.1이 검증하고
      EXPERIENCE.md IA 표가 확정한 것이다 — 최상위 4화면 중 하나이므로 탭바가 선다 (UX-DR3).
   바깥 틀 .b_frame은 상단바·푸터와 같은 좌우 정렬선(content-max)을 공유하고, "끝까지 한 단"의
   읽기 폭(640, UX-DR4)은 안쪽 열 .b_col_read가 좌측 정렬로 갖는다 (오너 확정 2026-07-27,
   이전의 .b_container.m_read 대체 — 640을 가운데 정렬해 정렬선이 어긋나던 것을 고친다).
   좌우 여백은 행이 스스로 갖는다(orders.css) — 행 사이 hairline이 열 끝까지 그어져야 하기 때문이다. */
export default function OrdersPage() {
  return (
    <BuyerShell tab="orders" showTabbar topbar={{ variant: "title", title: "주문내역" }}>
      <div className="b_frame">
        <div className="b_col_read b_orders">
          <BuyerPageHeading title="주문내역" />
          <OrdersView />
        </div>
      </div>
    </BuyerShell>
  );
}
