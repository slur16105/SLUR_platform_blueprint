"use client";

/* 콘솔 셸 — 관리자·판매자 공통 사이드바 + 상단바.
   시각 어휘는 슬러 시맨틱 토큰만 쓴다(console-shell.css). 하드코딩 색 없음.
   다크 사이드바는 --color-surface-inverse라 다크모드에서 자동 반전된다.
   기능/데이터는 이 컴포넌트가 갖지 않는다 — 순수 레이아웃. 페이지 로직은 children이 소유. */

import type { ReactNode } from "react";
import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

import LogoutButton from "@/app/logout-button";

import "./console-shell.css";

type Role = "admin" | "seller";
type NavItem = { href: string; label: string; icon: ReactNode };

// 아이콘은 인라인 SVG(외부 아이콘/이모지 금지 — 슬러 규칙). currentColor로 색 상속.
const I = {
  grid: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="2" y="2" width="5" height="5" rx="1" /><rect x="9" y="2" width="5" height="5" rx="1" /><rect x="2" y="9" width="5" height="5" rx="1" /><rect x="9" y="9" width="5" height="5" rx="1" /></svg>
  ),
  list: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M2 4h12M2 8h12M2 12h8" strokeLinecap="round" /></svg>
  ),
  card: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="2" y="4" width="12" height="8" rx="1" /><path d="M2 7h12" /></svg>
  ),
  layout: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="2" y="2" width="12" height="5" rx="1" /><rect x="2" y="9" width="12" height="5" rx="1" /></svg>
  ),
  people: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="7" cy="7" r="4" /><path d="M13 13l-2.5-2.5" strokeLinecap="round" /></svg>
  ),
  gear: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="8" cy="8" r="2.5" /><path d="M8 1v2M8 13v2M1 8h2M13 8h2" strokeLinecap="round" /></svg>
  ),
  box: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M8 2l6 3v6l-6 3-6-3V5z" strokeLinejoin="round" /><path d="M2 5l6 3 6-3M8 8v6" /></svg>
  ),
  badge: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M8 1.5l1.6 1.1 1.9-.2.7 1.8 1.6 1v1.9l1 1.6-1 1.6v1.9l-1.6 1-.7 1.8-1.9-.2L8 14.5l-1.6-1.1-1.9.2-.7-1.8-1.6-1V8.9l-1-1.6 1-1.6V3.8l1.6-1 .7-1.8 1.9.2z" strokeLinejoin="round" /><path d="M6 8l1.5 1.5L10.5 6.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ),
};

const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "대시보드", icon: I.grid },
  { href: "/admin/orders", label: "주문 관리", icon: I.list },
  { href: "/admin/deposits", label: "입금 확인", icon: I.card },
  { href: "/admin/sellers/applications", label: "입점 심사", icon: I.badge },
  { href: "/admin/home", label: "홈 편성", icon: I.layout },
  { href: "/admin/lookup", label: "회원·판매자", icon: I.people },
  { href: "/admin/settings", label: "설정", icon: I.gear },
];

const SELLER_NAV: NavItem[] = [
  { href: "/seller", label: "대시보드", icon: I.grid },
  { href: "/seller/products", label: "상품 관리", icon: I.box },
  { href: "/seller/orders", label: "주문 관리", icon: I.list },
];

export default function ConsoleShell({
  role,
  title,
  description,
  actions,
  children,
}: {
  role: Role;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const nav = role === "seller" ? SELLER_NAV : ADMIN_NAV;
  const home = role === "seller" ? "/seller" : "/admin";
  const isActive = (href: string) => (href === home ? pathname === home : pathname.startsWith(href));

  return (
    <div className="console_shell">
      <aside className="console_side" data-open={open ? "" : undefined}>
        <div className="l_brand">
          <b>SLUR</b>
          <span>{role === "seller" ? "SELLER" : "ADMIN"}</span>
        </div>
        <nav className="l_nav">
          {nav.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className="l_link"
              data-on={isActive(it.href) ? "" : undefined}
              onClick={() => setOpen(false)}
            >
              <span className="i_ic">{it.icon}</span>
              {it.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="console_scrim" data-open={open ? "" : undefined} onClick={() => setOpen(false)} aria-hidden="true" />

      <div className="console_main">
        <header className="console_topbar">
          <button className="l_menu btn m_icon" type="button" aria-label="메뉴 열기" onClick={() => setOpen((v) => !v)}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 4h12M2 8h12M2 12h12" strokeLinecap="round" /></svg>
          </button>
          <span className="l_crumb">{role === "seller" ? "판매자 콘솔" : "관리자 콘솔"}</span>
          <div className="l_top_actions">
            <LogoutButton />
          </div>
        </header>

        <div className="console_body">
          <div className="l_page_head">
            <div>
              <h1 className="l_h1">{title}</h1>
              {description ? <p className="l_desc">{description}</p> : null}
            </div>
            {actions ? <div className="l_actions">{actions}</div> : null}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
