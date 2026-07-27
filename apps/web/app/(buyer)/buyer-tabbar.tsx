"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { BUYER_NAV_ITEMS, CartBadge, type BuyerTab } from "./buyer-icons";
import { disarmHomeScroll } from "./home-scroll";

/* 하단 고정 탭바 — 56px, 4탭 균등.
   활성 표시는 색 채움이 아니라 먹색 + 라벨 굵기 800 + 아이콘 선 굵기 1.4→1.9px (UX-DR3).
   ≥768에서는 CSS로 감춘다(display:none) — 조건부 렌더가 아니다.
   DOM 순서상 <main> 뒤에 놓인다 (UX-DR6). */
export default function BuyerTabbar({ tab }: { tab?: BuyerTab }) {
  const pathname = usePathname();

  return (
    <nav className="b_tabbar" aria-label="주요 메뉴">
      {BUYER_NAV_ITEMS.map(({ key, label, href, Icon }) => {
        const active = key === tab;
        return (
          <Link
            key={key}
            href={href}
            className="b_tab"
            data-active={active ? "true" : undefined}
            aria-current={active ? "page" : undefined}
            onClick={() => {
              // 홈 탭으로 진입할 땐 스크롤 복원 무장을 해제한다 — 카드 클릭 후 홈 탭 재탭은 최상단(재탭 규칙),
              // 뒤로가기(카드→상세→뒤로)만 복원되게 한다.
              if (key === "home") disarmHomeScroll();
              // 같은 탭 재탭 → 최상단 복귀. prefers-reduced-motion을 존중해 smooth를 쓰지 않는다.
              if (pathname === href) window.scrollTo({ top: 0 });
            }}
          >
            <span className="i_icon">
              <Icon />
              {key === "cart" ? <CartBadge /> : null}
            </span>
            <span className="b_tab_label">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
