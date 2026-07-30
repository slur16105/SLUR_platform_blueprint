"use client";

/* 장바구니 본체 — **새 테마 판**.

   🚨 이 파일은 cart-view.tsx + cart-pack.tsx의 **로직을 그대로 옮긴 것**이고 바뀐 것은 마크업뿐이다.
      아래 규약은 검증된 동작이라 다시 짜지 않는다:
   · D1 — 묶음 키는 brand_name(응답에 seller_id가 없다). 순서는 응답 순서 그대로. 재정렬하지 않는다.
          그래야 장바구니 순서 = 주문서 순서 = 주문 스냅샷 순서가 유지된다.
   · D2 — 배송비 숫자를 만들지 않는다. 유일한 계산 경로는 POST /orders/preview(우편번호 필요)다.
   · D6 — 낙관적 갱신은 수량·행 금액만. **성공에만 재조회**하고, 실패는 되돌린 뒤 그 자리에 문장을 남긴다.
          (자동 재조회가 오류 문장을 덮어쓰던 것이 Flutter판의 부채였다.)
   · D7 — 삭제는 인라인 확인 줄이다. 모달·window.confirm·스와이프 삭제를 만들지 않는다.
   · D8 — 행은 [사진+이름·옵션·금액 = 상세 링크] … [우측: 수량 + 삭제]. 컨트롤은 링크의 형제라
          클릭이 상세 이동을 부르지 않는다(stopPropagation 불필요).
   · D10 — 폭 전환은 CSS만. 조건부 렌더로 바꾸면 열린 확인 줄·진행 중 요청이 날아간다.
   🚨 합계는 서버의 purchasable_total 하나에서만 온다. 행 금액을 더하지 않는다 (AD-12). */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { formatWon } from "../format";
import { getCart, removeItem, setQuantity, type CartItem, type CartResponse } from "../cart-api";
import { useCartCount } from "../cart-count";
import { type ApiFailure } from "../buyer-feedback";
import {
  DEAD_PACK_NOTE,
  DEAD_PACK_TAG,
  DISCONTINUED_BRAND,
  EMPTY_MESSAGE,
  MAX_CART_QTY,
  MIN_CART_QTY,
  SHIPPING_NOTE,
  SUMMARY_PENDING_TEXT,
  SUMMARY_TOTAL_LABEL,
} from "./constants";

type Pack = { key: string; brand: string; items: CartItem[] };

