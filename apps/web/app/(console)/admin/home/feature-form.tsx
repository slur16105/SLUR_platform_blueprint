"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import LogoutButton from "@/app/logout-button";
import "./home.css";

type Kind = "hero" | "slot";
type Layout = "feature" | "strip";

type Product = {
  id: string;
  name: string;
  brand_name: string;
  price_from: number;
  main_image_url: string | null;
  sold_out: boolean;
};

type FeatureDetail = {
  id: string;
  kind: Kind;
  layout: Layout;
  title: string;
  issue_no: string | null;
  issue_label: string | null;
  lead_text: string | null;
  image_path: string | null;
  display_order: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  items: { product_id: string; name: string; brand_name: string; price_from: number; main_image_url: string | null; sold_out: boolean }[];
};

type Category = { id: string; name: string };

// KST는 DST 없는 고정 +09:00. 폼 안내·목록 표시(timeZone:"Asia/Seoul")와 일치시키려고
// 브라우저 로컬 tz가 아니라 이 고정 오프셋으로 환산한다(관리자 PC가 KST가 아니어도 동일).
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

// ISO(UTC) → datetime-local 입력값(KST 고정 +09:00). 서버 datetime은 tz-aware다.
function isoToLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Date(d.getTime() + KST_OFFSET_MS).toISOString().slice(0, 16);
}

// datetime-local(KST로 해석) → ISO(UTC, tz-aware). 서버는 aware datetime을 기대한다(naive면 노출창 비교가 깨진다).
function localToIso(v: string): string | null {
  if (!v) return null;
  const ms = Date.parse(`${v}:00+09:00`); // 입력값을 +09:00 벽시계로 고정 해석
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toISOString();
}

function priceText(p: Product) {
  return `${p.brand_name} · ${p.price_from.toLocaleString()}원~`;
}

