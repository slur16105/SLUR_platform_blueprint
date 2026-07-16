"use client";

import { useEffect, useState } from "react";

import "./new.css";

type Category = { id: string; name: string };
type Uploaded = { path: string; preview: string };
type Row = { option1_value: string; option2_value: string; extra_price: string; stock: string; is_active: boolean };

export default function NewProductPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [images, setImages] = useState<Uploaded[]>([]);
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
    fetch("/api/admin/categories").then(async (r) => {
      if (r.ok) {
        const list = await r.json();
        setCategories(list);
        if (list[0]) setCategoryId(list[0].id);
      }
    }).catch(() => {});
  }, []);

  async function addImages(files: FileList | null) {
    if (!files) return;
    setError(null);
    let count = images.length;  // stale closure 방지 — 로컬 카운터
    for (const file of Array.from(files)) {
      if (count >= 11) {
        setError("이미지는 대표 1장 포함 최대 11장까지입니다.");
        return;
      }
      try {
        const pre = await fetch("/api/sellers/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ op: "presign", content_type: file.type }),
        });
        if (pre.status === 401) return void (window.location.href = "/login");
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
      } catch {
        setError("네트워크 연결을 확인해 주세요.");
        return;
      }
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
        if (res.status === 401) return void (window.location.href = "/login");
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
      <main className="page_product_new">
        <div className="card p_panel">
          <h1 className="p_title">상품이 등록됐습니다</h1>
          <p className="p_desc">즉시 노출 상태입니다. 옵션·재고 관리 기능은 곧 추가됩니다.</p>
          <a className="btn m_primary" href="/seller">판매자 센터로</a>
        </div>
      </main>
    );
  }

  return (
    <main className="page_product_new">
      <form className="card p_panel" onSubmit={submit}>
        <h1 className="p_title">상품 등록</h1>
        {error && <div className="alert m_inline m_danger" role="alert">{error}</div>}
        <div className="field">
          <label className="i_label" htmlFor="name">상품명</label>
          <input id="name" className="input_text" maxLength={100} required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label className="i_label" htmlFor="price">기본 가격 (원)</label>
          <input id="price" className="input_text" type="number" min={0} step={1} required value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <div className="field">
          <label className="i_label" htmlFor="category">카테고리</label>
          <select id="category" className="input_text" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="i_label" htmlFor="description">상세 설명</label>
          <textarea id="description" className="input_text m_textarea" rows={6} maxLength={5000} required
            value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="field">
          <span className="i_label">이미지 (첫 장이 대표, 최대 11장)</span>
          <input className="i_file" type="file" accept="image/jpeg,image/png,image/webp" multiple
            onChange={(e) => { addImages(e.target.files); e.target.value = ""; }} />
          {images.length > 0 && (
            <ul className="i_previews">
              {images.map((img, idx) => (
                <li key={img.path} className="i_thumb" data-state={idx === 0 ? "main" : undefined}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.preview} alt={idx === 0 ? "대표 이미지" : `추가 이미지 ${idx}`} />
                  <button type="button" className="btn m_small m_ghost" onClick={() => setImages((p) => p.filter((_, i) => i !== idx))}>제거</button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="field">
          <label className="i_label">
            <input type="checkbox" checked={useOptions} onChange={(e) => { setUseOptions(e.target.checked); setRows([]); }} /> 옵션 사용 (색상·사이즈 등)
          </label>
        </div>
        {!useOptions && (
          <div className="field">
            <label className="i_label" htmlFor="stock">재고 수량</label>
            <input id="stock" className="input_text" type="number" min={0} step={1} value={stock} onChange={(e) => setStock(e.target.value)} />
          </div>
        )}
        {useOptions && (
          <div className="p_options">
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
                  <tr><th>{axis1.name.trim() || "옵션1"}</th>{axis2.values.trim() && <th>{axis2.name.trim() || "옵션2"}</th>}<th>추가금액</th><th>재고</th><th>판매</th></tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={`${r.option1_value}|${r.option2_value}`}>
                      <td>{r.option1_value}</td>
                      {axis2.values.trim() && <td>{r.option2_value}</td>}
                      <td><input className="input_text m_small" type="number" step={1} value={r.extra_price}
                        onChange={(e) => setRows((p) => p.map((x, j) => j === i ? { ...x, extra_price: e.target.value } : x))} /></td>
                      <td><input className="input_text m_small" type="number" min={0} step={1} value={r.stock}
                        onChange={(e) => setRows((p) => p.map((x, j) => j === i ? { ...x, stock: e.target.value } : x))} /></td>
                      <td><input type="checkbox" checked={r.is_active}
                        onChange={(e) => setRows((p) => p.map((x, j) => j === i ? { ...x, is_active: e.target.checked } : x))} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
        <button className="btn m_primary m_large" type="submit" disabled={busy || images.length === 0 || (useOptions && rows.length === 0)}>등록하기</button>
      </form>
    </main>
  );
}
