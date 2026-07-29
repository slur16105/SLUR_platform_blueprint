"use client";

/* 입점 심사 — 판매자 신청 승인/반려. (구 /admin 홈의 입점심사 탭을 전용 라우트로 분리, IA 개선)
   기능·API는 기존 그대로(/api/admin/applications). 프레젠테이션만 셸로. */

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

export default function SellerApplications() {
  const router = useRouter();
  const [items, setItems] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true); // 최초 로드·탭 전환 완료 전 빈 문구 깜빡임 방지
  const [status, setStatus] = useState("pending");
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [approving, setApproving] = useState<Application | null>(null); // 승인 확인 모달 대상 (비가역 액션 게이팅)
  const [submitting, setSubmitting] = useState(false); // 확인 처리 중 중복 클릭·중복 승인 방지
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const approveRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async (s: string) => {
    setNotice(null);
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/applications?status=${s}`);
      if (res.status === 401) return void router.replace("/login");
      if (res.status === 403) return void router.replace("/no-role"); // R7: FastAPI 판정 결과를 따른다
      if (!res.ok) {
        setError("목록을 불러오지 못했습니다. 새로고침해 주세요.");
        return;
      }
      const data = await res.json();
      setItems(data.items ?? []);
    } catch {
      setError("네트워크 연결을 확인해 주세요.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  // 상태 탭 변경 시 재조회 — 로더 호출을 effect 안 async 함수로 감싼다(React 데이터 페칭 관례).
  useEffect(() => {
    void (async () => { await load(status); })();
  }, [status, load]);

  // 승인 확인 모달 열림 — 확정 버튼에 초기 포커스 + ESC 닫기(처리 중 제외)
  useEffect(() => {
    if (!approving) return;
    approveRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) setApproving(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [approving, submitting]);

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
      load(status);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ConsoleShell
      role="admin"
      title="입점 심사"
      description="판매자 입점 신청을 검토하고 승인·반려합니다."
    >
      <div className="page_admin">
        <div className="p_tabs">
          {(["pending", "approved", "rejected"] as const).map((s) => (
            <button key={s} type="button"
              className={`btn m_small${status === s ? " m_primary" : " m_ghost"}`}
              onClick={() => setStatus(s)}>
              {s === "pending" ? "심사 대기" : s === "approved" ? "승인됨" : "반려됨"}
            </button>
          ))}
        </div>
        {notice && <div className="alert m_inline m_success" role="status">{notice}</div>}
        {error && <div className="alert m_inline m_danger" role="alert">{error}</div>}
        {loading ? (
          <p className="p_empty">불러오는 중…</p>
        ) : items.length === 0 ? (
          <p className="p_empty">해당 상태의 신청이 없습니다.</p>
        ) : null}
        {!loading && <ul className="p_list">
          {items.map((a) => (
            <li className="card p_item" key={a.id}>
              <div className="i_head">
                <strong className="i_brand">{a.brand_name}</strong>
                <span className="i_company">{a.company_name}</span>
              </div>
              <p className="i_intro">{a.brand_intro}</p>
              <dl className="i_meta">
                <div><dt>대표자</dt><dd>{a.representative_name}</dd></div>
                <div><dt>사업자번호</dt><dd>{a.business_registration_number}</dd></div>
                <div><dt>통판신고</dt><dd>{a.mail_order_number}</dd></div>
                <div><dt>주소</dt><dd>{a.business_address}</dd></div>
                <div><dt>연락처</dt><dd>{a.contact_phone}</dd></div>
              </dl>
              {a.status === "pending" && rejecting !== a.id && (
                <div className="i_actions">
                  <button className="btn m_primary" type="button" onClick={() => setApproving(a)}>승인</button>
                  <button className="btn m_danger" type="button" onClick={() => setRejecting(a.id)}>반려</button>
                </div>
              )}
              {rejecting === a.id && (
                <div className="i_reject">
                  <input className="input_text" placeholder="반려 사유 (신청자에게 표시됩니다)"
                    value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
                  <p className="i_warn">반려는 되돌릴 수 없습니다. 신청자는 사유를 확인한 뒤 처음부터 다시 신청해야 합니다.</p>
                  <div className="i_actions">
                    <button className="btn m_danger" type="button" data-state={submitting ? "loading" : undefined}
                      onClick={() => act(a.id, "reject")}>반려 확정</button>
                    <button className="btn m_ghost" type="button" disabled={submitting}
                      onClick={() => { setRejecting(null); setReason(""); }}>취소</button>
                  </div>
                </div>
              )}
              {a.status === "rejected" && a.rejection_reason && (
                <p className="i_reason">반려 사유: {a.rejection_reason}</p>
              )}
            </li>
          ))}
        </ul>}

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
                  <div><dt>대표자</dt><dd>{approving.representative_name}</dd></div>
                  <div><dt>사업자번호</dt><dd>{approving.business_registration_number}</dd></div>
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
      </div>
    </ConsoleShell>
  );
}
