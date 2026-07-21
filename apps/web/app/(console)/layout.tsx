import SiteFooter from "@/app/site-footer";

// 판매자·관리자·정책 표면의 공통 레이아웃.
// 🚨 반드시 프래그먼트로 반환한다 — globals.css의 body{display:flex;flex-direction:column}과
//    site-footer.css의 .layout_footer{margin-top:auto}가 푸터를 바닥에 붙이는데,
//    래핑 엘리먼트가 하나라도 끼면 body의 직계 flex 자식이 아니게 되어
//    콘텐츠가 짧은 페이지(/terms 등)에서 푸터가 떠오른다.
export default function ConsoleLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      {children}
      <SiteFooter />
    </>
  );
}
