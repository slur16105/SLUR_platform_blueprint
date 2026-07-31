"use client";

/* 주문서 본체 — **새 테마 판**.

   🚨 이 파일은 checkout-view.tsx의 **로직을 그대로 옮긴 것**이고 바뀐 것은 마크업뿐이다.
      돈이 걸린 화면이라 아래 규약을 한 줄도 바꾸지 않았다:
   · D5 — 두 단계. ① 진입 즉시 GET /carts의 **구매 가능 항목만**으로 묶음·상품금액을,
          ② 우편번호가 정해지면 POST /orders/preview 결과로 **통째 교체**. 두 소스를 섞어 계산하지 않는다.
          ①이 필요한 진짜 이유는 사진이다 — preview 응답에 image_url이 없다.
   · D2 — 미리보기 재조회는 **이벤트 핸들러에서만** 시작한다(검색 완료 / 5자리 완성 / 다시 시도 /
          price_changed). 요청마다 순번을 매겨 늦게 온 결과는 버린다 —
          제주 우편번호 옆에 서울 배송비가 남으면 `주문하기`가 409로 튕긴다.
   · D6 — 주문 대상은 preview가 준 cart_item_id **전부**. 고르는 수단을 만들지 않는다.
   · D7 — 재검증 실패는 **머무르며 알린다.** 자동 이동·자동 재제출 없음.
   · FR-32 — 중개자 고지는 `주문하기`보다 **위**다(≥768 우측 칼럼 / <768 고정 CTA 바 바로 위).
   🚨 금액은 서버 응답 값만 쓴다. 클라이언트가 더해 만든 값을 보내지 않는다 (AD-12). */

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import AddressFormThemed, { OrderNoteFieldThemed } from "./address-form-themed";
import PostcodeOverlay, { type PostcodeResult } from "./postcode-overlay";
import SavedAddresses, { toValues, type SavedAddress } from "./saved-addresses";
import {
  SERVER_FIELD_MAP,
  digitsOnly,
  isAddressComplete,
  validateField,
  type AddressField,
  type AddressValues,
  type FieldErrorMap,
} from "./address-form";
import { BROKER_NOTICE } from "@/app/config/company";
import { type ApiFailure } from "../buyer-feedback";
import { mapFieldErrors } from "../auth-errors";
import { getCart, type CartItem, type CartResponse } from "../cart-api";
import { useCartCount } from "../cart-count";
import { formatWon } from "../format";
import { createOrder, postPreview, type OrderPreviewResponse, type OutOfStockItem } from "../orders-api";

/* ── 문구 — 리터럴을 화면 코드에 흩뿌리지 않는다 ── */
const SUMMARY_TOTAL_LABEL = "결제 예정 금액"; // 여기서만 참이다 — 배송비가 확정됐다
const SUMMARY_PENDING_TEXT = "배송지 입력 후 계산";
const NOTE_GENERAL = "배송지가 제주·도서산간이면 이 자리에 추가 배송비가 더해집니다.";
const NOTE_JEJU = "제주 지역 추가 배송비가 포함되었습니다.";
const NOTE_ISLAND = "도서산간 추가 배송비가 포함되었습니다.";
const PAY_METHOD = "무통장입금";
/* 🚨 `3일`은 settings.unpaid_cancel_days이며 구매자 API로 내려오지 않는다(관리자 전용) —
   운영자가 그 값을 바꾸면 이 문장을 손으로 고쳐야 한다. 실제 기한은 주문완료의 deposit_due_at이 말한다. */
const PAY_NOTE = "입금 확인 후 배송이 시작됩니다. 주문 후 3일 안에 입금하지 않으면 자동 취소됩니다.";
const EMPTY_MESSAGE = "주문할 수 있는 상품이 없습니다.";
const FREE_SHIPPING = "무료배송";

type RowView = {
  key: string;
  name: string;
  optionText: string;
  quantity: number;
  lineTotal: number | null;
  imageUrl: string | null;
};
type PackView = { key: string; brand: string; shippingTotal: number | null; rows: RowView[] };

