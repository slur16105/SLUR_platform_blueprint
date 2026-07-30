"use client";

/* 로그인 폼 — **새 테마 판**.

   🚨 login-form.tsx의 **로직을 그대로 옮긴 것**이고 바뀐 것은 마크업뿐이다.
   🚨 이 화면은 구매자 전용이 아니다 — 판매자·관리자도 여기로 로그인한다 (FR-3).
      로그인 후 이동은 roleHome(role)이 정한다(콘솔 사용자는 콘솔로 간다). 이 규칙을 건드리지 않는다.
   · 오류는 필드에만 표시한다 — 상단 요약 배너를 쓰지 않는다 (UX-DR9).
   · 401은 어느 쪽이 틀렸는지 말하지 않고 두 필드를 함께 표시한다(계정 존재 노출 방지).
   · 카카오는 형제 폼이다 — 중첩하면 HTML이 무효가 되고 제출이 어긋난다.
     GET 링크가 아니라 POST인 이유는 소셜 login-CSRF 차단이다 (D4). */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { MSG, mapFieldErrors, type ErrorEnvelope, type FieldErrors } from "../auth-errors";
import { useCartCount } from "../cart-count";
import { roleHome } from "@/lib/nav";

const FIELDS = ["email", "password"] as const;

const INPUT =
  "w-full border border-border bg-background px-4 h-12 text-[15px] transition-colors focus:border-foreground focus:outline-none";

/* 카카오 말풍선 — 인라인 SVG. 아이콘 폰트·이모지·외부 CDN 금지 (UX-DR16). */
function KakaoMark() {
  return (
    <svg width="17" height="16" viewBox="0 0 18 17" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M9 1C4.58 1 1 3.79 1 7.23c0 2.2 1.47 4.13 3.68 5.22l-.93 3.4a.34.34 0 0 0 .52.38l4.05-2.66c.22.02.45.03.68.03 4.42 0 8-2.79 8-6.37C17 3.79 13.42 1 9 1Z"
      />
    </svg>
  );
}

export default function LoginFormThemed({ next, notice }: { next: string | null; notice: string | null }) {
  const router = useRouter();
  const { refresh: refreshCartCount } = useCartCount();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const signupHref = next ? `/signup?next=${encodeURIComponent(next)}` : "/signup";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return; // 중복 제출 차단
    setBusy(true);
    setFieldErrors({});
    setMessage(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data: ErrorEnvelope & { role?: string } = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.code === "invalid_credentials") {
          setFieldErrors({ email: "", password: "" }); // 두 필드 모두 오류 면
          setMessage(MSG.invalidCredentials);
        } else if (data.code === "validation_error") {
          const { fields, rest } = mapFieldErrors(data.details, FIELDS);
          setFieldErrors(fields);
          setMessage(rest[0] ?? (Object.keys(fields).length ? null : MSG.invalidInput));
        } else if (data.code === "service_unavailable") {
          setMessage(MSG.serviceUnavailable);
        } else {
          setMessage(MSG.generic);
        }
        return;
      }
      /* 방금 로그인한 사람의 장바구니 배지가 비어 있지 않도록 다시 읽게 한다.
         이동은 그대로다(콘솔 역할 포함) — 이 호출은 배지 값만 건드린다. */
      refreshCartCount();
      router.replace(next ?? roleHome(data.role));
      router.refresh(); // Router Cache 잔상 제거
    } catch {
      setMessage(MSG.network);
    } finally {
      setBusy(false);
    }
  }

  const hasError = (f: string) => f in fieldErrors;
  const describedBy = (f: string) =>
    [fieldErrors[f] ? `${f}_err` : null, message ? "login_msg" : null].filter(Boolean).join(" ") || undefined;

  return (
    <>
      <form onSubmit={submit} noValidate>
        <div className="mb-5">
          <label className="mb-2 block text-[13px] font-medium" htmlFor="email">이메일</label>
          <input
            id="email"
            className={`${INPUT} ${hasError("email") ? "border-accent" : ""}`}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="이메일을 입력하세요"
            required
            autoComplete="email"
            aria-invalid={hasError("email") || undefined}
            aria-describedby={describedBy("email")}
          />
          {fieldErrors.email ? (
            <p className="mt-2 text-[12px] text-accent" id="email_err" role="alert">{fieldErrors.email}</p>
          ) : null}
        </div>

        <div className="mb-6">
          <label className="mb-2 block text-[13px] font-medium" htmlFor="password">비밀번호</label>
          <input
            id="password"
            className={`${INPUT} ${hasError("password") ? "border-accent" : ""}`}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호를 입력하세요"
            required
            autoComplete="current-password"
            aria-invalid={hasError("password") || undefined}
            aria-describedby={describedBy("password")}
          />
          {fieldErrors.password ? (
            <p className="mt-2 text-[12px] text-accent" id="password_err" role="alert">{fieldErrors.password}</p>
          ) : null}
          {message ? (
            <p className="mt-2 text-[12px] text-accent" id="login_msg" role="alert">{message}</p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={busy}
          className="h-14 w-full bg-foreground text-[15px] font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "로그인 중" : "로그인"}
        </button>
      </form>

      <div className="my-6 flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        <span className="text-[12px] text-muted-foreground">또는</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      {/* 🚨 카카오는 로그인 폼의 **형제 폼**이다 — 중첩하면 제출이 어긋난다. POST인 이유는 login-CSRF 차단. */}
      <form action="/api/auth/kakao/start" method="post">
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <button
          type="submit"
          className="flex h-14 w-full items-center justify-center gap-2 bg-[#FEE500] text-[15px] font-semibold text-[#3c1e1e] transition-opacity hover:opacity-90"
        >
          <KakaoMark />
          카카오로 시작하기
        </button>
      </form>

      {notice ? (
        <p className="mt-4 text-center text-[13px] text-accent" role="alert">{notice}</p>
      ) : null}

      <p className="mt-8 text-center text-[14px] text-muted-foreground">
        아직 회원이 아니신가요?
        <Link href={signupHref} className="ml-2 font-semibold text-foreground underline underline-offset-4">
          회원가입
        </Link>
      </p>
    </>
  );
}
