"use client";

/* 구매자 로그아웃 — **새 테마 판**. logout-link.tsx의 규약 그대로:
   POST /api/auth/logout(멱등) → 배지 리셋 → replace("/") → refresh().
   🚨 배지 리셋이 없으면 로그아웃 후에도 숫자가 남는다(같은 레이아웃이라 remount되지 않는다).
   🚨 push가 아니라 replace다 — 뒤로 가기로 로그아웃된 /me에 돌아가면 401 화면을 본다.
   🚨 확인 줄·실패 문구를 두지 않는다 — 되돌릴 수 없는 파괴적 동작이 아니고,
      BFF가 멱등이라 상류가 죽어도 쿠키는 지워진다. */

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import { useCartCount } from "../cart-count";

export default function LogoutButtonThemed() {
  const router = useRouter();
  const { setCount } = useCartCount();
  const [pending, setPending] = useState(false);

  const logout = useCallback(() => {
    if (pending) return; // 중복 제출 차단
    setPending(true);
    void (async () => {
      await fetch("/api/auth/logout", { method: "POST", cache: "no-store" }).catch(() => {});
      setCount(undefined);
      router.replace("/");
      router.refresh();
    })();
  }, [pending, router, setCount]);

  return (
    <button
      type="button"
      onClick={logout}
      disabled={pending}
      className="text-[14px] text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground disabled:opacity-50"
    >
      로그아웃
    </button>
  );
}
