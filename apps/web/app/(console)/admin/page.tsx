"use client";

/* 관리자 대시보드 — 운영형(action-queue 중심). UX 전문가 검토(2026-07-28) 반영.
   랜딩은 "지금 무엇을 처리할까"에 답한다: 처리 대기 큐(각 라우트로 딥링크) + 최근 주문.
   전부 기존 API의 total/items로 구성 — 신규 백엔드 없음. 매출·추이·랭킹(집계 API 필요)은 2차.
   입점 심사는 /admin/sellers/applications, 카테고리는 /admin/settings로 이동(IA 개선). */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import ConsoleShell from "@/app/(console)/console-shell";
import { statusBadgeClass, statusLabel } from "./orders/status";
import "./dashboard.css";

type RecentOrder = {
  order_id: string;
  order_no: string;
  created_at: string;
  display_status: string;
  grand_total: number;
  buyer_name: string;
  buyer_email: string;
};

function formatDateTime(s: string) {
  // 주문 목록·상세와 대사 시 시간 불일치 방지 — KST 고정
  return new Date(s).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Seoul" });
}

type Stats = {
  period: string;
  new_orders: number;
  paid_orders: number;
  revenue: number;
  new_users: number;
  pending_payment_count: number;
  pending_payment_amount: number;
};

const PERIODS: { value: string; label: string }[] = [
  { value: "today", label: "오늘" },
  { value: "7d", label: "최근 7일" },
  { value: "30d", label: "최근 30일" },
];

