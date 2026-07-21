import "@/app/styles/buyer/tokens.css";
import "@/app/styles/buyer/type.css";
import "./buyer.css";

/* 구매자 라우트 그룹 레이아웃.
   data-surface="buyer"는 여기 한 곳에만 붙는다 — 구매자 팔레트·먹색 포커스 링의
   스코프가 전부 이 속성에서 나온다 (D1). 판매자·관리자 문서에는 나타나지 않는다.
   푸터는 붙지 않는다 — FR-31·33은 /me(8.7)가 받는다. */
export default function BuyerLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="b_surface" data-surface="buyer">
      {children}
    </div>
  );
}
