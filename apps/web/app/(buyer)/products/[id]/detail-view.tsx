"use client";

/* 상품상세 본체 — **새 테마 판**.

   🚨 이 파일은 product-detail.tsx의 **로직(적재·조합 선택·담기·401 복귀 자동담기·배지 갱신)을
      그대로 옮긴 것**이고 바뀐 것은 마크업·클래스뿐이다. 검증된 동작을 다시 짜지 않는다.
      옛 파일은 아직 남겨 둔다(되돌릴 자리). 이전이 확정되면 그때 지운다.

   유지되는 규약:
   · 조합은 ?variant=<uuid>에 replace로 남는다 — /login 왕복 후에도 고른 조합이 복원된다 (D4).
   · 담기 수량은 항상 1 — 수량은 장바구니가 소유한다 (8.4 D8).
   · `바로 구매`는 담고 나서 /cart로 간다 — 백엔드에 단품 주문 경로가 없다.
   · 401이면 쿠키를 미리 읽지 않고 응답을 받고 나서 /login?next=…&add=1 로 보낸다 (AD-1, R7).
   · 배지는 낙관적 +1이 아니라 재조회한 서버 값으로 갱신한다 (D5). */

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";

import { addItem, getCart } from "../../cart-api";
import { useCartCount } from "../../cart-count";
import { formatWon } from "../../format";
import { getPublicJson, type ApiFailure } from "../../buyer-feedback";
import type { ProductItem } from "../../product-card";
import OptionAxes, { type PublicVariant } from "./option-axes-themed";
import { isPlaceholder, productImage } from "../../product-image";

type SellerInfoData = {
  brand_name: string;
  company_name: string;
  representative_name: string;
  business_registration_number: string;
  mail_order_number: string;
  business_address: string;
  contact_phone: string;
};

type ProductDetailData = ProductItem & {
  description: string;
  image_urls: string[];
  variants: PublicVariant[];
  seller_info: SellerInfoData;
};

/* D11 — 공개 상품 API에 배송비가 없다. 실제 금액은 우편번호가 있어야 정해지고
   POST /orders/preview가 계산한다 (AD-12). 응답에 없는 값을 화면이 만들어내지 않는다. */
const SHIPPING_NOTE = "배송비는 판매자마다 다르며 주문서에서 확인할 수 있습니다.";

