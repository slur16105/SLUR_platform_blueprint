"use client";

/* 회원 탈퇴 — 내 정보 화면 맨 아래. **새 테마 판.**

   🚨 window.confirm·alert를 쓰지 않는다. 브라우저 기본 대화상자는 스타일도 문구도 우리 것이
      아니고, 무엇이 지워지는지 설명할 자리가 없다. 확인은 **인라인 단계**로 편다 —
      [회원 탈퇴] → 무엇이 지워지고 무엇이 남는지 + [취소]/[탈퇴하기].
   🚨 실패 문구는 서버가 준 message를 그대로 쓴다. "진행 중 주문이 있어 안 된다"는 판정은
      서버만 할 수 있고, 화면이 같은 문장을 다시 쓰면 두 벌이 되어 어긋난다.
      HTTP 코드는 노출하지 않는다 — 사용자가 할 수 있는 일이 없는 정보다.
   🚨 로그아웃(logout-button-themed)과 달리 확인 단계가 있다. 되돌릴 수 없기 때문이다 —
      복구 경로는 없다(개인정보를 실제로 파기한다). */

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import { useCartCount } from "../cart-count";

export default function WithdrawSection() {
  const router = useRouter();
  const { setCount } = useCartCount();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const withdraw = useCallback(() => {
    if (pending) return; // 중복 제출 차단 — 두 번째 요청은 이미 탈퇴한 계정이라 401이 된다
    setPending(true);
    setError(null);
    void (async () => {
      try {
        const res = await fetch("/api/auth/me", { method: "DELETE", cache: "no-store" });
        if (!res.ok) {
          // 204에는 본문이 없다 — 실패일 때만 봉투를 읽는다
          const body = await res.json().catch(() => null);
          setError(body?.message ?? "탈퇴 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.");
          setPending(false);
          return;
        }
        // 배지 리셋 — 같은 레이아웃이라 remount되지 않아 숫자가 남는다 (로그아웃과 같은 이유)
        setCount(undefined);
        router.replace("/"); // push가 아니다 — 뒤로 가기로 401이 된 /me에 돌아가지 않게
        router.refresh();
      } catch {
        setError("네트워크 연결을 확인해 주세요.");
        setPending(false);
      }
    })();
  }, [pending, router, setCount]);

  return (
    <section aria-labelledby="me_h_withdraw" className="mt-10 border-t border-border pt-6">
      <h2 id="me_h_withdraw" className="text-[12px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        회원 탈퇴
      </h2>

      {error && (
        <p className="mt-3 border border-accent/40 px-4 py-2 text-[13px] text-accent" role="alert">
          {error}
        </p>
      )}

      {!confirming ? (
        <>
          <p className="mt-3 text-[13px] text-muted-foreground">
            탈퇴하면 계정과 개인정보가 삭제되며 되돌릴 수 없습니다.
          </p>
          <button
            type="button"
            onClick={() => { setConfirming(true); setError(null); }}
            className="mt-3 border border-border px-3 py-1.5 text-[13px] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
          >
            회원 탈퇴
          </button>
        </>
      ) : (
        <div className="mt-3 border border-border p-5" data-state="confirming">
          {/* 사실대로 쓴다 — "전부 삭제됩니다"라고 하면 거짓말이 된다.
              주문 기록은 전자상거래법상 5년 보존 대상이라 실제로 남는다. */}
          <p className="text-[14px] font-medium">정말 탈퇴하시겠어요?</p>
          <ul className="mt-3 space-y-1.5 text-[13px] leading-relaxed text-muted-foreground">
            <li>· 이름·이메일·연락처 등 회원 정보와 저장된 배송지, 장바구니가 삭제됩니다.</li>
            <li>· 주문·결제 기록은 관련 법령에 따라 5년간 보관되며, 구매자 정보는 익명 처리됩니다.</li>
            <li>· 삭제된 정보는 복구할 수 없고, 탈퇴 즉시 로그아웃됩니다.</li>
          </ul>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => { setConfirming(false); setError(null); }}
              className="h-10 flex-1 border border-border text-[14px] disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={withdraw}
              data-state={pending ? "loading" : undefined}
              className="h-10 flex-1 bg-foreground text-[14px] font-medium text-background disabled:opacity-50"
            >
              {pending ? "처리 중…" : "탈퇴하기"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
