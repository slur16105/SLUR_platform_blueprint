"use client";

/* 입점 심사 — 판매자 신청 승인/반려. (구 /admin 홈의 입점심사 탭을 전용 라우트로 분리, IA 개선)
   기능·API는 기존 그대로(/api/admin/applications). 대량 대비로 카드 리스트 → 데이터 테이블 + 검색 + 페이지네이션. */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import ConsoleShell from "@/app/(console)/console-shell";
import "../../admin.css";

type Application = {
  id: string;
  status: string;
  brand_name: string;
  brand_intro: string;
  company_name: string;
  representative_name: string;
  business_registration_number: string;
  mail_order_number: string;
  business_address: string;
  contact_phone: string;
  created_at: string;
  rejection_reason: string | null;
};

const PAGE_SIZE = 20; // 백엔드 고정 페이지 크기 — total로 마지막 페이지 계산

function formatDateTime(s: string) {
  // 다른 관리자 화면(주문·입금)과 대사 시 시간 불일치 방지 — KST 고정
  return new Date(s).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Seoul" });
}

function statusBadge(s: string) {
  if (s === "approved") return { className: "badge m_success", label: "승인됨" };
  if (s === "rejected") return { className: "badge m_danger", label: "반려됨" };
  return { className: "badge m_warning", label: "심사 대기" };
}

