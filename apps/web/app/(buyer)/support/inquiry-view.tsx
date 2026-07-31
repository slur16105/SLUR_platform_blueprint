"use client";

/* 1:1 문의 — 작성과 내역을 한 화면에서. 통신판매중개자의 불만·분쟁 처리 창구다(전자상거래법
   제20조의2). 답변은 운영자가 콘솔에서 달고, 여기 내역에 그대로 나타난다.

   상품 문의(판매자 직접 응대)는 아직 없다 — 유형에 '상품'을 두어 운영자가 중계한다. */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Reply = { id: string; body: string; created_at: string };
type Inquiry = {
  id: string;
  category: string;
  title: string;
  body: string;
  status: string;
  order_id: string | null;
  created_at: string;
  replies: Reply[];
};

const CATEGORIES = [
  { value: "order", label: "주문·배송" },
  { value: "product", label: "상품" },
  { value: "account", label: "계정" },
  { value: "etc", label: "기타" },
];
const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label]));
const STATUS_LABEL: Record<string, string> = {
  open: "답변 대기", answered: "답변 완료", closed: "종료",
};

function formatDateTime(s: string) {
  return new Date(s).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Seoul" });
}

export default function InquiryView() {
  const router = useRouter();
  const [items, setItems] = useState<Inquiry[] | null>(null);
  const [category, setCategory] = useState("order");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/inquiries");
      if (res.status === 401) return void router.replace("/login?next=/support");
      if (!res.ok) {
        setItems([]);
        setError("문의 내역을 불러오지 못했습니다.");
        return;
      }
      const data = await res.json();
      setItems(data.items ?? []);
    } catch {
      setItems([]);
      setError("네트워크 연결을 확인해 주세요.");
    }
  }, [router]);

  useEffect(() => {
    void (async () => { await load(); })();
  }, [load]);

  useEffect(() => () => { if (noticeTimer.current) clearTimeout(noticeTimer.current); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!title.trim() || !body.trim()) {
      setError("제목과 내용을 입력해 주세요.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, title: title.trim(), body: body.trim() }),
      });
      if (res.status === 401) return void router.replace("/login?next=/support");
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setError(d?.details?.[0]?.reason ?? d?.message ?? "문의 접수에 실패했습니다.");
        return;
      }
      setTitle("");
      setBody("");
      setNotice("문의가 접수됐습니다. 답변이 달리면 이 화면에서 확인하실 수 있습니다.");
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
      noticeTimer.current = setTimeout(() => setNotice(null), 6000);
      await load();
    } catch {
      setError("네트워크 연결을 확인해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[720px] px-5 py-10">
      <h1 className="text-[24px] font-semibold tracking-tight">1:1 문의</h1>
      <p className="mt-2 text-[14px] text-muted-foreground">
        주문·배송·상품에 관해 궁금한 점을 남겨 주세요. 운영자가 확인 후 답변드립니다.{" "}
        <Link href="/faq" className="underline underline-offset-4">자주 묻는 질문</Link>도 함께 확인해 보세요.
      </p>

      {notice && (
        <p className="mt-5 border border-border bg-muted/40 px-4 py-3 text-[14px]" role="status">{notice}</p>
      )}
      {error && (
        <p className="mt-5 border border-accent/40 px-4 py-3 text-[14px] text-accent" role="alert">{error}</p>
      )}

      <form onSubmit={submit} className="mt-7 space-y-4 border-t border-border pt-7">
        <div className="space-y-1.5">
          <label htmlFor="inq_category" className="block text-[13px] font-medium">문의 유형</label>
          <select id="inq_category" value={category} onChange={(e) => setCategory(e.target.value)}
            className="h-11 w-full border border-border bg-background px-3 text-[14px]">
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="inq_title" className="block text-[13px] font-medium">제목</label>
          <input id="inq_title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100}
            placeholder="문의 제목을 입력하세요"
            className="h-11 w-full border border-border bg-background px-3 text-[14px]" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="inq_body" className="block text-[13px] font-medium">내용</label>
          <textarea id="inq_body" value={body} onChange={(e) => setBody(e.target.value)} rows={6} maxLength={2000}
            placeholder="주문번호를 함께 적어 주시면 더 빠르게 확인할 수 있습니다."
            className="w-full border border-border bg-background p-3 text-[14px]" />
          <p className="text-[12px] text-muted-foreground">최대 2,000자</p>
        </div>
        <button type="submit" disabled={busy}
          className="h-11 w-full bg-foreground text-[14px] font-medium text-background disabled:opacity-50">
          {busy ? "접수 중…" : "문의 보내기"}
        </button>
      </form>

      <section className="mt-12">
        <h2 className="text-[15px] font-semibold">내 문의 내역</h2>
        {items === null ? (
          <p className="mt-4 text-[14px] text-muted-foreground" role="status">불러오는 중…</p>
        ) : items.length === 0 ? (
          <p className="mt-4 text-[14px] text-muted-foreground">아직 남긴 문의가 없습니다.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border border-y border-border">
            {items.map((i) => (
              <li key={i.id} className="py-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="border border-border px-2 py-0.5 text-[12px] text-muted-foreground">
                    {CATEGORY_LABEL[i.category] ?? i.category}
                  </span>
                  <span className="text-[12px] text-muted-foreground">{formatDateTime(i.created_at)}</span>
                  <span className={`ml-auto text-[12px] ${i.status === "open" ? "text-accent" : "text-muted-foreground"}`}>
                    {STATUS_LABEL[i.status] ?? i.status}
                  </span>
                </div>
                <p className="mt-2 text-[15px] font-medium">{i.title}</p>
                <p className="mt-1 whitespace-pre-wrap text-[14px] text-muted-foreground">{i.body}</p>
                {i.replies.map((r) => (
                  <div key={r.id} className="mt-3 border-l-2 border-foreground/70 bg-muted/40 px-4 py-3">
                    <p className="text-[12px] text-muted-foreground">운영자 답변 · {formatDateTime(r.created_at)}</p>
                    <p className="mt-1 whitespace-pre-wrap text-[14px]">{r.body}</p>
                  </div>
                ))}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