/** ① 장바구니 → 묶음. 키는 brand_name이다(응답에 seller_id가 없다). Map은 삽입 순서를 지킨다. */
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
      // ①단계에서만 하는 산술이며 합계에는 쓰지 않는다
      lineTotal: item.final_price === null ? null : item.final_price * item.quantity,
      imageUrl: item.image_url,
    });
  }
  return [...packs.values()];
}

/** ② 미리보기 → 묶음. 사진만 ①에서 빌려 온다. */
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
  pending: boolean;
  data: OrderPreviewResponse | null;
  postal: string | null;
  error: ApiFailure | null;
};
type SubmitFail = { message: string; items?: OutOfStockItem[]; action: "cart" | "orders" | null };

const EMPTY_VALUES: AddressValues = {
  recipientName: "",
  recipientPhone: "",
  postalCode: "",
  address1: "",
  address2: "",
  orderNote: "",
};

export default function CheckoutScreen() {
  const router = useRouter();
  const { setCount } = useCartCount();

  const [cart, setCart] = useState<{ data: CartResponse | null; error: ApiFailure | null } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [quote, setQuote] = useState<QuoteState>({ pending: false, data: null, postal: null, error: null });
  const [values, setValues] = useState<AddressValues>(EMPTY_VALUES);
  const [errors, setErrors] = useState<FieldErrorMap>({});
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitFail, setSubmitFail] = useState<SubmitFail | null>(null);
  const [blocked, setBlocked] = useState(false);

  const seqRef = useRef(0);
  const submittingRef = useRef(false);
  const searchButtonRef = useRef<HTMLButtonElement | null>(null);
  const address2Ref = useRef<HTMLInputElement | null>(null);

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

  /* 🚨 이 함수를 effect에서 부르지 않는다. 호출 지점은 이벤트 핸들러뿐이다 (D2). */
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
        const message = r.error.message;
        setQuote((q) => ({ ...q, pending: false }));
        setErrors((e) => ({ ...e, postalCode: message }));
        return;
      }
      setQuote((q) => ({ ...q, pending: false, error: r.error }));
    },
    [toLogin],
  );

  const onFieldChange = useCallback(
    (field: AddressField, value: string) => {
      setValues((v) => ({ ...v, [field]: value }));
      setErrors((e) => dropError(e, field));
      // 🚨 재조회의 시작점 ② — 직접 입력으로 5자리가 완성된 순간
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
    searchButtonRef.current?.focus(); // 닫으면 원래 버튼으로 포커스가 돌아온다
  }, []);

  /* 🚨 재조회의 시작점 ① — 검색 완료 */
  const onPostcodeSelect = useCallback(
    (r: PostcodeResult) => {
      setValues((v) => ({ ...v, postalCode: r.postalCode, address1: r.address1 }));
      setErrors((e) => dropError(e, "postalCode", "address1"));
      setOverlayOpen(false);
      void refreshPreview(r.postalCode);
      address2Ref.current?.focus(); // 다음에 할 일(상세주소)로 포커스를 옮긴다
    },
    [refreshPreview],
  );

  const loading = cart === null;
  const cartData = cart?.data ?? null;
  const cartError = cart?.error ?? null;

  // 구매 불가 항목은 주문서에 나타나지 않는다 — 서버가 이미 판정했다 (FR-35, AD-10)
  const purchasable = cartData?.items.filter((i) => i.purchasable) ?? [];
  const postalDigits = digitsOnly(values.postalCode);

  /* 두 판정을 분리한다. shown = 보여줄 금액(재조회 중엔 이전 결과 유지),
     quoteReady = 보낼 수 있는 금액(지금 입력된 우편번호의 것이어야 한다). */
  const quoteFits = quote.data !== null && quote.postal === postalDigits && postalDigits.length === 5;
  const shown = quote.data !== null && (quote.pending || quoteFits) ? quote.data : null;
  const quoteReady = quoteFits && !quote.pending;

  const images = new Map<string, string | null>(purchasable.map((i) => [i.id, i.image_url]));
  const packs = shown ? packsFromQuote(shown, images) : packsFromCart(purchasable);

  const grandTotal = shown ? shown.grand_total : null;
  const canSubmit = quoteReady && !submitting && isAddressComplete(values) && !blocked;

  const onSubmit = useCallback(() => {
    if (submittingRef.current) return;
    const data = quote.data;
    if (data === null) return;

    submittingRef.current = true;
    setSubmitting(true);
    setSubmitFail(null);

    void (async () => {
      const r = await createOrder({
        cart_item_ids: data.seller_groups.flatMap((g) => g.items.map((i) => i.cart_item_id)),
        expected_grand_total: data.grand_total, // 화면이 보여준 그 숫자
        postal_code: digitsOnly(values.postalCode),
        recipient_name: values.recipientName.trim(),
        recipient_phone: digitsOnly(values.recipientPhone), // 서버 계약이 ^\d{9,11}$
        address1: values.address1.trim(),
        address2: values.address2.trim(),
        order_note: values.orderNote.trim(),
      });
      submittingRef.current = false;
      setSubmitting(false);

      if (r.ok) {
        setCount(0); // 서버가 같은 트랜잭션에서 장바구니를 비웠다
        // 🚨 push가 아니라 replace다 — 뒤로가기로 /checkout에 오면 empty_cart다
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
          setSubmitFail({ message: err.message, items: err.outOfStock, action: "cart" });
          return;
        case "not_found":
          setSubmitFail({ message: err.message, action: "cart" });
          return;
        case "duplicate_request":
          // 실패가 아니라 **이미 만들어졌다**는 뜻이다
          setSubmitFail({ message: err.message, action: "orders" });
          return;
        case "price_changed":
          // 새 금액으로 갱신하되 **자동 재제출하지 않는다**
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

  /* ── 화면 ── */
  if (loading) {
    return (
      <div className="mx-auto max-w-[1600px] px-5 py-16">
        <div className="h-5 w-40 animate-pulse bg-muted" />
        <div className="mt-6 h-12 w-full max-w-md animate-pulse bg-muted" />
        <div className="mt-3 h-12 w-full max-w-md animate-pulse bg-muted" />
      </div>
    );
  }

  if (cartError || !cartData) {
    return (
      <div className="mx-auto max-w-[1600px] px-5 py-32 text-center">
        <p className="text-[16px] text-muted-foreground">{cartError?.message ?? "주문서를 불러오지 못했습니다."}</p>
        <button
          type="button"
          onClick={() => setReloadKey((n) => n + 1)}
          className="mt-7 border border-foreground px-10 py-4 text-[14px] font-semibold uppercase transition-colors hover:bg-foreground hover:text-background"
        >
          다시 시도
        </button>
      </div>
    );
  }

  // 구매 가능 항목 0건 — 주문 상품·금액·CTA를 그리지 않는다
  if (blocked || purchasable.length === 0) {
    return (
      <div className="mx-auto max-w-[1600px] px-5 py-32 text-center">
        <p className="text-[16px] text-muted-foreground">{EMPTY_MESSAGE}</p>
        <Link
          href="/cart"
          className="mt-7 inline-block border border-foreground px-10 py-4 text-[14px] font-semibold uppercase transition-colors hover:bg-foreground hover:text-background"
        >
          장바구니로 이동
        </Link>
      </div>
    );
  }

  const orderButton = (
    <button
      type="button"
      disabled={!canSubmit}
      onClick={onSubmit}
      className="h-14 w-full bg-foreground text-[15px] font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-default disabled:bg-muted disabled:text-muted-foreground"
    >
      {grandTotal === null ? (
        submitting ? "주문 중" : "주문하기"
      ) : (
        <>
          <span className="tabular-nums">{formatWon(grandTotal)}</span>
          <span className="mx-2 opacity-60" aria-hidden="true">·</span>
          {submitting ? "주문 중" : "주문하기"}
        </>
      )}
    </button>
  );

  const brokerNotice = <p className="text-[12px] leading-relaxed text-muted-foreground">{BROKER_NOTICE}</p>;

  const failBlock = submitFail ? (
    <div className="mt-5 border border-accent p-4" role="status">
      <p className="text-[14px] text-accent">{submitFail.message}</p>
      {submitFail.items && submitFail.items.length > 0 ? (
        <ul className="mt-2 space-y-1 text-[13px] text-muted-foreground">
          {submitFail.items.map((it, idx) => (
            <li key={`${it.product_name}-${idx}`}>
              {it.product_name}
              {it.option_text ? ` · ${it.option_text}` : ""}
            </li>
          ))}
        </ul>
      ) : null}
      {submitFail.action === "cart" ? (
        <Link href="/cart" className="mt-3 inline-block border border-foreground px-5 py-2.5 text-[13px] font-medium">
          장바구니로 이동
        </Link>
      ) : null}
      {submitFail.action === "orders" ? (
        <Link href="/orders" className="mt-3 inline-block border border-foreground px-5 py-2.5 text-[13px] font-medium">
          주문내역 보기
        </Link>
      ) : null}
    </div>
  ) : null;

  const amountRow = (label: string, value: React.ReactNode) => (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );

  return (
    <>
      <div className="mx-auto grid max-w-[1600px] gap-10 px-5 pb-24 lg:grid-cols-[1fr_380px] lg:gap-14">
        {/* 좌 — 입력·주문 상품 */}
        <div>
          <section aria-labelledby="co_h_ship" className="border-t border-border py-8 first:border-t-0 first:pt-0">
            <h2 id="co_h_ship" className="mb-6 text-[18px] font-semibold uppercase tracking-wide">배송지</h2>
            <div className="max-w-xl">
              {/* 저장된 배송지 — 고르면 아래 폼을 채운다. 주문에 실리는 값은 여전히 폼 내용이다 */}
              <SavedAddresses
                onPick={(a: SavedAddress) => {
                  setValues((prev) => toValues(a, prev.orderNote));
                  setErrors({});
                }}
                onLoaded={(rows) => {
                  // 기본 배송지를 처음 한 번만 자동 적용 — 사용자가 고친 값을 덮지 않는다
                  const def = rows.find((r) => r.is_default) ?? rows[0];
                  if (!def) return;
                  setValues((prev) => (prev.recipientName || prev.address1 ? prev : toValues(def, prev.orderNote)));
                }}
              />
              <AddressFormThemed
                values={values}
                errors={errors}
                onChange={onFieldChange}
                onBlur={onFieldBlur}
                onOpenPostcode={openPostcode}
                searchButtonRef={searchButtonRef}
                address2Ref={address2Ref}
                disabled={submitting}
              />
            </div>
          </section>

          <section aria-labelledby="co_h_note" className="border-t border-border py-8">
            <h2 id="co_h_note" className="mb-6 text-[18px] font-semibold uppercase tracking-wide">배송 요청사항</h2>
            <div className="max-w-xl">
              <OrderNoteFieldThemed
                value={values.orderNote}
                error={errors.orderNote}
                onChange={(v) => onFieldChange("orderNote", v)}
                onBlur={() => onFieldBlur("orderNote")}
                disabled={submitting}
              />
            </div>
          </section>

          <section aria-labelledby="co_h_items" className="border-t border-border py-8">
            <h2 id="co_h_items" className="mb-6 text-[18px] font-semibold uppercase tracking-wide">
              주문 상품 · 판매자 {packs.length}곳
            </h2>
            {packs.map((pack) => (
              <div key={pack.key} className="mb-8 last:mb-0">
                <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
                  <p className="text-[15px] font-semibold uppercase tracking-wide">{pack.brand}</p>
                  {pack.shippingTotal === null ? null : pack.shippingTotal === 0 ? (
                    <span className="text-[13px] text-muted-foreground">{FREE_SHIPPING}</span>
                  ) : (
                    <span className="text-[13px] text-muted-foreground">
                      배송비 <b className="text-foreground">{formatWon(pack.shippingTotal)}</b>
                    </span>
                  )}
                </div>
                <div className="space-y-5">
                  {/* 🚨 체크박스·수량 스테퍼·삭제를 두지 않는다 — 주문서 묶음은 읽기 전용이다 */}
                  {pack.rows.map((row) => (
                    <div key={row.key} className="flex gap-4">
                      <div className="h-24 w-20 flex-none overflow-hidden bg-muted">
                        {row.imageUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={row.imageUrl}
                            alt={row.name}
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[16px] font-medium">{row.name}</p>
                        <p className="mt-1 text-[13px] text-muted-foreground">
                          {row.optionText ? `${row.optionText} · ${row.quantity}개` : `${row.quantity}개`}
                        </p>
                        <p className="mt-1.5 text-[15px] font-semibold tabular-nums">
                          {row.lineTotal === null ? "—" : formatWon(row.lineTotal)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>

          <section aria-labelledby="co_h_pay" className="border-t border-border py-8">
            <h2 id="co_h_pay" className="mb-6 text-[18px] font-semibold uppercase tracking-wide">결제 수단</h2>
            {/* 🚨 API로 전송하지 않는다 — OrderCreateRequest에 결제 수단 필드가 없다.
                화면에만 존재하는 사실 표기이므로 상태도 두지 않는다 (defaultChecked). */}
            <label htmlFor="co_pay_bank" className="flex items-center gap-3 text-[15px]">
              <input
                type="radio"
                id="co_pay_bank"
                name="co_pay"
                value="bank_transfer"
                defaultChecked
                className="h-4 w-4 accent-black"
              />
              {PAY_METHOD}
            </label>
            <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-muted-foreground">{PAY_NOTE}</p>
          </section>

          {/* 중개자 고지 (<lg) — 고정 CTA 바 바로 위, 같은 스크롤 흐름 안 (FR-32) */}
          <div className="border-t border-border py-6 lg:hidden">{brokerNotice}</div>
        </div>

        {/* 우 — 결제 금액 (≥lg 따라다님) */}
        <aside className="lg:sticky lg:top-[124px] lg:self-start" aria-busy={quote.pending}>
          <div className="border border-border p-7">
            <h2 className="mb-6 text-[15px] font-semibold uppercase tracking-wide">결제 금액</h2>
            {/* 🚨 행 순서 고정 · 도서산간은 0원이어도 줄을 지우지 않는다 */}
            <dl className="space-y-3 text-[14px]">
              {amountRow("상품 금액", formatWon(shown ? shown.item_total : cartData.purchasable_total))}
              {amountRow(
                "배송비",
                shown ? formatWon(shown.shipping_total) : <span className="text-muted-foreground">{SUMMARY_PENDING_TEXT}</span>,
              )}
              {amountRow(
                "도서산간 추가",
                shown ? formatWon(shown.remote_extra_total) : <span className="text-muted-foreground">{SUMMARY_PENDING_TEXT}</span>,
              )}
            </dl>
            <div className="mt-6 flex items-baseline justify-between border-t border-border pt-5">
              <span className="text-[14px] font-semibold">{SUMMARY_TOTAL_LABEL}</span>
              <span className="text-[26px] font-semibold tabular-nums">
                {grandTotal === null ? (
                  <span className="text-[15px] font-normal text-muted-foreground">{SUMMARY_PENDING_TEXT}</span>
                ) : (
                  formatWon(grandTotal)
                )}
              </span>
            </div>

            <p className="mt-4 text-[12px] leading-relaxed text-muted-foreground">
              {remoteNote(shown ? shown.remote_area_kind : null)}
            </p>
            {/* 재조회 중에도 이전 금액을 지우지 않는다 — 이 자리에만 진행 표시를 둔다 */}
            {quote.pending ? (
              <p className="mt-2 text-[12px] text-muted-foreground" role="status">
                배송비를 다시 계산하고 있습니다.
              </p>
            ) : null}
            {quote.error ? (
              <div className="mt-4">
                <p className="text-[13px] text-accent">{quote.error.message}</p>
                <button
                  type="button"
                  onClick={() => void refreshPreview(postalDigits)}
                  className="mt-2 border border-foreground px-4 py-2 text-[13px]"
                >
                  다시 시도
                </button>
              </div>
            ) : null}
            {failBlock}

            {/* 🚨 중개자 고지는 `주문하기`보다 **위**다 (FR-32) */}
            <div className="mt-6 hidden lg:block">{brokerNotice}</div>
            <div className="mt-4 hidden lg:block">{orderButton}</div>
          </div>
        </aside>
      </div>

      {/* 하단 고정 CTA 바 (<lg) — DOM 순서상 콘텐츠 뒤 (UX-DR6). 주문서에는 탭바가 없다. */}
      <div className="sticky bottom-0 z-40 border-t border-border bg-background px-5 py-3 lg:hidden">
        {orderButton}
      </div>

      {overlayOpen ? <PostcodeOverlay onSelect={onPostcodeSelect} onClose={closeOverlay} /> : null}
    </>
  );
}
