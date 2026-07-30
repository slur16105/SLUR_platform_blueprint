/* 내 정보 — `/me` (보호 라우트). **새 테마 적용 화면 (이전 7/N).**

   D1 — 이 화면은 규제 요건(FR-31·33)의 수용처다. 새 테마의 공통 푸터도 사업자 정보·중개자 고지를
        싣지만, 이 화면은 그것을 **본문에서 한 번 더** 분명히 보여준다.
   D3 — 두 층으로 가른다. 이 서버 컴포넌트가 사업자 정보·중개자 고지를 **API 없이** 정적으로 그리고,
        계정 구획과 로그아웃만 클라이언트다.
        🚨 계정 조회가 실패해도 법적 고지가 사라지면 안 된다 — 그 결합을 물리적으로 만들지 않는다.
   D2 — `가입 방식` 줄을 만들지 않는다. email 유무로 가입 경로를 추론하면
        **이메일이 있는 카카오 계정에 "이메일 가입"**이라고 쓰게 된다.
   🚨 회원정보 수정·배송지 관리·찜·전화번호 표시를 붙이지 않는다 (v1 밖). */

import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";

import { API_BASE } from "@/lib/auth";
import { BROKER_NOTICE, COMPANY } from "@/app/config/company";

import AccountCardThemed from "./account-card-themed";
import LogoutButtonThemed from "./logout-button-themed";
import { SiteFooter, SiteHeader } from "../site-chrome";
import type { NavCategory } from "../labels";

import "../theme.css";

export const metadata: Metadata = { title: "내 정보 — SLUR 편집숍" };

/** 사업자 정보 6항목 (UX-DR10). 🚨 값은 전부 COMPANY 상수에서 온다 —
 *  화면 코드에 상호·번호·주소 문자열을 다시 쓰지 않는다 (AD-13). */
const BIZ_ROWS: ReadonlyArray<{ label: string; value: string }> = [
  { label: "상호", value: COMPANY.name },
  { label: "대표자", value: COMPANY.representative },
  { label: "사업자등록번호", value: COMPANY.businessRegistrationNumber },
  { label: "통신판매업 신고번호", value: COMPANY.mailOrderNumber },
  { label: "주소", value: COMPANY.address },
  { label: "연락처", value: COMPANY.contact },
];

const MENU: ReadonlyArray<{ href: string; label: string }> = [{ href: "/orders", label: "주문내역" }];

async function getJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${path}`, { next: { revalidate: 300 } });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

export default async function MePage() {
  const [categories, cookieStore] = await Promise.all([
    getJson<NavCategory[]>("/api/v1/products/categories", []),
    cookies(),
  ]);

  return (
    <div className="slur min-h-screen">
      <SiteHeader categories={categories} loggedIn={Boolean(cookieStore.get("slur_role"))} />

      <div className="border-b border-border">
        <div className="mx-auto max-w-[1600px] px-5 py-12 text-center md:py-16">
          <h1 className="text-[34px] font-bold uppercase leading-none tracking-tight md:text-[44px]">MY PAGE</h1>
        </div>
      </div>

      <main className="mx-auto grid max-w-[1600px] gap-10 px-5 py-12 lg:grid-cols-2 lg:gap-14">
        {/* 좌 — 계정 + 메뉴 */}
        <div>
          <section aria-labelledby="me_h_acct" className="border border-border p-7">
            <AccountCardThemed headingId="me_h_acct" />
          </section>

          <nav aria-label="내 정보 메뉴" className="mt-6">
            {MENU.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="flex min-h-[56px] items-center justify-between border-b border-border text-[15px] transition-colors hover:text-muted-foreground"
              >
                {label}
                <span aria-hidden="true" className="text-[18px] text-muted-foreground">›</span>
              </Link>
            ))}
          </nav>

          <div className="mt-8">
            <LogoutButtonThemed />
          </div>
        </div>

        {/* 우 — 사업자 정보 + 중개자 고지 (FR-31·32). API 없이 선다. */}
        <section aria-labelledby="me_h_biz">
          <div className="mb-4 flex items-center gap-3">
            <h2 id="me_h_biz" className="text-[12px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              사업자 정보
            </h2>
            {/* placeholder를 실제 정보로 오인하지 않게 하는 장치 */}
            <span className="border border-dashed border-border px-2 py-0.5 text-[11px] text-muted-foreground">
              임시 정보
            </span>
          </div>

          <dl className="border border-dashed border-border p-6 text-[14px]">
            {BIZ_ROWS.map(({ label, value }) => (
              <div key={label} className="flex gap-5 border-b border-border py-3 last:border-b-0">
                <dt className="w-32 flex-none text-muted-foreground">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>

          <p className="mt-4 text-[13px] text-muted-foreground">실사업자 정보는 서비스 오픈 전에 교체됩니다.</p>
          {/* 🚨 문장을 복사하지 않는다 — 정본은 config/company.ts의 BROKER_NOTICE다.
              접히지 않는다. 모달·`더보기` 뒤로 숨기지 않는다 (UX-DR10). */}
          <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">{BROKER_NOTICE}</p>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
