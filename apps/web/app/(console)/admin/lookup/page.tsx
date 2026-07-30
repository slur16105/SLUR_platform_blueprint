"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import ConsoleShell from "@/app/(console)/console-shell";
import { pageRange, pageWindow } from "@/app/(console)/pagination";
import "./lookup.css";

// 역할 탭 — 전체(필터 없음) / 관리자 / 판매자 / 일반회원(buyer)
type RoleTab = "" | "admin" | "seller" | "buyer";
const ROLE_TABS: { key: RoleTab; label: string }[] = [
  { key: "", label: "전체 회원" },
  { key: "admin", label: "관리자" },
  { key: "seller", label: "판매자" },
  { key: "buyer", label: "일반 회원" },
];

type UserRow = {
  id: string;
  email: string;
  name: string;
  roles: string[];
  created_at: string;
};

const ROLE_LABEL: Record<string, string> = { buyer: "구매자", seller: "판매자", admin: "관리자" };
const ROLE_BADGE: Record<string, string> = { buyer: "", seller: "m_brand", admin: "m_danger" };

function formatDateTime(s: string) {
  // 다른 관리자 화면과 대사 시 시간 불일치 방지 — KST 고정
  return new Date(s).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Seoul" });
}

export default function AdminMembers() {
  const router = useRouter();
  const [role, setRole] = useState<RoleTab>("");
  const [q, setQ] = useState(""); // 입력 중 값
  const [appliedQ, setAppliedQ] = useState(""); // 실제 조회에 쓰인 값
  const [items, setItems] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [size, setSize] = useState(20);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const loadSeq = useRef(0); // 요청 세대 카운터 — 탭·검색·페이지 연타 시 늦은 응답 폐기

  const load = useCallback(async (r: RoleTab, query: string, p: number) => {
    const gen = ++loadSeq.current;
    setError(null);
    setLoading(true);
    try {
      const sp = new URLSearchParams({ tab: "users", page: String(p) });
      if (query) sp.set("q", query);
      if (r) sp.set("role", r);
      const res = await fetch(`/api/admin/lookup?${sp.toString()}`);
      if (gen !== loadSeq.current) return; // 더 최신 요청이 있음 — 이 응답은 폐기
      if (res.status === 401) return void router.replace("/login");
      if (res.status === 403) return void router.replace("/no-role"); // R7: FastAPI 판정 결과를 따른다
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        return void setError(data?.message ?? "목록을 불러오지 못했습니다. 다시 시도해 주세요.");
      }
      const data = await res.json();
      if (gen !== loadSeq.current) return;
      const list: UserRow[] = data.items ?? [];
      const totalCount: number = data.total ?? 0;
      const s: number = data.size > 0 ? data.size : 20;
      setSize(s);
      // 빈 뒷페이지 갇힘 방지 — 조건 변경으로 페이지가 사라졌으면 앞 페이지로 이동
      if (list.length === 0 && totalCount > 0 && p > 1) {
        return void setPage(Math.min(Math.max(1, Math.ceil(totalCount / s)), p - 1));
      }
      setItems(list);
      setTotal(totalCount);
    } catch {
      if (gen === loadSeq.current) setError("네트워크 연결을 확인해 주세요.");
    } finally {
      if (gen === loadSeq.current) setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void (async () => { await load(role, appliedQ, page); })();
  }, [role, appliedQ, page, load]);

  function changeRole(r: RoleTab) {
    if (r === role) return;
    setRole(r);
    setQ("");
    setAppliedQ("");
    setPage(1);
    setItems([]);
    setTotal(0);
    setError(null);
    setLoading(true);
  }

  function submitSearch() {
    const query = q.trim();
    if (query && query.length < 2) return void setError("검색어는 2자 이상 입력해 주세요.");
    if (query.length > 100) return void setError("검색어는 100자 이내로 입력해 주세요.");
    setError(null);
    setPage(1);
    if (query === appliedQ) load(role, query, 1); // 같은 조건 재검색 — effect가 안 돌므로 직접 조회
    else setAppliedQ(query);
  }

  function clearSearch() {
    setQ("");
    setAppliedQ("");
    setPage(1);
  }

  const lastPage = Math.max(1, Math.ceil(total / size));

  return (
    <ConsoleShell
      role="admin"
      title="회원 관리"
      description="회원을 역할별로 조회하고, 행을 눌러 상세를 확인합니다."
    >
      <div className="page_admin_lookup">
      <nav className="tab_menu" aria-label="회원 역할">
        {ROLE_TABS.map((t) => (
          <button key={t.key || "all"} type="button" className="i_tab"
            data-state={role === t.key ? "active" : undefined}
            onClick={() => changeRole(t.key)}>{t.label}</button>
        ))}
      </nav>
      <form className="p_search" onSubmit={(e) => { e.preventDefault(); submitSearch(); }}>
        <input className="input_text" type="search" maxLength={100} value={q}
          placeholder="이메일·이름 (2자 이상)"
          onChange={(e) => setQ(e.target.value)} />
        <button className="btn m_primary" type="submit">검색</button>
      </form>
      {appliedQ && (
        <div className="p_search_note" role="status">
          <span>「<strong>{appliedQ}</strong>」 검색 결과{!loading ? ` · ${total}건` : ""}</span>
          <button className="i_clear" type="button" onClick={clearSearch}>검색 초기화</button>
        </div>
      )}
      {error && <div className="alert m_inline m_danger" role="alert">{error}</div>}
      {loading ? (
        <p className="p_empty">불러오는 중…</p>
      ) : items.length === 0 ? (
        <p className="p_empty">{appliedQ ? "조건에 맞는 회원이 없습니다." : "회원이 없습니다."}</p>
      ) : (
        <div className="table_wrap">
          <div className="table_scroll"><table className="table_data">
            <thead>
              <tr>
                <th>이메일</th>
                <th>이름</th>
                <th>역할</th>
                <th>가입일</th>
                <th aria-label="바로가기"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id}>
                  <td>{u.email ? <span className="i_email">{u.email}</span> : <span className="m_muted">(소셜 계정)</span>}</td>
                  <td>{u.name}</td>
                  <td>
                    <div className="i_roles">
                      {/* 구매자는 별도 role 행이 없음 — 빈 배열이면 기본 뱃지로 표기 */}
                      {u.roles.length === 0 && <span className="badge m_small">구매자</span>}
                      {u.roles.map((r) => (
                        <span key={r} className={`badge m_small ${ROLE_BADGE[r] ?? ""}`.trim()}>{ROLE_LABEL[r] ?? r}</span>
                      ))}
                    </div>
                  </td>
                  <td className="m_muted">{formatDateTime(u.created_at)}</td>
                  <td className="m_num">
                    <Link className="btn m_small" href={`/admin/users/${u.id}`}>상세</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
          <div className="i_foot">
            <span className="i_count">총 {total}건 · {pageRange(page, size, items.length)} 표시</span>
            <div className="i_btn_wrap">
              <button className="btn m_small" type="button" disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}>이전</button>
              {pageWindow(page, lastPage).map((n) => (
                <button key={n} className="btn m_small" type="button"
                  data-state={n === page ? "active" : undefined}
                  aria-current={n === page ? "page" : undefined}
                  onClick={() => setPage(n)}>{n}</button>
              ))}
              <button className="btn m_small" type="button" disabled={page >= lastPage}
                onClick={() => setPage((p) => p + 1)}>다음</button>
            </div>
          </div>
        </div>
      )}
      </div>
    </ConsoleShell>
  );
}
