"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { BUYER_NAV_ITEMS, CartBadge, type BuyerTab } from "./buyer-icons";

/* 상단 내비 — ≥768에서만 보인다(CSS display).
   탭바와 같은 4항목 정의를 공유하며, 13px/600 · 활성은 먹색 800.
   밑줄·알약·색 채움을 두지 않는다. */
export default function BuyerTopnav({ tab }: { tab?: BuyerTab }) {
  const pathname = usePathname();

  return (
    <nav className="b_topnav" aria-label="주요 메뉴">
      {BUYER_NAV_ITEMS.map(({ key, label, href }) => {
        const active = key === tab;
        return (
          <Link
            key={key}
            href={href}
            className="b_topnav_item"
            data-active={active ? "true" : undefined}
            aria-current={active ? "page" : undefined}
            onClick={() => {
              if (pathname === href) window.scrollTo({ top: 0 });
            }}
          >
            {label}
            {key === "cart" ? <CartBadge /> : null}
          </Link>
        );
      })}
    </nav>
  );
}
