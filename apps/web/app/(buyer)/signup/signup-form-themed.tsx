"use client";

/* 회원가입 폼 — **새 테마 판**.
   🚨 signup-form.tsx의 **로직을 그대로 옮긴 것**이고 바뀐 것은 마크업뿐이다.
   · 클라이언트 선검증은 백엔드 계약과 **같은 값**으로만 한다 — 더 엄격하면 백엔드가 통과시키는
     입력을 화면이 막아 사용자만 손해다.
   · 동의 사실은 서버가 가입 트랜잭션에서 직접 기록한다(user_agreements) — 화면이 따로 보내지 않는다.
     화면은 "지금 시행 중인 버전"을 표기해, 어떤 문서에 동의하는지 사용자가 확인할 수 있게 한다.
   · 가입 성공 후 이동·배지 갱신 규칙은 로그인과 같다. */

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { MSG, mapFieldErrors, type ErrorEnvelope, type FieldErrors } from "../auth-errors";
import { useCartCount } from "../cart-count";
import PolicyLink from "../legal/policy-link";
import { roleHome } from "@/lib/nav";

const FIELDS = ["email", "password", "name", "phone"] as const;
const PHONE_RE = /^01[016789]\d{7,8}$/;

const INPUT =
  "w-full border border-border bg-background px-4 h-12 text-[15px] transition-colors focus:border-foreground focus:outline-none";

function Field({
  id,
  label,
  optional,
  type,
  inputMode,
  value,
  onChange,
  placeholder,
  autoComplete,
  help,
  error,
}: {
  id: string;
  label: string;
  optional?: boolean;
  type: string;
  inputMode?: "numeric";
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoComplete: string;
  help?: string;
  error?: string;
}) {
  const helpId = help ? `${id}_help` : undefined;
  const errId = error ? `${id}_err` : undefined;
  const describedBy = [errId, helpId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="mb-5">
      <label className="mb-2 block text-[13px] font-medium" htmlFor={id}>
        {label}
        {optional ? <span className="ml-1.5 text-[12px] text-muted-foreground">(선택)</span> : null}
      </label>
      <input
        id={id}
        className={`${INPUT} ${error ? "border-accent" : ""}`}
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
      />
      {help ? <p className="mt-2 text-[12px] text-muted-foreground" id={helpId}>{help}</p> : null}
      {error ? <p className="mt-2 text-[12px] text-accent" id={errId} role="alert">{error}</p> : null}
    </div>
  );
}

export default function SignupFormThemed({ next }: { next: string | null }) {
  const router = useRouter();
  const { refresh: refreshCartCount } = useCartCount();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // 시행 중인 약관 버전 — 실패해도 가입은 막지 않는다(동의 기록은 서버가 남긴다)
  const [versions, setVersions] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    void (async () => {
      const res = await fetch("/api/legal/agreements").catch(() => null);
      if (!alive || !res?.ok) return;
      const rows: { type: string; version: string }[] = await res.json().catch(() => []);
      setVersions(Object.fromEntries(rows.map((r) => [r.type, r.version])));
    })();
    return () => { alive = false; };
  }, []);

  const agreed = agreeTerms && agreePrivacy;

  function preValidate(): FieldErrors {
    const errs: FieldErrors = {};
    if (password.length < 8 || password.length > 128) errs.password = "비밀번호는 8자 이상 입력해 주세요.";
    if (!name.trim() || name.trim().length > 100) errs.name = "이름을 입력해 주세요.";
    if (phone.trim() && !PHONE_RE.test(phone.trim())) errs.phone = "휴대폰번호 형식이 올바르지 않습니다.";
    return errs;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !agreed) return; // 중복 제출·미동의 제출 차단
    setMessage(null);
    const local = preValidate();
    if (Object.keys(local).length) {
      setFieldErrors(local);
      return;
    }
    setBusy(true);
    setFieldErrors({});
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // 동의 상태는 보내지 않는다 — 백엔드 스키마에 필드가 없다
        body: JSON.stringify({
          email,
          password,
          name: name.trim(),
          phone: phone.trim() ? phone.trim() : null,
        }),
      });
      const data: ErrorEnvelope & { role?: string } = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.code === "email_already_exists") {
          setFieldErrors({ email: MSG.emailExists });
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
      refreshCartCount();
      router.replace(next ?? roleHome(data.role)); // 로그인과 같은 복귀 규칙
      router.refresh();
    } catch {
      setMessage(MSG.network);
    } finally {
      setBusy(false);
    }
  }

  const err = (f: string) => fieldErrors[f];

  return (
    <form onSubmit={submit} noValidate>
      <Field id="email" label="이메일" type="email" value={email} onChange={setEmail}
        placeholder="이메일을 입력하세요" autoComplete="email" error={err("email")} />
      <Field id="password" label="비밀번호" type="password" value={password} onChange={setPassword}
        placeholder="비밀번호를 입력하세요" autoComplete="new-password" help="8자 이상" error={err("password")} />
      <Field id="name" label="이름" type="text" value={name} onChange={setName}
        placeholder="이름을 입력하세요" autoComplete="name" error={err("name")} />
      <Field id="phone" label="휴대폰번호" optional type="tel" inputMode="numeric" value={phone} onChange={setPhone}
        placeholder="숫자만 입력하세요" autoComplete="tel" error={err("phone")} />

      <div className="mt-2 space-y-3 border-t border-border pt-5">
        {[
          { checked: agreeTerms, set: setAgreeTerms, kind: "terms" as const, text: "이용약관에 동의합니다" },
          { checked: agreePrivacy, set: setAgreePrivacy, kind: "privacy" as const, text: "개인정보 수집·이용에 동의합니다" },
        ].map((t) => (
          <div key={t.kind} className="flex items-center justify-between gap-3">
            <label className="flex cursor-pointer items-center gap-2.5 text-[14px]">
              <input
                type="checkbox"
                checked={t.checked}
                onChange={(e) => t.set(e.target.checked)}
                className="h-4 w-4 accent-black"
              />
              <span>
                <i className="not-italic font-medium text-accent">[필수]</i> {t.text}
                {versions[t.kind] && (
                  <span className="ml-1 text-[12px] text-muted-foreground">v{versions[t.kind]}</span>
                )}
              </span>
            </label>
            {/* 모달로 연다 — 절반 채운 폼을 떠나지 않으므로 입력이 보존된다.
                JS 미탑재·새 탭이면 실제 페이지로 이동(폴백). */}
            <PolicyLink kind={t.kind} className="flex-none text-[13px] text-muted-foreground underline underline-offset-4">
              보기
            </PolicyLink>
          </div>
        ))}
      </div>

      {message ? <p className="mt-4 text-[12px] text-accent" role="alert">{message}</p> : null}

      <button
        type="submit"
        disabled={busy || !agreed}
        className="mt-6 h-14 w-full bg-foreground text-[15px] font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-default disabled:bg-muted disabled:text-muted-foreground"
      >
        {busy ? "가입 중" : "가입하기"}
      </button>

      <p className="mt-5 text-center text-[13px] leading-relaxed text-muted-foreground">
        가입하면 구매자로 시작합니다. 판매자 입점은 별도 신청이 필요합니다.
      </p>
    </form>
  );
}
