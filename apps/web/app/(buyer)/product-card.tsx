/* 상품 카드 — 사진 → 브랜드 라벨 → 상품명 → 가격 (UX-DR2).
   브랜드명이 상품명보다 먼저·굵게·자간을 벌려 읽히는 것이 이 지면의 지문이다.
   카드 전체가 하나의 링크다 — 사진·글자 어디를 눌러도 상품상세로 간다.

   품절 카드는 숨기지 않는다 (FR-10 확장, UX-DR8): 채도 저하 + `품절` 태그 +
   흐린 글자 + 가격 취소선. 색과 텍스트를 항상 함께 쓰며, 눌러서 상세로 들어갈 수 있다 —
   어떤 조합이 남았는지 볼 수 있어야 하기 때문이다. */

import Link from "next/link";

import BrandLabel from "./brand-label";
import { formatWon } from "./format";

/** GET /api/v1/products의 items[] 한 항목 (PublicProductItem). */
export type ProductItem = {
  id: string;
  name: string;
  brand_name: string;
  price_from: number;
  main_image_url: string | null;
  sold_out: boolean;
  category_id: string;
};

export default function ProductCard({ item }: { item: ProductItem }) {
  return (
    <Link
      href={`/products/${item.id}`}
      className="b_card"
      data-soldout={item.sold_out ? "true" : undefined}
    >
      <span className="i_thumb">
        {item.main_image_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            className="i_img"
            src={item.main_image_url}
            alt={item.name}
            loading="lazy"
            decoding="async"
          />
        ) : null}
        {/* 품절은 장식이 아니다 — 스크린리더에 상품명과 함께 전달돼야 하므로 숨기지 않는다 */}
        {item.sold_out ? <span className="b_tag i_soldout">품절</span> : null}
      </span>
      <BrandLabel size="card" className="i_brand">
        {item.brand_name}
      </BrandLabel>
      <span className="b_product_name_card i_name">{item.name}</span>
      <span className="b_price_card i_price">{formatWon(item.price_from)}</span>
    </Link>
  );
}
