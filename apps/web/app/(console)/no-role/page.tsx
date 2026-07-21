import Link from "next/link";

import LogoutButton from "@/app/logout-button";

/* 판매자·관리자 화면 접근 안내 전용 (D3).
   정상 로그인 동선에서 구매자가 여기에 도달하는 경로는 없다 —
   다만 /seller·/admin을 직접 입력하면 미들웨어가 여전히 여기로 보내므로 화면을 남긴다.
   `쇼핑 계속하기`가 그때의 출구다. 구매자 전용 로그아웃(→ /)은 /me(8.7) 소관이다. */
export default function NoRole() {
  return (
    <main className="page_landing">
      <h1>접근 권한이 없습니다</h1>
      <p>이 화면은 판매자·관리자 전용입니다.</p>
      <p>
        입점을 원하시면 <Link href="/apply">입점 신청</Link>을 이용해 주세요.
      </p>
      <p>
        <Link href="/">쇼핑 계속하기</Link>
      </p>
      <LogoutButton />
    </main>
  );
}
