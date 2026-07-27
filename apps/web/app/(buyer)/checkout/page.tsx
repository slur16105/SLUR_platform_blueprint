import BuyerShell from "../buyer-shell";
import CheckoutView from "./checkout-view";
import "./checkout.css";

/* 주문서 — `/checkout` (보호 라우트).

   상단바는 뒤로가기 + 제목이고 **탭바가 서지 않는다** — 하단 고정 CTA가 있는 화면에는
   탭바를 두지 않는 것이 규칙이고 장바구니만 예외다 (UX-DR3).
   tab="cart"는 ≥768 상단 내비에서 소속 최상위 항목(`장바구니`)을 활성으로 표시하기 위한 것이다 —
   주문서의 소속은 장바구니라고 EXPERIENCE.md IA 표가 확정했다. */
export default function CheckoutPage() {
  return (
    <BuyerShell tab="cart" ctaBar topbar={{ variant: "back-title", title: "주문서" }}>
      <CheckoutView />
    </BuyerShell>
  );
}
