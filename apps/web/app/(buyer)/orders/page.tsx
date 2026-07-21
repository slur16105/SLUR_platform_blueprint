import BuyerShell from "../buyer-shell";

/* 주문내역 — `/orders` (보호 라우트).
   🚧 자리표시. 내용은 8.6이 대체한다.
   읽는 화면이므로 ≥768에서 본문을 640px로 묶는다 (m_read). */
export default function OrdersPage() {
  return (
    <BuyerShell tab="orders" showTabbar topbar={{ variant: "title", title: "주문내역" }}>
      <div className="b_container m_read b_stub">
        <p className="b_body">주문내역은 8.6에서 채웁니다.</p>
        <p className="b_notice i_note">탭 목적지 확인을 위한 자리표시 화면입니다.</p>
      </div>
    </BuyerShell>
  );
}
