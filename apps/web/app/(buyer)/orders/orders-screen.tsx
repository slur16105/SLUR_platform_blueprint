"use client";

/* 주문내역 본체 — **새 테마 판**. orders-view.tsx의 로직 그대로, 마크업만 교체.

   · D4 — 페이지네이션은 `더 보기` + **누적 길이 vs total**이다(응답에 페이지 크기가 없다).
   · 🚨 order_id 중복 제거 — offset 페이지네이션 도중 새 주문이 생기면 경계 항목이 두 페이지에
        걸친다. 뒤엣것을 버린다.
   · 🚨 실패하면 page를 올리지 않는다 — 다음 `더 보기`가 같은 페이지를 다시 청한다.
   · 🚨 대표 상태는 서버의 display_status를 **매핑만** 한다 (AD-12). 묶음 상태로 계산하지 않는다.
   · 🚨 order_no·title은 서버 값 그대로 — 화면이 "외 n건"을 만들지 않는다.
   · 상태는 색만 다른 글자가 아니라 무엇의 상태인지 읽히게 한다(스크린리더용 접두어). */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { type ApiFailure } from "../buyer-feedback";
import { formatOrderDate, formatWon } from "../format";
import { listOrders, type OrderCard } from "../orders-api";
import { orderStatusView } from "./order-status";

const EMPTY_MESSAGE = "아직 주문이 없습니다.";
const LIST_END = "최근 주문부터 보입니다.";
const MORE_LABEL = "더 보기";

type Loaded = { items: OrderCard[]; total: number; page: number; error: ApiFailure | null };

/* 상태 표시 — 액센트가 붙는 상태는 입금대기 하나뿐이다 (UX-DR8). 나머지는 무채색. */
const TONE_CLASS: Record<string, string> = {
  waiting: "border-accent text-accent",
  moving: "border-border text-foreground",
  finished: "border-border text-muted-foreground",
};

export default function OrdersScreen() {
  const router = useRouter();

  const [result, setResult] = useState<Loaded | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  /* `더 보기`는 목록을 지우지 않는 별도 축이다 — 진행 상태·오류를 result에 섞지 않는다. */
  const [morePending, setMorePending] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);

  const toLogin = useCallback(() => router.replace("/login?next=%2Forders"), [router]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const r = await listOrders(1);
      if (!alive) return;
      if (!r.ok && r.error.code === "unauthorized") {
        toLogin();
        return;
      }
      setResult(
        r.ok
          ? { items: r.data.items, total: r.data.total, page: r.data.page, error: null }
          : { items: [], total: 0, page: 1, error: r.error },
      );
    })();
    return () => {
      alive = false;
    };
  }, [reloadKey, toLogin]);

  const onMore = useCallback(() => {
    if (morePending) return;
    setMorePending(true);
    setMoreError(null);
    void (async () => {
      const current = result;
      const r = await listOrders((current?.page ?? 1) + 1);
      setMorePending(false);
      if (!r.ok) {
        if (r.error.code === "unauthorized") {
          toLogin();
          return;
        }
        setMoreError(r.error.message);
        return;
      }
      const page = r.data;
      setResult((prev) => {
        if (!prev) return prev;
        const seen = new Set(prev.items.map((o) => o.order_id));
        const merged = prev.items.slice();
        for (const card of page.items) {
          if (seen.has(card.order_id)) continue; // 경계 중복 제거
          seen.add(card.order_id);
          merged.push(card);
        }
        return { items: merged, total: page.total, page: page.page, error: null };
      });
    })();
  }, [morePending, result, toLogin]);

  const retry = useCallback(() => {
    setResult(null);
    setReloadKey((n) => n + 1);
  }, []);

  const wrap = "mx-auto w-full max-w-[900px] px-5 pb-20";

  // 최초 로딩은 행 골격이다 — 화면 중앙 스피너를 쓰지 않는다 (UX-DR9)
  if (result === null) {
    return (
      <div className={wrap} aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="border-b border-border py-6">
            <div className="h-3 w-28 animate-pulse bg-muted" />
            <div className="mt-3 h-5 w-2/3 animate-pulse bg-muted" />
            <div className="mt-3 h-4 w-24 animate-pulse bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  if (result.error) {
    return (
      <div className={`${wrap} py-24 text-center`}>
        <p className="text-[16px] text-muted-foreground">{result.error.message}</p>
        <button
          type="button"
          onClick={retry}
          className="mt-7 border border-foreground px-10 py-4 text-[14px] font-semibold uppercase transition-colors hover:bg-foreground hover:text-background"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (result.items.length === 0) {
    return (
      <div className={`${wrap} py-24 text-center`}>
        <p className="text-[16px] text-muted-foreground">{EMPTY_MESSAGE}</p>
        <Link
          href="/"
          className="mt-7 inline-block border border-foreground px-10 py-4 text-[14px] font-semibold uppercase transition-colors hover:bg-foreground hover:text-background"
        >
          쇼핑 계속하기
        </Link>
      </div>
    );
  }

  // 🚨 페이지 크기를 알지 못한다 — 누적 길이와 total만 비교한다 (D4)
  const hasMore = result.items.length < result.total;

  return (
    <div className={wrap}>
      {result.items.map((order) => {
        const status = orderStatusView(order.display_status);
        // 판매자를 브랜드명으로 부른다 (UX-DR15). 빈 브랜드명은 잇는 점만 남기지 않도록 거른다.
        const brands = order.sub_orders
          .map((s) => s.brand_name)
          .filter((b) => b !== "")
          .join(" · ");
        return (
          <Link
            key={order.order_id}
            href={`/orders/${order.order_id}`}
            className="flex items-center gap-4 border-b border-border py-6 transition-colors hover:bg-muted/40"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <span className="text-[13px] text-muted-foreground">{formatOrderDate(order.created_at)}</span>
                <span className={`border px-2 py-0.5 text-[12px] font-medium ${TONE_CLASS[status.tone] ?? TONE_CLASS.moving}`}>
                  <span className="sr-only">주문 상태 </span>
                  {status.label}
                </span>
              </div>
              {/* 🚨 order_no를 그대로 쓴다 — 클라 가공 금지 */}
              <p className="mt-2 text-[12px] tracking-wide text-muted-foreground">{order.order_no}</p>
              {/* 서버가 조립한 `유광 도자 머그 외 1건` — 화면이 "외 n건"을 만들지 않는다 */}
              <p className="mt-1.5 truncate text-[17px] font-medium">{order.title}</p>
              {brands ? <p className="mt-1 truncate text-[13px] text-muted-foreground">{brands}</p> : null}
              <p className="mt-2 text-[16px] font-semibold tabular-nums">{formatWon(order.grand_total)}</p>
            </div>
            <span aria-hidden="true" className="flex-none text-[20px] text-muted-foreground">›</span>
          </Link>
        );
      })}

      <div className="mt-10 text-center">
        {hasMore ? (
          <button
            type="button"
            disabled={morePending}
            onClick={onMore}
            className="border border-foreground px-12 py-4 text-[14px] font-semibold uppercase tracking-wide transition-colors hover:bg-foreground hover:text-background disabled:opacity-50"
          >
            {morePending ? "불러오는 중" : MORE_LABEL}
          </button>
        ) : (
          <p className="text-[13px] text-muted-foreground">{LIST_END}</p>
        )}
        {/* 🚨 HTTP 코드·code 문자열을 쓰지 않는다 — 봉투의 message 그대로다 */}
        {moreError ? (
          <p className="mt-4 text-[13px] text-accent" role="status">
            {moreError}
          </p>
        ) : null}
      </div>
    </div>
  );
}
