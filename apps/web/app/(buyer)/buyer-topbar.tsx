"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { CartBadge, IconBack, IconCart, type BuyerTab } from "./buyer-icons";
import BuyerTopnav from "./buyer-topnav";
import { useCartCount } from "./cart-count";

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
  /* 링크에 aria-label이 있으면 그것이 이름의 전부가 되어 안의 배지 숫자가 낭독되지 않는다.
     탭바·상단 내비는 글자 라벨을 갖고 있어 문제가 없지만 여기는 아이콘뿐이다 —
     그래서 건수를 이름에 함께 싣는다. 값이 없으면(비로그인·조회 전) `장바구니`만 읽는다. */
  const { count } = useCartCount();
  const cartLabel = count !== undefined && count > 0 ? `장바구니 ${count}건` : "장바구니";

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
          ) : title ? (
            /* 제목이 없으면 제목 노드를 렌더하지 않는다 — 상품상세의 상단바는
               뒤로가기 + 장바구니이며 제목이 없다 (8.3 D14-1). */
            <span className="b_topbar_title i_heading">{title}</span>
          ) : null}

          {/* 광학 중앙 정렬용 빈 자리는 우측에 아무것도 없을 때만 필요하다 */}
          {variant === "back-title" && !showCart ? (
            <span className="i_spacer" aria-hidden="true" />
          ) : null}

          {showCart && variant !== "logo-center" ? (
            <Link href="/cart" className="i_cart" aria-label={cartLabel}>
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
