import BuyerShell from "./buyer-shell";

/* 구매자 홈 (상품목록) — `/`.
   비로그인도 볼 수 있는 공개 라우트다. 판매자·관리자 계정도 여기로 진입해 막히지 않는다.
   🚧 내용은 8.3(상품목록·상품상세)이 통째로 대체한다.
      8.1은 셸 위에 반응형 그리드 규칙을 눈으로 확인할 수 있는 자리표시 블록만 둔다.
      자리표시 6개는 높이를 서로 다르게 두어(buyer.css의 nth-child)
      2/3/3열 전환과 어긋난 리듬을 눈으로 확인할 수 있게 한다. */

const PLACEHOLDER_COUNT = 6;

export default function BuyerHomePage() {
  return (
    <BuyerShell tab="home" showTabbar topbar={{ variant: "logo", showCart: true }}>
      <div className="b_container b_section">
        <p className="b_eyebrow i_eyebrow">큐레이션</p>
        <h1 className="b_display i_display">
          골라온 것들을
          <br />
          천천히 봅니다
        </h1>
        <div className="b_grid">
          {Array.from({ length: PLACEHOLDER_COUNT }, (_, i) => (
            <div className="b_ph" key={i}>
              <div className="b_placeholder" />
              <p className="b_brand_label">BRAND</p>
              <p className="b_product_name_card">자리표시 상품 {i + 1}</p>
              <p className="b_price_card">00,000원</p>
            </div>
          ))}
        </div>
      </div>
    </BuyerShell>
  );
}
