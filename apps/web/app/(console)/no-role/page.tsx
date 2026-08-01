/* 권한 없음 — 판매자·관리자 화면에 자격 없이 접근했을 때.

   여기 오는 경로는 둘이다:
     ① 구매자 계정으로 /seller·/admin 주소를 직접 입력 → 미들웨어가 보낸다
     ② 승인 직전/직후라 아직 역할이 토큰에 반영되지 않았다
   "안 됩니다"로 끝내면 사용자는 다음에 뭘 할지 모른다. **막힌 이유와 다음 행동**을 함께 준다:
   입점하려면 신청, 계정이 잘못됐으면 다시 로그인, 그 외에는 쇼핑을 계속.

   🚨 권한 판정 자체는 FastAPI가 한다(AD-1). 이 화면은 그 결과를 사람이 읽을 말로 옮길 뿐이다. */

import type { Metadata } from "next";

import StatusScreen from "@/app/status-screen";

import "../../(buyer)/theme.css";

export const metadata: Metadata = {
  title: "접근 권한이 없습니다 — SLUR",
  robots: { index: false, follow: false },
};

export default function NoRole() {
  return (
    <StatusScreen
      title="접근 권한이 없습니다"
      message={
        <>
          이 화면은 <b className="font-medium text-foreground">판매자·관리자 전용</b>입니다.
          입점을 원하시면 신청을 남겨 주세요 — 운영자가 확인 후 연락드립니다.
          <br />
          이미 판매자라면 <b className="font-medium text-foreground">해당 계정으로 다시 로그인</b>했는지
          확인해 주세요. 승인 직후에는 다시 로그인해야 권한이 반영됩니다.
        </>
      }
      actions={[
        { href: "/apply", label: "입점 신청하기", primary: true },
        { href: "/login", label: "다른 계정으로 로그인" },
        { href: "/", label: "쇼핑 계속하기" },
      ]}
      links={[{ href: "/support", label: "1:1 문의" }]}
    />
  );
}
