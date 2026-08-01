/* 404 — 없는 주소로 들어왔을 때. Next 기본 화면은 영문 한 줄이라 여기서 대체한다.

   🚨 라우트 그룹((console))에 별도 not-found를 두지 않는다 — Next는 **주소가 아무 라우트와도
      맞지 않으면 루트 not-found만** 쓴다. 그룹 파일은 notFound()를 직접 호출할 때만 쓰이므로
      운영자가 오타로 들어온 `/admin/xxx`에는 절대 뜨지 않는다(죽은 파일이 된다).
      대신 여기서 역할 쿠키를 보고 **갈 곳과 문구를 바꾼다** — 운영자에게 "홈으로"는 도움이 안 된다. */

import type { Metadata } from "next";
import { cookies } from "next/headers";

import StatusScreen from "./status-screen";

import "./(buyer)/theme.css";

export const metadata: Metadata = {
  title: "페이지를 찾을 수 없습니다 — SLUR",
  robots: { index: false, follow: false },
};

export default async function NotFound() {
  // slur_role은 UX 힌트 쿠키다(권한 판정은 FastAPI 몫) — 여기서는 "어디로 돌려보낼까"에만 쓴다
  const role = (await cookies()).get("slur_role")?.value;
  const isConsole = role === "admin" || role === "seller";

  if (isConsole) {
    const home = role === "admin" ? "/admin" : "/seller";
    return (
      <StatusScreen
        code="404"
        title="찾을 수 없는 화면입니다"
        message="주소가 바뀌었거나, 삭제된 주문·상품일 수 있습니다. 목록에서 다시 선택해 주세요."
        actions={[
          { href: home, label: "대시보드로 가기", primary: true },
          { href: role === "admin" ? "/admin/orders" : "/seller/orders", label: "주문 관리" },
        ]}
      />
    );
  }

  return (
    <StatusScreen
      code="404"
      title="페이지를 찾을 수 없습니다"
      message="주소가 바뀌었거나, 판매가 끝나 내려간 지면일 수 있습니다. 홈에서 다시 찾아보세요."
      actions={[{ href: "/", label: "홈으로 가기", primary: true }]}
      links={[
        { href: "/orders", label: "주문 내역" },
        { href: "/faq", label: "자주 묻는 질문" },
        { href: "/support", label: "1:1 문의" },
      ]}
    />
  );
}