export default function SellerApplications() {
  const router = useRouter();
  const [items, setItems] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true); // 최초 로드·탭 전환 완료 전 빈 문구 깜빡임 방지
  const [status, setStatus] = useState("pending");
  const [q, setQ] = useState(""); // 입력 중 값
  const [appliedQ, setAppliedQ] = useState(""); // 실제 조회에 쓰인 값
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [rejecting, setRejecting] = useState<Application | null>(null); // 반려 확인 모달 대상 (비가역 액션 게이팅)
  const [reason, setReason] = useState("");
  const [approving, setApproving] = useState<Application | null>(null); // 승인 확인 모달 대상 (비가역 액션 게이팅)
  const [submitting, setSubmitting] = useState(false); // 확인 처리 중 중복 클릭·중복 승인 방지
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const approveRef = useRef<HTMLButtonElement>(null);
  const reasonRef = useRef<HTMLInputElement>(null);
  const loadSeq = useRef(0); // 요청 세대 카운터 — 검색·페이지·탭 연타 시 늦은 응답 폐기

  const load = useCallback(async (s: string, query: string, p: number) => {
    const gen = ++loadSeq.current;
    setNotice(null);
    setError(null);
    setLoading(true);
    try {
      const sp = new URLSearchParams({ status: s, page: String(p) });
      if (query) sp.set("q", query);
      const res = await fetch(`/api/admin/applications?${sp.toString()}`);
      if (gen !== loadSeq.current) return; // 더 최신 요청이 있음 — 이 응답은 폐기
      if (res.status === 401) return void router.replace("/login");
      if (res.status === 403) return void router.replace("/no-role"); // R7: FastAPI 판정 결과를 따른다
      if (!res.ok) {
        setError("목록을 불러오지 못했습니다. 새로고침해 주세요.");
        return;
      }
      const data = await res.json();
      if (gen !== loadSeq.current) return;
      const list: Application[] = data.items ?? [];
      const t: number = data.total ?? 0;
      // 빈 뒷페이지 갇힘 방지 — 조건 변경으로 페이지가 사라졌으면 마지막 페이지로 이동
      if (list.length === 0 && t > 0 && p > 1) {
        return void setPage(Math.min(Math.max(1, Math.ceil(t / PAGE_SIZE)), p - 1)); // 항상 앞 페이지로만 — 루프 불가
      }
      setItems(list);
      setTotal(t);
    } catch {
      if (gen === loadSeq.current) setError("네트워크 연결을 확인해 주세요.");
    } finally {
      if (gen === loadSeq.current) setLoading(false);
    }
  }, [router]);

  // 상태 탭·검색어·페이지 변경 시 재조회 — 로더 호출을 effect 안 async 함수로 감싼다(React 데이터 페칭 관례).
  useEffect(() => {
    void (async () => { await load(status, appliedQ, page); })();
  }, [status, appliedQ, page, load]);

  // 확인 모달 열림 — 초기 포커스 + ESC 닫기(처리 중 제외)
  useEffect(() => {
    if (!approving && !rejecting) return;
    if (approving) approveRef.current?.focus();
    else reasonRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) { setApproving(null); setRejecting(null); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [approving, rejecting, submitting]);

  async function act(id: string, action: "approve" | "reject") {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, reason: action === "reject" ? reason : undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.details?.[0]?.reason ?? data.message ?? "처리에 실패했습니다.");
        return;
      }
      setNotice(
        action === "approve"
          ? `승인 완료 — 신청자가 다시 로그인하면 판매자 센터를 이용할 수 있습니다.`
          : "반려 처리했습니다. 신청자에게 사유가 표시됩니다.",
      );
      setApproving(null);
      setRejecting(null);
      setReason("");
      load(status, appliedQ, page);
    } finally {
      setSubmitting(false);
    }
  }

  function changeStatus(s: string) {
    if (s === status) return;
    setStatus(s);
    setPage(1);
    // 탭은 독립 컨텍스트 — 이전 탭의 검색어가 새 탭에 남지 않게 초기화한다.
    // (검색어 미초기화 시 effect가 이전 appliedQ로 재조회해, 검색 안 했는데 필터된 결과가 뜬다)
    setQ("");
    setAppliedQ("");
  }

  function submitSearch() {
    const query = q.trim();
    setError(null);
    setPage(1);
    if (query === appliedQ) load(status, query, 1); // 같은 조건 재검색 — effect가 안 돌므로 직접 조회
    else setAppliedQ(query);
  }

  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <ConsoleShell
      role="admin"
      title="입점 심사"
      description="판매자 입점 신청을 검토하고 승인·반려합니다."
    >
      <div className="page_admin">
        <nav className="tab_menu" aria-label="심사 상태">
          {(["pending", "approved", "rejected"] as const).map((s) => (
            <button key={s} type="button" className="i_tab"
              data-state={status === s ? "active" : undefined}
              onClick={() => changeStatus(s)}>
              {s === "pending" ? "심사 대기" : s === "approved" ? "승인됨" : "반려됨"}
            </button>
          ))}
        </nav>
        <form className="p_search" onSubmit={(e) => { e.preventDefault(); submitSearch(); }}>
          <input className="input_text" type="search" maxLength={100} value={q}
            placeholder="브랜드·상호·대표자명"
            onChange={(e) => setQ(e.target.value)} />
          <button className="btn m_primary" type="submit">검색</button>
        </form>
        {notice && <div className="alert m_inline m_success" role="status">{notice}</div>}
        {error && <div className="alert m_inline m_danger" role="alert">{error}</div>}
        {loading ? (
          <p className="p_empty">불러오는 중…</p>
        ) : items.length === 0 ? (
          <p className="p_empty">{appliedQ ? "조건에 맞는 신청이 없습니다." : "해당 상태의 신청이 없습니다."}</p>
        ) : (
          <div className="table_wrap">
            <div className="table_scroll"><table className="table_data">
              <thead>
                <tr>
                  <th>브랜드</th>
                  <th>상호</th>
                  <th>대표자</th>
                  <th>연락처</th>
                  <th>신청일</th>
                  <th>상태</th>
                  <th aria-label="처리"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((a) => {
                  const badge = statusBadge(a.status);
                  return (
                    <tr key={a.id}>
                      <td><strong className="i_brand">{a.brand_name}</strong></td>
                      <td>{a.company_name}</td>
                      <td>{a.representative_name}</td>
                      <td className="m_muted">{a.contact_phone}</td>
                      <td className="m_muted">{formatDateTime(a.created_at)}</td>
                      <td><span className={badge.className}>{badge.label}</span></td>
                      <td>
                        {a.status === "pending" ? (
                          <div className="i_actions">
                            <button className="btn m_small m_primary" type="button"
                              onClick={() => setApproving(a)}>승인</button>
                            <button className="btn m_small m_danger" type="button"
                              onClick={() => { setRejecting(a); setReason(""); }}>반려</button>
                          </div>
                        ) : a.status === "rejected" && a.rejection_reason ? (
                          <span className="i_reason">사유: {a.rejection_reason}</span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
            <div className="i_foot">
              <span className="i_count">총 {total}건</span>
              <div className="i_btn_wrap">
                <button className="btn m_small m_ghost" type="button" disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}>이전</button>
                <span className="i_page">{page} / {lastPage}</span>
                <button className="btn m_small m_ghost" type="button" disabled={page >= lastPage}
                  onClick={() => setPage((p) => p + 1)}>다음</button>
              </div>
            </div>
          </div>
        )}

        {approving && (
          <div className="modal_dialog" data-state="open" role="dialog" aria-modal="true" aria-labelledby="approve_confirm_title"
            onClick={(e) => { if (e.target === e.currentTarget && !submitting) setApproving(null); }}>
            <div className="i_wrap">
              <div className="i_head">
                <h2 className="i_title" id="approve_confirm_title">입점 승인</h2>
                <button className="i_close" type="button" aria-label="닫기" disabled={submitting}
                  onClick={() => setApproving(null)}>✕</button>
              </div>
              <div className="i_body">
                <p className="i_text">이 신청을 승인하면 판매자 계정이 생성되고 판매자 권한이 부여됩니다. 승인 후에는 화면에서 되돌릴 수 없습니다.</p>
                <dl className="i_summary">
                  <div><dt>브랜드</dt><dd><strong>{approving.brand_name}</strong></dd></div>
                  <div><dt>상호</dt><dd>{approving.company_name}</dd></div>
                  <div><dt>소개</dt><dd>{approving.brand_intro}</dd></div>
                  <div><dt>대표자</dt><dd>{approving.representative_name}</dd></div>
                  <div><dt>사업자번호</dt><dd>{approving.business_registration_number}</dd></div>
                  <div><dt>통판신고</dt><dd>{approving.mail_order_number}</dd></div>
                  <div><dt>주소</dt><dd>{approving.business_address}</dd></div>
                  <div><dt>연락처</dt><dd>{approving.contact_phone}</dd></div>
                </dl>
              </div>
              <div className="i_foot">
                <button className="btn m_ghost" type="button" disabled={submitting} onClick={() => setApproving(null)}>취소</button>
                <button className="btn m_primary" type="button" ref={approveRef} data-state={submitting ? "loading" : undefined}
                  onClick={() => act(approving.id, "approve")}>승인 확정</button>
              </div>
            </div>
          </div>
        )}

        {rejecting && (
          <div className="modal_dialog" data-state="open" role="dialog" aria-modal="true" aria-labelledby="reject_confirm_title"
            onClick={(e) => { if (e.target === e.currentTarget && !submitting) setRejecting(null); }}>
            <div className="i_wrap">
              <div className="i_head">
                <h2 className="i_title" id="reject_confirm_title">입점 반려</h2>
                <button className="i_close" type="button" aria-label="닫기" disabled={submitting}
                  onClick={() => setRejecting(null)}>✕</button>
              </div>
              <div className="i_body">
                <p className="i_text">이 신청을 반려합니다. 반려는 되돌릴 수 없으며, 신청자는 사유를 확인한 뒤 처음부터 다시 신청해야 합니다.</p>
                <dl className="i_summary">
                  <div><dt>브랜드</dt><dd><strong>{rejecting.brand_name}</strong></dd></div>
                  <div><dt>상호</dt><dd>{rejecting.company_name}</dd></div>
                  <div><dt>대표자</dt><dd>{rejecting.representative_name}</dd></div>
                </dl>
                <label className="field">
                  <span className="i_label">반려 사유 (신청자에게 표시됩니다)</span>
                  <input className="input_text" ref={reasonRef} maxLength={500}
                    placeholder="반려 사유를 입력하세요"
                    value={reason} onChange={(e) => setReason(e.target.value)} />
                </label>
              </div>
              <div className="i_foot">
                <button className="btn m_ghost" type="button" disabled={submitting} onClick={() => setRejecting(null)}>취소</button>
                <button className="btn m_danger" type="button" data-state={submitting ? "loading" : undefined}
                  onClick={() => act(rejecting.id, "reject")}>반려 확정</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ConsoleShell>
  );
}
