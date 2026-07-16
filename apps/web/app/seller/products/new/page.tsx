"use client";

import { useEffect, useState } from "react";

import "./new.css";

type Category = { id: string; name: string };
type Uploaded = { path: string; preview: string };

export default function NewProductPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [images, setImages] = useState<Uploaded[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

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
    for (const file of Array.from(files)) {
      if (images.length >= 11) {
        setError("이미지는 대표 1장 포함 최대 11장까지입니다.");
        return;
      }
      try {
        const pre = await fetch("/api/sellers/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ op: "presign", content_type: file.type }),
        });
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
      } catch {
        setError("네트워크 연결을 확인해 주세요.");
        return;
      }
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/sellers/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          base_price: Number(price),
          description: description.trim(),
          category_id: categoryId,
          image_paths: images.map((i) => i.path),
        }),
      });
      const data = await res.json();
      if (res.status === 401) return void (window.location.href = "/login");
      if (!res.ok) {
        setError(data.details?.[0]?.reason ?? data.message ?? "등록에 실패했습니다.");
        return;
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
        <button className="btn m_primary m_large" type="submit" disabled={busy || images.length === 0}>등록하기</button>
      </form>
    </main>
  );
}
