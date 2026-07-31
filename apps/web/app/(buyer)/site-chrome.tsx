"use client";

/* 새 테마 공통 크롬 — 헤더 + 푸터. 이 테마로 이전된 화면들이 함께 쓴다.
   기존 셸(buyer-shell)의 상단바·탭바·푸터를 대신하며, 옛 화면은 계속 옛 셸을 쓴다.

   기능은 기존 것을 그대로 재사용한다 — 새로 만들지 않는다:
   · 장바구니 건수 = useCartCount (레이아웃의 CartCountProvider가 이미 값을 소유)
   · 로그아웃 = POST /api/auth/logout (멱등) → 배지 리셋 → 홈으로 → 서버 갱신
   · 법정 고지(FR-31·32) = config/company.ts 정본 + 약관·개인정보 모달(PolicyLink)
   <lg에서는 카테고리를 가로 스크롤 줄로 내려 모바일에서도 탐색이 끊기지 않게 한다
   (옛 하단 탭바를 대신하는 자리). */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { BROKER_NOTICE, COMPANY } from "@/app/config/company";

import { useCartCount } from "./cart-count";
import { en, type NavCategory } from "./labels";
import PolicyLink from "./legal/policy-link";

export type { NavCategory };

export function SiteHeader({
  categories,
  loggedIn,
  activeCategory,
}: {
  categories: NavCategory[];
  loggedIn: boolean;
  activeCategory?: string | null;
}) {
  const router = useRouter();
  const { count, setCount } = useCartCount();
  const [loggingOut, setLoggingOut] = useState(false);

  function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    void (async () => {
      await fetch("/api/auth/logout", { method: "POST", cache: "no-store" }).catch(() => {});
      setCount(undefined); // 배지 리셋 — 이동 전에
      router.replace("/");
      router.refresh(); // 서버 레이아웃 재실행 → 헤더가 비로그인 상태로 동기화
    })();
  }

  const catHref = (id: string | null) => (id ? `/?category=${encodeURIComponent(id)}` : "/");

  return (
    <>
      <div className="bg-foreground py-2 text-center text-[13px] tracking-wide text-background">
        <span className="font-semibold text-accent">이번 주 편성 공개</span> · 운영자가 직접 선별한 브랜드를 가장 먼저 만나보세요
      </div>

      <header className="sticky top-0 z-50 border-b border-border bg-background">
        <div className="mx-auto flex h-[76px] max-w-[1600px] items-center gap-8 px-5 md:h-[100px]">
          <Link href="/" className="text-[26px] font-bold leading-none tracking-tight md:text-[30px]">
            SLUR.
          </Link>

          <nav className="hidden items-center gap-5 text-[13px] font-medium tracking-wide lg:flex">
            {categories.map((c) => (
              <Link
                key={c.id}
                href={catHref(c.id)}
                aria-current={activeCategory === c.id ? "page" : undefined}
                className={`uppercase transition-opacity hover:opacity-60 ${
                  activeCategory === c.id ? "font-bold" : ""
                }`}
              >
                {en(c.name)}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-4 text-[13px]">
            {loggedIn ? (
              <>
                <Link href="/me" className="hover:opacity-60">MY</Link>
                <button type="button" onClick={logout} disabled={loggingOut} className="hover:opacity-60 disabled:opacity-40">
                  LOGOUT
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="hover:opacity-60">LOGIN</Link>
                <Link href="/signup" className="hover:opacity-60">JOIN</Link>
              </>
            )}
            <Link
              href="/cart"
              className="flex items-center gap-1 hover:opacity-60"
              aria-label={count !== undefined && count > 0 ? `장바구니 ${count}건` : "장바구니"}
            >
              CART
              {count !== undefined && count > 0 ? (
                <span className="bg-accent px-1.5 text-[12px] text-accent-foreground">{count}</span>
              ) : null}
            </Link>
          </div>
        </div>

        {/* <lg — 카테고리 가로 스크롤 (모바일 탐색) */}
        <div className="flex gap-4 overflow-x-auto border-t border-border px-5 py-3 text-[13px] font-medium lg:hidden [scrollbar-width:none]">
          <Link href={catHref(null)} className={`whitespace-nowrap uppercase ${!activeCategory ? "font-bold" : "opacity-60"}`}>
            ALL
          </Link>
          {categories.map((c) => (
            <Link
              key={c.id}
              href={catHref(c.id)}
              className={`whitespace-nowrap uppercase ${activeCategory === c.id ? "font-bold" : "opacity-60"}`}
            >
              {en(c.name)}
            </Link>
          ))}
        </div>
      </header>
    </>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-muted/40">
      <div className="mx-auto max-w-[1600px] px-5 py-12">
        <div className="grid gap-10 md:grid-cols-[2fr_1fr_1fr_1fr]">
          <div>
            <p className="text-[26px] font-bold leading-none tracking-tight">SLUR.</p>
            <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-muted-foreground">
              운영자가 판매자를 직접 선별·초청하는 큐레이션형 디자인 편집숍입니다.
            </p>
          </div>
          {/* 🚨 닿는 곳이 있는 항목만 둔다 — 목적지 없는 라벨(공지사항 등)을 만들지 않는다. */}
          <div>
            <p className="mb-3.5 text-[15px] font-semibold">SUPPORT</p>
            <ul className="space-y-2.5 text-[14px] text-muted-foreground">
              <li><Link href="/faq" className="hover:text-foreground">자주 묻는 질문</Link></li>
              <li><Link href="/support" className="hover:text-foreground">1:1 문의</Link></li>
              <li><Link href="/faq#shipping" className="hover:text-foreground">배송 안내</Link></li>
              <li>
                <a href={`mailto:${COMPANY.email}`} className="hover:text-foreground">1:1 문의</a>
              </li>
            </ul>
          </div>
          <div>
            <p className="mb-3.5 text-[15px] font-semibold">POLICY</p>
            <ul className="space-y-2.5 text-[14px] text-muted-foreground">
              <li>
                {/* 클릭 시 모달(맥락 유지). JS 미탑재·새 탭이면 실제 페이지로 이동(폴백). */}
                <PolicyLink kind="terms" className="hover:text-foreground">이용약관</PolicyLink>
              </li>
              <li>
                <PolicyLink kind="privacy" className="hover:text-foreground">개인정보처리방침</PolicyLink>
              </li>
            </ul>
          </div>
          <div>
            <p className="mb-3.5 text-[15px] font-semibold">ACCOUNT</p>
            <ul className="space-y-2.5 text-[14px] text-muted-foreground">
              <li><Link href="/me" className="hover:text-foreground">내 정보</Link></li>
              <li><Link href="/orders" className="hover:text-foreground">주문내역</Link></li>
              <li><Link href="/cart" className="hover:text-foreground">장바구니</Link></li>
            </ul>
          </div>
        </div>

        {/* 법정 고지 — 정본은 config/company.ts (여기서 문구를 창작하지 않는다) */}
        <div className="mt-10 border-t border-border pt-5 text-[12px] leading-relaxed text-muted-foreground">
          <p>
            {COMPANY.name} · 대표 {COMPANY.representative} · 사업자등록번호 {COMPANY.businessRegistrationNumber} ·
            통신판매업 신고 {COMPANY.mailOrderNumber}
          </p>
          <p className="mt-1">{COMPANY.address} · {COMPANY.contact} · {COMPANY.email}</p>
          <p className="mt-3">{BROKER_NOTICE}</p>
          <p className="mt-2">실사업자 정보는 서비스 오픈 전에 교체됩니다.</p>
          <p className="mt-3">© SLUR</p>
        </div>
      </div>
    </footer>
  );
}
