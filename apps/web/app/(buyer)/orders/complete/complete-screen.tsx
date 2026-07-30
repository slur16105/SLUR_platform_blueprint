"use client";

/* 주문완료 본체 — **새 테마 판**.

   🚨 complete-view.tsx의 **로직을 그대로 옮긴 것**이고 바뀐 것은 마크업뿐이다:
   · 이 화면은 **자기 데이터를 스스로 가져온다.** 생성 응답을 메모리로 나르지 않는다 —
     POST /orders의 201에는 order_no가 없고, 메모리로 나르면 새로고침 한 번에 빈 화면이 된다.
     URL에 싣는 것은 주문 UUID 하나뿐이다(금액·계좌를 쿼리에 실으면 조작된 화면을 만들 수 있다).
   · 입금 안내 상자는 **deposit_info 객체의 존재 여부로만** 분기한다.
     display_status 문자열로 분기하지 않는다 (AD-12). 관리자가 그 사이 입금 확인을 하면
     상자가 사라진 완료 화면이 보인다 — 정직한 표시다.
   · order_no는 응답 값을 그대로 쓴다 — 클라이언트가 가공하지 않는다. */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import DepositBoxThemed from "../../deposit-box-themed";
import { type ApiFailure } from "../../buyer-feedback";
import { getOrder, isUuid, type OrderDetailResponse } from "../../orders-api";

const HEADING = "주문이 접수되었습니다";
const NOT_FOUND = "주문을 찾을 수 없습니다.";
const TAIL = "기한까지 입금이 확인되지 않으면 주문은 자동 취소됩니다.";

function OrdersLink() {
  return (
    <Link
      href="/orders"
      className="inline-block border border-foreground px-10 py-4 text-[14px] font-semibold uppercase transition-colors hover:bg-foreground hover:text-background"
    >
      주문내역 보기
    </Link>
  );
}

export default function CompleteScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const orderId = params.get("order") ?? "";
  const valid = isUuid(orderId);

  const [result, setResult] = useState<{ data: OrderDetailResponse | null; error: ApiFailure | null } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  /* 401 → /login?next=<현재 경로+쿼리>. 로그인 후 이 주문완료 화면으로 되돌아온다. */
  const toLogin = useCallback(() => {
    const q = params.toString();
    const here = q ? `${pathname}?${q}` : pathname;
    router.replace(`/login?next=${encodeURIComponent(here)}`);
  }, [router, pathname, params]);

  useEffect(() => {
    if (!valid) return; // 형식이 아닌 id는 서버를 부르지 않는다
    let alive = true;
    void (async () => {
      const r = await getOrder(orderId);
      if (!alive) return;
      if (!r.ok && r.error.code === "unauthorized") {
        toLogin();
        return;
      }
      setResult(r.ok ? { data: r.data, error: null } : { data: null, error: r.error });
    })();
    return () => {
      alive = false;
    };
  }, [orderId, valid, reloadKey, toLogin]);

  const retry = useCallback(() => {
    setResult(null);
    setReloadKey((n) => n + 1);
  }, []);

  const wrap = "mx-auto w-full max-w-[560px] px-5 py-16 text-center";

  /* order 파라미터가 없거나 UUID 형식이 아니면 빈 화면이 아니라 안내를 낸다 */
  if (!valid) {
    return (
      <div className={wrap}>
        <p className="text-[16px] text-muted-foreground">{NOT_FOUND}</p>
        <div className="mt-7">
          <OrdersLink />
        </div>
      </div>
    );
  }

  if (result === null) {
    return (
      <div className={wrap} aria-hidden="true">
        <div className="mx-auto h-8 w-56 animate-pulse bg-muted" />
        <div className="mx-auto mt-4 h-4 w-40 animate-pulse bg-muted" />
        <div className="mt-10 h-56 w-full animate-pulse bg-muted" />
      </div>
    );
  }

  if (result.error || !result.data) {
    const notFound = result.error?.code === "not_found";
    return (
      <div className={wrap}>
        <p className="text-[16px] text-muted-foreground">{notFound ? NOT_FOUND : result.error?.message}</p>
        <div className="mt-7">
          {notFound ? (
            <OrdersLink />
          ) : (
            <button
              type="button"
              onClick={retry}
              className="border border-foreground px-10 py-4 text-[14px] font-semibold uppercase transition-colors hover:bg-foreground hover:text-background"
            >
              다시 시도
            </button>
          )}
        </div>
      </div>
    );
  }

  const order = result.data;
  const deposit = order.deposit_info;

  return (
    <div className={wrap}>
      {/* 접수 표시 — 색이 아니라 형태로 (모노크롬) */}
      <span
        aria-hidden="true"
        className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border-2 border-foreground text-[24px] leading-none"
      >
        ✓
      </span>

      <h1 className="mt-6 text-[28px] font-semibold tracking-tight">{HEADING}</h1>

      <p className="mt-4 text-[14px]">
        <span className="text-muted-foreground">주문번호 </span>
        {/* 🚨 응답 order_no를 그대로 쓴다 — 클라이언트 가공 금지 */}
        <b className="font-semibold tracking-wide">{order.order_no}</b>
      </p>

      {/* 🚨 deposit_info가 null이면 상자를 그리지 않는다(이미 입금 확인·취소된 주문) */}
      {deposit ? (
        <div className="mt-10 text-left">
          <DepositBoxThemed
            amount={deposit.grand_total}
            account={deposit.deposit_account}
            dueAt={deposit.deposit_due_at}
            expired={deposit.expired}
          />
          <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">{TAIL}</p>
        </div>
      ) : null}

      <div className="mt-10 space-y-2">
        <Link
          href={`/orders/${order.order_id}`}
          className="block h-14 w-full bg-foreground text-[15px] font-semibold leading-[3.5rem] text-background transition-opacity hover:opacity-90"
        >
          주문 상세 보기
        </Link>
        <Link
          href="/"
          className="block h-14 w-full border border-foreground text-[15px] font-semibold leading-[3.4rem] transition-colors hover:bg-muted"
        >
          쇼핑 계속하기
        </Link>
      </div>
    </div>
  );
}
