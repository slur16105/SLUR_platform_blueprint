/* 브랜드 라벨 — 이 지면의 지문.
   카드·장바구니 묶음 헤더·주문서 묶음·주문상세 묶음에서 같은 얼굴로 반복되며,
   이 반복이 "판매자별로 나뉜 주문"이라는 구조를 시각적으로 가르친다 (UX-DR2·UX-DR13).
   자간은 CSS로만 준다 — 글자 사이에 공백을 넣으면 스크린리더 낭독이 깨진다. */

export type BrandLabelSize = "card" | "pack" | "detail";

const SIZE_CLASS: Record<BrandLabelSize, string> = {
  card: "",            // 11px / .15em — 목록 카드
  pack: "m_pack",      // 10.5px / .14em — 묶음 헤더
  detail: "m_detail",  // 11.5px / .17em — 상품상세
};

export default function BrandLabel({
  children,
  size = "card",
  className,
}: {
  children: React.ReactNode;
  size?: BrandLabelSize;
  className?: string;
}) {
  return (
    <span className={["b_brand_label", SIZE_CLASS[size], className].filter(Boolean).join(" ")}>
      {children}
    </span>
  );
}
