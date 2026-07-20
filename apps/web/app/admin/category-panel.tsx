"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Category = { id: string; name: string; sort_order: number };

export default function CategoryPanel() {
  const router = useRouter();
  const [items, setItems] = useState<Category[]>([]);
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/admin/categories");
      if (res.status === 401) return void router.replace("/login");
      if (!res.ok) return void setError("목록을 불러오지 못했습니다.");
      setItems(await res.json());
    } catch {
      setError("네트워크 연결을 확인해 주세요.");
    }
  }, [router]);

  // 초기 로드 — 로더 호출을 effect 안에서 선언한 async 함수로 감싼다(React 데이터 페칭 관례).
  // 호출 시점·인자는 그대로라 동작은 동일하다.
  useEffect(() => {
    void (async () => { await load(); })();
  }, [load]);

  async function op(body: Record<string, unknown>): Promise<boolean> {
    setError(null);
    try {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 403) {
        router.replace("/no-role");
        return false;
      }
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => null);
        setError(data?.details?.[0]?.reason ?? data?.message ?? "처리에 실패했습니다.");
        return false;
      }
      await load();
      return true;
    } catch {
      setError("네트워크 연결을 확인해 주세요.");
      return false;
    }
  }

  function move(idx: number, dir: -1 | 1) {
    const next = [...items];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    op({ op: "order", ids: next.map((c) => c.id) });
  }

  return (
    <section className="p_categories">
      {error && <div className="alert m_inline m_danger" role="alert">{error}</div>}
      <form className="i_new" onSubmit={(e) => { e.preventDefault(); if (newName.trim()) { op({ op: "create", name: newName.trim() }); setNewName(""); } }}>
        <input className="input_text" placeholder="새 카테고리 이름 (예: 문구)" maxLength={30}
          value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button className="btn m_primary" type="submit">추가</button>
      </form>
      {items.length === 0 && <p className="p_empty">카테고리가 없습니다 — 첫 카테고리를 만들어 보세요.</p>}
      <ul className="i_list">
        {items.map((c, idx) => (
          <li className="card i_row" key={c.id}>
            {editing === c.id ? (
              <form className="i_edit" onSubmit={async (e) => { e.preventDefault(); if (await op({ op: "rename", id: c.id, name: editName.trim() })) setEditing(null); }}>
                <input className="input_text" value={editName} maxLength={30} onChange={(e) => setEditName(e.target.value)} />
                <button className="btn m_small m_primary" type="submit">저장</button>
                <button className="btn m_small m_ghost" type="button" onClick={() => setEditing(null)}>취소</button>
              </form>
            ) : (
              <>
                <strong className="i_name">{c.name}</strong>
                <div className="i_actions">
                  <button className="btn m_small m_ghost" type="button" onClick={() => move(idx, -1)} aria-label="위로">↑</button>
                  <button className="btn m_small m_ghost" type="button" onClick={() => move(idx, 1)} aria-label="아래로">↓</button>
                  <button className="btn m_small m_ghost" type="button" onClick={() => { setEditing(c.id); setEditName(c.name); }}>이름 수정</button>
                  <button className="btn m_small m_danger" type="button" onClick={() => op({ op: "delete", id: c.id })}>삭제</button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
