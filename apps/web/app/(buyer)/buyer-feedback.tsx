/* 로딩 · 빈 상태 · 오류 — 목업에 없는 화면이며 8.3이 처음 만든다 (UX-DR9).
   8.4~8.7이 함께 쓰므로 라우트 그룹 루트에 평평하게 둔다.
   "use client"를 붙이지 않는다 — 훅이 없으므로 서버 컴포넌트(Suspense fallback)에서도,
   클라이언트 본체에서도 그대로 쓸 수 있다.

   표시 규약 (R6): 분기는 봉투의 code로, 화면 표시는 message로.
   🚨 HTTP 상태 코드와 code 문자열을 화면에 렌더하지 않는다 — `로그인 실패 (401)`은 Don't 예시다. */

import type { ErrorEnvelope } from "./auth-errors";

/** 봉투가 없는 실패(fetch throw — 네트워크 단절). 서버가 문장을 못 주는 유일한 경우다. */
export const NETWORK_MESSAGE = "연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요.";

/** 봉투에 message가 없을 때의 최후 문장. code를 대신 노출하지 않는다. */
const GENERIC_MESSAGE = "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";

export type ApiFailure = {
  /** 화면 분기용 — 렌더하지 않는다 */
  code: string;
  /** 화면 표시용 문장 */
  message: string;
};

/** 공개 GET 한 벌. 성공이면 데이터, 실패면 표시용 문장 + 분기용 code.
 *  throw하지 않는다 — 호출부가 try/catch를 두 겹 쌓지 않게 한다. */
export async function getPublicJson<T>(
  url: string,
): Promise<{ ok: true; data: T } | { ok: false; error: ApiFailure }> {
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store" });
  } catch {
    return { ok: false, error: { code: "network", message: NETWORK_MESSAGE } };
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    return { ok: false, error: { code: "service_unavailable", message: GENERIC_MESSAGE } };
  }
  if (!res.ok) {
    const env = (body ?? {}) as ErrorEnvelope;
    return { ok: false, error: { code: env.code ?? "http_error", message: env.message || GENERIC_MESSAGE } };
  }
  return { ok: true, data: body as T };
}

/* ── 로딩 ───────────────────────────────────────
   카드 골격을 그리드 자리에 둔다. 화면 중앙 스피너를 쓰지 않는다 (UX-DR9).
   애니메이션은 최소로 두고 prefers-reduced-motion에서 끈다 (buyer.css). */
export function GridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="b_grid b_products" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div className="b_card_skeleton" key={i}>
          <span className="i_thumb b_skeleton" />
          <span className="i_line b_skeleton" />
          <span className="i_line m_short b_skeleton" />
        </div>
      ))}
    </div>
  );
}

/** 블록 하나짜리 골격 — 상세처럼 그리드가 아닌 자리에 쓴다. */
export function BlockSkeleton({ className }: { className?: string }) {
  return <div className={["b_block_skeleton", className].filter(Boolean).join(" ")} aria-hidden="true" />;
}

/* ── 빈 상태 ─────────────────────────────────── */
export function EmptyState({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div className="b_feedback" role="status">
      <p className="b_body i_msg">{message}</p>
      {action ? <div className="i_action">{action}</div> : null}
    </div>
  );
}

/* ── 오류 ────────────────────────────────────
   문장은 봉투의 message(또는 네트워크 문장) 그대로. 숫자를 덧붙이지 않는다. */
export function ErrorState({
  message,
  onRetry,
  action,
}: {
  message: string;
  onRetry?: () => void;
  action?: React.ReactNode;
}) {
  return (
    <div className="b_feedback" role="status">
      <p className="b_body i_msg">{message}</p>
      {onRetry ? (
        <div className="i_action">
          <button type="button" className="b_btn m_ghost b_control" onClick={onRetry}>
            다시 시도
          </button>
        </div>
      ) : null}
      {action ? <div className="i_action">{action}</div> : null}
    </div>
  );
}
