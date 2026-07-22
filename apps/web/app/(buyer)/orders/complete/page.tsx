import { Suspense } from "react";

import BuyerShell from "../../buyer-shell";
import CompleteView from "./complete-view";
import "./complete.css";

/* 주문완료 — `/orders/complete` (보호 라우트).

   🚨 경로 경합: (8.6이 만들) `/orders/[id]`와 같은 깊이지만 **정적 세그먼트가 동적을 이긴다** —
      Next가 판정하므로 [id] 쪽에서 `id === "complete"`를 걸러내는 코드를 쓰지 않는다 (D4, 8.1 위험 9).

   셸: 상단바는 로고 중앙형, **하단 고정 CTA·탭바가 없다**. 본문 버튼 두 개가 다음 걸음을 준다.
   tab="orders"는 ≥768 상단 내비의 현재 위치 표시가 비지 않게 한다.

   본체를 <Suspense>로 감싸는 이유: CompleteView가 useSearchParams(?order)를 쓴다.
   경계가 없으면 tsc·lint는 통과하고 next build만 깨진다 (8.3의 학습). */
export default function OrderCompletePage() {
  return (
    <BuyerShell tab="orders" topbar={{ variant: "logo-center" }}>
      <Suspense
        fallback={
          <div className="b_container m_narrow b_complete">
            <div className="b_complete_skeleton" aria-hidden="true">
              <span className="i_line m_title b_skeleton" />
              <span className="i_line m_short b_skeleton" />
              <span className="i_box b_skeleton" />
            </div>
          </div>
        }
      >
        <CompleteView />
      </Suspense>
    </BuyerShell>
  );
}
