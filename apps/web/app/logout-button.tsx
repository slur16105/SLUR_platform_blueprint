"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/login");
    router.refresh(); // Router Cache 잔상 제거
  }
  return (
    <button className="btn m_ghost" type="button" onClick={logout}>
      로그아웃
    </button>
  );
}
