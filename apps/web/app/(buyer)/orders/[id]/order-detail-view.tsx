"use client";

/* 주문상세 본체 (8.6 D6·D8·D9·D10).

   구획 순서: 주문번호·일시 → (입금대기면 입금 안내 상자) → 주문 상품(판매자 묶음들)
              → 배송 정보 → 결제 정보 → 하단 취소 안내.

   D6 — 결제 정보는 **3행 + 결제수단 한 줄**이다. 도서산간 줄을 만들지 않는다 —
        응답에 그 값을 분리한 필드가 없고, 묶음별 remote_extra_fee를 더하려면 취소된 묶음을
        제외하는 서버 기준까지 재현해야 한다. 그것이 곧 파생 로직 구현이고 AD-12 위반이다.
   D8 — 성공도 invalid_transition도 **재조회한다.** 단 오류 문장은 재조회가 지우지 않는
        별도 상태(packError)에 담는다 — 재조회가 result를 통째로 갈아끼우기 때문이다.
   D9 — 입금 안내는 8.5 컴포넌트의 detail 변형이며 **deposit_info 객체의 존재로만** 분기한다.
        display_status로 분기하면 부분 취소·관리자 개입이 만든 경계에서 상자가 잘못 뜬다.
   D13 — 폭 전환은 CSS만으로 한다. matchMedia·innerWidth·resize를 쓰지 않는다 —
        조건부 렌더는 폭이 바뀔 때 언마운트되어 열린 확인 줄·진행 중 요청·오류 문장을 날린다.

   🚨 금액은 응답의 item_total·shipping_total·grand_total에서 각각 하나씩 온다 (AD-12).
   🚨 HTTP 코드·code 문자열을 렌더하지 않는다 — 분기는 code, 표시는 message다. */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import DepositBox from "../../deposit-box";
import OrderPack, { type PackHandlers, type PackView } from "./order-pack";
import { EmptyState, ErrorState, type ApiFailure } from "../../buyer-feedback";
import { formatOrderDateTime, formatPhone, formatWon } from "../../format";
import { cancelSubOrder, getOrder, isUuid, type OrderDetailResponse } from "../../orders-api";

const NOT_FOUND = "주문을 찾을 수 없습니다.";
const CANCEL_NOTICE = "배송준비 전까지 판매자 묶음 단위로 취소할 수 있습니다.";
const PAY_METHOD = "무통장입금"; // API가 주지 않는 화면 고정 텍스트 — v1 결제 수단이 하나뿐이라는 사실 표기
const BLANK = "—";

function DetailSkeleton() {
  return (
    <div className="b_detail_skeleton" aria-hidden="true">
      <span className="i_line m_title b_skeleton" />
      <span className="i_line m_short b_skeleton" />
      <span className="i_box b_skeleton" />
      <span className="i_line m_short b_skeleton" />
      <span className="i_box m_low b_skeleton" />
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

function KvRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="b_kv_row b_row">
      <dt className="i_key">{label}</dt>
      {/* 빈 값이어도 행을 지우지 않는다 — 자리를 `—`로 지킨다 (AC 13) */}
      <dd className="i_value">{value || BLANK}</dd>
    </div>
  );
}

