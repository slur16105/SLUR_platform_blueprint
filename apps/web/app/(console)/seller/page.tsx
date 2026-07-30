"use client";

/* 판매자 대시보드 — 운영형(처리 대기 큐 중심). 관리자 대시보드와 같은 구조·워딩을 쓴다.
   랜딩은 "지금 무엇을 처리할까"에 답한다: 처리 대기 큐(딥링크) + 발송할 주문 + 품절 임박.
   배송비 설정은 여기 있던 폼을 /seller/settings로 분리했다(관리자 IA와 일치).
   매출·정산·추이는 집계 API도 정산 기능도 없어 이식 대상 아님(시안 원본은 직접 판매 모델). */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import ConsoleShell from "@/app/(console)/console-shell";
import "./dashboard.css";

type LowStockItem = {
  product_id: string;
  product_name: string;
  option_text: string;
  stock: number;
};

type Dashboard = {
  preparing_count: number;
  shipping_count: number;
  low_stock: LowStockItem[];
  low_stock_threshold: number;
};

type OrderLine = { product_name: string; option_text: string; quantity: number; status: "ordered" | "canceled" };
type SubOrder = {
  sub_order_id: string;
  order_no: string;
  created_at: string;
  recipient_name: string;
  recipient_phone: string;
  all_canceled: boolean;
  items: OrderLine[];
};

type Profile = { brand_name: string; company_name: string };

function formatDateTime(s: string) {
  // 주문 관리·관리자 화면과 대사 시 시간 불일치 방지 — KST 고정
  return new Date(s).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Seoul" });
}

export default function SellerDashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [preparing, setPreparing] = useState<SubOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 대시보드 값은 전부 서버 응답 표시만 (AD-12) — 클라이언트 계산 없음
  const load = useCallback(async () => {
    setError(null);
    try {
      const [d, o, p] = await Promise.all([
        fetch("/api/seller/dashboard"),
        fetch("/api/seller/orders?status=preparing&page=1"),
        fetch("/api/sellers/me"),
      ]);
      const all = [d, o, p];
      if (all.some((x) => x.status === 401)) return void router.replace("/login");
      if (all.some((x) => x.status === 403)) return void router.replace("/no-role");
      if (d.ok) setDashboard(await d.json());
      if (o.ok) {
        const data = await o.json();
        setPreparing(((data.items ?? []) as SubOrder[]).slice(0, 5));
      } else {
        setPreparing([]);
      }
      if (p.ok) setProfile(await p.json());
      if (!d.ok && !o.ok) setError("대시보드를 불러오지 못했습니다.");
    } catch {
      setError("네트워크 연결을 확인해 주세요.");
    }
  }, [router]);

  // 초기 로드 — 로더 호출을 effect 안 async 함수로 감싼다(React 데이터 페칭 관례).
  useEffect(() => {
    void (async () => { await load(); })();
  }, [load]);

  const lowStock = dashboard?.low_stock ?? [];
  const queue = [
    // 라벨은 주문 관리 탭 이름과 같은 표기 — 같은 것을 화면마다 다른 이름으로 부르지 않는다
    { label: "배송준비", count: dashboard?.preparing_count ?? null, href: "/seller/orders?status=preparing", hint: "송장 입력이 필요한 주문" },
    { label: "배송중", count: dashboard?.shipping_count ?? null, href: "/seller/orders?status=shipping", hint: "배송 완료 처리 대기" },
    { label: "품절 임박", count: dashboard ? lowStock.length : null, href: "/seller/products", hint: dashboard ? `재고 ${dashboard.low_stock_threshold}개 이하` : "재고 부족 상품" },
  ];

  return (
    <ConsoleShell
      role="seller"
      title="대시보드"
      description={profile ? `${profile.brand_name} · 지금 처리할 일을 한눈에 봅니다.` : "지금 처리할 일을 한눈에 봅니다."}
      actions={<Link className="btn m_primary" href="/seller/products/new">상품 등록</Link>}
    >
      <div className="page_seller_dash">
        {error && (
          <div className="alert m_inline m_danger" role="alert">
            {error}
            <button className="btn m_small" type="button" onClick={load}>다시 시도</button>
          </div>
        )}

        <section className="p_queue">
          <h2 className="p_section_title">처리 대기</h2>
          <div className="i_grid">
            {queue.map((q) => (
              <Link key={q.href} href={q.href} className="i_qcard"
                data-alert={q.count && q.count > 0 ? "" : undefined}>
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

        <section className="p_list">
          <div className="i_head">
            <h2 className="p_section_title">발송할 주문</h2>
            <Link className="i_more" href="/seller/orders?status=preparing">전체 보기 →</Link>
          </div>
          {preparing === null ? (
            <p className="p_loading" role="status">불러오는 중…</p>
          ) : preparing.length === 0 ? (
            <p className="p_empty">발송할 주문이 없습니다.</p>
          ) : (
            <div className="table_wrap">
              <div className="table_scroll"><table className="table_data">
                <thead>
                  <tr>
                    <th>주문번호</th>
                    <th>수령인</th>
                    <th>품목</th>
                  </tr>
                </thead>
                <tbody>
                  {preparing.map((o) => (
                    <tr key={o.sub_order_id}>
                      <td>
                        <strong>{o.order_no}</strong>
                        <span className="i_time">{formatDateTime(o.created_at)}</span>
                        {o.all_canceled && <span className="badge m_small m_danger">전체 취소됨</span>}
                      </td>
                      <td>
                        {o.recipient_name}
                        <span className="i_phone">{o.recipient_phone}</span>
                      </td>
                      <td>
                        <ul className="i_lines">
                          {o.items.filter((l) => l.status !== "canceled").map((line, idx) => (
                            <li key={idx}>
                              {line.product_name}
                              {line.option_text && <span className="i_line_option"> · {line.option_text}</span>}
                              <span className="i_line_qty"> × {line.quantity}</span>
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          )}
        </section>

        <section className="p_list">
          <div className="i_head">
            <h2 className="p_section_title">
              품절 임박{dashboard && ` — 재고 ${dashboard.low_stock_threshold}개 이하`}
            </h2>
            <Link className="i_more" href="/seller/products">상품 관리 →</Link>
          </div>
          {dashboard === null ? (
            <p className="p_loading" role="status">불러오는 중…</p>
          ) : lowStock.length === 0 ? (
            <p className="p_empty">품절 임박 상품이 없습니다.</p>
          ) : (
            <div className="table_wrap">
              <div className="table_scroll"><table className="table_data">
                <thead>
                  <tr>
                    <th>상품</th>
                    <th>옵션</th>
                    <th className="m_num">남은 재고</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStock.map((s, idx) => (
                    <tr key={`${s.product_id}-${idx}`}>
                      <td>{s.product_name}</td>
                      <td className="m_muted">{s.option_text || "-"}</td>
                      <td className="m_num"><span className="i_stock">{s.stock.toLocaleString()}개</span></td>
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
