"use client";

/* 배송지 관리 — 내 정보 화면에 붙는 섹션.

   주문서(SavedAddresses)는 '고르기'만 하고, 추가·수정·삭제는 여기서 한다. 주문 흐름 한가운데에
   관리 기능을 두면 결제 이탈이 늘어난다.

   🚨 우편번호는 검색 위젯 없이 직접 입력받는다 — 주문서와 달리 여기는 결제 경로가 아니고,
      다음 우편번호 스크립트를 이 화면까지 끌어오면 CSP·로딩 비용이 늘어난다. 형식(5자리)은
      서버가 주문 생성과 같은 규칙으로 검증한다. */

import { useCallback, useEffect, useRef, useState } from "react";

type Address = {
  id: string;
  label: string;
  recipient_name: string;
  recipient_phone: string;
  postal_code: string;
  address1: string;
  address2: string;
  is_default: boolean;
};

const EMPTY = {
  id: "", label: "", recipient_name: "", recipient_phone: "",
  postal_code: "", address1: "", address2: "", is_default: false,
};

export default function AddressBook() {
  const [rows, setRows] = useState<Address[] | null>(null);
  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/addresses");
      setRows(res.ok ? await res.json() : []);
    } catch {
      setRows([]);
    }
  }, []);

  useEffect(() => { void (async () => { await load(); })(); }, [load]);
  useEffect(() => () => { if (noticeTimer.current) clearTimeout(noticeTimer.current); }, []);

  function showNotice(msg: string) {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 4000);
  }

  async function send(op: string, payload: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op, ...payload }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setError(d?.details?.[0]?.reason ?? d?.message ?? "처리에 실패했습니다.");
        return false;
      }
      await load();
      return true;
    } catch {
      setError("네트워크 연결을 확인해 주세요.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form || busy) return;
    const ok = await send(form.id ? "update" : "create", {
      id: form.id || undefined,
      label: form.label,
      recipient_name: form.recipient_name,
      recipient_phone: form.recipient_phone.replace(/\D/g, ""),
      postal_code: form.postal_code.replace(/\D/g, ""),
      address1: form.address1,
      address2: form.address2,
      is_default: form.is_default,
    });
    if (ok) {
      setForm(null);
      showNotice(form.id ? "배송지를 수정했습니다." : "배송지를 저장했습니다.");
    }
  }

  return (
    <section aria-labelledby="me_h_addr">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="me_h_addr" className="text-[12px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          배송지 관리
        </h2>
        {form === null && (
          <button type="button" onClick={() => { setForm({ ...EMPTY }); setError(null); }}
            className="border border-border px-3 py-1.5 text-[13px] transition-colors hover:border-foreground">
            배송지 추가
          </button>
        )}
      </div>

      {notice && <p className="mb-3 border border-border bg-muted/40 px-4 py-2 text-[13px]" role="status">{notice}</p>}
      {error && <p className="mb-3 border border-accent/40 px-4 py-2 text-[13px] text-accent" role="alert">{error}</p>}

      {form !== null && (
        <form onSubmit={save} className="mb-5 space-y-3 border border-border p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-[13px]">
              이름(선택)
              <input value={form.label} maxLength={30} onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="집, 회사" className="mt-1 h-10 w-full border border-border bg-background px-3 text-[14px]" />
            </label>
            <label className="block text-[13px]">
              받는 분
              <input value={form.recipient_name} maxLength={50}
                onChange={(e) => setForm({ ...form, recipient_name: e.target.value })}
                className="mt-1 h-10 w-full border border-border bg-background px-3 text-[14px]" />
            </label>
            <label className="block text-[13px]">
              연락처
              <input value={form.recipient_phone} inputMode="numeric" maxLength={13}
                onChange={(e) => setForm({ ...form, recipient_phone: e.target.value })}
                placeholder="01012345678" className="mt-1 h-10 w-full border border-border bg-background px-3 text-[14px]" />
            </label>
            <label className="block text-[13px]">
              우편번호
              <input value={form.postal_code} inputMode="numeric" maxLength={5}
                onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
                placeholder="06236" className="mt-1 h-10 w-full border border-border bg-background px-3 text-[14px]" />
            </label>
          </div>
          <label className="block text-[13px]">
            주소
            <input value={form.address1} maxLength={255}
              onChange={(e) => setForm({ ...form, address1: e.target.value })}
              className="mt-1 h-10 w-full border border-border bg-background px-3 text-[14px]" />
          </label>
          <label className="block text-[13px]">
            상세 주소
            <input value={form.address2} maxLength={255}
              onChange={(e) => setForm({ ...form, address2: e.target.value })}
              className="mt-1 h-10 w-full border border-border bg-background px-3 text-[14px]" />
          </label>
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" checked={form.is_default} className="h-4 w-4 accent-black"
              onChange={(e) => setForm({ ...form, is_default: e.target.checked })} />
            기본 배송지로 사용
          </label>
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={busy}
              className="h-10 flex-1 bg-foreground text-[14px] font-medium text-background disabled:opacity-50">
              {busy ? "저장 중…" : "저장"}
            </button>
            <button type="button" disabled={busy} onClick={() => { setForm(null); setError(null); }}
              className="h-10 flex-1 border border-border text-[14px] disabled:opacity-50">취소</button>
          </div>
        </form>
      )}

      {rows === null ? (
        <p className="text-[14px] text-muted-foreground" role="status">불러오는 중…</p>
      ) : rows.length === 0 ? (
        <p className="text-[14px] text-muted-foreground">저장된 배송지가 없습니다. 추가해 두면 주문할 때 바로 불러옵니다.</p>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {rows.map((a) => (
            <li key={a.id} className="py-4">
              <div className="flex flex-wrap items-center gap-2">
                {a.label && <span className="border border-border px-1.5 py-0.5 text-[12px]">{a.label}</span>}
                <span className="text-[15px] font-medium">{a.recipient_name}</span>
                {a.is_default && <span className="text-[12px] text-muted-foreground">기본 배송지</span>}
              </div>
              <p className="mt-1 text-[14px] text-muted-foreground">
                [{a.postal_code}] {a.address1} {a.address2}
              </p>
              <p className="mt-0.5 text-[13px] text-muted-foreground">{a.recipient_phone}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {!a.is_default && (
                  <button type="button" disabled={busy}
                    onClick={async () => { if (await send("default", { id: a.id })) showNotice("기본 배송지로 지정했습니다."); }}
                    className="border border-border px-3 py-1.5 text-[13px] disabled:opacity-50">기본으로</button>
                )}
                <button type="button" disabled={busy}
                  onClick={() => { setForm({ ...a }); setError(null); }}
                  className="border border-border px-3 py-1.5 text-[13px] disabled:opacity-50">수정</button>
                <button type="button" disabled={busy}
                  onClick={async () => { if (await send("delete", { id: a.id })) showNotice("배송지를 삭제했습니다."); }}
                  className="px-3 py-1.5 text-[13px] text-muted-foreground disabled:opacity-50">삭제</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
