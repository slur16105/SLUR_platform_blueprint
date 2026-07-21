import LogoutButton from "@/app/logout-button";

export default function NoRole() {
  return (
    <main className="page_landing">
      <h1>접근 권한이 없습니다</h1>
      <p>이 웹은 판매자·관리자용입니다. 구매는 SLUR 앱을 이용해 주세요.</p>
      <p>입점을 원하시면 입점 신청(Epic 2에서 오픈)을 이용해 주세요.</p>
      <LogoutButton />
    </main>
  );
}
