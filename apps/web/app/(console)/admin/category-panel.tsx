"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import ConfirmModal from "@/app/(console)/confirm-modal";
import "./category-panel.css";

type Category = { id: string; name: string; sort_order: number; product_count: number };

const GripIcon = (
  <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
    <circle cx="6" cy="4" r="1.2" /><circle cx="10" cy="4" r="1.2" />
    <circle cx="6" cy="8" r="1.2" /><circle cx="10" cy="8" r="1.2" />
    <circle cx="6" cy="12" r="1.2" /><circle cx="10" cy="12" r="1.2" />
  </svg>
);

export default function CategoryPanel() {
  const router = useRouter();
  const [items, setItems] = useState<Category[]>([]);
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); // 순서 저장 중 — 연타로 순서가 엇갈리는 것 방지
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);
  // 순서 이동 후 같은 버튼에 포커스를 되돌린다 — 키보드로 여러 칸 옮길 때 매번 탭 이동하지 않게
  const refocus = useRef<{ id: string; dir: -1 | 1 } | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/admin/categories?counts=1");
      if (res.status === 401) return void router.replace("/login");
      if (res.status === 403) return void router.replace("/no-role");
      if (!res.ok) return void setError("목록을 불러오지 못했습니다.");
      setItems(await res.json());
    } catch {
      setError("네트워크 연결을 확인해 주세요.");
    }
  }, [router]);

  // 초기 로드 — 로더 호출을 effect 안에서 선언한 async 함수로 감싼다(React 데이터 페칭 관례).
  useEffect(() => {
    void (async () => { await load(); })();
  }, [load]);

  // 순서 저장 후 눌렀던 방향 버튼으로 포커스 복원 (행이 이동해 DOM이 다시 그려진 뒤)
  useEffect(() => {
    if (busy || !refocus.current) return;
    const { id, dir } = refocus.current;
    refocus.current = null;
    document.querySelector<HTMLButtonElement>(`[data-move="${dir === -1 ? "up" : "down"}-${id}"]`)?.focus();
  }, [busy, items]);

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

  /** 순서 저장 — 화면을 먼저 새 순서로 바꿔 보여주고(낙관적) 서버에 전체 순서를 보낸다. */
  async function saveOrder(next: Category[]) {
    if (busy) return;
    setBusy(true);
    setItems(next); // 드래그를 놓은 즉시 결과가 보이게 — 실패하면 load()가 서버 순서로 되돌린다
    await op({ op: "order", ids: next.map((c) => c.id) });
    setBusy(false);
  }

  function move(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[idx], next[target]] = [next[target], next[idx]];
    refocus.current = { id: items[idx].id, dir };
    void saveOrder(next);
  }

  /** 끌어온 항목을 대상 위치에 끼워 넣는다(자리 교환이 아니라 삽입 — 여러 칸 이동이 한 번에 끝난다). */
  function dropOn(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const from = items.findIndex((c) => c.id === dragId);
    const to = items.findIndex((c) => c.id === targetId);
    if (from < 0 || to < 0) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    void saveOrder(next);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    const ok = await op({ op: "delete", id: pendingDelete.id });
    setDeleting(false);
    if (ok) setPendingDelete(null);
  }

  const canReorder = items.length > 1;

  return (
    <section className="p_categories">
      <p className="i_hint">
        이 순서가 <strong>구매자 상품목록의 필터 탭 순서</strong>입니다. 손잡이를 끌어 옮기거나 ↑↓ 버튼으로 바꿉니다 —
        바꾸는 즉시 저장됩니다.
      </p>
      {error && <div className="alert m_inline m_danger" role="alert">{error}</div>}
      <form className="i_new" onSubmit={(e) => { e.preventDefault(); if (newName.trim()) { op({ op: "create", name: newName.trim() }); setNewName(""); } }}>
        <input className="input_text" placeholder="새 카테고리 이름 (예: 문구)" maxLength={30}
          value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button className="btn m_primary" type="submit">추가</button>
      </form>
      {items.length === 0 && <p className="p_empty">카테고리가 없습니다 — 첫 카테고리를 만들어 보세요.</p>}
      <ul className="i_list">
        {items.map((c, idx) => (
          <li
            className="card i_row"
            key={c.id}
            draggable={canReorder && !busy && editing === null}
            data-dragging={dragId === c.id ? "" : undefined}
            data-over={overId === c.id && dragId !== null && dragId !== c.id ? "" : undefined}
            onDragStart={(e) => { setDragId(c.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", c.id); }}
            onDragOver={(e) => { if (dragId && dragId !== c.id) { e.preventDefault(); if (overId !== c.id) setOverId(c.id); } }}
            onDrop={(e) => { e.preventDefault(); dropOn(c.id); setDragId(null); setOverId(null); }}
            onDragEnd={() => { setDragId(null); setOverId(null); }}
          >
            {editing === c.id ? (
              <form className="i_edit" onSubmit={async (e) => { e.preventDefault(); if (await op({ op: "rename", id: c.id, name: editName.trim() })) setEditing(null); }}>
                <input className="input_text m_small" value={editName} maxLength={30} onChange={(e) => setEditName(e.target.value)} />
                <button className="btn m_small m_primary" type="submit">저장</button>
                <button className="btn m_small" type="button" onClick={() => setEditing(null)}>취소</button>
              </form>
            ) : (
              <>
                <span className="i_grip" data-state={canReorder ? undefined : "disabled"}
                  title={canReorder ? "끌어서 순서 변경" : "카테고리가 하나뿐이라 순서를 바꿀 수 없습니다"}>
                  {GripIcon}
                </span>
                <strong className="i_name">{c.name}</strong>
                <span className="i_count">상품 {c.product_count.toLocaleString()}개</span>
                <div className="i_actions">
                  {/* 드래그가 어려운 환경·키보드 사용자를 위한 대체 경로 — 드래그와 같은 결과 */}
                  <button className="btn m_small m_move" type="button" data-move={`up-${c.id}`}
                    disabled={busy || idx === 0} onClick={() => move(idx, -1)} aria-label={`${c.name} 위로`}>↑</button>
                  <button className="btn m_small m_move" type="button" data-move={`down-${c.id}`}
                    disabled={busy || idx === items.length - 1} onClick={() => move(idx, 1)} aria-label={`${c.name} 아래로`}>↓</button>
                  <button className="btn m_small" type="button"
                    onClick={() => { setEditing(c.id); setEditName(c.name); }}>이름 수정</button>
                  {/* 소속 상품이 있으면 서버가 삭제를 거부한다(FK RESTRICT) — 누르게 해두고 실패를 보여주지 않는다 */}
                  <button className="btn m_small m_danger" type="button" disabled={c.product_count > 0}
                    title={c.product_count > 0
                      ? `상품 ${c.product_count.toLocaleString()}개가 속해 있어 삭제할 수 없습니다`
                      : undefined}
                    onClick={() => setPendingDelete(c)}>삭제</button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
      <ConfirmModal
        open={pendingDelete !== null}
        title="카테고리 삭제"
        danger
        confirmLabel="삭제"
        submitting={deleting}
        message={
          pendingDelete === null ? "" : (
            <>
              <strong>{pendingDelete.name}</strong>을 삭제합니다. 구매자 상품목록의 필터 탭에서도 사라집니다.
              되돌릴 수 없습니다.
            </>
          )
        }
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </section>
  );
}
