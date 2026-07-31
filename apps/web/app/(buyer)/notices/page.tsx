/* 공지사항 — `/notices` (공개). 약관 개정 고지가 실리는 지면이다.

   서버에서 목록을 받아 렌더한다 — 로그인과 무관한 공개 정보이므로 클라이언트 컴포넌트로
   만들 이유가 없다. 본문은 줄바꿈만 보존하고 마크업을 해석하지 않는다(운영자 입력이 그대로
   HTML로 실행되면 안 된다). */

import type { Metadata } from "next";
import { cookies } from "next/headers";

import { API_BASE } from "@/lib/auth";

import { SiteFooter, SiteHeader } from "../site-chrome";
import type { NavCategory } from "../labels";

import "../theme.css";

export const metadata: Metadata = {
  title: "공지사항 — SLUR 편집숍",
  description: "서비스 이용에 관한 안내와 약관 개정 고지",
};

type Notice = {
  id: string;
  title: string;
  body: string;
  is_pinned: boolean;
  published_at: string | null;
};

async function getJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${path}`, { next: { revalidate: 60 } });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

function formatDate(s: string | null) {
  if (!s) return "";
  return new Date(s).toLocaleDateString("ko-KR", { dateStyle: "long", timeZone: "Asia/Seoul" });
}

export default async function NoticesPage() {
  const [categories, list, cookieStore] = await Promise.all([
    getJson<NavCategory[]>("/api/v1/products/categories", []),
    getJson<{ items: Notice[] }>("/api/v1/notices", { items: [] }),
    cookies(),
  ]);
  const items = list.items ?? [];

  return (
    <div className="slur min-h-screen">
      <SiteHeader categories={categories} loggedIn={Boolean(cookieStore.get("slur_role"))} />

      <div className="border-b border-border">
        <div className="mx-auto max-w-[1600px] px-5 py-12 text-center md:py-16">
          <h1 className="text-[34px] font-bold uppercase leading-none tracking-tight md:text-[44px]">NOTICE</h1>
          <p className="mt-3 text-[14px] text-muted-foreground">공지사항</p>
        </div>
      </div>

      <main className="mx-auto w-full max-w-[900px] px-5 py-12">
        {items.length === 0 ? (
          <p className="py-16 text-center text-[14px] text-muted-foreground">등록된 공지가 없습니다.</p>
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {items.map((n) => (
              <li key={n.id} className="py-7">
                <div className="flex flex-wrap items-center gap-2">
                  {n.is_pinned && (
                    <span className="border border-foreground px-2 py-0.5 text-[12px] font-medium">중요</span>
                  )}
                  <span className="text-[13px] text-muted-foreground">{formatDate(n.published_at)}</span>
                </div>
                <h2 className="mt-2 text-[17px] font-semibold">{n.title}</h2>
                {/* 운영자 입력을 HTML로 해석하지 않는다 — 줄바꿈만 보존 */}
                <p className="mt-3 whitespace-pre-wrap text-[14px] leading-relaxed text-muted-foreground">{n.body}</p>
              </li>
            ))}
          </ul>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
