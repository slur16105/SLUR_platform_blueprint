"use client";

/* 판매자 상품 수정 — 등록(new)과 같은 카드 구성으로, 등록 후 값을 고치는 경로.
   저장은 성격별로 나뉜 API 3개를 쓴다: 기본 정보·상태=PATCH, 옵션=PUT variants, 이미지=PUT images.
   바뀐 묶음만 보낸다 — 손대지 않은 영역을 덮어써서 남의 변경을 날리지 않게. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

import ConsoleShell from "@/app/(console)/console-shell";
import "../../new/new.css";

type Category = { id: string; name: string };
type ProductImage = { path: string; url: string | null };
type Variant = {
  id: string;
  option1_name: string; option1_value: string;
  option2_name: string; option2_value: string;
  extra_price: number; stock: number; is_active: boolean;
};
type Product = {
  id: string; name: string; base_price: number; description: string;
  status: string; category_id: string; images: ProductImage[]; variants: Variant[];
};

type Row = {
  option1_value: string; option2_value: string;
  extra_price: string; stock: string; is_active: boolean;
};

const STATUS_LABEL: Record<string, string> = { active: "판매중", soldout: "품절", hidden: "숨김" };

export default function EditProductPage() {
  const router = useRouter();
  const productId = String(useParams().id ?? "");

  const [original, setOriginal] = useState<Product | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState("active");
  const [rows, setRows] = useState<Row[]>([]);
  // 이미지는 "지금 목록"을 통째로 들고 있다가 저장 시 통째로 보낸다(서버도 교체 방식)
  const [imagePaths, setImagePaths] = useState<string[]>([]);
  const [newPreviews, setNewPreviews] = useState<Record<string, string>>({}); // path → 방금 올린 파일 미리보기
  const [uploading, setUploading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyProduct = useCallback((p: Product) => {
    setOriginal(p);
    setName(p.name);
    setPrice(String(p.base_price));
    setDescription(p.description);
    setCategoryId(p.category_id);
    setStatus(p.status);
    setImagePaths(p.images.map((i) => i.path));
    setRows(p.variants.map((v) => ({
      option1_value: v.option1_value,
      option2_value: v.option2_value,
      extra_price: String(v.extra_price),
      stock: String(v.stock),
      is_active: v.is_active,
    })));
  }, []);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      // 단건 조회 API가 없어 내 상품 목록에서 고른다 — 남의 상품이면 애초에 목록에 없다
      const [pr, cr] = await Promise.all([
        fetch("/api/sellers/products"),
        fetch("/api/products/categories"),
      ]);
      if (pr.status === 401) return void router.replace("/login");
      if (pr.status === 403) return void router.replace("/no-role");
      if (!pr.ok) return void setLoadError("상품을 불러오지 못했습니다.");
      const list: Product[] = await pr.json();
      const found = list.find((p) => p.id === productId);
      if (!found) return void setLoadError("상품을 찾을 수 없습니다. 목록에서 다시 선택해 주세요.");
      applyProduct(found);
      // 카테고리만 실패해도 알린다 — 조용히 두면 셀렉트가 빈 채로 떠서 카테고리가 사라진 것처럼 보인다
      if (cr.ok) setCategories(await cr.json());
      else setCategoryError("카테고리를 불러오지 못했습니다. 새로고침해 주세요.");
    } catch {
      setLoadError("네트워크 연결을 확인해 주세요.");
    }
  }, [productId, router, applyProduct]);

  useEffect(() => {
    void (async () => { await load(); })();
  }, [load]);

  useEffect(() => () => { if (noticeTimer.current) clearTimeout(noticeTimer.current); }, []);

  function showNotice(msg: string) {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 5000);
  }

  async function addImages(files: FileList | null) {
    if (!files) return;
    setError(null);
    setUploading(true);
    let count = imagePaths.length;
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
        const up = await fetch(data.upload_url, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
        if (!up.ok) {
          setError("이미지 업로드에 실패했습니다.");
          return;
        }
        const path: string = data.path;
        setImagePaths((prev) => [...prev, path]);
        setNewPreviews((prev) => ({ ...prev, [path]: URL.createObjectURL(file) }));
        count += 1;
      }
    } catch {
      setError("네트워크 연결을 확인해 주세요.");
    } finally {
      setUploading(false);
    }
  }

  function imageSrc(path: string) {
    // 방금 올린 건 로컬 미리보기, 기존 건 서버가 준 URL
    return newPreviews[path] ?? original?.images.find((i) => i.path === path)?.url ?? null;
  }

  function moveImageFirst(path: string) {
    setImagePaths((prev) => [path, ...prev.filter((p) => p !== path)]);
  }

  // 어떤 묶음이 바뀌었는지 — 바뀐 것만 저장한다
  const dirty = useMemo(() => {
    if (!original) return { fields: false, images: false, variants: false, any: false };
    const fields =
      name.trim() !== original.name ||
      Number(price) !== original.base_price ||
      description.trim() !== original.description ||
      categoryId !== original.category_id ||
      status !== original.status;
    const images =
      imagePaths.length !== original.images.length ||
      imagePaths.some((p, i) => p !== original.images[i]?.path);
    const variants = rows.some((r, i) => {
      const v = original.variants[i];
      return !v || Number(r.extra_price) !== v.extra_price || Number(r.stock) !== v.stock || r.is_active !== v.is_active;
    });
    return { fields, images, variants, any: fields || images || variants };
  }, [original, name, price, description, categoryId, status, imagePaths, rows]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!original || !dirty.any) return;
    // 숫자 칸을 비운 채 저장하면 Number("")가 0이 되어 가격·재고가 조용히 0으로 바뀐다
    const blank = rows.find((r) => r.extra_price.trim() === "" || r.stock.trim() === "");
    if (blank) {
      setError("추가금액과 재고를 비워둘 수 없습니다. 0을 입력해 주세요.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    // 어디까지 저장됐는지 사용자에게 정확히 말하기 위해 성공한 묶음을 기록한다.
    // 이전에는 실패 문구가 무조건 "다른 변경은 저장됐습니다"라, 저장된 게 없어도 그렇게 떴다.
    const saved: string[] = [];
    const failNotice = (msg: string) =>
      setError(saved.length ? `${msg} (저장된 항목: ${saved.join("·")})` : msg);
    try {
      if (dirty.fields) {
        const res = await fetch("/api/sellers/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            op: "patch", id: original.id,
            name: name.trim(), base_price: Number(price), description: description.trim(),
            category_id: categoryId, status,
          }),
        });
        if (res.status === 401) return void router.replace("/login");
        if (res.status === 403) return void router.replace("/no-role");
        if (!res.ok) {
          const d = await res.json().catch(() => null);
          failNotice(d?.details?.[0]?.reason ?? d?.message ?? "기본 정보 저장에 실패했습니다.");
          await load();  // 화면을 서버 상태로 되돌린다 — 실패한 값이 저장된 것처럼 남지 않게
          return;
        }
        saved.push("기본 정보");
      }
      // 옵션(재고)을 이미지보다 먼저 저장한다 — 재고가 판매에 직접 영향을 주므로
      // 이미지 실패 때문에 재고 변경이 통째로 누락되는 순서를 피한다.
      if (dirty.variants) {
        const res = await fetch("/api/sellers/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            op: "variants", id: original.id,
            // 조합 자체(옵션 값)는 여기서 바꾸지 않는다 — 값·재고·판매여부만 수정
            variants: rows.map((r, i) => ({
              option1_name: original.variants[i]?.option1_name ?? "",
              option1_value: r.option1_value,
              option2_name: original.variants[i]?.option2_name ?? "",
              option2_value: r.option2_value,
              extra_price: Number(r.extra_price) || 0,
              stock: Number(r.stock) || 0,
              is_active: r.is_active,
            })),
          }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => null);
          failNotice(d?.details?.[0]?.reason ?? d?.message ?? "옵션·재고 저장에 실패했습니다.");
          await load();
          return;
        }
        saved.push("옵션·재고");
      }
      if (dirty.images) {
        const res = await fetch("/api/sellers/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ op: "images", id: original.id, image_paths: imagePaths }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => null);
          failNotice(d?.details?.[0]?.reason ?? d?.message ?? "이미지 저장에 실패했습니다.");
          await load();
          return;
        }
        saved.push("이미지");
      }
      showNotice("변경 사항을 저장했습니다.");
      setNewPreviews({});
      await load(); // 서버 값으로 다시 맞춘다 — 저장 후 화면이 실제 상태와 어긋나지 않게
    } catch {
      setError("네트워크 연결을 확인해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <ConsoleShell role="seller" title="상품 수정">
        <div className="page_product_new">
          <div className="alert m_inline m_danger" role="alert">{loadError}</div>
          <div className="p_actions"><Link className="btn" href="/seller/products">상품 관리로</Link></div>
        </div>
      </ConsoleShell>
    );
  }

  if (!original) {
    return (
      <ConsoleShell role="seller" title="상품 수정">
        <div className="page_product_new"><p className="p_desc" role="status">불러오는 중…</p></div>
      </ConsoleShell>
    );
  }

  const hasOptions = original.variants.some((v) => v.option1_value !== "");

  return (
    <ConsoleShell role="seller" title="상품 수정" description={original.name}>
      <form className="page_product_new" onSubmit={save}>
        {notice && <div className="alert m_inline m_success" role="status">{notice}</div>}
        {error && <div className="alert m_inline m_danger" role="alert">{error}</div>}

        <section className="card p_card">
          <h2 className="i_title">기본 정보</h2>
          <div className="i_row2">
            <div className="field">
              <label className="i_label" htmlFor="name">상품명 <span className="i_req">*</span></label>
              <input id="name" className="input_text" maxLength={100} required value={name}
                onChange={(e) => setName(e.target.value)} />
              <span className="i_help">최대 100자</span>
            </div>
            <div className="field">
              <label className="i_label" htmlFor="price">기본 가격 <span className="i_req">*</span></label>
              <input id="price" className="input_text" type="number" min={0} step={1} required value={price}
                onChange={(e) => setPrice(e.target.value)} />
              <span className="i_help">옵션 추가금액이 마이너스인 조합보다 낮게는 내릴 수 없습니다.</span>
            </div>
          </div>
          <div className="i_row2">
            <div className="field">
              <label className="i_label" htmlFor="category">카테고리 <span className="i_req">*</span></label>
              <select id="category" className="input_text" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {categoryError && <span className="i_help">{categoryError}</span>}
            </div>
            <div className="field">
              <label className="i_label" htmlFor="status">판매 상태</label>
              <select id="status" className="input_text" value={status} onChange={(e) => setStatus(e.target.value)}>
                {Object.entries(STATUS_LABEL).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
              </select>
              <span className="i_help">숨김으로 두면 구매자 화면에서 보이지 않습니다.</span>
            </div>
          </div>
        </section>

        <section className="card p_card">
          <h2 className="i_title">이미지 <span className="i_req">*</span></h2>
          <p className="i_desc">맨 앞이 대표 이미지입니다. 대표 포함 최대 11장.</p>
          <div className="field">
            <input className="i_file" type="file" accept="image/jpeg,image/png,image/webp" multiple
              aria-label="이미지 추가" disabled={uploading}
              onChange={(e) => { addImages(e.target.files); e.target.value = ""; }} />
            {uploading && <span className="i_uploading" role="status">업로드 중…</span>}
          </div>
          <ul className="i_previews">
            {imagePaths.map((path, idx) => {
              const src = imageSrc(path);
              return (
                <li key={path} className="i_thumb" data-state={idx === 0 ? "main" : undefined}>
                  {src ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={src} alt={idx === 0 ? "대표 이미지" : `추가 이미지 ${idx}`} />
                  ) : (
                    <span className="i_thumb_empty" aria-hidden="true" />
                  )}
                  <div className="i_thumb_actions">
                    {idx !== 0 && (
                      <button type="button" className="btn m_small" onClick={() => moveImageFirst(path)}>대표로</button>
                    )}
                    <button type="button" className="btn m_small" disabled={imagePaths.length <= 1}
                      title={imagePaths.length <= 1 ? "이미지는 최소 1장 필요합니다" : undefined}
                      onClick={() => setImagePaths((p) => p.filter((x) => x !== path))}>제거</button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card p_card">
          <h2 className="i_title">상세 설명 <span className="i_req">*</span></h2>
          <div className="field">
            <textarea className="input_text m_textarea" rows={6} maxLength={5000} required aria-label="상세 설명"
              value={description} onChange={(e) => setDescription(e.target.value)} />
            <span className="i_help">최대 5,000자</span>
          </div>
        </section>

        <section className="card p_card">
          <h2 className="i_title">{hasOptions ? "옵션 · 재고" : "재고"}</h2>
          <p className="i_desc">
            {hasOptions
              ? "조합별 추가금액·재고·판매 여부를 수정합니다. 조합 자체(옵션 값)를 바꾸려면 상품을 새로 등록해 주세요."
              : "옵션이 없는 상품입니다. 재고 수량만 수정합니다."}
          </p>
          <table className="i_grid">
            <thead>
              <tr>
                {hasOptions && <th>{original.variants[0]?.option1_name || "옵션1"}</th>}
                {hasOptions && original.variants.some((v) => v.option2_value) && <th>{original.variants[0]?.option2_name || "옵션2"}</th>}
                <th className="m_num">추가금액</th>
                <th className="m_num">재고</th>
                <th>판매 여부</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={original.variants[i]?.id ?? i}>
                  {hasOptions && <td>{r.option1_value || "-"}</td>}
                  {hasOptions && original.variants.some((v) => v.option2_value) && <td>{r.option2_value || "-"}</td>}
                  <td className="m_num">
                    <input className="input_text m_small" type="number" step={1} value={r.extra_price}
                      aria-label={`${r.option1_value || "기본"} 추가금액`}
                      onChange={(e) => setRows((p) => p.map((x, j) => j === i ? { ...x, extra_price: e.target.value } : x))} />
                  </td>
                  <td className="m_num">
                    <input className="input_text m_small" type="number" min={0} step={1} value={r.stock}
                      aria-label={`${r.option1_value || "기본"} 재고`}
                      onChange={(e) => setRows((p) => p.map((x, j) => j === i ? { ...x, stock: e.target.value } : x))} />
                  </td>
                  <td>
                    <input type="checkbox" checked={r.is_active}
                      aria-label={`${r.option1_value || "기본"} 판매 여부`}
                      onChange={(e) => setRows((p) => p.map((x, j) => j === i ? { ...x, is_active: e.target.checked } : x))} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <div className="p_actions">
          <button className="btn m_primary m_large" type="submit" disabled={busy || uploading || !dirty.any}
            data-state={busy ? "loading" : undefined}>저장</button>
          <Link className="btn m_large" href="/seller/products">목록으로</Link>
          {!dirty.any && <span className="i_hint">바뀐 내용이 없습니다.</span>}
        </div>
      </form>
    </ConsoleShell>
  );
}