function groupPacks(items: CartItem[]): Pack[] {
  const packs = new Map<string, Pack>();
  for (const item of items) {
    // variant_id가 null인 항목은 brand_name이 ""이라 자연히 한 묶음으로 모인다.
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

export default function CartScreen() {
  const router = useRouter();
  const { setCount } = useCartCount();

  /* 적재 결과 한 벌. 로딩 상태를 따로 두지 않고 null 여부로 파생한다 —
     effect 안에서 동기 setState를 하지 않기 위한 형태다. */
  const [result, setResult] = useState<{ data: CartResponse | null; error: ApiFailure | null } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

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

  /* 조용한 재조회 — 골격으로 되돌아가거나 스크롤이 튀지 않는다. 성공했을 때만 부른다 (D6). */
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
        // 직전 수량으로 되돌린다. 🚨 실패에는 재조회하지 않는다 (D6).
        setOverrides((o) => ({ ...o, [item.id]: prev }));
        setRowError({ id: item.id, message: r.error.message });
        if (r.error.code === "not_found") void refetch(); // 이미 지워진 항목이면 목록을 맞춘다
      })();
    },
    [refetch, toLogin],
  );

  const onConfirmDelete = useCallback(
    (id: string) => {
      setPendingId(id);
      setRowError(null);
      void (async () => {
        const r = await removeItem(id);
        setPendingId(null);
        if (r.ok) {
          setConfirmId(null);
          await refetch(); // 마지막 항목이 지워지면 빈 장바구니 상태로 바뀐다
          return;
        }
        if (r.error.code === "unauthorized") {
          toLogin();
          return;
        }
        setRowError({ id, message: r.error.message }); // 확인 줄은 열어 둔다
        if (r.error.code === "not_found") {
          setConfirmId(null);
          void refetch();
        }
      })();
    },
    [refetch, toLogin],
  );

  /* `다시 시도` — 오류 화면을 지우고 골격으로 되돌린 뒤 다시 읽는다. */
  const retry = useCallback(() => {
    setResult(null);
    setReloadKey((n) => n + 1);
  }, []);

  const loading = result === null;
  const data = result?.data ?? null;
  const error = result?.error ?? null;

  if (loading) {
    return (
      <div className="mx-auto max-w-[1600px] px-5 py-16">
        <div className="space-y-6">
          {[0, 1].map((i) => (
            <div key={i} className="flex gap-4">
              <div className="h-28 w-24 animate-pulse bg-muted" />
              <div className="flex-1 space-y-3 pt-1">
                <div className="h-3 w-24 animate-pulse bg-muted" />
                <div className="h-5 w-1/2 animate-pulse bg-muted" />
                <div className="h-4 w-24 animate-pulse bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-[1600px] px-5 py-32 text-center">
        <p className="text-[16px] text-muted-foreground">{error?.message ?? "장바구니를 불러오지 못했습니다."}</p>
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

  if (data.items.length === 0) {
    return (
      <div className="mx-auto max-w-[1600px] px-5 py-32 text-center">
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

  const packs = groupPacks(data.items);
  // 배지는 담긴 항목 수 전체, CTA는 주문 가능 항목 수. 둘 다 수량의 합이 아니라 행의 수다.
  const orderableCount = data.items.filter((i) => i.purchasable).length;

  const orderButton = (
    <button
      type="button"
      disabled={orderableCount === 0}
      onClick={() => router.push("/checkout")}
      className="h-14 w-full bg-foreground text-[15px] font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-default disabled:bg-muted disabled:text-muted-foreground"
    >
      주문하기 ({orderableCount}건)
    </button>
  );

  return (
    <>
      <div className="mx-auto grid max-w-[1600px] gap-10 px-5 pb-24 lg:grid-cols-[1fr_360px] lg:gap-14">
        {/* 좌 — 판매자 묶음 */}
        <div>
          {packs.map((pack) => {
            /* D4 — 구매 불가의 진실 단위는 **항목**이다. 묶음 태그·안내는 묶음의 모든 항목이
               불가할 때만 붙는다. 섞여 있으면 그 행만 흐려지고 행에 태그가 붙는다. */
            const deadPack = pack.items.every((i) => !i.purchasable);
            return (
              <div key={pack.key} className="border-t border-border py-7 first:border-t-0 first:pt-0">
                <div className="mb-5 flex items-center gap-3">
                  <p className="text-[15px] font-semibold uppercase tracking-wide">{pack.brand}</p>
                  {deadPack ? (
                    <span className="bg-muted px-2 py-1 text-[11px] text-muted-foreground">{DEAD_PACK_TAG}</span>
                  ) : null}
                </div>

                <div className="space-y-6">
                  {pack.items.map((item) => {
                    const qty = overrides[item.id] ?? item.quantity;
                    const busy = pendingId === item.id;
                    const confirming = confirmId === item.id;
                    const err = rowError?.id === item.id ? rowError.message : null;
                    const dead = !item.purchasable;
                    const lineTotal = item.final_price === null ? null : item.final_price * qty;

                    const main = (
                      <>
                        <div className="h-28 w-24 flex-none overflow-hidden bg-muted">
                          {item.image_url ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={item.image_url}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              className={`h-full w-full object-cover ${dead ? "opacity-40 grayscale" : ""}`}
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`truncate text-[17px] font-medium ${dead ? "text-muted-foreground" : ""}`}>
                            {item.product_name}
                          </p>
                          <p className="mt-1 truncate text-[13px] text-muted-foreground">{item.option_text || "—"}</p>
                          {dead && !deadPack ? (
                            <span className="mt-2 inline-block bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                              {DEAD_PACK_TAG}
                            </span>
                          ) : null}
                          <p className="mt-2 text-[15px] font-semibold tabular-nums">
                            {lineTotal === null ? "—" : formatWon(lineTotal)}
                          </p>
                        </div>
                      </>
                    );

                    return (
                      <div key={item.id} className="flex gap-4">
                        {/* 상세 링크 — 조합이 삭제된 항목(product_id 없음)은 링크 없이 그린다 */}
                        {item.product_id ? (
                          <Link href={`/products/${item.product_id}`} className="flex flex-1 gap-4">
                            {main}
                          </Link>
                        ) : (
                          <div className="flex flex-1 gap-4">{main}</div>
                        )}

                        {/* 우측 컨트롤 — 링크의 형제다 (D8) */}
                        <div className="flex flex-none flex-col items-end justify-between gap-3">
                          {confirming ? (
                            /* D7 — 인라인 확인 줄. 모달을 만들지 않는다. */
                            <div className="flex items-center gap-2" role="group" aria-label={`${item.product_name} 삭제 확인`}>
                              <span className="text-[13px]">삭제할까요?</span>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => onConfirmDelete(item.id)}
                                className="border border-foreground px-3 py-1.5 text-[13px] disabled:opacity-50"
                              >
                                삭제
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => {
                                  setConfirmId(null);
                                  setRowError(null);
                                }}
                                className="px-2 py-1.5 text-[13px] text-muted-foreground disabled:opacity-50"
                              >
                                취소
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmId(item.id); // 한 번에 한 행만 확인 상태다
                                setRowError(null);
                              }}
                              aria-label={`${item.product_name} 삭제`}
                              className="text-[18px] leading-none text-muted-foreground transition-colors hover:text-foreground"
                            >
                              ×
                            </button>
                          )}

                          <div className="flex items-center border border-border">
                            <button
                              type="button"
                              onClick={() => onStep(item, qty - 1)}
                              disabled={busy || dead || qty <= MIN_CART_QTY}
                              aria-label="수량 줄이기"
                              className="h-9 w-9 transition-colors hover:bg-muted disabled:opacity-40"
                            >
                              −
                            </button>
                            <span className="w-10 text-center text-[14px] tabular-nums">{qty}</span>
                            <button
                              type="button"
                              onClick={() => onStep(item, qty + 1)}
                              disabled={busy || dead || qty >= MAX_CART_QTY}
                              aria-label="수량 늘리기"
                              className="h-9 w-9 transition-colors hover:bg-muted disabled:opacity-40"
                            >
                              +
                            </button>
                          </div>

                          {/* 실패 문장 — 타이머로 자동 소거하지 않는다 (D6) */}
                          {err ? (
                            <p className="max-w-[220px] text-right text-[12px] text-accent" role="alert">
                              {err}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {deadPack ? (
                  <p className="mt-5 border-t border-border pt-4 text-[13px] text-muted-foreground">{DEAD_PACK_NOTE}</p>
                ) : (
                  <p className="mt-5 border-t border-border pt-4 text-[13px] text-muted-foreground">{SHIPPING_NOTE}</p>
                )}
              </div>
            );
          })}
        </div>

        {/* 우 — 합계. 묶음이 둘 이상일 때만 따라다닌다 (UX-DR4) */}
        <aside className={packs.length >= 2 ? "lg:sticky lg:top-[124px] lg:self-start" : undefined}>
          <div className="border border-border p-7">
            <p className="mb-6 text-[15px] font-semibold uppercase tracking-wide">ORDER SUMMARY</p>
            <dl className="space-y-3 text-[14px]">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{SUMMARY_TOTAL_LABEL}</dt>
                {/* 🚨 서버의 purchasable_total 하나만 쓴다 — 행 금액을 더하지 않는다 (AD-12) */}
                <dd className="tabular-nums">{formatWon(data.purchasable_total)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">배송비</dt>
                <dd className="text-muted-foreground">{SUMMARY_PENDING_TEXT}</dd>
              </div>
            </dl>
            <div className="mt-6 flex items-baseline justify-between border-t border-border pt-5">
              <span className="text-[14px] font-semibold">{SUMMARY_TOTAL_LABEL}</span>
              <span className="text-[26px] font-semibold tabular-nums">{formatWon(data.purchasable_total)}</span>
            </div>
            <div className="mt-6 hidden lg:block">{orderButton}</div>
            <p className="mt-4 text-[12px] leading-relaxed text-muted-foreground">
              SLUR는 통신판매중개자이며 통신판매의 당사자가 아닙니다.
            </p>
          </div>
        </aside>
      </div>

      {/* 하단 고정 CTA (<lg) — DOM 순서상 콘텐츠 뒤에 둔다 (UX-DR6) */}
      <div className="sticky bottom-0 z-40 border-t border-border bg-background px-5 py-3 lg:hidden">
        {orderButton}
      </div>
    </>
  );
}
