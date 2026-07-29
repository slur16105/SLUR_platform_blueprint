"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import ConsoleShell from "@/app/(console)/console-shell";
import "./user-detail.css";

type Seller = {
  id: string;
  brand_name: string;
  brand_intro: string;
  company_name: string;
  representative_name: string;
  business_registration_number: string;
  mail_order_number: string;
  business_address: string;
  contact_phone: string;
  base_shipping_fee: number;
  jeju_extra_fee: number;
  island_extra_fee: number;
  product_count: number;
  created_at: string;
};

type UserDetail = {
  id: string;
  email: string;
  name: string;
  roles: string[];
  created_at: string;
  seller: Seller | null;
};

const ROLE_LABEL: Record<string, string> = { buyer: "구매자", seller: "판매자", admin: "관리자" };
const ROLE_BADGE: Record<string, string> = { buyer: "", seller: "m_brand", admin: "m_danger" };
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function formatDateTime(s: string) {
  return new Date(s).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Seoul" });
}

export default function AdminUserDetail() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === "string" ? params.id : "";
  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!UUID_RE.test(id)) {
      setLoading(false);
      return void setError("올바르지 않은 회원 주소입니다.");
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${id}`);
      if (res.status === 401) return void router.replace("/login");
      if (res.status === 403) return void router.replace("/no-role"); // R7: FastAPI 판정 결과를 따른다
      if (res.status === 404) return void setError("회원을 찾을 수 없습니다.");
      if (!res.ok) return void setError("회원 정보를 불러오지 못했습니다. 다시 시도해 주세요.");
      setUser(await res.json());
    } catch {
      setError("네트워크 연결을 확인해 주세요.");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    void (async () => { await load(); })();
  }, [load]);

  const roles = user?.roles ?? [];
  const fees = user?.seller;

  return (
    <ConsoleShell role="admin" title="회원 상세">
      <div className="page_admin_user">
      <Link className="p_back" href="/admin/lookup"><span aria-hidden="true">←</span> 회원 관리</Link>
      {error && <div className="alert m_inline m_danger" role="alert">{error}</div>}
      {loading && <p className="p_loading" role="status">불러오는 중…</p>}
      {!loading && user && (
        <>
          <section className="card p_block">
            <div className="i_block_head">
              <h2 className="i_title">기본 정보</h2>
              <div className="i_roles">
                {roles.length === 0 && <span className="badge m_small">구매자</span>}
                {roles.map((r) => (
                  <span key={r} className={`badge m_small ${ROLE_BADGE[r] ?? ""}`.trim()}>{ROLE_LABEL[r] ?? r}</span>
                ))}
              </div>
            </div>
            <dl className="i_meta">
              <div><dt>이메일</dt><dd>{user.email || <span className="m_muted">(소셜 계정)</span>}</dd></div>
              <div><dt>이름</dt><dd>{user.name}</dd></div>
              <div><dt>가입일</dt><dd>{formatDateTime(user.created_at)}</dd></div>
            </dl>
            {user.email && (
              <div className="i_block_foot">
                <Link className="btn m_small" href={`/admin/orders?q=${encodeURIComponent(user.email)}`}>주문 이력 보기</Link>
              </div>
            )}
          </section>

          {fees && (
            <section className="card p_block">
              <div className="i_block_head">
                <h2 className="i_title">판매자 정보</h2>
                <Link className="btn m_small" href={`/admin/products?q=${encodeURIComponent(fees.brand_name)}`}>상품 {fees.product_count}개 보기</Link>
              </div>
              <dl className="i_meta">
                <div><dt>브랜드</dt><dd><strong>{fees.brand_name}</strong></dd></div>
                <div><dt>브랜드 소개</dt><dd>{fees.brand_intro}</dd></div>
                <div><dt>상호</dt><dd>{fees.company_name}</dd></div>
                <div><dt>대표자</dt><dd>{fees.representative_name}</dd></div>
                <div><dt>사업자번호</dt><dd>{fees.business_registration_number}</dd></div>
                <div><dt>통판신고</dt><dd>{fees.mail_order_number}</dd></div>
                <div><dt>사업장</dt><dd>{fees.business_address}</dd></div>
                <div><dt>연락처</dt><dd>{fees.contact_phone}</dd></div>
                <div><dt>배송비</dt><dd>기본 {fees.base_shipping_fee.toLocaleString()}원 · 제주 +{fees.jeju_extra_fee.toLocaleString()}원 · 도서 +{fees.island_extra_fee.toLocaleString()}원</dd></div>
              </dl>
            </section>
          )}
        </>
      )}
      </div>
    </ConsoleShell>
  );
}
