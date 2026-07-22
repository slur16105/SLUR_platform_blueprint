"use client";

/* 주문내역 본체 (8.6 D3·D4).

   D3 — 행은 **대표 상태 하나**만 상태로 쓴다. sub_orders 배열은 브랜드명 나열에만 쓴다.
        묶음별 진짜 상태는 상세가 갖는다(목록에 다 그리면 대표 상태와 시선을 다투고 640px 행이 무너진다).
   D4 — 페이지네이션은 `더 보기` 버튼 + **누적 길이 vs total**이다. 응답에 페이지 크기가 없으므로
        화면은 `20` 같은 숫자를 알지 못한다 (AD-13). 무한 스크롤 자동 로드는 금지다 (UX-DR16).
   D5 — 상품 **사진이 없다**. OrderCard에 image_url이 없고 되짚을 경로도 없다 —
        빈 회색 사각형을 자리표시로 남기지 않고 타이포 위계로 행을 세운다.
   D13 — 폭 전환은 CSS만으로 한다. matchMedia·innerWidth·resize를 쓰지 않는다 —
        조건부 렌더는 폭이 바뀔 때 언마운트되어 `더 보기`로 쌓은 목록을 통째로 날린다.

   🚨 대표 상태는 서버의 display_status를 그대로 매핑만 한다 (AD-12). 묶음 상태로 계산하지 않는다.
   🚨 effect 본문에서 동기 setState를 하지 않는다 — async IIFE + alive 가드 (react-hooks/set-state-in-effect). */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import StatusLabel from "../status-label";
import { EmptyState, ErrorState, type ApiFailure } from "../buyer-feedback";
import { formatOrderDate, formatWon } from "../format";
import { listOrders, type OrderCard } from "../orders-api";
import { orderStatusView } from "./order-status";

const EMPTY_MESSAGE = "아직 주문이 없습니다.";
const LIST_END = "최근 주문부터 보입니다.";
const MORE_LABEL = "더 보기";

type Loaded = {
  items: OrderCard[];
  /** 전체 건수 — `더 보기` 판정의 유일한 기준 */
  total: number;
  /** 마지막으로 받아 온 페이지 */
  page: number;
  error: ApiFailure | null;
};

function RowSkeleton() {
  return (
    <div className="b_order_skeleton" aria-hidden="true">
      <span className="i_line m_top b_skeleton" />
      <span className="i_line m_no b_skeleton" />
      <span className="i_line m_name b_skeleton" />
      <span className="i_line m_price b_skeleton" />
    </div>
  );
}

export default function OrdersView() {
  const router = useRouter();

  /* 적재 결과 한 벌. 로딩 상태를 따로 두지 않고 null 여부로 파생한다 —
     effect 안에서 동기 setState를 하지 않기 위한 형태다 (8.3의 학습, 8.4·8.5의 정본). */
  const [result, setResult] = useState<Loaded | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  /* `더 보기`는 목록을 지우지 않는 별도 축이다 — 진행 상태·오류를 result에 섞지 않는다.
     (5.1의 리뷰 교훈 b: 새로고침이 loadMore 플래그에 막히던 부채) */
  const [morePending, setMorePending] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);

  /* 401 → /login?next=%2Forders. 미들웨어 통과는 인증이 아니다 —
     slur_role(14일)이 slur_access(30분)보다 오래 살아 있다 (AD-1, R7). */
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
      setMorePending(false);
      setMoreError(null);
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

  /* 다음 페이지를 뒤에 잇는다.
     🚨 order_id 중복 제거 — offset 페이지네이션 도중 새 주문이 생기면 경계 항목이 두 페이지에
        걸친다. 뒤엣것을 버린다 (5.1이 겪은 사고).
     🚨 실패하면 page를 올리지 않는다 — 다음 `더 보기`가 같은 페이지를 다시 청한다.
        (validation_error로 상한을 넘은 경우에도 목록이 어긋난 채 굳지 않는다) */
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
          if (seen.has(card.order_id)) continue;
          seen.add(card.order_id);
          merged.push(card);
        }
        return { items: merged, total: page.total, page: page.page, error: null };
      });
    })();
  }, [morePending, result, toLogin]);

  // 최초 로딩은 행 골격이다 — 화면 중앙 스피너를 쓰지 않는다 (UX-DR9)
  if (result === null) {
    return (
      <div className="i_rows">
        <RowSkeleton />
        <RowSkeleton />
        <RowSkeleton />
      </div>
    );
  }

  if (result.error) {
    return (
      <div className="i_feedback">
        <ErrorState message={result.error.message} onRetry={() => setReloadKey((n) => n + 1)} />
      </div>
    );
  }

  if (result.items.length === 0) {
    return (
      <div className="i_feedback">
        <EmptyState
          message={EMPTY_MESSAGE}
          action={
            <Link href="/" className="b_btn m_ghost b_control">
              쇼핑 계속하기
            </Link>
          }
        />
      </div>
    );
  }

  // 🚨 페이지 크기를 알지 못한다 — 누적 길이와 total만 비교한다 (D4, AD-13)
  const hasMore = result.items.length < result.total;

  return (
    <>
      <div className="i_rows">
        {result.items.map((order) => {
          const status = orderStatusView(order.display_status);
          // 판매자를 브랜드명으로 부른다 (UX-DR15). 빈 브랜드명은 잇는 점만 남기지 않도록 거른다.
          const brands = order.sub_orders
            .map((s) => s.brand_name)
            .filter((b) => b !== "")
            .join(" · ");
          return (
            <Link key={order.order_id} href={`/orders/${order.order_id}`} className="b_order_row">
              <span className="i_top">
                <span className="i_date">{formatOrderDate(order.created_at)}</span>
                <StatusLabel tone={status.tone}>
                  {/* 색만 다른 글자가 아니라 무엇의 상태인지 읽히게 한다 (UX-DR8, 접근성 바닥) */}
                  <span className="b_sr">주문 상태 </span>
                  {status.label}
                </StatusLabel>
              </span>
              {/* 🚨 order_no를 그대로 쓴다 — UUID 뒤 8자리 대문자이며 클라 가공 금지 (위험 7) */}
              <span className="i_no">{order.order_no}</span>
              <span className="i_body">
                <span className="i_info">
                  {/* 서버가 조립한 `유광 도자 머그 외 1건` — 화면이 "외 n건"을 만들지 않는다 */}
                  <span className="i_name">{order.title}</span>
                  {brands ? <span className="i_brands">{brands}</span> : null}
                  <span className="i_price">{formatWon(order.grand_total)}</span>
                </span>
                {/* 셰브런은 CSS 도형이다 — 인라인 SVG는 [data-surface="buyer"] svg의
                    stroke-width 전역 규칙을 물려받는다 (8.4의 학습 12) */}
                <span className="i_caret" aria-hidden="true" />
              </span>
            </Link>
          );
        })}
      </div>

      <div className="i_end">
        {hasMore ? (
          <button type="button" className="b_btn m_ghost b_control i_more" disabled={morePending} onClick={onMore}>
            {MORE_LABEL}
          </button>
        ) : (
          <p className="b_notice i_end_note">{LIST_END}</p>
        )}
        {/* 🚨 HTTP 코드·code 문자열을 쓰지 않는다 — 봉투의 message 그대로다 */}
        {moreError ? (
          <p className="b_err_msg i_more_err" role="status">
            {moreError}
          </p>
        ) : null}
      </div>
    </>
  );
}
