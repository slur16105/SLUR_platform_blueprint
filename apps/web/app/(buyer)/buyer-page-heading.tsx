/* 화면 머리 — 최상위·조회 화면의 데스크톱 제목을 한 벌로 통일한다.
   <768에서는 상단바 제목이 그 역할을 하므로 감춘다(CSS display:none).
   ≥768에서 상단바가 로고+내비로 수렴하며 화면 제목이 사라지는 자리를 채운다 —
   장바구니·주문내역·주문상세·내 정보가 같은 머리를 공유해 데스크톱 제목 처리가 통일된다.
   wide=true는 장바구니처럼 본문이 1080px 폭인 화면용(그 외는 부모 컨테이너 폭을 따른다). */
export default function BuyerPageHeading({ title, wide = false }: { title: string; wide?: boolean }) {
  return (
    <div className={`b_page_heading${wide ? " m_wide" : ""}`}>
      <h1 className="b_title_sm i_title">{title}</h1>
    </div>
  );
}
