"use client";

/* 안내 도우미 — FAQ 화면 아래에 붙는 대화창. **로컬 검증 전용 기능이다.**

   🚨 서버가 꺼져 있다고 하면 **아무것도 그리지 않는다.** 눌러야 "안 됩니다"가 나오는
      버튼은 없는 것만 못하다. 배포(Hub맥)에는 Ollama가 없어 항상 꺼진 상태로 나간다.

   🚨 답변에 **근거(출처)를 반드시 붙인다.** 어디서 나온 답인지 보여야 사용자가 확인할 수
      있고, 그게 신뢰를 만든다. 근거 없이 답하는 화면은 만들지 않는다.

   ⚠️ 대화를 기억하지 않는다 — 질문 하나씩만 받는다. "그거 얼마인데요?" 같은 이어지는
      질문은 앞 문맥을 모른다. 화면에서 그 사실을 먼저 말해 기대를 맞춘다. */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Source = { title: string; url: string };
type Turn = {
  q: string;
  a?: string;
  outcome?: "answer" | "escalate" | "tool";
  sources?: Source[];
  failed?: boolean;
};

const PLACEHOLDER = "예) 제주도도 배송되나요?";

export default function ChatBox() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 상태를 먼저 묻는다. 실패해도 조용히 꺼진 것으로 본다 — FAQ 본문은 그대로 서야 한다.
    fetch("/api/chat")
      .then((r) => (r.ok ? r.json() : { enabled: false }))
      .then((d) => setEnabled(Boolean(d.enabled)))
      .catch(() => setEnabled(false));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [turns, busy]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const q = input.trim();
    if (!q || busy) return;
    setInput("");
    setBusy(true);
    setTurns((t) => [...t, { q }]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();
      setTurns((t) =>
        t.map((turn, i) =>
          i === t.length - 1
            ? res.ok
              ? { ...turn, a: data.answer, outcome: data.outcome, sources: data.sources ?? [] }
              : // 서버가 준 한국어 문구를 그대로 쓴다. HTTP 코드는 노출하지 않는다
                { ...turn, a: data.message ?? "잠시 후 다시 시도해 주세요.", failed: true }
            : turn,
        ),
      );
    } catch {
      setTurns((t) =>
        t.map((turn, i) =>
          i === t.length - 1 ? { ...turn, a: "연결이 끊겼어요. 잠시 후 다시 시도해 주세요.", failed: true } : turn,
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  if (!enabled) return null; // 로딩 중(null)에도 그리지 않는다 — 깜빡임 방지

  return (
    <section aria-labelledby="faq_chat_h" className="border border-border p-7">
      <h2 id="faq_chat_h" className="text-[15px] font-semibold">
        찾는 답이 없으신가요?
      </h2>
      <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
        위 안내와 이용약관에서 답을 찾아 드립니다. 확실하지 않은 내용은 답하지 않고 담당자에게
        연결해 드려요. <span className="whitespace-nowrap">한 번에 하나씩</span> 물어봐 주세요.
      </p>

      {turns.length > 0 && (
        <div className="mt-6 flex flex-col gap-5">
          {turns.map((t, i) => (
            <div key={i} className="flex flex-col gap-3">
              <p className="self-end max-w-[85%] bg-foreground px-4 py-2.5 text-[14px] text-background">
                {t.q}
              </p>

              {t.a === undefined ? (
                <p className="text-[14px] text-muted-foreground">답을 찾고 있어요…</p>
              ) : (
                <div className="max-w-[85%] border border-border px-4 py-3">
                  <p className="whitespace-pre-line text-[14px] leading-relaxed">{t.a}</p>

                  {/* 근거 — 답한 경우에만 붙는다 */}
                  {t.sources && t.sources.length > 0 && (
                    <ul className="mt-3 flex flex-col gap-1 border-t border-border pt-3">
                      {t.sources.map((s, j) => (
                        <li key={j}>
                          <Link
                            href={s.url}
                            className="text-[12px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
                          >
                            {s.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* 답하지 못한 경우엔 다음 행동을 준다 — "모르겠습니다"로 끝내지 않는다 */}
                  {(t.outcome === "escalate" || t.outcome === "tool") && (
                    <Link
                      href="/support"
                      className="mt-4 inline-block border border-foreground px-5 py-2.5 text-[13px] font-semibold transition-colors hover:bg-foreground hover:text-background"
                    >
                      문의 남기기
                    </Link>
                  )}
                </div>
              )}
            </div>
          ))}
          <div ref={endRef} />
        </div>
      )}

      <form onSubmit={send} className="mt-6 flex gap-2">
        <label htmlFor="faq_chat_q" className="sr-only">
          질문 입력
        </label>
        <input
          id="faq_chat_q"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={300}
          placeholder={PLACEHOLDER}
          disabled={busy}
          className="min-w-0 flex-1 border border-border px-4 py-3 text-[14px] outline-none focus:border-foreground disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="border border-foreground px-6 py-3 text-[14px] font-semibold transition-colors hover:bg-foreground hover:text-background disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "…" : "보내기"}
        </button>
      </form>
    </section>
  );
}
