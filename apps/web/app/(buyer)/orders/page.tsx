import BuyerShell from "../buyer-shell";
import OrdersView from "./orders-view";
import "./orders.css";

/* 주문내역 — `/orders` (보호 라우트).

   🚨 셸 호출 세 값(tab="orders" · showTabbar · topbar title)은 8.1이 검증하고
      EXPERIENCE.md IA 표가 확정한 것이다 — 최상위 4화면 중 하나이므로 탭바가 선다 (UX-DR3).
   🚨 .b_container.m_read(640px)를 빼지 않는다 — UX-DR4의 "끝까지 한 단"이 이 클래스 하나에 걸려 있다.
      좌우 여백은 행이 스스로 갖는다(orders.css) — 행 사이 hairline이 단 끝까지 그어져야 하기 때문이다. */
export default function OrdersPage() {
  return (
    <BuyerShell tab="orders" showTabbar topbar={{ variant: "title", title: "주문내역" }}>
      <div className="b_container m_read b_orders">
        <OrdersView />
      </div>
    </BuyerShell>
  );
}
