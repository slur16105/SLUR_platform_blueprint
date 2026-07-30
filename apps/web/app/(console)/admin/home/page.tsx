"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import ConsoleShell from "@/app/(console)/console-shell";
import ConfirmModal from "@/app/(console)/confirm-modal";
import "./home.css";

type Feature = {
  id: string;
  kind: "hero" | "slot";
  title: string;
  issue_no: string | null;
  issue_label: string | null;
  layout: "feature" | "strip";
  display_order: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  display_state: DisplayState; // 서버 파생 — 토글(is_active)과 노출 기간을 합친 실제 노출 상태
  item_count: number;
  updated_at: string;
};

type DisplayState = "live" | "scheduled" | "ended" | "off";

function formatDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Seoul" });
}

const KIND_LABEL: Record<string, string> = { hero: "히어로", slot: "슬롯" };
const LAYOUT_LABEL: Record<string, string> = { feature: "피처", strip: "스트립" };
// 구분 배지 색 — 행 호버색(--color-surface-hover)과 겹치지 않도록 색을 준다.
const KIND_BADGE: Record<string, string> = { hero: "badge m_small m_brand", slot: "badge m_small m_outline" };

// 실제 노출 상태 — 토글을 켜도 노출 기간 밖이면 구매자 홈에 안 나온다. 그 차이를 화면에서 말해준다.
const STATE_LABEL: Record<DisplayState, string> = {
  live: "노출중", scheduled: "예약", ended: "종료", off: "비노출",
};
const STATE_BADGE: Record<DisplayState, string> = {
  live: "badge m_small m_success", scheduled: "badge m_small m_warning",
  ended: "badge m_small", off: "badge m_small",
};
const STATE_HINT: Record<DisplayState, string> = {
  live: "지금 구매자 홈에 나옵니다.",
  scheduled: "노출 시작일이 아직 오지 않아 홈에 나오지 않습니다.",
  ended: "노출 기간이 끝나 홈에 나오지 않습니다.",
  off: "노출 스위치가 꺼져 있어 홈에 나오지 않습니다.",
};

const GripIcon = (
  <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
    <circle cx="6" cy="4" r="1.2" /><circle cx="10" cy="4" r="1.2" />
    <circle cx="6" cy="8" r="1.2" /><circle cx="10" cy="8" r="1.2" />
    <circle cx="6" cy="12" r="1.2" /><circle cx="10" cy="12" r="1.2" />
  </svg>
);