export default function OrderDetailView({ orderId }: { orderId: string }) {
  const router = useRouter();
  const valid = isUuid(orderId);

  /* 적재 결과 한 벌. 로딩은 null 여부로 파생한다 — effect 본문에서 동기 setState를 하지 않는다. */
  const [result, setResult] = useState<{ data: OrderDetailResponse | null; error: ApiFailure | null } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // 묶음 단위 상태 — 폭이 바뀌어도 살아남는다(조건부 렌더가 아니라 CSS로만 배치가 바뀌므로)
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  /* 🚨 재조회가 지우지 않는 자리 (D8) — result에 넣으면 재조회가 스스로 문장을 지운다
        (Flutter판 finally-invalidate 부채의 웹 재현). 8.4의 rowError와 같은 형태다. */
  const [packError, setPackError] = useState<{ subOrderId: string; message: string; notFound: boolean } | null>(null);
  const [focusPack, setFocusPack] = useState<{ id: string; target: "confirm" | "cancel" } | null>(null);

  /* 401 → /login?next=%2Forders%2F<id>. 미들웨어 통과는 인증이 아니다 (AD-1, R7). */
  const toLogin = useCallback(() => {
    router.replace(`/login?next=${encodeURIComponent(`/orders/${orderId}`)}`);
  }, [router, orderId]);

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

  /* 조용한 재조회 — skeleton으로 되돌아가지 않고 스크롤이 튀지 않는다 (8.4의 refetch 패턴).
     🚨 packError를 건드리지 않는다 (D8). */
  const refetch = useCallback(async () => {
    const r = await getOrder(orderId);
    if (!r.ok) {
      if (r.error.code === "unauthorized") toLogin();
      return;
    }
    setResult({ data: r.data, error: null });
  }, [orderId, toLogin]);

  const onAsk = useCallback((id: string) => {
    // 한 번에 하나의 묶음만 확인 상태다 — 다른 묶음의 `주문 취소`를 누르면 이전 확인 줄이 닫힌다
    setConfirmId(id);
    setPackError(null);
    setFocusPack({ id, target: "confirm" });
  }, []);

  const onDismiss = useCallback((id: string) => {
    setConfirmId(null);
    setPackError(null);
    setFocusPack({ id, target: "cancel" });
  }, []);

  /* 🚨 되돌릴 수 없는 동작이다 — 재고가 복원되고 취소 기록이 남으며 재취소는 거부된다.
        확인 줄이 유일한 방어선이고, 확인 줄을 건너뛰는 경로를 만들지 않는다 (위험 16). */
  const onConfirm = useCallback(
    (id: string) => {
      if (pendingId !== null) return; // 중복 제출 차단
      setPendingId(id);
      setPackError(null);
      void (async () => {
        const r = await cancelSubOrder(id);
        setPendingId(null);
        if (r.ok) {
          setConfirmId(null);
          setFocusPack(null);
          await refetch(); // 응답에 갱신된 주문이 없다 — 재조회가 필수다
          return;
        }
        if (r.error.code === "unauthorized") {
          toLogin();
          return;
        }
        if (r.error.code === "invalid_transition") {
          /* 화면이 낡았다는 신호다 — 다른 탭에서 관리자가 입금을 확인했거나 판매자가 배송을 시작했다.
             문장을 남긴 채 서버 값으로 상태를 정정한다 (D8). message에 관리자 문의 안내가 이미 있다. */
          setConfirmId(null);
          setFocusPack(null);
          setPackError({ subOrderId: id, message: r.error.message, notFound: false });
          await refetch();
          return;
        }
        if (r.error.code === "not_found") {
          setConfirmId(null);
          setPackError({ subOrderId: id, message: NOT_FOUND, notFound: true });
          return;
        }
        // 네트워크·그 밖 — 서버 상태를 바꾸지 못했으므로 재조회하지 않는다. 확인 줄은 열린 채로 둔다.
        setPackError({ subOrderId: id, message: r.error.message, notFound: false });
      })();
    },
    [pendingId, refetch, toLogin],
  );

  /* 마운트 즉시 포커스를 가져가는 안정된 ref 콜백.
     identity가 고정이라 리렌더마다 다시 불리지 않는다 — 포커스를 훔치는 루프가 생기지 않는다. */
  const focusRef = useCallback((el: HTMLButtonElement | null) => {
    el?.focus();
  }, []);

  /* id가 UUID 형식이 아니거나 남의 주문이면 빈 화면이 아니라 안내를 낸다 (AC 16).
     🚨 `id === "complete"` 같은 문자열을 걸러내지 않는다 — 정적 세그먼트가 동적을 이기는 것은
        라우터가 이미 판정했다 (8.1 위험 9 · 8.5 D4). */
  if (!valid) {
    return (
      <div className="i_feedback">
        <EmptyState message={NOT_FOUND} action={<OrdersLink />} />
      </div>
    );
  }

  // 최초 로딩은 블록 골격이다 — 화면 중앙 스피너를 쓰지 않는다 (UX-DR9)
  if (result === null) return <DetailSkeleton />;

  if (result.error || !result.data) {
    const notFound = result.error?.code === "not_found";
    return (
      <div className="i_feedback">
        {notFound ? (
          <EmptyState message={NOT_FOUND} action={<OrdersLink />} />
        ) : (
          <ErrorState message={result.error?.message ?? ""} onRetry={() => setReloadKey((n) => n + 1)} />
        )}
      </div>
    );
  }

  const order = result.data;
  const deposit = order.deposit_info;
  const address = [`(${order.postal_code})`, order.address1, order.address2].filter(Boolean).join(" ");

  const view: PackView = { pendingId, confirmId, packError, focusPack };
  const handlers: PackHandlers = { onAsk, onDismiss, onConfirm, focusRef, notFoundAction: <OrdersLink /> };

  return (
    <>
      <div className="i_head">
        {/* 🚨 order_no를 그대로 쓴다 — 목업의 `20260721-0037`은 존재하지 않는 형식이다 (위험 7) */}
        <p className="i_no">{order.order_no}</p>
        <p className="i_when">{formatOrderDateTime(order.created_at)}</p>
      </div>

      {/* 🚨 deposit_info 객체의 존재로만 분기한다 (AD-12, 5.1의 확정 규약).
          입금대기가 아닌 주문의 상세에서는 상자가 사라진다. 위치는 주문번호 바로 아래 최상단이다 —
          다시 들어온 사람이 "얼마를 어디로 넣어야 하는가"를 스크롤 없이 봐야 한다 (UX-DR14). */}
      {deposit ? (
        <div className="i_deposit">
          <DepositBox
            variant="detail"
            amount={deposit.grand_total}
            account={deposit.deposit_account}
            dueAt={deposit.deposit_due_at}
            expired={deposit.expired}
          />
        </div>
      ) : null}

      <section className="i_sec m_items" aria-labelledby="od_h_items">
        <h2 className="b_section_label i_sec_h" id="od_h_items">
          주문 상품 · 판매자별 {order.sub_orders.length}건
        </h2>
        {order.sub_orders.map((sub) => (
          <OrderPack key={sub.sub_order_id} sub={sub} view={view} h={handlers} />
        ))}
      </section>

      <section className="i_sec m_ship" aria-labelledby="od_h_ship">
        <h2 className="b_section_label i_sec_h" id="od_h_ship">
          배송 정보
        </h2>
        {/* 값은 전부 주문 시점 스냅샷이다 (AD-7) — 지금의 배송지가 아니다 */}
        <dl className="i_kv">
          <KvRow label="수령인" value={order.recipient_name} />
          <KvRow label="연락처" value={formatPhone(order.recipient_phone)} />
          <KvRow label="주소" value={address} />
          <KvRow label="요청사항" value={order.order_note} />
        </dl>
      </section>

      <section className="i_sec m_pay" aria-labelledby="od_h_pay">
        <h2 className="b_section_label i_sec_h" id="od_h_pay">
          결제 정보
        </h2>
        {/* 🚨 3행이다. 도서산간 줄을 만들지 않는다 (D6) — 응답에 분리 필드가 없다.
            <AmountSummary>를 쓰지 않고 .b_amount_summary CSS만 재사용한다:
            "행을 빼는 prop"이 생기면 주문서에서도 실수로 켜질 수 있다. */}
        <div className="b_amount_summary">
          <div className="i_row">
            <span className="i_label b_control">상품 금액</span>
            <span className="i_value b_control">{formatWon(order.item_total)}</span>
          </div>
          <div className="i_row">
            <span className="i_label b_control">배송비</span>
            <span className="i_value b_control">{formatWon(order.shipping_total)}</span>
          </div>
          <div className="i_total">
            <span className="i_total_label">합계</span>
            {/* 20px 액센트 — 입금 안내 상자의 금액보다 커지면 "이 화면에서 가장 중요한 것은
                입금 금액"이라는 UX-DR14의 판단이 뒤집힌다 (D6). */}
            <span className="i_total_value b_price_hero">{formatWon(order.grand_total)}</span>
          </div>
        </div>
        <div className="i_pay_way b_row">
          <span className="i_key">결제수단</span>
          <span className="i_value">{PAY_METHOD}</span>
        </div>
      </section>

      {/* 항상 있다 — 버튼이 있는 묶음과 없는 묶음이 왜 나란한지 설명한다 (UX-DR15) */}
      <div className="i_tail">
        <p className="b_notice">{CANCEL_NOTICE}</p>
      </div>
    </>
  );
}