export default function FeatureForm({ featureId }: { featureId?: string }) {
  const router = useRouter();
  const isEdit = !!featureId;

  const [kind, setKind] = useState<Kind>("slot");
  const [layout, setLayout] = useState<Layout>("feature");
  const [title, setTitle] = useState("");
  const [issueNo, setIssueNo] = useState("");
  const [issueLabel, setIssueLabel] = useState("");
  const [leadText, setLeadText] = useState("");
  const [imagePath, setImagePath] = useState("");
  const [displayOrder, setDisplayOrder] = useState("0");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [selected, setSelected] = useState<Product[]>([]);

  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 후보 상품 (공개 목록 재사용 — 관리자 전용 목록 API가 없다)
  const [categories, setCategories] = useState<Category[]>([]);
  const [category, setCategory] = useState(""); // "" = 전체
  const [candidates, setCandidates] = useState<Product[]>([]);
  const [candPage, setCandPage] = useState(1);
  const [candTotal, setCandTotal] = useState(0);
  const [candLoading, setCandLoading] = useState(false);
  const [candError, setCandError] = useState<string | null>(null);

  // 편집 대상 로드
  const loadFeature = useCallback(async () => {
    if (!featureId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/admin/home/${featureId}`);
      if (res.status === 401) return void router.replace("/login");
      if (res.status === 403) return void router.replace("/no-role");
      if (res.status === 404) return void setLoadError("편성을 찾을 수 없습니다. 삭제되었을 수 있습니다.");
      if (!res.ok) return void setLoadError("편성을 불러오지 못했습니다.");
      const d: FeatureDetail = await res.json();
      setKind(d.kind);
      setLayout(d.layout);
      setTitle(d.title);
      setIssueNo(d.issue_no ?? "");
      setIssueLabel(d.issue_label ?? "");
      setLeadText(d.lead_text ?? "");
      setImagePath(d.image_path ?? "");
      setDisplayOrder(String(d.display_order));
      setStartsAt(isoToLocal(d.starts_at));
      setEndsAt(isoToLocal(d.ends_at));
      setIsActive(d.is_active);
      setSelected(d.items.map((it) => ({
        id: it.product_id, name: it.name, brand_name: it.brand_name,
        price_from: it.price_from, main_image_url: it.main_image_url, sold_out: it.sold_out,
      })));
    } catch {
      setLoadError("네트워크 연결을 확인해 주세요.");
    } finally {
      setLoading(false);
    }
  }, [featureId, router]);

  useEffect(() => {
    void (async () => { await loadFeature(); })();
  }, [loadFeature]);

  // 카테고리 목록 (후보 필터용) — 실패해도 전체 조회는 가능하므로 조용히 무시
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/products/categories");
        if (res.ok) {
          const data = await res.json();
          setCategories(Array.isArray(data) ? data : []);
        }
      } catch { /* 필터 없이 진행 */ }
    })();
  }, []);

  // 후보 상품 로드
  const loadCandidates = useCallback(async (cat: string, page: number) => {
    setCandLoading(true);
    setCandError(null);
    try {
      const sp = new URLSearchParams({ page: String(page) });
      if (cat) sp.set("category", cat);
      const res = await fetch(`/api/products?${sp.toString()}`);
      if (!res.ok) return void setCandError("상품 목록을 불러오지 못했습니다.");
      const data = await res.json();
      setCandidates(data.items ?? []);
      setCandTotal(data.total ?? 0);
    } catch {
      setCandError("네트워크 연결을 확인해 주세요.");
    } finally {
      setCandLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => { await loadCandidates(category, candPage); })();
  }, [category, candPage, loadCandidates]);

  function addProduct(p: Product) {
    setSelected((prev) => (prev.some((s) => s.id === p.id) ? prev : [...prev, p]));
  }
  function removeProduct(id: string) {
    setSelected((prev) => prev.filter((s) => s.id !== id));
  }
  function moveSelected(idx: number, dir: -1 | 1) {
    setSelected((prev) => {
      const next = [...prev];
      const t = idx + dir;
      if (t < 0 || t >= next.length) return prev;
      [next[idx], next[t]] = [next[t], next[idx]];
      return next;
    });
  }

  async function submit() {
    if (submitting) return;
    setError(null);
    const t = title.trim();
    if (t.length < 1 || t.length > 120) return void setError("제목은 1~120자로 입력해 주세요.");
    const order = Number(displayOrder);
    if (!Number.isInteger(order) || order < 0) return void setError("노출 순서는 0 이상의 정수로 입력해 주세요.");
    if (startsAt && endsAt && localToIso(endsAt)! <= localToIso(startsAt)!) {
      return void setError("노출 종료가 시작보다 빠를 수 없습니다.");
    }

    const body = {
      kind, layout, title: t,
      issue_no: issueNo.trim() || null,
      issue_label: issueLabel.trim() || null,
      lead_text: leadText.trim() || null,
      image_path: imagePath.trim() || null,
      display_order: order,
      starts_at: localToIso(startsAt),
      ends_at: localToIso(endsAt),
      is_active: isActive,
      product_ids: selected.map((p) => p.id),
    };

    setSubmitting(true);
    try {
      const res = await fetch(isEdit ? `/api/admin/home/${featureId}` : "/api/admin/home", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 401) return void router.replace("/login");
      if (res.status === 403) return void router.replace("/no-role");
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        // 없는 product_id(400)·중복(422)·필드 검증 등 상류 봉투 메시지를 그대로 노출
        setError(data?.details?.[0]?.reason ?? data?.message ?? "저장에 실패했습니다.");
        return;
      }
      router.push("/admin/home");
    } catch {
      setError("네트워크 연결을 확인해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  const candLastPage = Math.max(1, Math.ceil(candTotal / 20));

  if (loading) {
    return <main className="page_admin_home"><p className="p_empty" role="status">불러오는 중…</p></main>;
  }
  if (loadError) {
    return (
      <main className="page_admin_home">
        <div className="alert m_inline m_danger" role="alert">{loadError}</div>
        <nav className="p_tabs"><Link className="btn m_small m_ghost" href="/admin/home">← 편성 목록</Link></nav>
      </main>
    );
  }

  return (
    <main className="page_admin_home">
      <header className="p_head">
        <h1 className="p_title">{isEdit ? "편성 수정" : "새 편성"}</h1>
        <div className="p_head_actions">
          <Link className="btn m_small m_ghost" href="/admin/home">← 편성 목록</Link>
          <LogoutButton />
        </div>
      </header>
      {error && <div className="alert m_inline m_danger" role="alert">{error}</div>}
      <form className="p_form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <fieldset className="card p_fieldset">
          <legend className="p_legend">기본 정보</legend>
          <div className="i_grid">
            <label className="i_field">
              <span className="i_label">구분 <span className="i_req">*</span></span>
              <select className="input_text m_select" value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
                <option value="hero">히어로 (홈 최상단 대표)</option>
                <option value="slot">슬롯 (일반 편성)</option>
              </select>
            </label>
            <label className="i_field">
              <span className="i_label">레이아웃 <span className="i_req">*</span></span>
              <select className="input_text m_select" value={layout} onChange={(e) => setLayout(e.target.value as Layout)}>
                <option value="feature">피처 (큰 카드)</option>
                <option value="strip">스트립 (가로 나열)</option>
              </select>
            </label>
          </div>
          <label className="i_field">
            <span className="i_label">제목 <span className="i_req">*</span></span>
            <input className="input_text" type="text" maxLength={120} value={title}
              placeholder="예: 이번 주 슬러 픽" onChange={(e) => setTitle(e.target.value)} />
          </label>
          <div className="i_grid">
            <label className="i_field">
              <span className="i_label">이슈 라벨</span>
              <input className="input_text" type="text" maxLength={20} value={issueLabel}
                placeholder="예: VOL." onChange={(e) => setIssueLabel(e.target.value)} />
            </label>
            <label className="i_field">
              <span className="i_label">이슈 번호</span>
              <input className="input_text" type="text" maxLength={20} value={issueNo}
                placeholder="예: 07" onChange={(e) => setIssueNo(e.target.value)} />
            </label>
          </div>
          <label className="i_field">
            <span className="i_label">리드 문구</span>
            <textarea className="input_text" maxLength={5000} value={leadText}
              placeholder="편성 소개 문구 (선택)" onChange={(e) => setLeadText(e.target.value)} />
          </label>
          <label className="i_field">
            <span className="i_label">이미지 경로</span>
            <input className="input_text" type="text" maxLength={300} value={imagePath}
              placeholder="예: home/hero-202607.jpg (업로드는 범위 밖 — 저장소 경로 텍스트)"
              onChange={(e) => setImagePath(e.target.value)} />
            <span className="i_note">이미지 파일 업로드는 이 화면 범위 밖입니다. 스토리지에 올린 파일의 경로를 직접 입력하세요.</span>
          </label>
        </fieldset>

        <fieldset className="card p_fieldset">
          <legend className="p_legend">노출 설정</legend>
          <div className="i_grid">
            <label className="i_field">
              <span className="i_label">노출 시작</span>
              <input className="input_text" type="datetime-local" value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)} />
              <span className="i_note">비워 두면 즉시 노출됩니다 (KST).</span>
            </label>
            <label className="i_field">
              <span className="i_label">노출 종료</span>
              <input className="input_text" type="datetime-local" value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)} />
              <span className="i_note">비워 두면 종료 없이 노출됩니다 (KST).</span>
            </label>
          </div>
          <div className="i_grid">
            <label className="i_field">
              <span className="i_label">노출 순서</span>
              <input className="input_text" type="number" min={0} value={displayOrder}
                onChange={(e) => setDisplayOrder(e.target.value)} />
              <span className="i_note">같은 구분 안에서 작은 값이 먼저 노출됩니다.</span>
            </label>
            <label className="i_field">
              <span className="i_label">활성 여부</span>
              <span className="i_check">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                <span>활성화 (구매자 홈에 노출)</span>
              </span>
            </label>
          </div>
        </fieldset>

        <fieldset className="card p_fieldset">
          <legend className="p_legend">상품 묶음</legend>
          <p className="i_note">후보에서 상품을 골라 오른쪽에 담고 순서를 정합니다. 저장하면 이 목록으로 <strong>편성 품목이 전량 교체</strong>됩니다.</p>
          <div className="p_picker">
            <div className="p_picker_col">
              <div className="i_col_head">
                <span className="i_col_title">후보 상품</span>
                <select className="input_text m_select m_small" aria-label="카테고리 필터" value={category}
                  onChange={(e) => { setCategory(e.target.value); setCandPage(1); }}>
                  <option value="">전체 카테고리</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              {candError && <div className="alert m_inline m_danger" role="alert">{candError}</div>}
              <div className="i_candidates">
                {candLoading ? (
                  <p className="i_note" role="status">불러오는 중…</p>
                ) : candidates.length === 0 ? (
                  <p className="i_note">후보 상품이 없습니다.</p>
                ) : candidates.map((p) => {
                  const picked = selected.some((s) => s.id === p.id);
                  return (
                    <button className="i_product" type="button" key={p.id} disabled={picked}
                      onClick={() => addProduct(p)} title={picked ? "이미 담김" : "추가"}>
                      {p.main_image_url
                        /* eslint-disable-next-line @next/next/no-img-element */
                        ? <img className="i_thumb" src={p.main_image_url} alt="" />
                        : <span className="i_thumb" aria-hidden="true" />}
                      <span className="i_prod_body">
                        <span className="i_prod_name">{p.name}</span>
                        <span className="i_prod_meta">{priceText(p)}{p.sold_out && <span className="i_soldout"> · 품절</span>}</span>
                      </span>
                      <span className="i_prod_actions">{picked ? "담김" : "+"}</span>
                    </button>
                  );
                })}
              </div>
              <div className="i_picker_foot">
                <span className="i_note">총 {candTotal}개</span>
                <div className="i_form_actions">
                  <button className="btn m_small m_ghost" type="button" disabled={candPage <= 1 || candLoading}
                    onClick={() => setCandPage((p) => Math.max(1, p - 1))}>이전</button>
                  <span className="i_note">{candPage} / {candLastPage}</span>
                  <button className="btn m_small m_ghost" type="button" disabled={candPage >= candLastPage || candLoading}
                    onClick={() => setCandPage((p) => p + 1)}>다음</button>
                </div>
              </div>
            </div>
            <div className="p_picker_col">
              <div className="i_col_head">
                <span className="i_col_title">담긴 상품 ({selected.length})</span>
              </div>
              <div className="i_selected">
                {selected.length === 0 ? (
                  <p className="i_note">담긴 상품이 없습니다. 왼쪽에서 골라 담으세요.</p>
                ) : selected.map((p, idx) => (
                  <div className="i_product" key={p.id}>
                    <span className="i_order_num">{idx + 1}</span>
                    {p.main_image_url
                      /* eslint-disable-next-line @next/next/no-img-element */
                      ? <img className="i_thumb" src={p.main_image_url} alt="" />
                      : <span className="i_thumb" aria-hidden="true" />}
                    <span className="i_prod_body">
                      <span className="i_prod_name">{p.name}</span>
                      <span className="i_prod_meta">{priceText(p)}{p.sold_out && <span className="i_soldout"> · 품절</span>}</span>
                    </span>
                    <span className="i_prod_actions">
                      <button className="btn m_small m_ghost" type="button" aria-label="위로"
                        disabled={idx === 0} onClick={() => moveSelected(idx, -1)}>↑</button>
                      <button className="btn m_small m_ghost" type="button" aria-label="아래로"
                        disabled={idx === selected.length - 1} onClick={() => moveSelected(idx, 1)}>↓</button>
                      <button className="btn m_small m_danger" type="button" aria-label="제거"
                        onClick={() => removeProduct(p.id)}>✕</button>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </fieldset>

        <div className="i_form_foot">
          <Link className="btn m_ghost" href="/admin/home">취소</Link>
          <div className="i_form_actions">
            <button className="btn m_primary" type="submit" disabled={submitting}
              data-state={submitting ? "loading" : undefined}>
              {isEdit ? "변경 저장" : "편성 만들기"}
            </button>
          </div>
        </div>
      </form>
    </main>
  );
}
