"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";

import BrandLabel from "../../brand-label";
import OptionAxes, { type PublicVariant } from "../../option-axes";
import SellerInfoSection, { type SellerInfoData } from "../../seller-info";
import { BlockSkeleton, ErrorState, getPublicJson, type ApiFailure } from "../../buyer-feedback";
import { formatWon } from "../../format";
import type { ProductItem } from "../../product-card";

/* 상품상세 본체 — `/products/[id]`의 내용.

   ≥768 2단은 CSS grid 영역 하나로 만든다 (D8): "media info" / "legal legal".
   DOM 순서는 이미지 → 정보 → 법적 고지로 고정이며, 폭에 따라 노드를 옮기지 않는다.
   🚨 matchMedia·innerWidth·resize를 쓰지 않는다 — 폭이 바뀔 때 언마운트되면
      선택한 축·현재 썸네일·접이식 열림 상태가 날아간다 (AC 11, AD-14).

   CTA는 두 자리에 렌더하고 CSS display로 전환한다 (D9). 비활성 판정은 한 곳에서 계산해
   두 사본에 같은 값을 넘긴다. display:none인 쪽은 접근성 트리에서도 빠지므로
   스크린리더에 `장바구니 담기`가 두 번 읽히지 않는다. */

type ProductDetailData = ProductItem & {
  description: string;
  image_urls: string[];
  variants: PublicVariant[];
  seller_info: SellerInfoData;
};

/* D11 — 공개 상품 API에 배송비가 없다. 실제 금액은 배송지 우편번호가 있어야 정해지고
   POST /orders/preview가 계산한다 (AD-12). 응답에 없는 값을 화면이 만들어내지 않는다. */
const SHIPPING_NOTE = "배송비는 판매자마다 다르며 주문서에서 확인할 수 있습니다."; // [ASSUMPTION]

