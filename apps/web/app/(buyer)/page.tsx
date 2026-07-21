import { Suspense } from "react";

import BuyerShell from "./buyer-shell";
import { GridSkeleton } from "./buyer-feedback";
import ProductList from "./product-list";

import "./browse.css";

/* 구매자 홈 (상품목록) — `/`.
   비로그인도 볼 수 있는 공개 라우트다. 판매자·관리자 계정도 여기로 진입해 막히지 않으며
   역할로 분기하지 않는다 (FR-3). 미들웨어 matcher에 없어 미들웨어가 아예 실행되지 않는다.

   셸 호출부 세 값(tab="home" · showTabbar · topbar logo+cart)은 8.1이 검증한 상태다 —
   바꾸면 8.1의 AC 1·2가 깨진다.

   본체를 <Suspense>로 감싸는 이유(D3): ProductList가 useSearchParams를 쓴다.
   Suspense 경계가 없으면 tsc·lint는 통과하고 next build만 깨진다 (Next 16 규약).
   fallback을 스피너가 아니라 카드 골격으로 두면 UX-DR9의 "화면 중앙 스피너 금지"가
   프리렌더 단계에서도 자동으로 지켜진다. */
export default function BuyerHomePage() {
  return (
    <BuyerShell tab="home" showTabbar topbar={{ variant: "logo", showCart: true }}>
      <Suspense
        fallback={
          <div className="b_container b_section">
            <p className="b_eyebrow i_eyebrow">큐레이션</p>
            <h1 className="b_display i_display">
              골라온 것들을
              <br />
              천천히 봅니다
            </h1>
            <GridSkeleton />
          </div>
        }
      >
        <ProductList />
      </Suspense>
    </BuyerShell>
  );
}
