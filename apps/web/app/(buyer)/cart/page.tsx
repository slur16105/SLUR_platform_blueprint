import BuyerShell from "../buyer-shell";
import BuyerPageHeading from "../buyer-page-heading";
import CartView from "./cart-view";
import "./cart.css";

/* 장바구니 — `/cart` (보호 라우트).
   장바구니만 하단 고정 CTA + 탭바 2단이 허용되는 예외 화면이다 —
   최상위이면서 결제로 넘어가는 지점이기 때문. 헤더에 뒤로가기를 두지 않는다.
   🚨 셸 호출부 세 값(tab="cart" · showTabbar · topbar title)은 8.1이 검증하고
      EXPERIENCE.md IA 표가 확정한 것이다. 여기를 바꾸면 8.1의 AC 1·2가 깨진다. */
export default function CartPage() {
  return (
    <BuyerShell tab="cart" showTabbar ctaBar topbar={{ variant: "title", title: "장바구니" }}>
      <BuyerPageHeading title="장바구니" wide />
      <CartView />
    </BuyerShell>
  );
}
