/* 자주 묻는 질문 — `/faq` (공개). **새 테마 화면.**

   ⚠️ PRD 화면 목록 밖 신설이다(오너 결정 2026-07-30). 내용은 하드코딩이며
      관리자 화면에서 고칠 수 없다 — 바꾸려면 faq-content.ts를 고치고 배포한다.

   🚨 아코디언을 JS로 만들지 않고 <details>/<summary>로 짠다 — 스크린리더·키보드가
      브라우저 기본 동작으로 이미 지원되고, JS가 없어도 내용이 보인다.
   🚨 계좌·기한 같은 실제 값을 여기 적지 않는다 — 서버 값을 말하는 곳(주문완료·주문상세)과
      두 벌이 되면 언젠가 어긋난다. */

import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";

import { API_BASE } from "@/lib/auth";
import { BROKER_NOTICE, COMPANY } from "@/app/config/company";

import { FAQ_GROUPS } from "./faq-content";
import { SiteFooter, SiteHeader } from "../site-chrome";
import type { NavCategory } from "../labels";

import "../theme.css";

export const metadata: Metadata = {
  title: "자주 묻는 질문 — SLUR 편집숍",
  description: "주문·결제·배송·취소에 관해 자주 묻는 질문 — SLUR 편집숍",
};

async function getJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${path}`, { next: { revalidate: 300 } });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

export default async function FaqPage() {
  const [categories, cookieStore] = await Promise.all([
    getJson<NavCategory[]>("/api/v1/products/categories", []),
    cookies(),
  ]);

  return (
    <div className="slur min-h-screen">
      <SiteHeader categories={categories} loggedIn={Boolean(cookieStore.get("slur_role"))} />

      <div className="border-b border-border">
        <div className="mx-auto max-w-[1600px] px-5 py-12 text-center md:py-16">
          <h1 className="text-[34px] font-bold uppercase leading-none tracking-tight md:text-[44px]">FAQ</h1>
          <p className="mt-3 text-[14px] text-muted-foreground">자주 묻는 질문</p>
        </div>
      </div>

      <main className="mx-auto w-full max-w-[900px] px-5 py-12">
        {/* 그룹 바로가기 — 앵커. 푸터의 `배송 안내`도 #shipping으로 들어온다. */}
        <nav aria-label="주제 바로가기" className="mb-10 flex flex-wrap gap-2">
          {FAQ_GROUPS.map((g) => (
            <a
              key={g.id}
              href={`#${g.id}`}
              className="border border-border px-4 py-2 text-[13px] transition-colors hover:border-foreground"
            >
              {g.title}
            </a>
          ))}
        </nav>

        {FAQ_GROUPS.map((group) => (
          <section key={group.id} id={group.id} className="mb-12 scroll-mt-[120px]">
            <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {group.title}
            </h2>
            <div className="border-t border-border">
              {group.items.map((item) => (
                <details key={item.q} className="group border-b border-border">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-[16px] font-medium [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <span
                      aria-hidden="true"
                      className="flex-none text-[20px] leading-none text-muted-foreground transition-transform group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="pb-6 text-[15px] leading-relaxed text-muted-foreground">{item.a}</p>
                </details>
              ))}
            </div>
          </section>
        ))}

        {/* 더 물을 곳 — 여기서만 연락처를 노출한다(정본은 config/company.ts) */}
        <section className="border border-border p-7">
          <h2 className="text-[15px] font-semibold">더 궁금한 점이 있으신가요?</h2>
          <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
            찾으시는 답이 없으면 아래로 문의해 주세요. 주문번호를 함께 알려주시면 빠르게 확인할 수 있습니다.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <a
              href={`mailto:${COMPANY.email}`}
              className="border border-foreground px-6 py-3 text-[14px] font-semibold transition-colors hover:bg-foreground hover:text-background"
            >
              이메일 문의
            </a>
            <Link
              href="/orders"
              className="border border-border px-6 py-3 text-[14px] transition-colors hover:border-foreground"
            >
              주문내역 확인
            </Link>
          </div>
          <p className="mt-5 text-[12px] leading-relaxed text-muted-foreground">{BROKER_NOTICE}</p>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
