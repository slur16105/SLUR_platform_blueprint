import LogoutButton from "../logout-button";

export default function AdminHome() {
  return (
    <main className="page_landing">
      <h1>관리자</h1>
      <p>입점 승인·운영 화면은 Epic 2에서 생깁니다.</p>
      <LogoutButton />
    </main>
  );
}