export default function AdminDashboard() {
  const router = useRouter();
  const [deposits, setDeposits] = useState<number | null>(null);
  const [preparing, setPreparing] = useState<number | null>(null);
  const [applications, setApplications] = useState<number | null>(null);
  const [inquiries, setInquiries] = useState<number | null>(null);
  const [recent, setRecent] = useState<RecentOrder[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [period, setPeriod] = useState("today");
  const [error, setError] = useState<string | null>(null);

  // 통계는 기간 전환마다 다시 부른다 — 처리 대기 큐(기간 무관)와 로딩을 분리
  useEffect(() => {
    let alive = true;
    void (async () => {
      const res = await fetch(`/api/admin/stats?period=${period}`).catch(() => null);
      if (!alive) return;
      // 세션 만료·권한 상실은 큐 조회와 같은 경로로 처리한다 — 통계만 조용히 "–"로 남으면
      // 운영자가 서버 장애인지 로그인이 풀린 것인지 구분할 수 없다.
      if (res?.status === 401) return void router.replace("/login");
      if (res?.status === 403) return void router.replace("/no-role");
      setStats(res?.ok ? await res.json().catch(() => null) : null);
    })();
    return () => { alive = false; };
  }, [period, router]);

  const load = useCallback(async () => {
    setError(null);
    try {
      // 처리 대기 카운트 + 최근 주문을 병렬 조회 (전부 기존 엔드포인트의 total/items)
      const [d, o, a, r, q] = await Promise.all([
        fetch("/api/admin/deposits?page=1"),
        fetch("/api/admin/orders?status=preparing&page=1"),
        fetch("/api/admin/applications?status=pending"),
        fetch("/api/admin/orders?page=1"),
        fetch("/api/admin/inquiries?status=open&page=1"),
      ]);
      const all = [d, o, a, r, q];
      if (all.some((x) => x.status === 401)) return void router.replace("/login");
      if (all.some((x) => x.status === 403)) return void router.replace("/no-role"); // R7
      const dj = d.ok ? await d.json() : null;
      const oj = o.ok ? await o.json() : null;
      const aj = a.ok ? await a.json() : null;
      const rj = r.ok ? await r.json() : null;
      setDeposits(dj?.total ?? null);
      setPreparing(oj?.total ?? null);
      setApplications(aj?.total ?? aj?.items?.length ?? null);
      setRecent(rj?.items ? (rj.items as RecentOrder[]).slice(0, 5) : []);
      const qj = q.ok ? await q.json() : null;
      setInquiries(qj?.total ?? null);
      if (!d.ok && !o.ok && !a.ok && !r.ok) setError("대시보드를 불러오지 못했습니다. 새로고침해 주세요.");
    } catch {
      setError("네트워크 연결을 확인해 주세요.");
    }
  }, [router]);

  // 초기 로드 — effect 안 async 함수로 감싼다(React 데이터 페칭 관례).
  useEffect(() => {
    void (async () => { await load(); })();
  }, [load]);

  const queue = [
    { label: "입금 확인", count: deposits, href: "/admin/deposits", hint: "무통장 입금 대기" },
    // 라벨은 주문 상태 라벨(STATUS_LABEL)과 같은 표기를 쓴다 — 화면마다 다른 이름으로 부르지 않는다
    { label: "배송준비", count: preparing, href: "/admin/orders?status=preparing", hint: "판매자 발송 전 주문" },
    { label: "입점 심사", count: applications, href: "/admin/sellers/applications", hint: "판매자 신청 대기" },
    // 소비자 불만 처리는 법적 의무다 — 대기 건수를 랜딩에서 바로 보이게 둔다
    { label: "문의 답변", count: inquiries, href: "/admin/inquiries?status=open", hint: "답변 대기 중인 1:1 문의" },
  ];

  return (
    <ConsoleShell
      role="admin"
      title="대시보드"
      description="지금 처리할 일과 최근 주문을 한눈에 봅니다."
    >
      <div className="page_admin_dash">
        {error && <div className="alert m_inline m_danger" role="alert">{error}</div>}

        <section className="p_stats">
          <div className="i_head">
            <h2 className="p_section_title">현황</h2>
            <nav className="tab_menu" aria-label="집계 기간">
              {PERIODS.map((p) => (
                <button key={p.value} type="button" className="i_tab"
                  data-state={period === p.value ? "active" : undefined}
                  onClick={() => setPeriod(p.value)}>{p.label}</button>
              ))}
            </nav>
          </div>
          <div className="i_grid">
            {/* 매출·주문·가입은 선택한 기간 기준, 입금 대기는 지금 상태(기간 무관)라 라벨로 구분한다 */}
            <div className="i_tile">
              <span className="i_tlabel">매출</span>
              <strong className="i_tvalue">{stats ? `${stats.revenue.toLocaleString()}원` : "–"}</strong>
              <span className="i_thint">입금 확인된 금액 · 취소 제외</span>
            </div>
            <div className="i_tile">
              <span className="i_tlabel">신규 주문</span>
              <strong className="i_tvalue">{stats ? stats.new_orders.toLocaleString() : "–"}</strong>
              <span className="i_thint">입금 확인 {stats ? stats.paid_orders.toLocaleString() : "–"}건</span>
            </div>
            <div className="i_tile">
              <span className="i_tlabel">신규 가입</span>
              <strong className="i_tvalue">{stats ? stats.new_users.toLocaleString() : "–"}</strong>
              <span className="i_thint">기간 내 가입한 회원</span>
            </div>
            <div className="i_tile">
              <span className="i_tlabel">입금 대기 금액</span>
              <strong className="i_tvalue">{stats ? `${stats.pending_payment_amount.toLocaleString()}원` : "–"}</strong>
              <span className="i_thint">지금 기준 {stats ? stats.pending_payment_count.toLocaleString() : "–"}건 · 기간 무관</span>
            </div>
          </div>
        </section>

        <section className="p_queue">
          <h2 className="p_section_title">처리 대기</h2>
          <div className="i_grid">
            {queue.map((q) => (
              <Link key={q.href} href={q.href} className="i_qcard"
                data-alert={q.count !== null && q.count > 0 ? "" : undefined}>
                <span className="i_qmain">
                  <span className="i_qlabel">{q.label}</span>
                  <span className="i_qhint">{q.hint}</span>
                </span>
                <span className="i_qval">
                  <span className="i_qcount">{q.count === null ? "–" : q.count.toLocaleString()}</span>
                  <span className="i_qgo">처리하기 →</span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="p_recent">
          <div className="i_head">
            <h2 className="p_section_title">최근 주문</h2>
            <Link className="i_more" href="/admin/orders">전체 보기 →</Link>
          </div>
          {recent === null ? (
            <p className="p_empty" role="status">불러오는 중…</p>
          ) : recent.length === 0 ? (
            <p className="p_empty">최근 주문이 없습니다.</p>
          ) : (
            <div className="table_wrap">
              <div className="table_scroll"><table className="table_data">
                <thead>
                  <tr>
                    <th>주문번호</th>
                    <th>주문자</th>
                    <th>상태</th>
                    <th className="m_num">금액</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((o) => (
                    <tr key={o.order_id} className="i_row" tabIndex={0}
                      onClick={() => router.push(`/admin/orders/${o.order_id}`)}
                      onKeyDown={(e) => { if (e.key === "Enter") router.push(`/admin/orders/${o.order_id}`); }}>
                      <td>
                        <strong>{o.order_no}</strong>
                        <span className="i_time">{formatDateTime(o.created_at)}</span>
                      </td>
                      <td>
                        {o.buyer_name}
                        <span className="i_email">{o.buyer_email}</span>
                      </td>
                      <td><span className={statusBadgeClass(o.display_status)}>{statusLabel(o.display_status)}</span></td>
                      <td className="m_num"><strong>{o.grand_total.toLocaleString()}원</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          )}
        </section>
      </div>
    </ConsoleShell>
  );
}
