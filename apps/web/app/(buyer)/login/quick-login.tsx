"use client";

/* 빠른 로그인 — **로컬 확인 전용**. 역할별 데모 계정으로 한 번에 들어간다.

   🚨 실서비스에 절대 노출되면 안 된다. 노출 판정은 **서버**가 한다(page.tsx에서 DEV_QUICK_LOGIN
      환경변수를 읽어 이 컴포넌트를 렌더할지 정한다) — 클라이언트에서 판정하면 번들에 계정이
      남고, 조건이 틀어지는 순간 그대로 드러난다.
   🚨 계정·비밀번호는 로컬 시더가 만드는 데모 값이다(app/local_seed.py). 실계정을 여기 적지 않는다.

   로그인 자체는 일반 경로(/api/auth/login)를 그대로 쓴다 — 우회 경로를 만들지 않는다. */

import { useRouter } from "next/navigation";
import { useState } from "react";

import { roleHome } from "@/lib/nav";

const ACCOUNTS = [
  { key: "admin", label: "관리자", email: "local-admin@example.com", password: "local-admin-password-2026" },
  { key: "seller", label: "판매자", email: "local-seller@example.com", password: "local-seller-password-2026" },
  { key: "buyer", label: "손님", email: "local-buyer@example.com", password: "local-buyer-password-2026" },
];

export default function QuickLogin({ next }: { next: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function login(acc: (typeof ACCOUNTS)[number]) {
    if (busy) return;
    setBusy(acc.key);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: acc.email, password: acc.password }),
      });
      if (!res.ok) {
        // 시드를 안 돌렸을 때가 대부분이다 — 무엇을 하면 되는지 알려준다
        setError(`${acc.label} 계정으로 로그인하지 못했습니다. 시드를 먼저 실행하세요: docker compose --profile tools run --rm seed`);
        return;
      }
      const data = await res.json().catch(() => null);
      router.replace(next || roleHome(data?.role));
      router.refresh();
    } catch {
      setError("네트워크 연결을 확인해 주세요.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mb-8 border border-dashed border-border p-4" aria-labelledby="quick_login_cap">
      <p id="quick_login_cap" className="text-[12px] font-medium text-muted-foreground">
        로컬 확인용 빠른 로그인 — 실서비스에는 나타나지 않습니다
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {ACCOUNTS.map((a) => (
          <button
            key={a.key}
            type="button"
            disabled={busy !== null}
            onClick={() => login(a)}
            className="h-10 border border-border text-[13px] transition-colors hover:border-foreground disabled:opacity-50"
          >
            {busy === a.key ? "로그인 중…" : a.label}
          </button>
        ))}
      </div>
      {error && <p className="mt-3 text-[12px] text-accent" role="alert">{error}</p>}
    </section>
  );
}
