"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { MSG, mapFieldErrors, type ErrorEnvelope, type FieldErrors } from "../auth-errors";
import { useCartCount } from "../cart-count";
import { roleHome } from "@/lib/nav";

const FIELDS = ["email", "password"] as const;

/* 카카오 말풍선 — 인라인 SVG. 아이콘 폰트·이모지·외부 CDN 금지 (UX-DR16).
   면으로 그리는 마크라 셸의 stroke-width 규칙과 무관하다. */
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

/* 로그인 폼.
   오류는 필드에만 표시한다 — 상단 요약 배너를 쓰지 않는다 (UX-DR9).
   401은 어느 쪽이 틀렸는지 말하지 않고 두 필드를 함께 표시한다. */
export default function LoginForm({ next, notice }: { next: string | null; notice: string | null }) {
  const router = useRouter();
  const { refresh: refreshCartCount } = useCartCount();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null); // 비밀번호 아래 한 줄
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
          setFieldErrors({ email: "", password: "" }); // 두 필드 모두 오류 면 — 문장은 아래 한 줄로
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
      /* /login도 (buyer) 그룹이라 아래 replace로는 배지 프로바이더가 remount되지 않는다 —
         방금 로그인한 사람의 장바구니 배지가 비어 있지 않도록 여기서 다시 읽게 한다.
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
  // 라벨-필드-오류를 프로그램적으로 묶는다 (UX-DR9). 401은 필드별 문장 없이 아래 한 줄만 가리킨다.
  const describedBy = (f: string) =>
    [fieldErrors[f] ? `${f}_err` : null, message ? "login_msg" : null].filter(Boolean).join(" ") || undefined;

  return (
    <>
      <form className="b_authform" onSubmit={submit} noValidate>
        <div className="b_field">
          <label className="b_label" htmlFor="email">
            이메일
          </label>
          <input
            id="email"
            className={`b_input b_input_text${hasError("email") ? " m_error" : ""}`}
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
            <p className="b_err_msg" id="email_err" role="alert">
              {fieldErrors.email}
            </p>
          ) : null}
        </div>

        <div className="b_field m_last">
          <label className="b_label" htmlFor="password">
            비밀번호
          </label>
          <input
            id="password"
            className={`b_input b_input_text${hasError("password") ? " m_error" : ""}`}
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
            <p className="b_err_msg" id="password_err" role="alert">
              {fieldErrors.password}
            </p>
          ) : null}
          {message ? (
            <p className="b_err_msg" id="login_msg" role="alert">
              {message}
            </p>
          ) : null}
        </div>

        <button className="b_btn b_button_text m_solid m_full" type="submit" disabled={busy}>
          로그인
        </button>
      </form>

      <div className="b_or" aria-hidden="true">
        <span className="i_line" />
        <span className="i_text">또는</span>
        <span className="i_line" />
      </div>

      {/* 카카오는 로그인 폼의 형제 폼이다 — 중첩하면 HTML이 무효가 되고 제출이 어긋난다.
          GET 링크가 아니라 POST인 이유는 소셜 login-CSRF 차단이다 (D4). */}
      <form className="b_kakaoform" action="/api/auth/kakao/start" method="post">
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <button className="b_btn b_button_text m_kakao m_full" type="submit">
          <KakaoMark />
          카카오로 시작하기
        </button>
      </form>

      {notice ? (
        <p className="b_err_msg m_center" role="alert">
          {notice}
        </p>
      ) : null}

      <p className="b_footlink">
        아직 회원이 아니신가요?
        <Link href={signupHref} className="i_link">
          <span>회원가입</span>
        </Link>
      </p>
    </>
  );
}
