"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import "./apply.css";

type AppStatus = { status: string; brand_name: string; rejection_reason: string | null } | null;

const FIELDS = [
  { name: "company_name", label: "상호", max: 100 },
  { name: "representative_name", label: "대표자명", max: 50 },
  { name: "business_registration_number", label: "사업자등록번호", max: 20, help: "예: 220-81-62517" },
  { name: "mail_order_number", label: "통신판매업 신고번호", max: 50 },
  { name: "business_address", label: "사업장 주소", max: 255 },
  { name: "contact_phone", label: "연락처", max: 20 },
  { name: "brand_name", label: "브랜드명 (노출용)", max: 50 },
] as const;

export default function ApplyPage() {
  const router = useRouter();
  const [existing, setExisting] = useState<AppStatus>(null);
  const [loaded, setLoaded] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/sellers/apply")
      .then(async (r) => {
        if (r.status === 401) router.replace("/login");
        else if (r.ok) setExisting(await r.json());
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/sellers/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      if (!res.ok) {
        if (data.code === "application_already_pending") setExisting({ status: "pending", brand_name: "", rejection_reason: null });
        else setError(data.details?.[0]?.reason ?? data.message ?? "제출에 실패했습니다.");
        return;
      }
      setExisting(data);
    } catch {
      setError("네트워크 연결을 확인해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return null;

  if (existing && existing.status === "pending") {
    return (
      <main className="page_apply">
        <div className="p_panel card">
          <h1 className="p_title">심사 중입니다</h1>
          <p className="p_desc">신청서를 검토하고 있어요. 결과는 담당자가 연락드립니다.</p>
        </div>
      </main>
    );
  }
  if (existing && existing.status === "approved") {
    return (
      <main className="page_apply">
        <div className="p_panel card">
          <h1 className="p_title">입점이 승인되었습니다</h1>
          <p className="p_desc">다시 로그인하면 판매자 센터를 이용할 수 있습니다.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="page_apply">
      <form className="p_panel card" onSubmit={submit}>
        <h1 className="p_title">입점 신청</h1>
        <p className="p_desc">SLUR와 결이 맞는 브랜드를 기다립니다.</p>
        {existing?.status === "rejected" && (
          <div className="alert m_inline m_warning" role="alert">
            이전 신청이 반려되었습니다{existing.rejection_reason ? ` — ${existing.rejection_reason}` : ""}. 다시 신청할 수 있어요.
          </div>
        )}
        {error && (
          <div className="alert m_inline m_danger" role="alert">{error}</div>
        )}
        {FIELDS.map((f) => (
          <div className="field" key={f.name}>
            <label className="i_label" htmlFor={f.name}>{f.label}</label>
            <input id={f.name} className="input_text" maxLength={f.max} required
              value={values[f.name] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))} />
            {"help" in f && f.help && <span className="i_help">{f.help}</span>}
          </div>
        ))}
        <div className="field">
          <label className="i_label" htmlFor="brand_intro">브랜드 소개</label>
          <textarea id="brand_intro" className="input_text m_textarea" maxLength={500} required rows={4}
            value={values.brand_intro ?? ""}
            onChange={(e) => setValues((v) => ({ ...v, brand_intro: e.target.value }))} />
        </div>
        <button className="btn m_primary m_full m_large" type="submit" disabled={busy}>
          신청서 제출
        </button>
      </form>
    </main>
  );
}
