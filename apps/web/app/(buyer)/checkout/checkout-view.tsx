"use client";

/* 주문서 본체 (8.5).

   D5 — 두 단계로 그린다. ① 진입 즉시 GET /carts의 **구매 가능 항목만**으로 묶음과 상품 금액을,
        ② 우편번호가 정해지면 POST /orders/preview 결과로 **통째로 교체**한다.
        두 소스를 섞어 계산하지 않는다. 금액의 진실은 언제나 ②다.
        ①이 필요한 진짜 이유는 사진이다 — preview 응답에 image_url이 없다 (위험 3).
   D2 — 미리보기 재조회는 **이벤트 핸들러에서만** 시작한다(검색 완료 / 5자리 직접 입력 완성 /
        `다시 시도` / price_changed 자동 재조회). useEffect가 postalCode를 감시하지 않는다 —
        react-hooks/set-state-in-effect가 이 저장소에서 lint error이고(8.3의 학습),
        이 화면은 재조회가 가장 잦다.
        요청마다 순번을 매기고 도착 시점의 순번이 최신이 아니면 **결과를 버린다** —
        제주 우편번호 옆에 서울 배송비가 남으면 그 화면의 `주문하기`가 409로 튕긴다.
   D6 — 주문 대상은 preview가 준 cart_item_id **전부**다. 고르는 수단을 만들지 않는다
        (preview에 항목 선택 파라미터가 없어 부분 주문은 미리 볼 수 없다).
   D7 — 재검증 실패는 **머무르며 알린다.** 자동 이동·자동 재제출을 하지 않는다.
   D12 — 폭 전환은 CSS만으로. matchMedia·innerWidth·resize 사용 0건. */

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import AddressForm, {
  OrderNoteField,
  SERVER_FIELD_MAP,
  digitsOnly,
  isAddressComplete,
  validateField,
  type AddressField,
  type AddressValues,
  type FieldErrorMap,
} from "./address-form";
import AmountSummary from "../amount-summary";
import PostcodeOverlay, { type PostcodeResult } from "./postcode-overlay";
import SellerPack from "../seller-pack";
import { BrokerNotice } from "../seller-info";
import { EmptyState, ErrorState, type ApiFailure } from "../buyer-feedback";
import { mapFieldErrors } from "../auth-errors";
import { getCart, type CartItem, type CartResponse } from "../cart-api";
import { useCartCount } from "../cart-count";
import { formatWon } from "../format";
import {
  createOrder,
  postPreview,
  type OrderPreviewResponse,
  type OutOfStockItem,
} from "../orders-api";

/* ── 문구 — 리터럴을 화면 코드에 흩뿌리지 않는다 (AD-13의 정신).
      스파인 Voice·Tone 표에 없는 것은 `[ASSUMPTION]`이며 Slur 확인 항목이다. */
const SUMMARY_TOTAL_LABEL = "결제 예정 금액"; // 여기서만 참이다 — 배송비가 확정됐다 (D9)
const SUMMARY_PENDING_TEXT = "배송지 입력 후 계산"; // [ASSUMPTION]
const NOTE_GENERAL = "배송지가 제주·도서산간이면 이 자리에 추가 배송비가 더해집니다."; // [ASSUMPTION]
const NOTE_JEJU = "제주 지역 추가 배송비가 포함되었습니다."; // [ASSUMPTION]
const NOTE_ISLAND = "도서산간 추가 배송비가 포함되었습니다."; // [ASSUMPTION]
const PAY_METHOD = "무통장입금";
/* 🚨 `3일`은 settings.unpaid_cancel_days이며 구매자 API로 내려오지 않는다(관리자 전용) —
   운영자가 그 값을 바꾸면 이 문장을 손으로 고쳐야 한다. 실제 기한은 주문완료의
   deposit_due_at(서버 값)이 말한다. 부채로 등재한다 (위험 7). */
const PAY_NOTE = "입금 확인 후 배송이 시작됩니다. 주문 후 3일 안에 입금하지 않으면 자동 취소됩니다.";
const EMPTY_MESSAGE = "주문할 수 있는 상품이 없습니다.";
const FREE_SHIPPING = "무료배송";

/* ── 표시용 모델 — 두 단계가 같은 모양으로 수렴한다 ── */
type RowView = {
  key: string;
  name: string;
  optionText: string;
  quantity: number;
  /** 판매 종료 등으로 단가를 모르면 null (①단계에서만 가능) */
  lineTotal: number | null;
  imageUrl: string | null;
};

