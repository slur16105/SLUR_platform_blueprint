"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { MSG, mapFieldErrors, type ErrorEnvelope, type FieldErrors } from "../auth-errors";
import { useCartCount } from "../cart-count";
import { roleHome } from "@/lib/nav";

const FIELDS = ["email", "password", "name", "phone"] as const;

/* 클라이언트 선검증은 백엔드 계약과 **같은 값**으로만 한다 (SignupRequest).
   더 엄격하게 만들면 백엔드가 통과시키는 입력을 화면이 막아 사용자만 손해다. */
const PHONE_RE = /^01[016789]\d{7,8}$/;

export default function SignupForm({ next }: { next: string | null }) {
  const router = useRouter();
  const { refresh: refreshCartCount } = useCartCount();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null); // 매핑되지 않는 오류만 폼 하단 한 줄
  const [busy, setBusy] = useState(false);

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
        // 동의 상태는 보내지 않는다 — 백엔드 스키마에 필드가 없다 (ERD 무변경, 위험 6)
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
      // 배지도 로그인과 같은 규칙이다 — /signup도 (buyer) 그룹이라 replace로는 다시 읽지 않는다
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
    <form className="b_authform" onSubmit={submit} noValidate>
      <Field
        id="email"
        label="이메일"
        type="email"
        value={email}
        onChange={setEmail}
        placeholder="이메일을 입력하세요"
        autoComplete="email"
        error={err("email")}
      />
      <Field
        id="password"
        label="비밀번호"
        type="password"
        value={password}
        onChange={setPassword}
        placeholder="비밀번호를 입력하세요"
        autoComplete="new-password"
        help="8자 이상"
        error={err("password")}
      />
      <Field
        id="name"
        label="이름"
        type="text"
        value={name}
        onChange={setName}
        placeholder="이름을 입력하세요"
        autoComplete="name"
        error={err("name")}
      />
      <Field
        id="phone"
        label="휴대폰번호"
        optional
        type="tel"
        inputMode="numeric"
        value={phone}
        onChange={setPhone}
        placeholder="숫자만 입력하세요"
        autoComplete="tel"
        error={err("phone")}
      />

      <div className="b_terms">
        <div className="b_term">
          <label className="i_check">
            <input
              className="b_checkbox"
              type="checkbox"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
            />
            <span className="i_tx">
              <i className="i_req">[필수]</i> 이용약관에 동의합니다
            </span>
          </label>
          {/* 새 탭으로 연다 — 절반 채운 폼에서 나가면 입력이 날아간다 (D2) */}
          <Link className="b_view" href="/terms" target="_blank" rel="noopener">
            <span>보기</span>
          </Link>
        </div>
        <div className="b_term">
          <label className="i_check">
            <input
              className="b_checkbox"
              type="checkbox"
              checked={agreePrivacy}
              onChange={(e) => setAgreePrivacy(e.target.checked)}
            />
            <span className="i_tx">
              <i className="i_req">[필수]</i> 개인정보 수집·이용에 동의합니다
            </span>
          </label>
          <Link className="b_view" href="/privacy" target="_blank" rel="noopener">
            <span>보기</span>
          </Link>
        </div>
      </div>

      {message ? (
        <p className="b_err_msg" role="alert">
          {message}
        </p>
      ) : null}

      <button className="b_btn b_button_text m_solid m_full m_gap" type="submit" disabled={busy || !agreed}>
        가입하기
      </button>

      <p className="b_notice b_signup_guide">
        가입하면 구매자로 시작합니다. 판매자 입점은 별도 신청이 필요합니다.
      </p>
    </form>
  );
}

/* 라벨-필드-도움말-오류가 프로그램적으로 묶인 한 벌 (UX-DR9).
   오류는 해당 필드에만 붙는다 — 상단 요약 배너를 쓰지 않는다. */
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
    <div className="b_field">
      <label className="b_label" htmlFor={id}>
        {label}
        {optional ? <em className="i_opt">(선택)</em> : null}
      </label>
      <input
        id={id}
        className={`b_input b_input_text${error ? " m_error" : ""}`}
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
      />
      {help ? (
        <p className="b_help" id={helpId}>
          {help}
        </p>
      ) : null}
      {error ? (
        <p className="b_err_msg" id={errId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
