"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import AmountSummary from "../amount-summary";
import CartPack, { type CartPackData, type CartPackHandlers, type CartRowView } from "./cart-pack";
import { EmptyState, ErrorState, type ApiFailure } from "../buyer-feedback";
import { getCart, removeItem, setQuantity, type CartItem, type CartResponse } from "../cart-api";
import { useCartCount } from "../cart-count";
import {
  DISCONTINUED_BRAND,
  EMPTY_MESSAGE,
  MAX_CART_QTY,
  MIN_CART_QTY,
  SHIPPING_NOTE,
  SUMMARY_PENDING_TEXT,
  SUMMARY_TOTAL_LABEL,
} from "./constants";

/* 장바구니 본체.

   D1 — 묶음 키는 brand_name이다(응답에 seller_id가 없다). 묶음 순서·묶음 안 순서는
        응답이 내려온 순서 그대로다(서버 정렬 created_at DESC, id DESC). 재정렬하지 않는다 —
        그래야 장바구니 순서 = 주문서 순서 = 주문 스냅샷 순서가 유지된다.
   D2 — 배송비·도서산간은 숫자를 내지 않는다. 어떤 API도 장바구니 시점에 배송비를 주지 않고
        유일한 계산 경로(POST /orders/preview)는 우편번호를 요구한다. 지어내지 않는다.
   D6 — 낙관적 갱신은 수량·행 금액만. 성공에만 재조회하고, 실패는 되돌린 뒤 그 자리에 문장을 남긴다.
        (Flutter판 cart_screen.dart의 finally-invalidate 부채를 여기서 갚는다.)
   D10 — 폭 전환은 CSS만으로 한다. matchMedia·innerWidth·resize를 쓰지 않는다 —
        조건부 렌더는 폭이 바뀔 때 언마운트되어 열린 확인 줄·진행 중 요청·오류 문장을 날린다.
   🚨 합계는 서버의 purchasable_total 하나에서만 온다. 행 금액을 더하지 않는다 (AD-12). */

function groupPacks(items: CartItem[]): CartPackData[] {
  const packs = new Map<string, CartPackData>();
  for (const item of items) {
    // variant_id가 null인 항목은 brand_name이 ""이므로 자연스럽게 한 묶음으로 모인다.
    // 표시명만 `판매 종료`로 바꾼다 — 빈 브랜드 라벨을 그리면 헤더가 비어 보인다.
    const key = item.brand_name;
    let pack = packs.get(key);
    if (!pack) {
      pack = { key, brand: key === "" ? DISCONTINUED_BRAND : key, items: [] };
      packs.set(key, pack);
    }
    pack.items.push(item);
  }
  return [...packs.values()]; // Map은 삽입 순서를 지킨다 = 응답 순서
}

function PackSkeleton() {
  return (
    <div className="b_cart_skeleton" aria-hidden="true">
      <span className="i_head b_skeleton" />
      <div className="i_row">
        <span className="i_thumb b_skeleton" />
        <div className="i_lines">
          <span className="i_line b_skeleton" />
          <span className="i_line m_short b_skeleton" />
          <span className="i_line m_price b_skeleton" />
        </div>
      </div>
    </div>
  );
}