type PackView = {
  key: string;
  brand: string;
  /** ①단계에서는 배송비를 모른다 — null이면 헤더 우측을 그리지 않는다 (D5·8.4 D2) */
  shippingTotal: number | null;
  rows: RowView[];
};

/** ① 장바구니 → 묶음. 키는 brand_name이다 — 응답에 seller_id가 없다 (8.4 D1).
 *  Map은 삽입 순서를 지키므로 묶음 순서 = 응답 순서 = 주문 스냅샷 순서다. */
function packsFromCart(items: CartItem[]): PackView[] {
  const packs = new Map<string, PackView>();
  for (const item of items) {
    let pack = packs.get(item.brand_name);
    if (!pack) {
      pack = { key: item.brand_name, brand: item.brand_name, shippingTotal: null, rows: [] };
      packs.set(item.brand_name, pack);
    }
    pack.rows.push({
      key: item.id,
      name: item.product_name,
      optionText: item.option_text,
      quantity: item.quantity,
      // 응답에 line_total이 없다 — ①단계에서만 하는 산술이며 합계에는 쓰지 않는다 (8.4 D12)
      lineTotal: item.final_price === null ? null : item.final_price * item.quantity,
      imageUrl: item.image_url,
    });
  }
  return [...packs.values()];
}

/** ② 미리보기 → 묶음. 사진만 ①에서 빌려 온다 (위험 3). */
function packsFromQuote(quote: OrderPreviewResponse, images: Map<string, string | null>): PackView[] {
  return quote.seller_groups.map((g) => ({
    key: g.seller_id,
    brand: g.brand_name,
    shippingTotal: g.shipping_total,
    rows: g.items.map((i) => ({
      key: i.cart_item_id,
      name: i.product_name,
      optionText: i.option_text,
      quantity: i.quantity,
      lineTotal: i.line_total, // 서버가 준다 — 클라이언트가 곱하지 않는다
      imageUrl: images.get(i.cart_item_id) ?? null,
    })),
  }));
}

function remoteNote(kind: string | null): string {
  if (kind === "jeju") return NOTE_JEJU;
  if (kind === "island") return NOTE_ISLAND;
  return NOTE_GENERAL;
}

function dropError(errors: FieldErrorMap, ...fields: AddressField[]): FieldErrorMap {
  const next = { ...errors };
  let changed = false;
  for (const f of fields) {
    if (next[f] !== undefined) {
      delete next[f];
      changed = true;
    }
  }
  return changed ? next : errors;
}

type QuoteState = {
  /** 재조회 중 — 이전 금액을 지우지 않고 요약 구획에만 진행 표시를 둔다 */
  pending: boolean;
  data: OrderPreviewResponse | null;
  /** data가 계산된 우편번호. 입력 값과 다르면 화면 금액이 그 주소의 것이 아니다 */
  postal: string | null;
  error: ApiFailure | null;
};

/** 주문 실패 블록 — 자동으로 이동하지 않는다. 이동 수단만 놓는다 (D7). */
type SubmitFail = {
  message: string;
  items?: OutOfStockItem[];
  action: "cart" | "orders" | null;
};

const EMPTY_VALUES: AddressValues = {
  recipientName: "",
  recipientPhone: "",
  postalCode: "",
  address1: "",
  address2: "",
  orderNote: "",
};

