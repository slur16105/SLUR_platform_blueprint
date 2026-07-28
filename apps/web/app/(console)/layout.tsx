// 판매자·관리자·정책 표면의 공통 레이아웃.
// 법적 푸터(SiteFooter)는 여기서 붙이지 않는다 — 관리자·판매자 운영 콘솔은 소비자 대상이 아니라
// 중개자 법적 고지 표시 의무가 없고(그 의무는 구매자 표면의 b_footer가 담당), 콘솔 셸 아래
// 풀폭 푸터는 위치가 어색하다. 소비자가 도달하는 문서·공개 페이지(terms·privacy·no-role·apply)는
// 각자 <SiteFooter/>를 직접 렌더해 바닥 고정을 유지한다(body flex 직계 자식 규칙).
export default function ConsoleLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