export default function CartView() {
  const router = useRouter();
  const { setCount } = useCartCount();

  /* 적재 결과 한 벌. 로딩 상태를 따로 두지 않고 null 여부로 파생한다 —
     effect 안에서 동기 setState를 하지 않기 위한 형태다(react-hooks/set-state-in-effect). */
  const [result, setResult] = useState<{ data: CartResponse | null; error: ApiFailure | null } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // 행 단위 상태 — 폭이 바뀌어도 살아남는다(조건부 렌더가 아니라 CSS로만 배치가 바뀌므로)
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const [focusRow, setFocusRow] = useState<{ id: string; target: "confirm" | "delete" } | null>(null);

  /* 401 → /login?next=%2Fcart. 미들웨어 통과는 인증이 아니다 —
     slur_role(14일)이 slur_access(30분)보다 오래 살아 있다 (AD-1). */
  const toLogin = useCallback(() => router.replace("/login?next=%2Fcart"), [router]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const r = await getCart();
      if (!alive) return;
      if (!r.ok && r.error.code === "unauthorized") {
        toLogin();
        return;
      }
      if (r.ok) setCount(r.data.items.length);
      setOverrides({});
      setResult(r.ok ? { data: r.data, error: null } : { data: null, error: r.error });
    })();
    return () => {
      alive = false;
    };
  }, [reloadKey, toLogin, setCount]);

  /* 조용한 재조회 — skeleton으로 되돌아가거나 스크롤이 튀지 않는다.
     성공했을 때만 부른다 (D6). 실패한 요청은 서버 상태를 바꾸지 않았으므로 재조회할 이유가 없다. */
  const refetch = useCallback(async () => {
    const r = await getCart();
    if (!r.ok) {
      if (r.error.code === "unauthorized") toLogin();
      return;
    }
    setCount(r.data.items.length);
    setOverrides({});
    setResult({ data: r.data, error: null });
  }, [toLogin, setCount]);

  const onStep = useCallback(
    (item: CartItem, next: number) => {
      if (next < MIN_CART_QTY || next > MAX_CART_QTY) return;
      const prev = item.quantity;
      setOverrides((o) => ({ ...o, [item.id]: next }));
      setPendingId(item.id);
      setRowError(null);
      void (async () => {
        const r = await setQuantity(item.id, next);
        setPendingId(null);
        if (r.ok) {
          await refetch();
          return;
        }
        if (r.error.code === "unauthorized") {
          toLogin();
          return;
        }
        // 직전 수량으로 되돌린다. 🚨 실패에는 재조회하지 않는다 — 자동 재조회가 오류 문장을 덮어쓰는 것이
        //    Flutter판의 부채였다 (D6). 단 not_found는 이미 지워진 항목이라 목록을 맞추는 편이 낫다.
        setOverrides((o) => ({ ...o, [item.id]: prev }));
        setRowError({ id: item.id, message: r.error.message });
        if (r.error.code === "not_found") void refetch();
      })();
    },
    [refetch, toLogin],
  );

  const onAsk = useCallback((id: string) => {
    // 한 번에 한 행만 확인 상태다 — 다른 행의 `삭제`를 누르면 이전 확인 줄이 닫힌다
    setConfirmId(id);
    setRowError(null);
    setFocusRow({ id, target: "confirm" });
  }, []);

  const onCancel = useCallback((id: string) => {
    setConfirmId(null);
    setRowError(null);
    setFocusRow({ id, target: "delete" });
  }, []);

  const onConfirmDelete = useCallback(
    (id: string) => {
      setPendingId(id);
      setRowError(null);
      void (async () => {
        const r = await removeItem(id);
        setPendingId(null);
        if (r.ok) {
          setConfirmId(null);
          setFocusRow(null);
          await refetch(); // 마지막 항목이 지워지면 빈 장바구니 상태로 바뀐다
          return;
        }
        if (r.error.code === "unauthorized") {
          toLogin();
          return;
        }
        setRowError({ id, message: r.error.message }); // 확인 줄은 열린 채로 둔다
        if (r.error.code === "not_found") {
          setConfirmId(null);
          void refetch();
        }
      })();
    },
    [refetch, toLogin],
  );

  const onRefresh = useCallback(() => {
    setRowError(null);
    void refetch();
  }, [refetch]);

  /* 마운트 즉시 포커스를 가져가는 안정된 ref 콜백.
     identity가 고정이라 리렌더마다 다시 불리지 않는다 — 포커스를 훔치는 루프가 생기지 않는다. */
  const focusRef = useCallback((el: HTMLButtonElement | null) => {
    el?.focus();
  }, []);

  /* `다시 시도` — 오류 화면을 지우고 골격으로 되돌린 뒤 다시 읽는다 (재시도 규약, /me와 같다).
     reloadKey만 올리면 응답이 올 때까지 같은 오류 화면이 그대로 남아 눌러도 아무 일이 없어 보인다. */
  const retry = useCallback(() => {
    setResult(null);
    setReloadKey((n) => n + 1);
  }, []);

  const loading = result === null;
  const data = result?.data ?? null;
  const error = result?.error ?? null;

  if (loading) {
    // 최초 로딩은 묶음 골격이다 — 화면 중앙 스피너를 쓰지 않는다 (UX-DR9)
    return (
      <div className="b_cart">
        <div className="i_packs">
          <PackSkeleton />
          <PackSkeleton />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="b_cart">
        <div className="i_packs">
          <div className="b_container">
            <ErrorState message={error?.message ?? ""} onRetry={retry} />
          </div>
        </div>
      </div>
    );
  }

  if (data.items.length === 0) {
    // 금액 요약과 하단 고정 CTA 바가 사라진다. 탭바는 그대로 선다(최상위 화면이므로 — 셸 소관).
    return (
      <div className="b_cart">
        <div className="i_packs">
          <div className="b_container">
            <EmptyState
              message={EMPTY_MESSAGE}
              action={
                <Link href="/" className="b_btn m_ghost b_control">
                  쇼핑 계속하기
                </Link>
              }
            />
          </div>
        </div>
      </div>
    );
  }

  const packs = groupPacks(data.items);
  // 배지는 담긴 항목 수 전체, CTA는 주문 가능 항목 수. 둘 다 수량의 합이 아니라 행의 수다 (AC 8).
  const orderableCount = data.items.filter((i) => i.purchasable).length;

  const view: CartRowView = { overrides, pendingId, confirmId, rowError, focusRow };
  const handlers: CartPackHandlers = { onStep, onAsk, onCancel, onConfirmDelete, onRefresh, focusRef };

  const orderButton = (
    <button
      type="button"
      className="b_btn m_solid m_full b_button_text"
      disabled={orderableCount === 0}
      onClick={() => router.push("/checkout")}
    >
      주문하기 ({orderableCount}건)
    </button>
  );

  return (
    <>
      {/* 묶음이 하나뿐이면 sticky를 걸지 않는다 (UX-DR4) — 판정은 묶음 수 하나다 (D10) */}
      <div className="b_cart" data-sticky={packs.length >= 2 ? "on" : undefined}>
        <div className="i_packs">
          {packs.map((pack) => (
            <CartPack key={pack.key} pack={pack} view={view} h={handlers} />
          ))}
        </div>

        <div className="i_summary">
          <AmountSummary
            data={{
              itemsTotal: data.purchasable_total,
              shippingFee: null,
              remoteAreaFee: null,
              total: data.purchasable_total,
            }}
            totalLabel={SUMMARY_TOTAL_LABEL}
            pendingText={SUMMARY_PENDING_TEXT}
          />
          <p className="b_notice i_note">{SHIPPING_NOTE}</p>
          {/* ≥768에서만 보이는 사본 — CTA가 우측 칼럼 안으로 승격된다 */}
          <div className="i_cta_side">{orderButton}</div>
        </div>
      </div>

      {/* 하단 고정 CTA 바 (<768) — DOM 순서상 콘텐츠 뒤에 둔다 (UX-DR6).
          같은 버튼을 두 자리에 렌더하고 CSS display로 전환한다 (D10). */}
      <div className="b_cta_bar m_stack">{orderButton}</div>
    </>
  );
}
