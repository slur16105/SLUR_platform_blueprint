"use client";

/* 계정 구획 — **새 테마 판**. account-card.tsx의 로직 그대로, 마크업만 교체.
   🚨 email은 null 가능(소셜 전용 계정). 빈 값은 `—`로 자리를 지킨다 — 줄을 지우면
      레이아웃이 계정마다 달라진다.
   🚨 401 → /login?next=%2Fme. 미들웨어 통과는 인증이 아니다(AD-1). */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getPublicJson, type ApiFailure } from "../buyer-feedback";

type MeResponse = { id: string; email: string | null; name: string; phone: string };

const EMPTY = "—";

export default function AccountCardThemed({ headingId }: { headingId: string }) {
  const router = useRouter();
  const [result, setResult] = useState<{ data: MeResponse | null; error: ApiFailure | null } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const toLogin = useCallback(() => router.replace("/login?next=%2Fme"), [router]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const r = await getPublicJson<MeResponse>("/api/auth/me");
      if (!alive) return;
      if (!r.ok && r.error.code === "unauthorized") {
        toLogin();
        return;
      }
      setResult(r.ok ? { data: r.data, error: null } : { data: null, error: r.error });
    })();
    return () => {
      alive = false;
    };
  }, [reloadKey, toLogin]);

  const retry = useCallback(() => {
    setResult(null);
    setReloadKey((k) => k + 1);
  }, []);

  return (
    <>
      <h2 id={headingId} className="text-[12px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        계정
      </h2>

      {result === null ? (
        /* 최초 로딩 — 블록 골격. 화면 중앙 스피너를 쓰지 않는다 (UX-DR9). */
        <div aria-hidden="true">
          <div className="mt-4 h-7 w-40 animate-pulse bg-muted" />
          <div className="mt-2 h-4 w-56 animate-pulse bg-muted" />
        </div>
      ) : result.error ? (
        <div className="mt-4">
          <p className="text-[14px] text-accent">{result.error.message}</p>
          <button type="button" onClick={retry} className="mt-3 border border-foreground px-5 py-2 text-[13px]">
            다시 시도
          </button>
        </div>
      ) : (
        <>
          <p className="mt-4 text-[24px] font-semibold tracking-tight">{result.data?.name || EMPTY}</p>
          <p className="mt-1.5 text-[14px] text-muted-foreground">{result.data?.email || EMPTY}</p>
        </>
      )}
    </>
  );
}
