"use client";

/* 주문완료 본체 (8.5 D3).

   🚨 이 화면은 **자기 데이터를 스스로 가져온다.** 생성 응답을 메모리로 나르지 않는다 —
      (a) POST /orders의 201에는 order_no가 없어 애초에 그릴 수 없고,
      (b) 메모리로 나르면 새로고침 한 번에 빈 화면이 된다.
      URL에 싣는 것은 주문 UUID 하나뿐이다. 금액·계좌를 쿼리에 실으면 조작된 화면을 만들 수 있고,
      남의 UUID를 넣어도 서버가 소유자를 검증해 404를 준다(존재 노출 방지).
   🚨 입금 안내 상자는 **deposit_info 객체의 존재 여부로만** 분기한다.
      display_status 문자열로 분기하지 않는다 (AD-12, 5.1의 확정 규약).
      관리자가 그 사이 입금 확인을 하면 상자가 사라진 완료 화면이 보인다 — 정직한 표시다. */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import DepositBox from "../../deposit-box";
import { EmptyState, ErrorState, type ApiFailure } from "../../buyer-feedback";
import { getOrder, isUuid, type OrderDetailResponse } from "../../orders-api";

const HEADING = "주문이 접수되었습니다";
const NOT_FOUND = "주문을 찾을 수 없습니다.";
const TAIL = "기한까지 입금이 확인되지 않으면 주문은 자동 취소됩니다.";

export default function CompleteView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const orderId = params.get("order") ?? "";
  const valid = isUuid(orderId);

  /* 적재 결과 한 벌. 로딩은 null 여부로 파생한다 —
     effect 본문에서 동기 setState를 하지 않기 위한 형태다 (8.3의 학습). */
  const [result, setResult] = useState<{ data: OrderDetailResponse | null; error: ApiFailure | null } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  /* 401 → /login?next=<현재 경로+쿼리>. 로그인 후 이 주문완료 화면으로 되돌아온다. */
  const toLogin = useCallback(() => {
    const q = params.toString();
    const here = q ? `${pathname}?${q}` : pathname;
    router.replace(`/login?next=${encodeURIComponent(here)}`);
  }, [router, pathname, params]);

  useEffect(() => {
    // 형식이 아닌 id는 서버를 부르지 않는다 — BFF도 같은 판정을 하지만 왕복이 낭비다
    if (!valid) return;
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

  /* `다시 시도` — 오류 화면을 지우고 골격으로 되돌린 뒤 다시 읽는다 (재시도 규약, /me와 같다).
     reloadKey만 올리면 응답이 올 때까지 같은 오류 화면이 남아 눌러도 아무 일이 없어 보인다. */
  const retry = useCallback(() => {
    setResult(null);
    setReloadKey((n) => n + 1);
  }, []);

  /* order 파라미터가 없거나 UUID 형식이 아니면 빈 화면이 아니라 안내를 낸다 (AC 12) */
  if (!valid) {
    return (
      <div className="b_complete b_col_confirm">
        <EmptyState message={NOT_FOUND} action={<OrdersLink />} />
      </div>
    );
  }

  if (result === null) {
    return (
      <div className="b_complete b_col_confirm">
        <div className="b_complete_skeleton" aria-hidden="true">
          <span className="i_line m_title b_skeleton" />
          <span className="i_line m_short b_skeleton" />
          <span className="i_box b_skeleton" />
        </div>
      </div>
    );
  }

  if (result.error || !result.data) {
    const notFound = result.error?.code === "not_found";
    return (
      <div className="b_complete b_col_confirm">
        {notFound ? (
          <EmptyState message={NOT_FOUND} action={<OrdersLink />} />
        ) : (
          <ErrorState message={result.error?.message ?? ""} onRetry={retry} />
        )}
      </div>
    );
  }

  const order = result.data;
  const deposit = order.deposit_info;

  return (
    <div className="b_complete b_col_confirm">
      <span className="i_mark" aria-hidden="true" />
      <h1 className="b_title_sm i_heading">{HEADING}</h1>

      <p className="i_orderno">
        <span className="i_key">주문번호</span>
        {/* 🚨 응답 order_no를 그대로 쓴다 — UUID 뒤 8자리 대문자이며 클라 가공 금지 (위험 6) */}
        <b className="i_value">{order.order_no}</b>
      </p>

      {/* 🚨 deposit_info가 null이면(이미 입금 확인·취소된 주문을 다시 열었을 때) 상자를 그리지 않는다 */}
      {deposit ? (
        <>
          <DepositBox
            variant="placed"
            amount={deposit.grand_total}
            account={deposit.deposit_account}
            dueAt={deposit.deposit_due_at}
            expired={deposit.expired}
          />
          <p className="b_notice i_tail">{TAIL}</p>
        </>
      ) : null}

      <div className="i_acts">
        {/* 목적지 /orders/[id]는 8.6이 만들었다 — 살아 있는 링크다 */}
        <Link href={`/orders/${order.order_id}`} className="b_btn m_solid m_full b_button_text">
          주문 상세 보기
        </Link>
        <Link href="/" className="b_btn m_ghost m_full b_button_text">
          쇼핑 계속하기
        </Link>
      </div>
    </div>
  );
}

function OrdersLink() {
  return (
    <Link href="/orders" className="b_btn m_ghost b_control">
      주문내역 보기
    </Link>
  );
}
