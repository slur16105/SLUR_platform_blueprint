import { Suspense } from "react";

import BuyerShell from "../../buyer-shell";
import { BlockSkeleton } from "../../buyer-feedback";
import ProductDetail from "./product-detail";

import "../../browse.css";

/* 상품상세 — `/products/[id]` (공개 라우트, 미들웨어 matcher에 없다).

   셸: 상단바는 뒤로가기 + 장바구니(제목 없음), 탭바는 없다 —
   하단 고정 CTA가 있는 화면이라 두 바를 겹치지 않는다 (EXPERIENCE §IA 배치 규칙 2).
   tab="home"은 ≥768에서 소속 최상위 항목(`홈`)이 활성으로 표시되게 한다 —
   현재 위치 표시가 비는 화면이 있으면 안 된다.

   본체를 <Suspense>로 감싸는 이유(D3): ProductDetail이 useSearchParams(?variant)를 쓴다.
   경계가 없으면 tsc·lint는 통과하고 next build만 깨진다. */
export default function ProductDetailPage() {
  return (
    <BuyerShell tab="home" ctaBar topbar={{ variant: "back-title", showCart: true }}>
      <Suspense
        fallback={
          <div className="b_container b_detail">
            <div className="i_media">
              <BlockSkeleton className="m_hero" />
            </div>
            <div className="i_info">
              <BlockSkeleton className="m_line" />
              <BlockSkeleton className="m_title" />
              <BlockSkeleton className="m_line" />
            </div>
          </div>
        }
      >
        <ProductDetail />
      </Suspense>
    </BuyerShell>
  );
}