export default function DetailView() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [result, setResult] = useState<{ data: ProductDetailData | null; error: ApiFailure | null } | null>(null);
  const [retry, setRetry] = useState(0);
  const [heroIndex, setHeroIndex] = useState(0);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

  const [pending, setPending] = useState<"stay" | "cart" | null>(null);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; message: string } | null>(null);
  const { setCount } = useCartCount();

  const [initialVariantId] = useState<string | null>(() => searchParams.get("variant"));

  useEffect(() => {
    let alive = true;
    void (async () => {
      const r = await getPublicJson<ProductDetailData>(`/api/products/${encodeURIComponent(id)}`);
      if (!alive) return;
      setHeroIndex(0);
      setResult(r.ok ? { data: r.data, error: null } : { data: null, error: r.error });
    })();
    return () => {
      alive = false;
    };
  }, [id, retry]);

  const loading = result === null;
  const data = result?.data ?? null;
  const error = result?.error ?? null;

  const handleVariant = useCallback(
    (variantId: string | null) => {
      setSelectedVariantId(variantId);
      router.replace(variantId ? `${pathname}?variant=${encodeURIComponent(variantId)}` : pathname, {
        scroll: false,
      });
    },
    [router, pathname],
  );

  const runAdd = useCallback(
    async (variantId: string, then: "stay" | "cart") => {
      setPending(then);
      setFeedback(null);
      const r = await addItem(variantId);
      if (r.ok) {
        const c = await getCart();
        setCount(c.ok ? c.data.items.length : undefined);
        setPending(null);
        if (then === "cart") {
          router.push("/cart");
          return;
        }
        setFeedback({ kind: "ok", message: "장바구니에 담았습니다." });
        return;
      }
      setPending(null);
      if (r.error.code === "unauthorized") {
        const sp = new URLSearchParams(window.location.search);
        sp.set("add", "1");
        router.replace(`/login?next=${encodeURIComponent(`${pathname}?${sp.toString()}`)}`);
        return;
      }
      setFeedback({ kind: "err", message: r.error.message });
    },
    [router, pathname, setCount],
  );

  const handleAdd = useCallback(() => {
    if (selectedVariantId) void runAdd(selectedVariantId, "stay");
  }, [selectedVariantId, runAdd]);
  const handleBuy = useCallback(() => {
    if (selectedVariantId) void runAdd(selectedVariantId, "cart");
  }, [selectedVariantId, runAdd]);

  /* 로그인 복귀 후의 자동 담기 — 한 번만 실행하고 즉시 add를 지운다 (D8). */
  const autoAddRef = useRef(false);
  useEffect(() => {
    if (autoAddRef.current) return;
    if (searchParams.get("add") !== "1") return;
    if (!data) return;
    autoAddRef.current = true;

    const stripped = new URLSearchParams(searchParams.toString());
    stripped.delete("add");
    const q = stripped.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });

    const vid = searchParams.get("variant");
    const target = vid ? data.variants.find((v) => v.id === vid) : undefined;
    if (!target || !target.purchasable) return;
    const t = setTimeout(() => void runAdd(target.id, "stay"), 0);
    return () => clearTimeout(t);
  }, [data, searchParams, pathname, router, runAdd]);

  if (loading) {
    return (
      <div className="mx-auto grid max-w-[1600px] gap-10 px-5 py-10 md:grid-cols-2 md:gap-14">
        <div className="aspect-4/5 w-full animate-pulse bg-muted" />
        <div className="space-y-4 pt-2">
          <div className="h-4 w-24 animate-pulse bg-muted" />
          <div className="h-9 w-3/4 animate-pulse bg-muted" />
          <div className="h-6 w-32 animate-pulse bg-muted" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    const notFound = !error || error.code === "not_found" || error.code === "validation_error";
    return (
      <div className="mx-auto max-w-[1600px] px-5 py-32 text-center">
        <p className="text-[16px] text-muted-foreground">
          {notFound ? "상품을 찾을 수 없습니다." : error.message}
        </p>
        <div className="mt-7">
          {notFound ? (
            <Link
              href="/"
              className="inline-block border border-foreground px-10 py-4 text-[14px] font-semibold uppercase transition-colors hover:bg-foreground hover:text-background"
            >
              상품목록으로
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setRetry((n) => n + 1)}
              className="border border-foreground px-10 py-4 text-[14px] font-semibold uppercase transition-colors hover:bg-foreground hover:text-background"
            >
              다시 시도
            </button>
          )}
        </div>
      </div>
    );
  }

  const images = data.image_urls ?? [];
  const hero = images[heroIndex] ?? images[0] ?? null;
  const selectedVariant = data.variants.find((v) => v.id === selectedVariantId) ?? null;

  /* D7 — 조합이 특정되면 그 조합의 final_price, 특정 전에는 price_from.
     🚨 클라이언트가 base + extra를 더하지 않는다 (AD-12). */
  const priceVaries = new Set(data.variants.map((v) => v.final_price)).size > 1;
  const priceText = selectedVariant
    ? formatWon(selectedVariant.final_price)
    : `${formatWon(data.price_from)}${priceVaries ? "부터" : ""}`;

  const allSoldOut = data.variants.length > 0 && data.variants.every((v) => !v.purchasable);
  const ctaDisabled = allSoldOut || selectedVariant === null || !selectedVariant.purchasable || pending !== null;
  const s = data.seller_info;

  const ctaButtons = (
    <div className="flex gap-2">
      <button
        type="button"
        disabled={ctaDisabled}
        onClick={handleAdd}
        className="h-14 flex-1 border border-foreground text-[15px] font-semibold transition-colors hover:bg-muted disabled:cursor-default disabled:border-border disabled:text-muted-foreground"
      >
        {pending === "stay" ? "담는 중" : "장바구니"}
      </button>
      <button
        type="button"
        disabled={ctaDisabled}
        onClick={handleBuy}
        className="h-14 flex-[2] bg-foreground text-[15px] font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-default disabled:bg-muted disabled:text-muted-foreground"
      >
        {allSoldOut ? "품절" : pending === "cart" ? "이동 중" : "바로 구매"}
      </button>
    </div>
  );

  const ctaFeedback = feedback ? (
    <p className={`mt-4 text-[14px] ${feedback.kind === "ok" ? "text-foreground" : "text-accent"}`} role="status">
      {feedback.message}
      {feedback.kind === "ok" ? (
        <Link href="/cart" className="ml-2 underline underline-offset-4">
          장바구니 보기
        </Link>
      ) : null}
    </p>
  ) : null;

  return (
    <>
      <main className="mx-auto max-w-[1600px] px-5">
        {/* 빵부스러기 */}
        <nav className="flex items-center gap-2 py-6 text-[13px] text-muted-foreground" aria-label="위치">
          <Link href="/" className="hover:text-foreground">HOME</Link>
          <span>/</span>
          <span className="text-foreground">{data.name}</span>
        </nav>

        <div className="grid gap-10 pb-16 md:grid-cols-2 md:gap-14">
          {/* 이미지 */}
          <div>
            <div className="aspect-4/5 w-full overflow-hidden bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={productImage(data.id, hero, { w: 1000, h: 1250 })}
                alt={data.name}
                decoding="async"
                className={`h-full w-full object-cover ${data.sold_out ? "opacity-40 grayscale" : ""}`}
              />
            </div>
            {/* 이미지가 1장이면 썸네일 행을 그리지 않는다 */}
            {images.length > 1 && !isPlaceholder(images[0]) ? (
              <div className="mt-2 grid grid-cols-4 gap-2" role="group" aria-label="상품 이미지">
                {images.map((url, i) => (
                  <button
                    key={url}
                    type="button"
                    aria-pressed={i === heroIndex}
                    onClick={() => setHeroIndex(i)}
                    className={`aspect-square overflow-hidden bg-muted transition-opacity ${
                      i === heroIndex ? "ring-2 ring-foreground" : "opacity-60 hover:opacity-100"
                    }`}
                  >
                    {/* alt은 상품명 — 장식이 아니라 상품 그 자체다 (D12) */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`${data.name} 이미지 ${i + 1}`}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* 정보 */}
          <div className="md:pt-2">
            <p className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
              {data.brand_name}
            </p>
            <h1 className="mt-2.5 text-[34px] font-semibold leading-tight tracking-tight">{data.name}</h1>
            <p className="mt-4 text-[26px] font-semibold tabular-nums">{priceText}</p>
            {data.description ? (
              <p className="mt-5 whitespace-pre-line text-[15px] leading-relaxed text-muted-foreground">
                {data.description}
              </p>
            ) : null}

            <div className="mt-8">
              <OptionAxes variants={data.variants} initialVariantId={initialVariantId} onSelect={handleVariant} />
            </div>

            <div className="flex gap-6 border-t border-border py-5 text-[14px]">
              <span className="w-20 flex-none text-muted-foreground">배송비</span>
              <span>{SHIPPING_NOTE}</span>
            </div>

            {/* ≥768에서 보이는 사본 — 정보 칼럼 안 */}
            <div className="hidden md:block">
              {ctaButtons}
              {ctaFeedback}
            </div>
          </div>
        </div>

        {/* 판매자 정보 — 2단 아래 전체 폭 (FR-31·32) */}
        <section className="border-t border-border py-14">
          <h2 className="mb-5 text-[22px] font-semibold uppercase tracking-wide">SELLER</h2>
          <dl className="max-w-2xl text-[14px] leading-relaxed">
            {[
              ["브랜드", s.brand_name],
              ["상호", s.company_name],
              ["대표자", s.representative_name],
              ["사업자등록번호", s.business_registration_number],
              ["통신판매업신고", s.mail_order_number],
              ["주소", s.business_address],
              ["연락처", s.contact_phone],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-6 border-b border-border py-3.5 last:border-b-0">
                <dt className="w-28 flex-none text-muted-foreground">{k}</dt>
                <dd>{v || "-"}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
            SLUR는 통신판매중개자이며 통신판매의 당사자가 아닙니다.
            상품·상품정보·거래에 관한 의무와 책임은 판매자에게 있습니다.
          </p>
        </section>
      </main>

      {/* 하단 고정 CTA (<768) — DOM 순서상 콘텐츠 뒤에 둔다 (UX-DR6) */}
      <div className="sticky bottom-0 z-40 border-t border-border bg-background px-5 py-3 md:hidden">
        {ctaButtons}
        {ctaFeedback}
      </div>
    </>
  );
}
