/* 회원가입 — `/signup`. **새 테마 적용 화면 (이전 6/N).**
   next는 로그인과 같은 규칙으로 소비된다 — 서버에서 한 번 거른 뒤 폼에 문자열로 내린다. */

import type { Metadata } from "next";
import { cookies } from "next/headers";

import { API_BASE } from "@/lib/auth";
import { safeNextPath } from "@/lib/nav";

import SignupFormThemed from "./signup-form-themed";
import { firstParam } from "../auth-errors";
import { SiteFooter, SiteHeader } from "../site-chrome";
import type { NavCategory } from "../labels";

import "../theme.css";

export const metadata: Metadata = { title: "회원가입 — SLUR 편집숍" };

async function getJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${path}`, { next: { revalidate: 300 } });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [sp, categories, cookieStore] = await Promise.all([
    searchParams,
    getJson<NavCategory[]>("/api/v1/products/categories", []),
    cookies(),
  ]);
  const next = safeNextPath(firstParam(sp.next));

  return (
    <div className="slur min-h-screen">
      <SiteHeader categories={categories} loggedIn={Boolean(cookieStore.get("slur_role"))} />
      <main className="mx-auto w-full max-w-[440px] px-5 py-16 md:py-24">
        <h1 className="mb-2 text-center text-[30px] font-bold uppercase tracking-tight">JOIN</h1>
        <p className="mb-10 text-center text-[14px] text-muted-foreground">
          가입하면 구매자로 시작합니다.
        </p>
        <SignupFormThemed next={next} />
      </main>
      <SiteFooter />
    </div>
  );
}