function CtaPair({
  variant,
  disabled,
  onAdd,
  onBuy,
}: {
  variant: "bar" | "inline";
  disabled: boolean;
  onAdd: () => void;
  onBuy: () => void;
}) {
  return (
    <div className={variant === "bar" ? "b_cta_pair b_cta_bar" : "b_cta_pair m_inline"}>
      <button type="button" className="b_btn i_ghost b_button_text" disabled={disabled} onClick={onAdd}>
        장바구니 담기
      </button>
      <button type="button" className="b_btn m_solid b_button_text" disabled={disabled} onClick={onBuy}>
        바로 구매
      </button>
    </div>
  );
}

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  /* 적재 결과 한 벌. 로딩 상태를 따로 두지 않고 null 여부로 파생한다 —
     effect 안에서 동기 setState를 하지 않기 위한 형태다(react-hooks/set-state-in-effect). */
  const [result, setResult] = useState<{ data: ProductDetailData | null; error: ApiFailure | null } | null>(null);
  const [retry, setRetry] = useState(0);
  const [heroIndex, setHeroIndex] = useState(0);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

  // 진입 시 한 번만 읽는다 — 이후 갱신은 아래 handleVariant가 URL로 내보내는 방향뿐이다
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

  /* 선택 조합을 ?variant=<uuid>에 replace로 남긴다 (D4).
     /login?next=<현재 경로+쿼리>로 갔다 돌아오면 조합이 그대로 복원된다 —
     UX-DR11 "담으려던 조합을 잃어버리면 안 된다"의 저장 수단이 이것이다.
     scroll:false — 칩을 고를 때마다 화면이 맨 위로 튀면 안 된다. */
  const handleVariant = useCallback(
    (variantId: string | null) => {
      setSelectedVariantId(variantId);
      router.replace(variantId ? `${pathname}?variant=${encodeURIComponent(variantId)}` : pathname, {
        scroll: false,
      });
    },
    [router, pathname],
  );

  /* 8.4 접점 — 이 스토리는 버튼의 자리·문구·활성 판정·갈 곳의 규칙까지만 소유한다.
     TODO(8.4): POST /api/v1/carts/items {variant_id, quantity} 를 BFF로 호출한다.
       · 401이면 `/login?next=${encodeURIComponent(pathname + window.location.search)}`로 보낸다.
         선택 조합이 ?variant에 있으므로 복귀만으로 복원된다(별도 저장소를 만들지 않는다).
       · 8.3은 로그인 여부를 판정하지 않는다 — 쿠키 존재는 인증이 아니다 (AD-1). 401 처리는 호출자 몫이다.
     TODO(8.4·8.5): `바로 구매`의 목적지는 여기서 정하지 않는다. 백엔드에 직구매 경로가 없어
       (주문 생성이 cart_item_ids 기반) 담기를 거쳐야 하며, 그 설계는 8.4·8.5가 소유한다. */
  const handleAdd = useCallback(() => {
    // 8.4가 담기 호출을 여기에 붙인다. 8.3은 API를 부르지 않는다.
  }, []);
  const handleBuy = useCallback(() => {
    // 8.4·8.5가 목적지를 정한 뒤 여기에 붙인다.
  }, []);

  if (loading) {
    return (
      <div className="b_container b_detail">
        <div className="i_media">
          <BlockSkeleton className="m_hero" />
        </div>
        <div className="i_info">
          <BlockSkeleton className="m_line" />
          <BlockSkeleton className="m_title" />
          <BlockSkeleton className="m_line" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    // 없는 상품·숨김 상품·잘못된 형식의 id 전부 같은 화면이다 (BFF가 404 봉투로 통일한다).
    // notFound()를 쓰지 않는 이유: 셸(상단바·상단 내비)을 유지해야 돌아갈 길이 보인다.
    const notFound = !error || error.code === "not_found" || error.code === "validation_error";
    return (
      <div className="b_container b_section">
        <ErrorState
          message={notFound ? "상품을 찾을 수 없습니다." : error.message}
          onRetry={notFound ? undefined : () => setRetry((n) => n + 1)}
          action={
            notFound ? (
              <Link href="/" className="b_btn m_ghost b_control">
                상품목록으로
              </Link>
            ) : undefined
          }
        />
      </div>
    );
  }

  const images = data.image_urls ?? [];
  const hero = images[heroIndex] ?? images[0] ?? null;
  const selectedVariant = data.variants.find((v) => v.id === selectedVariantId) ?? null;

  /* D7 — 조합이 특정되면 그 조합의 final_price, 특정 전에는 price_from.
     활성 조합 가격이 갈리면 `32,000원부터`. 🚨 클라이언트가 base + extra를 더하지 않는다 (AD-12). */
  const priceVaries = new Set(data.variants.map((v) => v.final_price)).size > 1;
  const priceText = selectedVariant
    ? formatWon(selectedVariant.final_price)
    : `${formatWon(data.price_from)}${priceVaries ? "부터" : ""}`; // [ASSUMPTION] `…원부터` 접미어

  const allSoldOut = data.variants.length > 0 && data.variants.every((v) => !v.purchasable);
  const ctaDisabled = allSoldOut || selectedVariant === null || !selectedVariant.purchasable;

  return (
    <>
      <div className="b_container b_detail">
        {/* 이미지 — ≥768에서 sticky가 걸리는 짧은 칼럼 */}
        <div className="i_media">
          <div className="b_hero">
            {hero ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img className="i_img" src={hero} alt={data.name} decoding="async" />
            ) : null}
          </div>
          {/* 이미지가 1장이면 썸네일 행을 그리지 않는다.
              [ASSUMPTION] 좌우 스와이프 제스처를 만들지 않는다 — 썸네일 탭으로 전 이미지에 닿는다 (UX-DR16). */}
          {images.length > 1 ? (
            <div className="b_thumbs" role="group" aria-label="상품 이미지">
              {images.map((url, i) => (
                <button
                  key={url}
                  type="button"
                  className="i_thumb"
                  data-selected={i === heroIndex ? "true" : undefined}
                  aria-pressed={i === heroIndex}
                  onClick={() => setHeroIndex(i)}
                >
                  {/* alt은 상품명 — 장식 아이콘이 아니라 상품 그 자체다 (D12).
                      버튼의 접근 가능한 이름도 이 alt에서 나온다. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="i_img"
                    src={url}
                    alt={`${data.name} 이미지 ${i + 1}`}
                    loading="lazy"
                    decoding="async"
                  />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {/* 정보 */}
        <div className="i_info">
          <BrandLabel size="detail" className="i_brand">
            {data.brand_name}
          </BrandLabel>
          <h1 className="b_title i_name">{data.name}</h1>
          <p className="b_price_hero i_price">{priceText}</p>
          <p className="b_body i_desc">{data.description}</p>

          <OptionAxes
            variants={data.variants}
            initialVariantId={initialVariantId}
            onSelect={handleVariant}
          />

          <div className="b_ship b_row">
            <span className="b_meta i_key">배송비</span>
            <span className="b_meta i_value">{SHIPPING_NOTE}</span>
          </div>

          {/* ≥768에서만 보이는 사본 — 화면 밖으로 밀려나지 않도록 정보 칼럼 안으로 승격된다 */}
          <CtaPair variant="inline" disabled={ctaDisabled} onAdd={handleAdd} onBuy={handleBuy} />
        </div>

        {/* 법적 고지 — ≥768에서도 우측 칼럼이 아니라 2단 아래 전체 폭 */}
        <div className="i_legal">
          <SellerInfoSection info={data.seller_info} />
        </div>
      </div>

      {/* 하단 고정 CTA (<768) — DOM 순서상 콘텐츠(법적 고지 포함) 뒤에 둔다 (UX-DR6) */}
      <CtaPair variant="bar" disabled={ctaDisabled} onAdd={handleAdd} onBuy={handleBuy} />
    </>
  );
}
