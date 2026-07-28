"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import ConsoleShell from "@/app/(console)/console-shell";
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
  item_count: number;
  updated_at: string;
};

function formatDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Seoul" });
}

const KIND_LABEL: Record<string, string> = { hero: "히어로", slot: "슬롯" };
const LAYOUT_LABEL: Record<string, string> = { feature: "피처", strip: "스트립" };

export default function AdminHomeFeatures() {
  const router = useRouter();
  const [items, setItems] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // 처리 중인 편성 id — 버튼 잠금

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/home");
      if (res.status === 401) return void router.replace("/login");
      if (res.status === 403) return void router.replace("/no-role"); // R7: FastAPI 판정 결과를 따른다
      if (!res.ok) return void setError("편성 목록을 불러오지 못했습니다. 새로고침해 주세요.");
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

  // 같은 kind 내 인접 편성과 display_order 값을 맞바꾼다 (category-panel ↑↓ 관례).
  // 순차 PATCH 2건 — 401/403·에러 봉투 처리는 patch()가 다른 핸들러와 동일하게 맡는다.
  // 성공·부분실패(a성공·b실패로 display_order 중복 잔존)와 무관하게 load()로 서버 상태에 재동기화한다.
  async function move(idx: number, dir: -1 | 1) {
    const cur = items[idx];
    const target = items[idx + dir];
    if (!cur || !target || cur.kind !== target.kind) return;
    const okA = await patch(cur.id, { display_order: target.display_order });
    if (!okA) return void (await load()); // A 실패(401은 patch가 이미 리다이렉트) — 재동기화만
    await patch(target.id, { display_order: cur.display_order });
    await load();
  }

  async function remove(f: Feature) {
    if (!window.confirm(`"${f.title}" 편성을 삭제할까요? 되돌릴 수 없습니다.`)) return;
    setError(null);
    setBusy(f.id);
    try {
      const res = await fetch(`/api/admin/home/${f.id}`, { method: "DELETE" });
      if (res.status === 401) return void router.replace("/login");
      if (res.status === 403) return void router.replace("/no-role");
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => null);
        return void setError(data?.message ?? "삭제에 실패했습니다.");
      }
      await load();
    } catch {
      setError("네트워크 연결을 확인해 주세요.");
    } finally {
      setBusy(null);
    }
  }

  // 다활성 히어로 안내 — 홈엔 활성 히어로 1건만 노출된다(display_order 최소). 스키마 제약은 없다(9.4).
  // items는 hero 먼저 · display_order 오름차순으로 정렬돼 있어 첫 활성 히어로가 실제 노출 대상이다.
  const activeHeroes = items.filter((f) => f.kind === "hero" && f.is_active);
  const shownHeroId = activeHeroes.length > 0 ? activeHeroes[0].id : null;
  const multiActiveHero = activeHeroes.length >= 2;

  return (
    <ConsoleShell
      role="admin"
      title="홈 편성"
      description="구매자 홈 화면에 노출되는 히어로·슬롯 편성입니다. 노출 순서·기간·활성 여부를 관리합니다."
      actions={
        <>
          <Link className="btn m_small m_primary" href="/admin/home/new">새 편성</Link>
          <button className="btn m_small m_ghost" type="button" onClick={load}>새로고침</button>
        </>
      }
    >
      <div className="page_admin_home">
      {error && <div className="alert m_inline m_danger" role="alert">{error}</div>}
      {multiActiveHero && (
        <div className="alert m_inline m_warning" role="alert">
          활성 히어로는 1건만 노출됩니다 — display_order가 가장 낮은 히어로가 홈에 나옵니다. 아래 <strong>노출 중</strong> 표시를 확인하세요.
        </div>
      )}
      {loading ? (
        <p className="p_empty" role="status">불러오는 중…</p>
      ) : items.length === 0 ? (
        <p className="p_empty">편성이 없습니다 — 첫 편성을 만들어 보세요.</p>
      ) : (
        <div className="table_wrap">
          <div className="table_scroll"><table className="table_data">
            <thead>
              <tr>
                <th>구분</th>
                <th>제목</th>
                <th>레이아웃</th>
                <th className="m_num">품목</th>
                <th>노출 기간</th>
                <th>순서</th>
                <th>상태</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {items.map((f, idx) => {
                const prev = items[idx - 1];
                const next = items[idx + 1];
                return (
                  <tr key={f.id}>
                    <td>
                      <span className="badge m_small">{KIND_LABEL[f.kind] ?? f.kind}</span>
                      {multiActiveHero && f.id === shownHeroId && (
                        <span className="badge m_small m_success" title="이 히어로가 홈에 노출됩니다"> 노출 중</span>
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
                      <div className="i_order_cell">
                        <button className="btn m_small m_ghost" type="button" aria-label="위로"
                          disabled={busy !== null || !prev || prev.kind !== f.kind}
                          onClick={() => move(idx, -1)}>↑</button>
                        <span className="i_order_num">{f.display_order}</span>
                        <button className="btn m_small m_ghost" type="button" aria-label="아래로"
                          disabled={busy !== null || !next || next.kind !== f.kind}
                          onClick={() => move(idx, 1)}>↓</button>
                      </div>
                    </td>
                    <td>
                      <span className={`badge m_small${f.is_active ? " m_success" : ""}`}>
                        {f.is_active ? "활성" : "비활성"}
                      </span>
                    </td>
                    <td>
                      <div className="i_actions">
                        <button className="btn m_small m_ghost" type="button" disabled={busy !== null}
                          onClick={() => toggleActive(f)}>{f.is_active ? "비활성화" : "활성화"}</button>
                        <Link className="btn m_small m_ghost" href={`/admin/home/${f.id}`}>수정</Link>
                        <button className="btn m_small m_danger" type="button" disabled={busy !== null}
                          onClick={() => remove(f)}>삭제</button>
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
    </ConsoleShell>
  );
}
