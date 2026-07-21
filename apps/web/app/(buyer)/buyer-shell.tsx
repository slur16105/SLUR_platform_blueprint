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
  topbar: BuyerTopbarProps;
  children: React.ReactNode;
};

/* 구매자 셸 — 상단바 → <main> → 하단 고정 바 순서.
   하단 고정 바가 DOM 순서상 콘텐츠 뒤에 있어야 키보드 포커스가 먼저 걸리지 않는다 (UX-DR6). */
export default function BuyerShell({ tab, showTabbar = false, topbar, children }: BuyerShellProps) {
  return (
    <>
      <BuyerTopbar {...topbar} tab={tab} />
      <main className="b_main" data-tabbar={showTabbar ? "on" : undefined}>
        {children}
      </main>
      {showTabbar ? <BuyerTabbar tab={tab} /> : null}
    </>
  );
}
