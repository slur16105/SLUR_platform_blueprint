"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { CartBadge, IconBack, IconCart, type BuyerTab } from "./buyer-icons";
import BuyerTopnav from "./buyer-topnav";

export type BuyerTopbarVariant = "logo" | "logo-center" | "back-title" | "title";

export type BuyerTopbarProps = {
  /** logo = 로고 + 장바구니 / logo-center = 로그인·주문완료 전용 / back-title = 뒤로가기 + 제목 / title = 제목만(좌측 정렬) */
  variant: BuyerTopbarVariant;
  title?: string;
  showCart?: boolean;
};

/* 상단바 — 54px 고정, 네 형태.
   ≥768에서는 형태와 무관하게 로고 + 상단 내비 한 형태로 수렴하고 뒤로가기가 사라진다.
   두 형태를 모두 렌더하고 CSS display로만 전환한다 — 폭이 바뀌어도 언마운트되지 않는다. */
export default function BuyerTopbar({
  variant,
  title,
  showCart = false,
  tab,
}: BuyerTopbarProps & { tab?: BuyerTab }) {
  const router = useRouter();

  return (
    <header className="b_topbar">
      <div className="b_topbar_in b_container">
        {/* < 768 — 화면별 형태 */}
        <div className="i_compact" data-variant={variant}>
          {variant === "back-title" ? (
            <button type="button" className="i_back" onClick={() => router.back()} aria-label="뒤로 가기">
              <IconBack />
            </button>
          ) : null}

          {variant === "logo" || variant === "logo-center" ? (
            <Link href="/" className="b_logo i_brand">
              SLUR
            </Link>
          ) : (
            <span className="b_topbar_title i_heading">{title}</span>
          )}

          {variant === "back-title" ? (
            <span className="i_spacer" aria-hidden="true" />
          ) : null}

          {showCart && variant !== "logo-center" ? (
            <Link href="/cart" className="i_cart" aria-label="장바구니">
              <IconCart />
              <CartBadge />
            </Link>
          ) : null}
        </div>

        {/* ≥ 768 — 로고 + 상단 내비로 수렴 */}
        <div className="i_wide">
          <Link href="/" className="b_logo">
            SLUR
          </Link>
          <BuyerTopnav tab={tab} />
        </div>
      </div>
    </header>
  );
}
