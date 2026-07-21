"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import "./login.css";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "로그인에 실패했습니다.");
        return;
      }
      router.push(data.role === "admin" ? "/admin" : data.role === "seller" ? "/seller" : "/no-role");
    } catch {
      setError("네트워크 연결을 확인해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page_login">
      <form className="p_form card" onSubmit={submit}>
        <h1 className="p_logo">SLUR</h1>
        <p className="p_desc">판매자·관리자 로그인</p>
        {error && (
          <div className="alert m_inline m_danger" role="alert">
            {error}
          </div>
        )}
        <div className="field">
          <label className="i_label" htmlFor="email">이메일</label>
          <input id="email" className="input_text" type="email" value={email}
            onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </div>
        <div className="field">
          <label className="i_label" htmlFor="password">비밀번호</label>
          <input id="password" className="input_text" type="password" value={password}
            onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        </div>
        <button className="btn m_primary m_full m_large" type="submit" disabled={busy}
          data-state={busy ? "loading" : undefined}>
          로그인
        </button>
      </form>
    </main>
  );
}
