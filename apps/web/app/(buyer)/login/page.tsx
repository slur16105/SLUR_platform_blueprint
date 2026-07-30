/* 로그인 — `/login`. **새 테마 적용 화면 (이전 6/N).**

   🚨 판매자·관리자도 이 화면으로 로그인한다 — 역할별로 진입점을 쪼개지 않는다 (FR-3).
      로그인 후 이동은 폼 안의 roleHome(role)이 정한다(콘솔 사용자는 콘솔로). 그 규칙은 무수정이다.

   서버 컴포넌트인 이유: next 검증이 클라이언트로 내려가면 "검증 후 사용" 순서를 렌더 타이밍이
   흔들 수 있고, useSearchParams()는 Suspense 경계 없이 쓰면 빌드를 흔든다.
   searchParams는 Next 16에서 Promise다. */

import type { Metadata } from "next";
import { cookies } from "next/headers";

import { API_BASE } from "@/lib/auth";
import { safeNextPath } from "@/lib/nav";

import LoginFormThemed from "./login-form-themed";
import { firstParam, kakaoNotice } from "../auth-errors";
import { SiteFooter, SiteHeader } from "../site-chrome";
import type { NavCategory } from "../labels";

import "../theme.css";

export const metadata: Metadata = { title: "로그인 — SLUR 편집숍" };

async function getJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${path}`, { next: { revalidate: 300 } });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [sp, categories, cookieStore] = await Promise.all([
    searchParams,
    getJson<NavCategory[]>("/api/v1/products/categories", []),
    cookies(),
  ]);
  const next = safeNextPath(firstParam(sp.next)); // 미들웨어가 심었더라도 소비 측이 다시 확인한다
  const notice = kakaoNotice(firstParam(sp.e));

  return (
    <div className="slur min-h-screen">
      <SiteHeader categories={categories} loggedIn={Boolean(cookieStore.get("slur_role"))} />
      <main className="mx-auto w-full max-w-[440px] px-5 py-16 md:py-24">
        <h1 className="mb-2 text-center text-[30px] font-bold uppercase tracking-tight">LOGIN</h1>
        <p className="mb-10 text-center text-[14px] text-muted-foreground">
          골라온 것들을 담아두고 바로 구매하세요.
        </p>
        <LoginFormThemed next={next} notice={notice} />
      </main>
      <SiteFooter />
    </div>
  );
}