function PackSkeleton() {
  return (
    <div className="b_checkout_skeleton" aria-hidden="true">
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

export default function CheckoutView() {
  const router = useRouter();
  const { setCount } = useCartCount();

  /* 적재 결과 한 벌. 로딩 상태를 따로 두지 않고 null 여부로 파생한다 —
     effect 안에서 동기 setState를 하지 않기 위한 형태다 (D2). */
  const [cart, setCart] = useState<{ data: CartResponse | null; error: ApiFailure | null } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [quote, setQuote] = useState<QuoteState>({ pending: false, data: null, postal: null, error: null });
  const [values, setValues] = useState<AddressValues>(EMPTY_VALUES);
  const [errors, setErrors] = useState<FieldErrorMap>({});
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitFail, setSubmitFail] = useState<SubmitFail | null>(null);
  /* empty_cart — 진입 시점이든 주문 시점이든 살 것이 없다는 같은 사실이다 */
  const [blocked, setBlocked] = useState(false);

  const seqRef = useRef(0);
  const submittingRef = useRef(false);
  const searchButtonRef = useRef<HTMLButtonElement | null>(null);
  const address2Ref = useRef<HTMLInputElement | null>(null);

  /* 401 → /login?next=%2Fcheckout. 미들웨어 통과는 인증이 아니다 —
     slur_role(14일)이 slur_access(30분)보다 오래 살아 있다 (R7, AD-1). */
  const toLogin = useCallback(() => router.replace("/login?next=%2Fcheckout"), [router]);

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
      setCart(r.ok ? { data: r.data, error: null } : { data: null, error: r.error });
    })();
    return () => {
      alive = false;
    };
  }, [reloadKey, toLogin, setCount]);

  /* ── 미리보기 재조회 (D2) ───────────────────
     🚨 이 함수를 effect에서 부르지 않는다. 호출 지점은 이벤트 핸들러뿐이다. */
  const refreshPreview = useCallback(
    async (postal: string) => {
      const my = ++seqRef.current;
      setQuote((q) => ({ ...q, pending: true, error: null }));

      const r = await postPreview(postal);
      if (my !== seqRef.current) return; // 늦게 도착했다 — 결과를 버린다

      if (r.ok) {
        setQuote({ pending: false, data: r.data, postal, error: null });
        return;
      }
      if (r.error.code === "unauthorized") {
        toLogin();
        return;
      }
      if (r.error.code === "empty_cart") {
        setBlocked(true);
        setQuote({ pending: false, data: null, postal: null, error: null });
        return;
      }
      if (r.error.code === "validation_error") {
        // 우편번호 형식은 이 화면의 유일한 preview 입력이다 — 그 필드에만 붙인다
        const message = r.error.message;
        setQuote((q) => ({ ...q, pending: false }));
        setErrors((e) => ({ ...e, postalCode: message }));
        return;
      }
      setQuote((q) => ({ ...q, pending: false, error: r.error }));
    },
    [toLogin],
  );

  /* ── 폼 ────────────────────────────────── */
  const onFieldChange = useCallback(
    (field: AddressField, value: string) => {
      setValues((v) => ({ ...v, [field]: value }));
      setErrors((e) => dropError(e, field));
      // 🚨 재조회의 시작점 ② — 직접 입력으로 5자리가 완성된 순간. effect가 아니라 여기다.
      if (field === "postalCode") {
        const d = digitsOnly(value);
        if (d.length === 5) void refreshPreview(d);
      }
    },
    [refreshPreview],
  );

  const onFieldBlur = (field: AddressField) => {
    const message = validateField(field, values[field]);
    setErrors((e) => (message === null ? dropError(e, field) : { ...e, [field]: message }));
  };

  const openPostcode = useCallback(() => setOverlayOpen(true), []);

  const closeOverlay = useCallback(() => {
    setOverlayOpen(false);
    // 오버레이를 닫으면 원래 버튼으로 포커스가 돌아온다 (AC 4)
    searchButtonRef.current?.focus();
  }, []);

  /* 🚨 재조회의 시작점 ① — 검색 완료. */
  const onPostcodeSelect = useCallback(
    (r: PostcodeResult) => {
      setValues((v) => ({ ...v, postalCode: r.postalCode, address1: r.address1 }));
      setErrors((e) => dropError(e, "postalCode", "address1"));
      setOverlayOpen(false);
      void refreshPreview(r.postalCode);
      // 상세주소는 직접 입력이다 — 검색이 끝난 사람이 다음에 할 일로 포커스를 옮긴다
      address2Ref.current?.focus();
    },
    [refreshPreview],
  );

  /* ── 파생 ──────────────────────────────── */
  const loading = cart === null;
  const cartData = cart?.data ?? null;
  const cartError = cart?.error ?? null;

  // 구매 불가 항목은 주문서에 나타나지 않는다 — 서버가 이미 판정했다 (FR-35, AD-10)
  const purchasable = cartData?.items.filter((i) => i.purchasable) ?? [];
  const postalDigits = digitsOnly(values.postalCode);

  /* 두 판정을 분리한다.
     · shown  — **보여줄** 금액. 재조회 중에는 이전 결과를 그대로 둔다 (AC 5: 이전 금액을 지우지 않는다).
     · ready  — **보낼 수 있는** 금액. 도착한 결과가 지금 입력된 우편번호의 것이어야 한다.
     하나로 합치면 둘 중 하나를 어긴다: 합쳐서 엄격하게 두면 재조회 중 화면이 미확정으로 되돌아가고,
     느슨하게 두면 서울 금액으로 제주 주소를 청약해 409 price_changed가 난다 (D2). */
  const quoteFits = quote.data !== null && quote.postal === postalDigits && postalDigits.length === 5;
  const shown = quote.data !== null && (quote.pending || quoteFits) ? quote.data : null;
  const quoteReady = quoteFits && !quote.pending;

  const images = new Map<string, string | null>(purchasable.map((i) => [i.id, i.image_url]));
  const packs = shown ? packsFromQuote(shown, images) : packsFromCart(purchasable);

  const grandTotal = shown ? shown.grand_total : null;
  const canSubmit = quoteReady && !submitting && isAddressComplete(values) && !blocked;

  /* ── 주문 생성 (D6·D7) ─────────────────── */
  const onSubmit = useCallback(() => {
    if (submittingRef.current) return;
    const data = quote.data;
    if (data === null) return;

    submittingRef.current = true;
    setSubmitting(true);
    setSubmitFail(null);

    void (async () => {
      const r = await createOrder({
        // preview가 준 id **전부**. 화면이 고르는 수단을 만들지 않는다 (D6)
        cart_item_ids: data.seller_groups.flatMap((g) => g.items.map((i) => i.cart_item_id)),
        // 화면이 보여준 그 숫자. 클라이언트가 다시 더해 만든 값을 보내면 보증이 무의미해진다 (AD-12)
        expected_grand_total: data.grand_total,
        postal_code: digitsOnly(values.postalCode),
        recipient_name: values.recipientName.trim(),
        // 🚨 전송 직전 숫자만 남긴다 — 서버 계약이 ^\d{9,11}$이다 (위험 4)
        recipient_phone: digitsOnly(values.recipientPhone),
        address1: values.address1.trim(),
        address2: values.address2.trim(),
        order_note: values.orderNote.trim(),
      });
      submittingRef.current = false;
      setSubmitting(false);

      if (r.ok) {
        // 서버가 같은 트랜잭션에서 장바구니를 비웠다 — 배지를 맞춘다
        setCount(0);
        // 🚨 push가 아니라 replace다. 뒤로가기로 /checkout에 돌아오면 empty_cart다 (D3)
        router.replace(`/orders/complete?order=${encodeURIComponent(r.data.order_id)}`);
        return;
      }

      const err = r.error;
      switch (err.code) {
        case "unauthorized":
          toLogin();
          return;
        case "empty_cart":
          setBlocked(true);
          return;
        case "out_of_stock":
          // 무엇이 문제인지 항목별로 나열한다. 자동으로 /cart로 튕기면 사용자가 읽을 시간이 없다
          setSubmitFail({ message: err.message, items: err.outOfStock, action: "cart" });
          return;
        case "not_found":
          setSubmitFail({ message: err.message, action: "cart" });
          return;
        case "duplicate_request":
          // 실패가 아니라 **이미 만들어졌다**는 뜻이다. order_id를 모르므로 목록으로 안내한다
          setSubmitFail({ message: err.message, action: "orders" });
          return;
        case "price_changed":
          // 새 금액으로 갱신하되 **자동 재제출하지 않는다** — 돈이 걸린 오해가 된다
          setSubmitFail({ message: err.message, action: null });
          void refreshPreview(digitsOnly(values.postalCode));
          return;
        case "validation_error": {
          const { fields, rest } = mapFieldErrors(err.details, Object.keys(SERVER_FIELD_MAP));
          const mapped: FieldErrorMap = {};
          for (const [serverField, reason] of Object.entries(fields)) {
            const field = SERVER_FIELD_MAP[serverField];
            if (field) mapped[field] = reason;
          }
          setErrors((e) => ({ ...e, ...mapped }));
          // 필드로 옮기지 못한 항목은 조용히 삼키지 않는다
          if (Object.keys(mapped).length === 0 || rest.length > 0) {
            setSubmitFail({ message: err.message, action: null });
          }
          return;
        }
        default:
          setSubmitFail({ message: err.message, action: null });
      }
    })();
  }, [quote.data, values, router, setCount, toLogin, refreshPreview]);

  /* ── 화면 ──────────────────────────────── */
  if (loading) {
    // 최초 로딩은 묶음 골격이다 — 화면 중앙 스피너를 쓰지 않는다 (UX-DR9)
    return (
      <div className="b_checkout_wait">
        <PackSkeleton />
        <PackSkeleton />
      </div>
    );
  }

  if (cartError || !cartData) {
    return (
      <div className="b_checkout_wait b_container">
        <ErrorState message={cartError?.message ?? ""} onRetry={() => setReloadKey((n) => n + 1)} />
      </div>
    );
  }

  // 구매 가능 항목 0건 — 주문 상품·금액·CTA를 그리지 않는다 (AC 16)
  if (blocked || purchasable.length === 0) {
    return (
      <div className="b_checkout_wait b_container">
        <EmptyState
          message={EMPTY_MESSAGE}
          action={
            <Link href="/cart" className="b_btn m_ghost b_control">
              장바구니로 이동
            </Link>
          }
        />
      </div>
    );
  }

  /* CTA는 두 자리에 렌더하고 CSS display로 전환한다 (8.3 D9·8.4 D10과 같은 패턴).
     상태는 여기 한 곳이 갖고 두 사본에 같은 값을 넘긴다.
     🚨 금액은 b_price_total을 쓰지 않는다 — 21px 액센트 합계는 화면당 한 번이다 (UX-DR13). */
  const orderButton = (
    <button type="button" className="b_btn m_solid m_full b_button_text i_cta" disabled={!canSubmit} onClick={onSubmit}>
      {grandTotal === null ? (
        "주문하기"
      ) : (
        <>
          <span className="i_amt">{formatWon(grandTotal)}</span>
          <span className="i_dot" aria-hidden="true">
            ·
          </span>
          주문하기
        </>
      )}
    </button>
  );

  const failBlock = submitFail ? (
    <div className="b_checkout_fail" role="status">
      <p className="i_msg">{submitFail.message}</p>
      {submitFail.items && submitFail.items.length > 0 ? (
        <ul className="i_list">
          {submitFail.items.map((it, idx) => (
            <li className="b_meta i_item" key={`${it.product_name}-${idx}`}>
              <span className="i_name">{it.product_name}</span>
              {it.option_text ? <span className="i_option"> · {it.option_text}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {submitFail.action === "cart" ? (
        <Link href="/cart" className="b_btn m_ghost b_control i_act">
          장바구니로 이동
        </Link>
      ) : null}
      {submitFail.action === "orders" ? (
        <Link href="/orders" className="b_btn m_ghost b_control i_act">
          주문내역 보기
        </Link>
      ) : null}
    </div>
  ) : null;

  return (
    <>
      <div className="b_checkout">
        {/* ── 배송지 ── */}
        <section className="i_sec i_ship_sec" aria-labelledby="co_h_ship">
          <h2 className="b_section_label i_sec_h" id="co_h_ship">
            배송지
          </h2>
          <AddressForm
            values={values}
            errors={errors}
            onChange={onFieldChange}
            onBlur={onFieldBlur}
            onOpenPostcode={openPostcode}
            searchButtonRef={searchButtonRef}
            address2Ref={address2Ref}
            disabled={submitting}
          />
        </section>

        {/* ── 배송 요청사항 ── */}
        <section className="i_sec i_note_sec" aria-labelledby="co_h_note">
          <h2 className="b_section_label i_sec_h" id="co_h_note">
            배송 요청사항
          </h2>
          <OrderNoteField
            value={values.orderNote}
            error={errors.orderNote}
            onChange={(v) => onFieldChange("orderNote", v)}
            onBlur={() => onFieldBlur("orderNote")}
            disabled={submitting}
          />
        </section>

        {/* ── 주문 상품 (읽기 전용) ── */}
        <section className="i_sec i_items_sec" aria-labelledby="co_h_items">
          <h2 className="b_section_label i_sec_h" id="co_h_items">
            주문 상품 · 판매자 {packs.length}곳
          </h2>
          <div className="i_packs">
            {packs.map((pack) => (
              <SellerPack
                key={pack.key}
                brand={pack.brand}
                headEnd={
                  pack.shippingTotal === null ? undefined : pack.shippingTotal === 0 ? (
                    <span className="b_meta i_ship m_free">{FREE_SHIPPING}</span>
                  ) : (
                    <span className="b_meta i_ship">
                      배송비 <b>{formatWon(pack.shippingTotal)}</b>
                    </span>
                  )
                }
              >
                {pack.rows.map((row) => (
                  /* 🚨 체크박스·수량 스테퍼·`삭제`를 두지 않는다 — 주문서 묶음은 읽기 전용이다 */
                  <div className="i_item b_order_item" key={row.key}>
                    <span className="i_thumb">
                      {row.imageUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img className="i_img" src={row.imageUrl} alt={row.name} loading="lazy" decoding="async" />
                      ) : null}
                    </span>
                    <div className="i_info">
                      <p className="b_product_name_row i_name">{row.name}</p>
                      <p className="b_meta i_option">
                        {row.optionText ? `${row.optionText} · ${row.quantity}개` : `${row.quantity}개`}
                      </p>
                      <p className="b_price_item i_price">{row.lineTotal === null ? "—" : formatWon(row.lineTotal)}</p>
                    </div>
                  </div>
                ))}
              </SellerPack>
            ))}
          </div>
        </section>

        {/* ── 결제 금액 (≥768 우측 sticky 칼럼) ── */}
        <section className="i_sec i_amount_sec" aria-labelledby="co_h_amount" aria-busy={quote.pending}>
          <h2 className="b_section_label i_sec_h" id="co_h_amount">
            결제 금액
          </h2>
          {/* 🚨 행 순서 고정 · 도서산간은 0원이어도 줄을 지우지 않는다. 값은 응답에서 각각 하나씩 온다 */}
          <AmountSummary
            data={{
              itemsTotal: shown ? shown.item_total : cartData.purchasable_total,
              shippingFee: shown ? shown.shipping_total : null,
              remoteAreaFee: shown ? shown.remote_extra_total : null,
              total: grandTotal,
            }}
            totalLabel={SUMMARY_TOTAL_LABEL}
            pendingText={SUMMARY_PENDING_TEXT}
          />
          <p className="b_meta i_sum_note">{remoteNote(shown ? shown.remote_area_kind : null)}</p>
          {/* 재조회 중에도 이전 금액을 지우지 않는다 — 이 자리에만 진행 표시를 둔다 */}
          {quote.pending ? (
            <p className="b_meta i_sum_note m_busy" role="status">
              배송비를 다시 계산하고 있습니다.
            </p>
          ) : null}
          {quote.error ? (
            <ErrorState message={quote.error.message} onRetry={() => void refreshPreview(postalDigits)} />
          ) : null}
          {failBlock}
          <div className="i_cta_side">{orderButton}</div>
        </section>

        {/* ── 결제 수단 ── */}
        <section className="i_sec i_pay_sec" aria-labelledby="co_h_pay">
          <h2 className="b_section_label i_sec_h" id="co_h_pay">
            결제 수단
          </h2>
          {/* 🚨 API로 전송하지 않는다 — OrderCreateRequest에 결제 수단 필드가 없다.
              화면에만 존재하는 사실 표기이므로 상태도 두지 않는다 (defaultChecked). */}
          <div className="b_pay b_row">
            <input
              type="radio"
              className="b_radio"
              id="co_pay_bank"
              name="co_pay"
              value="bank_transfer"
              defaultChecked
            />
            <label className="i_name" htmlFor="co_pay_bank">
              {PAY_METHOD}
            </label>
          </div>
          <p className="b_pay_note">{PAY_NOTE}</p>
        </section>

        {/* ── 중개자 고지 ──
            🚨 청약 버튼 바로 위, 같은 스크롤 흐름 안이다. ≥768 2단에서도 우측 sticky 칼럼이 아니라
               2단 아래 전체 폭에 놓인다 — 디자인 취향이 아니라 규제 요건이다 (FR-32, UX-DR10).
            🚨 문구는 app/config/company.ts의 BROKER_NOTICE가 정본이다. 여기에 복사하지 않는다. */}
        <div className="i_legal">
          <BrokerNotice className="i_broker" />
        </div>
      </div>

      {/* 하단 고정 CTA 바 (<768) — DOM 순서상 콘텐츠 뒤에 둔다 (UX-DR6).
          주문서에는 탭바가 없다 — m_stack을 쓰지 않는다 (UX-DR3). */}
      <div className="b_cta_bar">{orderButton}</div>

      {overlayOpen ? <PostcodeOverlay onSelect={onPostcodeSelect} onClose={closeOverlay} /> : null}
    </>
  );
}
