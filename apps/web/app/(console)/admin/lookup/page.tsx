"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import LogoutButton from "@/app/logout-button";
import "./lookup.css";

type Tab = "users" | "sellers" | "products";
const TABS: { key: Tab; label: string }[] = [
  { key: "users", label: "회원" },
  { key: "sellers", label: "판매자" },
  { key: "products", label: "상품" },
];

type UserRow = {
  id: string;
  email: string;
  name: string;
  roles: string[];
  created_at: string;
};

type SellerRow = {
  id: string;
  brand_name: string;
  company_name: string;
  representative_name: string;
  business_registration_number: string;
  mail_order_number: string;
  business_address: string;
  contact_phone: string;
  base_shipping_fee: number;
  jeju_extra_fee: number;
  island_extra_fee: number;
  product_count: number;
  created_at: string;
};

type ProductStatus = "active" | "soldout" | "hidden";
type ProductRow = {
  id: string;
  name: string;
  brand_name: string;
  base_price: number;
  status: ProductStatus;
  stock_sum: number;
  created_at: string;
};

type Category = { id: string; name: string; sort_order: number };

type StatusFilter = "" | ProductStatus;
const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "", label: "전체 상태" },
  { value: "active", label: "판매중" },
  { value: "soldout", label: "품절" },
  { value: "hidden", label: "숨김" },
];

const ROLE_LABEL: Record<string, string> = { buyer: "구매자", seller: "판매자", admin: "관리자" };
const ROLE_BADGE: Record<string, string> = { buyer: "", seller: "m_brand", admin: "m_danger" };

const PRODUCT_STATUS_LABEL: Record<ProductStatus, string> = { active: "판매중", soldout: "품절", hidden: "숨김" };
const PRODUCT_STATUS_BADGE: Record<ProductStatus, string> = { active: "m_success", soldout: "m_warning", hidden: "" };

const SEARCH_PLACEHOLDER: Record<Tab, string> = {
  users: "이메일·이름 (2자 이상)",
  sellers: "브랜드·상호 (2자 이상)",
  products: "상품명·브랜드 (2자 이상)",
};

function formatDateTime(s: string) {
  // 다른 관리자 화면과 대사 시 시간 불일치 방지 — KST 고정
  return new Date(s).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Seoul" });
}

