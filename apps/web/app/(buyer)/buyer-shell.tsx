import BuyerFooter from "./buyer-footer";
import BuyerTabbar from "./buyer-tabbar";
import BuyerTopbar, { type BuyerTopbarProps } from "./buyer-topbar";
import type { BuyerTab } from "./buyer-icons";

export type BuyerShellProps = {
  /** 소속 최상위 항목. 상세 화면도 소속을 지정한다(상품상세→home, 주문서→cart, 주문상세→orders).
   *  활성 판정을 pathname 추측에 맡기지 않는 이유다. */
  tab?: BuyerTab;
  /** 탭바는 최상위 4화면에만 선다. 하단 고정 CTA가 있는 화면에는 두지 않는다 —
   *  장바구니만 CTA + 탭바 2단 예외다. (폭에 따른 조건이 아니라 화면별 규칙) */
  showTabbar?: boolean;
  /** 하단 고정 CTA 바(.b_cta_bar)가 서는 화면(상품상세·장바구니·주문서)에서 켠다 —
   *  푸터가 그 바에 가려 법정 고지가 안 보이는 것을 막으려 푸터에 바 높이만큼 여백을 예약한다.
   *  CTA 바가 없는 화면(홈 등)엔 여백이 추가되지 않는다. */
  ctaBar?: boolean;
  topbar: BuyerTopbarProps;
  children: React.ReactNode;
};

/* 구매자 셸 — 상단바 → <main> → 하단 고정 바 순서.
   하단 고정 바가 DOM 순서상 콘텐츠 뒤에 있어야 키보드 포커스가 먼저 걸리지 않는다 (UX-DR6). */
export default function BuyerShell({ tab, showTabbar = false, ctaBar = false, topbar, children }: BuyerShellProps) {
  return (
    <>
      <BuyerTopbar {...topbar} tab={tab} />
      <main className="b_main" data-tabbar={showTabbar ? "on" : undefined}>
        {children}
      </main>
      {/* 법정 고지 푸터는 전 구매자 화면 하단에 공통으로 선다 (Q3, DESIGN §544).
         <main> 뒤 · 고정 탭바 앞. b_main이 flex:1로 자라 푸터를 항상 바닥으로 민다. */}
      <BuyerFooter tabbar={showTabbar} cta={ctaBar} />
      {showTabbar ? <BuyerTabbar tab={tab} /> : null}
    </>
  );
}
