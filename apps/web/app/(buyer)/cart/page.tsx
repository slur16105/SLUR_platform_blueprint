import BuyerShell from "../buyer-shell";

/* 장바구니 — `/cart` (보호 라우트).
   🚧 자리표시. 내용은 8.4가 대체한다.
   장바구니만 하단 고정 CTA + 탭바 2단이 허용되는 예외 화면이다 —
   최상위이면서 결제로 넘어가는 지점이기 때문. 헤더에 뒤로가기를 두지 않는다. */
export default function CartPage() {
  return (
    <BuyerShell tab="cart" showTabbar topbar={{ variant: "title", title: "장바구니" }}>
      <div className="b_container b_stub">
        <p className="b_body">장바구니는 8.4에서 채웁니다.</p>
        <p className="b_notice i_note">탭 목적지 확인을 위한 자리표시 화면입니다.</p>
      </div>
    </BuyerShell>
  );
}