export default function AdminLookup() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("users");
  const [q, setQ] = useState(""); // 입력 중 값
  const [appliedQ, setAppliedQ] = useState(""); // 실제 조회에 쓰인 값
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState<StatusFilter>("");
  const [items, setItems] = useState<UserRow[] | SellerRow[] | ProductRow[]>([]);
  const [total, setTotal] = useState(0);
  const [size, setSize] = useState(20); // 응답 size로 갱신 — 하드코딩 아님
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const loadSeq = useRef(0); // 요청 세대 카운터 — 탭·검색·페이지 연타 시 늦은 응답 폐기

  const load = useCallback(async (t: Tab, query: string, cat: string, st: StatusFilter, p: number) => {
    const gen = ++loadSeq.current;
    setError(null);
    try {
      const sp = new URLSearchParams({ tab: t, page: String(p) });
      if (query) sp.set("q", query);
      if (t === "products") {
        if (cat) sp.set("category_id", cat);
        if (st) sp.set("status", st);
      }
      const res = await fetch(`/api/admin/lookup?${sp.toString()}`);
      if (gen !== loadSeq.current) return; // 더 최신 요청이 있음 — 이 응답은 폐기
      if (res.status === 401) return void router.replace("/login");
      if (res.status === 403) return void router.replace("/no-role"); // R7: FastAPI 판정 결과를 따른다
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        return void setError(data?.message ?? "목록을 불러오지 못했습니다. 새로고침해 주세요.");
      }
      const data = await res.json();
      if (gen !== loadSeq.current) return;
      const list = data.items ?? [];
      const totalCount: number = data.total ?? 0;
      const s: number = data.size > 0 ? data.size : 20;
      setSize(s);
      // 빈 뒷페이지 갇힘 방지 — 조건 변경으로 페이지가 사라졌으면 마지막 페이지로 이동
      if (list.length === 0 && totalCount > 0 && p > 1) {
        return void setPage(Math.min(Math.max(1, Math.ceil(totalCount / s)), p - 1)); // 항상 앞 페이지로만 이동 — 루프 불가
      }
      setItems(list);
      setTotal(totalCount);
    } catch {
      if (gen === loadSeq.current) setError("네트워크 연결을 확인해 주세요.");
    }
  }, [router]);

  // 탭·검색어·필터·페이지 변경 시 재조회 — 로더 호출을 effect 안 async 함수로 감싼다(React 데이터 페칭 관례).
  useEffect(() => {
    void (async () => { await load(tab, appliedQ, categoryId, status, page); })();
  }, [tab, appliedQ, categoryId, status, page, load]);

  // 상품 탭 카테고리 셀렉트 — 카테고리 관리 화면과 동일 소스
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/categories");
        if (!res.ok) return; // 실패해도 조회 자체는 가능 — 셀렉트만 비워 둠
        setCategories(await res.json());
      } catch {
        // 네트워크 오류 — 목록 조회 쪽 에러 처리에 맡긴다
      }
    })();
  }, []);

  function changeTab(t: Tab) {
    if (t === tab) return;
    setTab(t);
    setQ("");
    setAppliedQ("");
    setCategoryId("");
    setStatus("");
    setPage(1);
    setItems([]);
    setTotal(0);
    setError(null);
  }

  function submitSearch() {
    const query = q.trim();
    if (query && query.length < 2) return void setError("검색어는 2자 이상 입력해 주세요.");
    if (query.length > 100) return void setError("검색어는 100자 이내로 입력해 주세요.");
    setError(null);
    setPage(1);
    if (query === appliedQ) load(tab, query, categoryId, status, 1); // 같은 조건 재검색 — effect가 안 돌므로 직접 조회
    else setAppliedQ(query);
  }

  const filtered = appliedQ || (tab === "products" && (categoryId || status));
  const lastPage = Math.max(1, Math.ceil(total / size));
  const emptyLabel: Record<Tab, string> = {
    users: filtered ? "조건에 맞는 회원이 없습니다." : "회원이 없습니다.",
    sellers: filtered ? "조건에 맞는 판매자가 없습니다." : "판매자가 없습니다.",
    products: filtered ? "조건에 맞는 상품이 없습니다." : "상품이 없습니다.",
  };

  return (
    <main className="page_admin_lookup">
      <header className="p_head">
        <h1 className="p_title">조회</h1>
        <div className="p_head_actions">
          <button className="btn m_small m_ghost" type="button" onClick={() => load(tab, appliedQ, categoryId, status, page)}>새로고침</button>
          <a className="btn m_small m_ghost" href="/admin">← 관리자 홈</a>
          <LogoutButton />
        </div>
      </header>
      <nav className="p_tabs">
        {TABS.map((t) => (
          <button key={t.key} type="button"
            className={`btn m_small${tab === t.key ? " m_primary" : " m_ghost"}`}
            onClick={() => changeTab(t.key)}>{t.label}</button>
        ))}
      </nav>
      <form className="p_search" onSubmit={(e) => { e.preventDefault(); submitSearch(); }}>
        <input className="input_text" type="search" maxLength={100} value={q}
          placeholder={SEARCH_PLACEHOLDER[tab]}
          onChange={(e) => setQ(e.target.value)} />
        {tab === "products" && (
          <>
            <select className="input_text m_select" aria-label="카테고리" value={categoryId}
              onChange={(e) => { setCategoryId(e.target.value); setPage(1); }}>
              <option value="">전체 카테고리</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className="input_text m_select" aria-label="상품 상태" value={status}
              onChange={(e) => { setStatus(e.target.value as StatusFilter); setPage(1); }}>
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </>
        )}
        <button className="btn m_primary" type="submit">검색</button>
      </form>
      {error && <div className="alert m_inline m_danger" role="alert">{error}</div>}
      {items.length === 0 ? (
        <p className="p_empty">{emptyLabel[tab]}</p>
      ) : (
        <div className={tab === "sellers" ? "table_wrap m_scroll" : "table_wrap"}>
          {tab === "users" && (
            <table className="table_data">
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
                {(items as UserRow[]).map((u) => (
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
                      {/* 이메일 없는 계정은 링크 숨김 — 빈 q가 전체 주문 목록으로 이어져 오인되는 것 방지 */}
                      {u.email && <a className="btn m_small m_ghost" href={`/admin/orders?q=${encodeURIComponent(u.email)}`}>주문 이력</a>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tab === "sellers" && (
            <table className="table_data m_wide">
              <thead>
                <tr>
                  <th>브랜드</th>
                  <th>상호</th>
                  <th>대표자</th>
                  <th>사업자번호</th>
                  <th>통판신고</th>
                  <th>주소</th>
                  <th>연락처</th>
                  <th className="m_num">배송비 (기본/제주/도서)</th>
                  <th className="m_num">상품 수</th>
                </tr>
              </thead>
              <tbody>
                {(items as SellerRow[]).map((s) => (
                  <tr key={s.id}>
                    <td><strong className="i_brand">{s.brand_name}</strong></td>
                    <td>{s.company_name}</td>
                    <td>{s.representative_name}</td>
                    <td className="m_muted">{s.business_registration_number}</td>
                    <td className="m_muted">{s.mail_order_number}</td>
                    <td className="i_address">{s.business_address}</td>
                    <td className="m_muted">{s.contact_phone}</td>
                    <td className="m_num">
                      {s.base_shipping_fee.toLocaleString()} / {s.jeju_extra_fee.toLocaleString()} / {s.island_extra_fee.toLocaleString()}원
                    </td>
                    <td className="m_num">{s.product_count.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tab === "products" && (
            <table className="table_data">
              <thead>
                <tr>
                  <th>상품명</th>
                  <th>브랜드</th>
                  <th className="m_num">가격</th>
                  <th>상태</th>
                  <th className="m_num">재고 합계</th>
                  <th>등록일</th>
                </tr>
              </thead>
              <tbody>
                {(items as ProductRow[]).map((p) => (
                  <tr key={p.id}>
                    <td><strong className="i_name">{p.name}</strong></td>
                    <td>{p.brand_name}</td>
                    <td className="m_num">{p.base_price.toLocaleString()}원</td>
                    <td><span className={`badge m_small ${PRODUCT_STATUS_BADGE[p.status] ?? ""}`.trim()}>{PRODUCT_STATUS_LABEL[p.status] ?? p.status}</span></td>
                    <td className="m_num">{p.stock_sum.toLocaleString()}</td>
                    <td className="m_muted">{formatDateTime(p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="i_foot">
            <span className="i_count">총 {total}건</span>
            <div className="i_btn_wrap">
              <button className="btn m_small m_ghost" type="button" disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}>이전</button>
              <span className="i_page">{page} / {lastPage}</span>
              <button className="btn m_small m_ghost" type="button" disabled={page >= lastPage}
                onClick={() => setPage((p) => p + 1)}>다음</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
