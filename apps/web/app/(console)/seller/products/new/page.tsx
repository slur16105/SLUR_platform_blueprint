"use client";

/* 판매자 상품 등록 — 시안(seller-product-new)처럼 성격별 카드로 나눈 폼.
   배송비·판매 상태는 상품별로 정하지 않는다(배송비=판매자 단위 설정, 상태=등록 즉시 판매중,
   FR-8). 시안엔 상품별 입력이 있으나 SLUR 구조와 맞지 않아 안내 카드로 대체했다. */

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

import ConsoleShell from "@/app/(console)/console-shell";
import "./new.css";

type Category = { id: string; name: string };
type Uploaded = { path: string; preview: string };
type Row = { option1_value: string; option2_value: string; extra_price: string; stock: string; is_active: boolean };

export default function NewProductPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [images, setImages] = useState<Uploaded[]>([]);
  const [uploading, setUploading] = useState(false);
  const [useOptions, setUseOptions] = useState(false);
  const [stock, setStock] = useState("0");
  const [axis1, setAxis1] = useState({ name: "", values: "" });
  const [axis2, setAxis2] = useState({ name: "", values: "" });
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null); // variants 실패 후 재시도 시 POST 중복 방지

  useEffect(() => {
    // 공개 카테고리 목록 — 판매자 화면이 관리자 전용 경로를 호출하지 않게 한다
    fetch("/api/products/categories").then(async (r) => {
      if (!r.ok) return void setCategoryError("카테고리를 불러오지 못했습니다. 새로고침해 주세요.");
      const list = await r.json();
      setCategories(list);
      if (list[0]) setCategoryId(list[0].id);
    }).catch(() => setCategoryError("네트워크 연결을 확인해 주세요."));
  }, []);

  async function addImages(files: FileList | null) {
    if (!files) return;
    setError(null);
    setUploading(true);
    let count = images.length;  // stale closure 방지 — 로컬 카운터
    try {
      for (const file of Array.from(files)) {
        if (count >= 11) {
          setError("이미지는 대표 1장 포함 최대 11장까지입니다.");
          return;
        }
        const pre = await fetch("/api/sellers/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ op: "presign", content_type: file.type }),
        });
        if (pre.status === 401) return void router.replace("/login");
        const data = await pre.json();
        if (!pre.ok) {
          setError(data.message ?? "이미지 업로드 준비에 실패했습니다.");
          return;
        }
        const up = await fetch(data.upload_url, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!up.ok) {
          setError("이미지 업로드에 실패했습니다.");
          return;
        }
        setImages((prev) => [...prev, { path: data.path, preview: URL.createObjectURL(file) }]);
        count += 1;
      }
    } catch {
      setError("네트워크 연결을 확인해 주세요.");
    } finally {
      setUploading(false);
    }
  }

  function buildRows() {
    const v1 = [...new Set(axis1.values.split(",").map((v) => v.trim()).filter(Boolean))];
    const v2 = [...new Set(axis2.values.split(",").map((v) => v.trim()).filter(Boolean))];
    if (v1.length === 0) return void setError("옵션 1의 값을 콤마로 구분해 입력해 주세요.");
    const combos = v2.length > 0 ? v1.flatMap((a) => v2.map((b) => [a, b] as const)) : v1.map((a) => [a, ""] as const);
    if (combos.length > 100) return void setError("옵션 조합은 최대 100개까지입니다.");
    setError(null);
    setRows(combos.map(([a, b]) => ({ option1_value: a, option2_value: b, extra_price: "0", stock: "0", is_active: true })));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      let productId = createdId;
      if (!productId) {
        const res = await fetch("/api/sellers/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            base_price: Number(price),
            description: description.trim(),
            category_id: categoryId,
            image_paths: images.map((i) => i.path),
            stock: useOptions ? 0 : Number(stock),
          }),
        });
        const data = await res.json();
        if (res.status === 401) return void router.replace("/login");
        if (!res.ok) {
          setError(data.details?.[0]?.reason ?? data.message ?? "등록에 실패했습니다.");
          return;
        }
        productId = data.id as string;
        setCreatedId(productId);
      }
      if (useOptions && rows.length > 0) {
        const vr = await fetch("/api/sellers/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            op: "variants",
            id: productId,
            variants: rows.map((r) => ({
              option1_name: axis1.name.trim(), option1_value: r.option1_value,
              option2_name: r.option2_value ? axis2.name.trim() : "", option2_value: r.option2_value,
              extra_price: Number(r.extra_price) || 0, stock: Number(r.stock) || 0, is_active: r.is_active,
            })),
          }),
        });
        if (!vr.ok) {
          const vd = await vr.json().catch(() => null);
          setError(vd?.details?.[0]?.reason ?? vd?.message ?? "옵션 저장에 실패했습니다. 상품은 등록되어 있습니다.");
          return;
        }
      }
      setDone(true);
    } catch {
      setError("네트워크 연결을 확인해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <ConsoleShell role="seller" title="상품 등록">
        <div className="page_product_new">
          <section className="card p_done">
            <h2 className="p_title">상품이 등록됐습니다</h2>
            <p className="p_desc">
              바로 구매자에게 보이는 <strong>판매중</strong> 상태입니다.
              품절 처리·숨기기는 상품 관리에서 할 수 있습니다.
            </p>
            <div className="i_links">
              <Link className="btn m_primary" href="/seller/products">상품 관리로</Link>
              <a className="btn" href="/seller/products/new">상품 하나 더 등록</a>
            </div>
          </section>
        </div>
      </ConsoleShell>
    );
  }

  // 등록 버튼을 못 누르는 이유를 먼저 말해준다 (비활성 버튼만 두면 왜인지 모른다)
  const blockedReason = uploading
    ? "이미지를 업로드하는 중입니다."
    : images.length === 0
      ? "상품 이미지를 1장 이상 올려 주세요."
      : useOptions && rows.length === 0
        ? "‘조합 만들기’로 옵션 표를 만든 뒤 등록할 수 있습니다."
        : null;

  return (
    <ConsoleShell role="seller" title="상품 등록" description="등록하면 바로 구매자에게 보입니다.">
      <form className="page_product_new" onSubmit={submit}>
        {error && <div className="alert m_inline m_danger" role="alert">{error}</div>}

        <section className="card p_card">
          <h2 className="i_title">기본 정보</h2>
          <div className="i_row2">
            <div className="field">
              <label className="i_label" htmlFor="name">상품명 <span className="i_req">*</span></label>
              <input id="name" className="input_text" maxLength={100} required value={name}
                placeholder="예: 인센스 홀더 · 그레이" onChange={(e) => setName(e.target.value)} />
              <span className="i_help">최대 100자</span>
            </div>
            <div className="field">
              <label className="i_label" htmlFor="price">기본 가격 <span className="i_req">*</span></label>
              <input id="price" className="input_text" type="number" min={0} step={1} required value={price}
                onChange={(e) => setPrice(e.target.value)} />
              <span className="i_help">원 단위 정수. 옵션별 추가금액은 아래에서 설정합니다.</span>
            </div>
          </div>
          <div className="field">
            <label className="i_label" htmlFor="category">카테고리 <span className="i_req">*</span></label>
            <select id="category" className="input_text" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {categoryError && <span className="i_help">{categoryError}</span>}
          </div>
        </section>

        <section className="card p_card">
          <h2 className="i_title">이미지 <span className="i_req">*</span></h2>
          <p className="i_desc">첫 번째 장이 대표 이미지가 됩니다. 대표 포함 최대 11장, JPG·PNG·WebP.</p>
          <div className="field">
            <input className="i_file" type="file" accept="image/jpeg,image/png,image/webp" multiple
              aria-label="상품 이미지 선택" disabled={uploading}
              onChange={(e) => { addImages(e.target.files); e.target.value = ""; }} />
            {uploading && <span className="i_uploading" role="status">업로드 중…</span>}
          </div>
          {images.length > 0 && (
            <ul className="i_previews">
              {images.map((img, idx) => (
                <li key={img.path} className="i_thumb" data-state={idx === 0 ? "main" : undefined}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.preview} alt={idx === 0 ? "대표 이미지" : `추가 이미지 ${idx}`} />
                  <button type="button" className="btn m_small" onClick={() => setImages((p) => p.filter((_, i) => i !== idx))}>제거</button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p_card">
          <h2 className="i_title">상세 설명 <span className="i_req">*</span></h2>
          <div className="field">
            <textarea id="description" className="input_text m_textarea" rows={6} maxLength={5000} required
              aria-label="상세 설명"
              placeholder="소재, 크기, 사용법, 브랜드 스토리 등을 적어 주세요."
              value={description} onChange={(e) => setDescription(e.target.value)} />
            <span className="i_help">최대 5,000자</span>
          </div>
        </section>

        <section className="card p_card">
          <h2 className="i_title">옵션 · 재고</h2>
          <div className="field">
            <label className="i_label">
              <input type="checkbox" checked={useOptions} onChange={(e) => { setUseOptions(e.target.checked); setRows([]); }} /> 옵션 사용 (색상·사이즈 등)
            </label>
          </div>
          {!useOptions && (
            <div className="field">
              <label className="i_label" htmlFor="stock">재고 수량</label>
              <input id="stock" className="input_text" type="number" min={0} step={1} value={stock} onChange={(e) => setStock(e.target.value)} />
              <span className="i_help">판매 가능 수량. 0이면 품절로 표시됩니다.</span>
            </div>
          )}
          {useOptions && (
            <div className="p_options">
              <p className="i_help">옵션 값을 콤마(,)로 구분해 입력한 뒤 &lsquo;조합 만들기&rsquo;를 누르면 아래 표에서 조합별 추가금액·재고를 설정할 수 있습니다. (조합 최대 100개)</p>
              <div className="i_axes">
                <input className="input_text" placeholder="옵션 1 이름 (예: 색상)" maxLength={20} value={axis1.name} onChange={(e) => setAxis1((a) => ({ ...a, name: e.target.value }))} />
                <input className="input_text" placeholder="값 (콤마 구분: 블랙,화이트)" maxLength={200} value={axis1.values} onChange={(e) => setAxis1((a) => ({ ...a, values: e.target.value }))} />
                <input className="input_text" placeholder="옵션 2 이름 (선택)" maxLength={20} value={axis2.name} onChange={(e) => setAxis2((a) => ({ ...a, name: e.target.value }))} />
                <input className="input_text" placeholder="값 (콤마 구분: S,M,L)" maxLength={200} value={axis2.values} onChange={(e) => setAxis2((a) => ({ ...a, values: e.target.value }))} />
                <button className="btn" type="button" onClick={buildRows}>조합 만들기</button>
              </div>
              {rows.length > 0 && (
                <table className="i_grid">
                  <thead>
                    <tr><th>{axis1.name.trim() || "옵션1"}</th>{axis2.values.trim() && <th>{axis2.name.trim() || "옵션2"}</th>}<th className="m_num">추가금액</th><th className="m_num">재고</th><th>판매 여부</th></tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={`${r.option1_value}|${r.option2_value}`}>
                        <td>{r.option1_value}</td>
                        {axis2.values.trim() && <td>{r.option2_value}</td>}
                        <td className="m_num"><input className="input_text m_small" type="number" step={1} value={r.extra_price}
                          aria-label={`${r.option1_value} 추가금액`}
                          onChange={(e) => setRows((p) => p.map((x, j) => j === i ? { ...x, extra_price: e.target.value } : x))} /></td>
                        <td className="m_num"><input className="input_text m_small" type="number" min={0} step={1} value={r.stock}
                          aria-label={`${r.option1_value} 재고`}
                          onChange={(e) => setRows((p) => p.map((x, j) => j === i ? { ...x, stock: e.target.value } : x))} /></td>
                        <td><input type="checkbox" checked={r.is_active}
                          aria-label={`${r.option1_value} 판매 여부`}
                          onChange={(e) => setRows((p) => p.map((x, j) => j === i ? { ...x, is_active: e.target.checked } : x))} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </section>

        {/* 판매자가 이 화면에서 찾을 법하지만 상품별로 정하지 않는 것 */}
        <section className="card p_card">
          <h2 className="i_title">여기서 정하지 않는 것</h2>
          <dl className="i_elsewhere">
            <div>
              <dt>배송비 · 도서산간 추가비</dt>
              <dd>상품별이 아니라 내 브랜드 전체에 적용됩니다. <Link href="/seller/settings">설정</Link>에서 정합니다.</dd>
            </div>
            <div>
              <dt>판매 상태</dt>
              <dd>등록하면 바로 판매중입니다. 품절 처리·숨기기는 <Link href="/seller/products">상품 관리</Link>에서 합니다.</dd>
            </div>
          </dl>
        </section>

        <div className="p_actions">
          <button className="btn m_primary m_large" type="submit" disabled={busy || blockedReason !== null}
            data-state={busy ? "loading" : undefined}>등록하기</button>
          <Link className="btn m_large" href="/seller/products">취소</Link>
          {blockedReason && <span className="i_hint">{blockedReason}</span>}
        </div>
      </form>
    </ConsoleShell>
  );
}
