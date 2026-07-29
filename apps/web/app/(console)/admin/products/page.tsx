"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import ConsoleShell from "@/app/(console)/console-shell";
import "./products.css";

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

const STATUS_LABEL: Record<ProductStatus, string> = { active: "판매중", soldout: "품절", hidden: "숨김" };
const STATUS_BADGE: Record<ProductStatus, string> = { active: "m_success", soldout: "m_warning", hidden: "" };

function formatDateTime(s: string) {
  return new Date(s).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Seoul" });
}

export default function AdminProducts() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState<StatusFilter>("");
  const [items, setItems] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [size, setSize] = useState(20);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const loadSeq = useRef(0);

  // 최초 마운트 시 URL ?q= 를 초기 검색어로 (판매자 상세의 "상품 N개 보기" 딥링크).
  // 효과는 하이드레이션 후 1회만 — 외부 소스(URL)에서 상태를 시딩하는 정당한 용례라 규칙 예외.
  useEffect(() => {
    const initial = (new URLSearchParams(window.location.search).get("q") ?? "").trim();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (initial && initial.length >= 2) { setQ(initial); setAppliedQ(initial); }
  }, []);

  const load = useCallback(async (query: string, cat: string, st: StatusFilter, p: number) => {
    const gen = ++loadSeq.current;
    setError(null);
    setLoading(true);
    try {
      const sp = new URLSearchParams({ tab: "products", page: String(p) });
      if (query) sp.set("q", query);
      if (cat) sp.set("category_id", cat);
      if (st) sp.set("status", st);
      const res = await fetch(`/api/admin/lookup?${sp.toString()}`);
      if (gen !== loadSeq.current) return;
      if (res.status === 401) return void router.replace("/login");
      if (res.status === 403) return void router.replace("/no-role"); // R7: FastAPI 판정 결과를 따른다
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        return void setError(data?.message ?? "목록을 불러오지 못했습니다. 다시 시도해 주세요.");
      }
      const data = await res.json();
      if (gen !== loadSeq.current) return;
      const list: ProductRow[] = data.items ?? [];
      const totalCount: number = data.total ?? 0;
      const s: number = data.size > 0 ? data.size : 20;
      setSize(s);
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
    void (async () => { await load(appliedQ, categoryId, status, page); })();
  }, [appliedQ, categoryId, status, page, load]);

  // 카테고리 셀렉트 — 카테고리 관리 화면과 동일 소스
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/categories");
        if (!res.ok) return;
        setCategories(await res.json());
      } catch {
        // 네트워크 오류 — 목록 조회 쪽 에러 처리에 맡긴다
      }
    })();
  }, []);

  function submitSearch() {
    const query = q.trim();
    if (query && query.length < 2) return void setError("검색어는 2자 이상 입력해 주세요.");
    if (query.length > 100) return void setError("검색어는 100자 이내로 입력해 주세요.");
    setError(null);
    setPage(1);
    if (query === appliedQ) load(query, categoryId, status, 1);
    else setAppliedQ(query);
  }

  const lastPage = Math.max(1, Math.ceil(total / size));
  const filtered = appliedQ || categoryId || status;

  return (
    <ConsoleShell role="admin" title="상품 조회" description="상품을 이름·브랜드·카테고리·상태로 검색합니다.">
      <div className="page_admin_products">
      <form className="p_search" onSubmit={(e) => { e.preventDefault(); submitSearch(); }}>
        <input className="input_text" type="search" maxLength={100} value={q}
          placeholder="상품명·브랜드 (2자 이상)" onChange={(e) => setQ(e.target.value)} />
        <select className="input_text m_select" aria-label="카테고리" value={categoryId}
          onChange={(e) => { setCategoryId(e.target.value); setPage(1); }}>
          <option value="">전체 카테고리</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="input_text m_select" aria-label="상품 상태" value={status}
          onChange={(e) => { setStatus(e.target.value as StatusFilter); setPage(1); }}>
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button className="btn m_primary" type="submit">검색</button>
      </form>
      {error && <div className="alert m_inline m_danger" role="alert">{error}</div>}
      {loading ? (
        <p className="p_empty">불러오는 중…</p>
      ) : items.length === 0 ? (
        <p className="p_empty">{filtered ? "조건에 맞는 상품이 없습니다." : "상품이 없습니다."}</p>
      ) : (
        <div className="table_wrap">
          <div className="table_scroll"><table className="table_data">
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
              {items.map((p) => (
                <tr key={p.id}>
                  <td><strong className="i_name">{p.name}</strong></td>
                  <td>{p.brand_name}</td>
                  <td className="m_num">{p.base_price.toLocaleString()}원</td>
                  <td><span className={`badge m_small ${STATUS_BADGE[p.status] ?? ""}`.trim()}>{STATUS_LABEL[p.status] ?? p.status}</span></td>
                  <td className="m_num">{p.stock_sum.toLocaleString()}</td>
                  <td className="m_muted">{formatDateTime(p.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
          <div className="i_foot">
            <span className="i_count">총 {total}건</span>
            <div className="i_btn_wrap">
              <button className="btn m_small" type="button" disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}>이전</button>
              <span className="i_page">{page} / {lastPage}</span>
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