export default function AdminHomeFeatures() {
  const router = useRouter();
  const [items, setItems] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // 처리 중인 항목 id — 버튼 잠금
  const [dragId, setDragId] = useState<string | null>(null); // 드래그 중인 행
  const [overId, setOverId] = useState<string | null>(null); // 드롭 대상 행
  const [pendingDelete, setPendingDelete] = useState<Feature | null>(null); // 삭제 확인 모달 대상
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/home");
      if (res.status === 401) return void router.replace("/login");
      if (res.status === 403) return void router.replace("/no-role"); // R7: FastAPI 판정 결과를 따른다
      if (!res.ok) return void setError("목록을 불러오지 못했습니다. 다시 시도해 주세요.");
      const data = await res.json();
      // kind(hero 먼저) → display_order → 최신순 정렬. 상류 순서와 무관하게 화면에서 고정한다.
      const list: Feature[] = (data.items ?? []).slice().sort((a: Feature, b: Feature) =>
        a.kind === b.kind ? a.display_order - b.display_order : a.kind === "hero" ? -1 : 1);
      setItems(list);
    } catch {
      setError("네트워크 연결을 확인해 주세요.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void (async () => { await load(); })();
  }, [load]);

  async function patch(id: string, body: Record<string, unknown>): Promise<boolean> {
    setError(null);
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/home/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 401) { router.replace("/login"); return false; }
      if (res.status === 403) { router.replace("/no-role"); return false; }
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.details?.[0]?.reason ?? data?.message ?? "처리에 실패했습니다.");
        return false;
      }
      return true;
    } catch {
      setError("네트워크 연결을 확인해 주세요.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function toggleActive(f: Feature) {
    if (await patch(f.id, { is_active: !f.is_active })) await load();
  }

  // 드래그드랍 순서 변경 — 같은 kind 그룹 안에서만(히어로↔슬롯 경계는 넘지 않는다).
  // 그룹의 display_order 값 풀은 그대로 두고 "어느 항목이 어느 값을 갖느냐"만 위치대로 재배정한다.
  // → 값 집합·오름차순·유일성이 보존돼 충돌이 없고, 실제로 자리가 바뀐 항목만 PATCH한다.
  // 부분 실패(중간 PATCH 오류)든 성공이든 마지막 load()로 서버 상태에 재동기화한다.
  async function reorder(fromId: string, toId: string) {
    if (fromId === toId) return;
    const drag = items.find((i) => i.id === fromId);
    const drop = items.find((i) => i.id === toId);
    if (!drag || !drop || drag.kind !== drop.kind) return; // 같은 구분 안에서만
    const group = items.filter((i) => i.kind === drag.kind); // display_order 오름차순 상태
    const orders = group.map((i) => i.display_order); // 순서값 풀(보존)
    const from = group.findIndex((i) => i.id === fromId);
    const to = group.findIndex((i) => i.id === toId);
    const next = group.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    const changed = next
      .map((it, idx) => ({ id: it.id, order: orders[idx], prev: it.display_order }))
      .filter((u) => u.order !== u.prev);
    if (changed.length === 0) return;
    for (const u of changed) {
      const ok = await patch(u.id, { display_order: u.order });
      if (!ok) break; // 401은 patch가 이미 리다이렉트, 그 외는 setError. 어느 쪽이든 load로 재동기화.
    }
    await load();
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const f = pendingDelete;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/home/${f.id}`, { method: "DELETE" });
      if (res.status === 401) return void router.replace("/login");
      if (res.status === 403) return void router.replace("/no-role");
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => null);
        return void setError(data?.message ?? "삭제에 실패했습니다.");
      }
      setPendingDelete(null);
      await load();
    } catch {
      setError("네트워크 연결을 확인해 주세요.");
    } finally {
      setDeleting(false);
    }
  }

  // 다활성 히어로 안내 — 홈엔 활성 히어로 1건만 노출된다(display_order 최소). 스키마 제약은 없다(9.4).
  // items는 hero 먼저 · display_order 오름차순으로 정렬돼 있어 첫 활성 히어로가 실제 노출 대상이다.
  const activeHeroes = items.filter((f) => f.kind === "hero" && f.is_active);
  const shownHeroId = activeHeroes.length > 0 ? activeHeroes[0].id : null;
  const multiActiveHero = activeHeroes.length >= 2;
  const draggedKind = dragId ? items.find((i) => i.id === dragId)?.kind ?? null : null;
  // 같은 구분 항목이 2개 이상일 때만 순서 변경 가능 — 1개뿐이면 바꿀 상대가 없다(손잡이 비활성).
  const heroCount = items.filter((i) => i.kind === "hero").length;
  const slotCount = items.length - heroCount;

  return (
    <ConsoleShell
      role="admin"
      title="메인 화면 관리"
      description="구매자 앱 메인 화면에 노출되는 히어로·슬롯을 관리합니다. 노출 순서·기간·노출 여부를 정합니다."
      actions={
        <>
          {/* 편성 결과는 구매자 홈에서 확인한다 — 새 탭으로 열어 관리 화면을 잃지 않게 */}
          <a className="btn m_small" href="/" target="_blank" rel="noopener noreferrer">구매자 홈 열기 ↗</a>
          <Link className="btn m_small m_primary" href="/admin/home/new">새 항목</Link>
        </>
      }
    >
      <div className="page_admin_home">
      <p className="p_hint">
        여기서 만든 항목은 <strong>구매자 앱 메인 화면</strong>에 그대로 노출됩니다.{" "}
        <strong>히어로</strong>는 홈 최상단 대형 지면(노출 1건만),{" "}
        <strong>슬롯</strong>은 편집 문장 + 고른 상품 묶음입니다(피처=크게 2점 / 스트립=가로로 여러 점).{" "}
        행 왼쪽 손잡이를 끌어 <strong>같은 구분 안에서</strong> 순서를 바꿉니다. 아래는 예시 항목이니 <strong>수정</strong>으로 열어 확인해 보세요.
      </p>
      {error && <div className="alert m_inline m_danger" role="alert">{error}</div>}
      {multiActiveHero && (
        <div className="alert m_inline m_warning" role="alert">
          노출 중인 히어로가 여러 개입니다 — 홈엔 순서가 가장 앞선 히어로 1건만 나옵니다. 아래 <strong>대표</strong> 표시를 확인하세요.
        </div>
      )}
      {loading ? (
        <p className="p_empty" role="status">불러오는 중…</p>
      ) : items.length === 0 ? (
        <p className="p_empty">항목이 없습니다 — 첫 항목을 만들어 보세요.</p>
      ) : (
        <div className="table_wrap">
          <div className="table_scroll"><table className="table_data">
            <thead>
              <tr>
                <th className="i_drag_cell"><span className="i_sr">순서</span></th>
                <th>구분</th>
                <th>제목</th>
                <th>레이아웃</th>
                <th className="m_num">품목</th>
                <th>노출 기간</th>
                <th>노출 상태</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {items.map((f) => {
                const kindCount = f.kind === "hero" ? heroCount : slotCount;
                const canReorder = kindCount > 1; // 같은 구분에 항목이 2개 이상이라야 순서 변경 의미가 있다
                const canDrag = busy === null && !deleting && canReorder;
                const canDropHere = dragId !== null && dragId !== f.id && draggedKind === f.kind;
                return (
                  <tr
                    key={f.id}
                    draggable={canDrag}
                    data-dragging={dragId === f.id ? "" : undefined}
                    data-over={overId === f.id && canDropHere ? "" : undefined}
                    onDragStart={(e) => { setDragId(f.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", f.id); }}
                    onDragOver={(e) => { if (canDropHere) { e.preventDefault(); if (overId !== f.id) setOverId(f.id); } }}
                    onDrop={(e) => { e.preventDefault(); if (dragId) void reorder(dragId, f.id); setDragId(null); setOverId(null); }}
                    onDragEnd={() => { setDragId(null); setOverId(null); }}
                  >
                    <td className="i_drag_cell">
                      <span
                        className="i_grip"
                        data-state={canReorder ? undefined : "disabled"}
                        title={canReorder ? "끌어서 순서 변경" : "이 구분에 항목이 하나뿐이라 순서를 바꿀 수 없습니다"}
                      >
                        {GripIcon}
                      </span>
                    </td>
                    <td>
                      <span className={KIND_BADGE[f.kind] ?? "badge m_small"}>{KIND_LABEL[f.kind] ?? f.kind}</span>
                      {multiActiveHero && f.id === shownHeroId && (
                        <span className="badge m_small m_success" title="여러 활성 히어로 중 실제로 홈에 노출되는 히어로"> 대표</span>
                      )}
                    </td>
                    <td>
                      <Link className="i_title" href={`/admin/home/${f.id}`}>{f.title}</Link>
                      {(f.issue_label || f.issue_no) && (
                        <span className="i_issue">{[f.issue_label, f.issue_no].filter(Boolean).join(" ")}</span>
                      )}
                    </td>
                    <td>{LAYOUT_LABEL[f.layout] ?? f.layout}</td>
                    <td className="m_num">{f.item_count}</td>
                    <td className="i_period">{formatDate(f.starts_at)} ~ {formatDate(f.ends_at)}</td>
                    <td>
                      <div className="i_state">
                        {/* 배지가 실제 노출 여부(기간 포함), 토글은 운영자가 켜고 끄는 스위치 */}
                        <span className={STATE_BADGE[f.display_state]} title={STATE_HINT[f.display_state]}>
                          {STATE_LABEL[f.display_state]}
                        </span>
                        <label className="i_toggle">
                          <input
                            type="checkbox"
                            checked={f.is_active}
                            disabled={busy !== null}
                            onChange={() => toggleActive(f)}
                            aria-label={`${f.title} 노출 스위치`}
                          />
                          <span className="i_toggle_track" aria-hidden="true"><span className="i_toggle_thumb" /></span>
                          <span className="i_toggle_label">{f.is_active ? "켜짐" : "꺼짐"}</span>
                        </label>
                      </div>
                    </td>
                    <td>
                      <div className="i_actions">
                        <Link className="btn m_small" href={`/admin/home/${f.id}`}>수정</Link>
                        <button className="btn m_small m_danger" type="button" disabled={busy !== null}
                          onClick={() => setPendingDelete(f)}>삭제</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        </div>
      )}
      </div>

      <ConfirmModal
        open={pendingDelete !== null}
        title="항목 삭제"
        message={pendingDelete ? <>「<strong>{pendingDelete.title}</strong>」 항목을 삭제합니다. 되돌릴 수 없습니다.</> : ""}
        confirmLabel="삭제"
        danger
        submitting={deleting}
        onConfirm={confirmDelete}
        onCancel={() => { if (!deleting) setPendingDelete(null); }}
      />
    </ConsoleShell>
  );
}
