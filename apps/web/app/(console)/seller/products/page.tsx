"use client";

/* 판매자 상품 관리 — 관리자 상품 조회(94c8699)와 같은 구성: 상태 탭 + 페이지 번호 + 총 건수.
   판매자 상품 목록 API는 전체를 한 번에 주므로(내 상품이라 규모가 작다) 탭·페이지는 클라이언트에서
   자른다. 서버 페이징이 필요할 만큼 늘면 API에 page/status를 붙인다. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import ConsoleShell from "@/app/(console)/console-shell";
import { pageRange, pageWindow } from "@/app/(console)/pagination";
import "./list.css";

type Variant = { stock: number; is_active: boolean };
type ProductImage = { path: string; url: string | null };
type Product = { id: string; name: string; base_price: number; status: string; images: ProductImage[]; variants: Variant[] };

type StatusFilter = "" | "active" | "soldout" | "hidden";
const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "", label: "전체 상태" },
  { value: "active", label: "판매중" },
  { value: "soldout", label: "품절" },
  { value: "hidden", label: "숨김" },
];
// 라벨·배지는 관리자 상품 조회와 같은 표기를 쓴다
const STATUS_LABEL: Record<string, string> = { active: "판매중", soldout: "품절", hidden: "숨김" };
const STATUS_BADGE: Record<string, string> = { active: "m_success", soldout: "m_warning", hidden: "" };
const PAGE_SIZE = 20;

export default function SellerProducts() {
  const router = useRouter();
  const [items, setItems] = useState<Product[]>([]);
  const [loaded, setLoaded] = useState(false); // 최초 fetch 완료 전엔 빈 상태 대신 로딩 표시 (거짓 "상품 없음" 깜빡임 방지)
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFilter>("");
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/sellers/products");
      if (res.status === 401) return void router.replace("/login");
      if (res.status === 403) return void router.replace("/no-role");
      if (!res.ok) return void setError("목록을 불러오지 못했습니다.");
      setItems(await res.json());
    } catch {
      setError("네트워크 연결을 확인해 주세요.");
    } finally {
      setLoaded(true); // 성공·실패·리다이렉트 무관하게 최초 로드 종료 표시
    }
  }, [router]);

  // 초기 로드 — 로더 호출을 effect 안에서 선언한 async 함수로 감싼다(React 데이터 페칭 관례).
  useEffect(() => {
    void (async () => { await load(); })();
  }, [load]);

  useEffect(() => () => { if (noticeTimer.current) clearTimeout(noticeTimer.current); }, []);

  function showNotice(msg: string) {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 5000);
  }

  async function setProductStatus(p: Product, next: string, doneMsg: string) {
    setError(null);
    setBusyId(p.id);
    try {
      const res = await fetch("/api/sellers/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "patch", id: p.id, status: next }),
      }).catch(() => null);
      if (res?.status === 401) return void router.replace("/login");
      if (!res || !res.ok) return void setError("상태 변경에 실패했습니다.");
      showNotice(doneMsg);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  const filtered = useMemo(
    () => (status ? items.filter((p) => p.status === status) : items),
    [items, status],
  );
  const total = filtered.length;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // 탭 전환·상태 변경으로 현재 페이지가 사라졌으면 마지막 페이지로 당긴다 (빈 뒷페이지 갇힘 방지)
  const safePage = Math.min(page, lastPage);
  const shown = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const stockOf = (p: Product) => p.variants.reduce((sum, v) => sum + v.stock, 0);

  return (
    <ConsoleShell
      role="seller"
      title="상품 관리"
      description="내가 등록한 상품의 판매 상태를 관리합니다."
      actions={<Link className="btn m_primary" href="/seller/products/new">상품 등록</Link>}
    >
      <div className="page_seller_products">
      <nav className="tab_menu" aria-label="판매 상태">
        {STATUS_OPTIONS.map((o) => (
          <button key={o.value} type="button" className="i_tab"
            data-state={status === o.value ? "active" : undefined}
            onClick={() => { setStatus(o.value); setPage(1); }}>
            {o.label}
          </button>
        ))}
      </nav>
      {notice && <div className="alert m_inline m_success" role="status">{notice}</div>}
      {error && <div className="alert m_inline m_danger" role="alert">{error}</div>}
      {!loaded ? (
        <p className="p_empty" role="status">불러오는 중…</p>
      ) : total === 0 ? (
        <p className="p_empty">
          {status ? `${STATUS_LABEL[status]} 상품이 없습니다.` : "등록된 상품이 없습니다. 상품 등록으로 첫 상품을 올려 주세요."}
        </p>
      ) : (
        <div className="table_wrap">
          <div className="table_scroll"><table className="table_data">
            <thead>
              <tr>
                <th>상품</th>
                <th className="m_num">가격</th>
                <th className="m_num">재고 합계</th>
                {/* 상태 탭으로 걸러진 목록은 전 행이 같은 상태다 — 전체 탭에서만 컬럼을 둔다 */}
                {status === "" && <th>상태</th>}
                <th>처리</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => {
                const stock = stockOf(p);
                const thumb = p.images[0]?.url ?? null;
                return (
                  <tr key={p.id}>
                    <td>
                      <div className="i_prod">
                        {thumb ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img className="i_thumb" src={thumb} alt="" />
                        ) : (
                          <span className="i_thumb m_empty" aria-hidden="true" />
                        )}
                        <span className="i_prod_text">
                          <strong className="i_name">{p.name}</strong>
                          {p.variants.length > 1 && <span className="i_option_count">옵션 {p.variants.length}개</span>}
                        </span>
                      </div>
                    </td>
                    <td className="m_num">{p.base_price.toLocaleString()}원</td>
                    <td className="m_num">
                      <span className="i_stock" data-state={stock === 0 ? "zero" : undefined}>{stock.toLocaleString()}</span>
                    </td>
                    {status === "" && (
                      <td><span className={`badge m_small ${STATUS_BADGE[p.status] ?? ""}`.trim()}>{STATUS_LABEL[p.status] ?? p.status}</span></td>
                    )}
                    <td>
                      <div className="i_actions">
                        <Link className="btn m_small" href={`/seller/products/${p.id}/edit`}>수정</Link>
                        {p.status !== "active" && (
                          <button className="btn m_small m_primary" type="button" disabled={busyId === p.id}
                            onClick={() => setProductStatus(p, "active", `‘${p.name}’을(를) 판매중으로 바꿨습니다.`)}>판매 재개</button>
                        )}
                        {p.status === "active" && (
                          <button className="btn m_small" type="button" disabled={busyId === p.id}
                            onClick={() => setProductStatus(p, "soldout", `‘${p.name}’을(를) 품절로 바꿨습니다.`)}>품절 처리</button>
                        )}
                        {p.status !== "hidden" && (
                          <button className="btn m_small" type="button" disabled={busyId === p.id}
                            onClick={() => setProductStatus(p, "hidden", `‘${p.name}’을(를) 숨겼습니다. 구매자 화면에 보이지 않습니다.`)}>숨기기</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
          <div className="i_foot">
            <span className="i_count">총 {total}건 · {pageRange(safePage, PAGE_SIZE, shown.length)} 표시</span>
            <div className="i_btn_wrap">
              <button className="btn m_small" type="button" disabled={safePage <= 1}
                onClick={() => setPage(Math.max(1, safePage - 1))}>이전</button>
              {pageWindow(safePage, lastPage).map((n) => (
                <button key={n} className="btn m_small" type="button"
                  data-state={n === safePage ? "active" : undefined}
                  aria-current={n === safePage ? "page" : undefined}
                  onClick={() => setPage(n)}>{n}</button>
              ))}
              <button className="btn m_small" type="button" disabled={safePage >= lastPage}
                onClick={() => setPage(safePage + 1)}>다음</button>
            </div>
          </div>
        </div>
      )}
      </div>
    </ConsoleShell>
  );
}
