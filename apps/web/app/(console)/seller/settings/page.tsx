"use client";

/* 판매자 설정 — 대시보드에 섞여 있던 배송비 설정을 독립 화면으로 분리(관리자 IA와 일치).
   브랜드 정보는 판매자가 스스로 바꿀 수 없다(입점 심사 승인 정보) — 읽기 전용으로 보여주고
   어디서 바뀌는지 안내한다. 상품·주문은 각자 메뉴가 정본이므로 여기서 다루지 않는다. */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import ConsoleShell from "@/app/(console)/console-shell";
import "./settings.css";

type Profile = {
  brand_name: string;
  brand_intro: string;
  company_name: string;
  base_shipping_fee: number;
  jeju_extra_fee: number;
  island_extra_fee: number;
};

const FEE_FIELDS = [
  { name: "base_shipping_fee", label: "기본 배송비", help: "구매자가 내 상품을 주문할 때 붙는 기본 배송비입니다. 0이면 무료배송으로 표시됩니다." },
  { name: "jeju_extra_fee", label: "제주 추가 배송비", help: "제주 주소로 배송할 때 기본 배송비에 더해집니다." },
  { name: "island_extra_fee", label: "도서산간 추가 배송비", help: "제주 외 도서산간 주소에 더해집니다." },
] as const;

export default function SellerSettings() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fees, setFees] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const r = await fetch("/api/sellers/me");
      if (r.status === 401) return void router.replace("/login");
      if (r.status === 403) return void router.replace("/no-role");
      if (!r.ok) return void setLoadError("설정을 불러오지 못했습니다.");
      const p: Profile = await r.json();
      setProfile(p);
      setFees({
        base_shipping_fee: String(p.base_shipping_fee),
        jeju_extra_fee: String(p.jeju_extra_fee),
        island_extra_fee: String(p.island_extra_fee),
      });
    } catch {
      setLoadError("네트워크 연결을 확인해 주세요.");
    }
  }, [router]);

  // 초기 로드 — 로더 호출을 effect 안 async 함수로 감싼다(React 데이터 페칭 관례).
  useEffect(() => {
    void (async () => { await load(); })();
  }, [load]);

  useEffect(() => () => { if (noticeTimer.current) clearTimeout(noticeTimer.current); }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const res = await fetch("/api/sellers/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base_shipping_fee: Number(fees.base_shipping_fee),
          jeju_extra_fee: Number(fees.jeju_extra_fee),
          island_extra_fee: Number(fees.island_extra_fee),
        }),
      });
      if (res.status === 401) return void router.replace("/login");
      if (res.status === 403) return void router.replace("/no-role");
      // 본문이 비어 있어도 catch로 흘러 "네트워크 연결" 오해를 부르지 않게 한다
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.details?.[0]?.reason ?? data?.message ?? "저장에 실패했습니다.");
        return;
      }
      if (data) setProfile(data);
      // 변경 시점부터의 새 주문에만 적용된다는 점을 분명히 — 기존 주문 금액은 바뀌지 않는다
      setNotice("배송비를 저장했습니다. 저장 이후 들어오는 주문부터 적용됩니다.");
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
      noticeTimer.current = setTimeout(() => setNotice(null), 5000);
    } catch {
      setError("네트워크 연결을 확인해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ConsoleShell role="seller" title="설정" description="배송비와 내 브랜드 정보를 관리합니다.">
      <div className="page_seller_settings">
        {notice && <div className="alert m_inline m_success" role="status">{notice}</div>}
        {loadError ? (
          <div className="alert m_inline m_danger" role="alert">
            {loadError}
            <button className="btn m_small" type="button" onClick={load}>다시 시도</button>
          </div>
        ) : !profile ? (
          <p className="p_empty" role="status">설정을 불러오는 중…</p>
        ) : (
          <div className="p_pair">
            <section className="card p_card">
              <h2 className="i_title">배송비</h2>
              <p className="i_desc">원 단위 정수로 입력합니다. 구매자 주문서에서 이 금액으로 계산됩니다.</p>
              {error && <div className="alert m_inline m_danger" role="alert">{error}</div>}
              <form className="i_form" onSubmit={save}>
                {FEE_FIELDS.map((f) => (
                  <div className="field" key={f.name}>
                    <label className="i_label" htmlFor={f.name}>{f.label}</label>
                    <input id={f.name} className="input_text" type="number" min={0} step={1} required
                      value={fees[f.name] ?? ""}
                      onChange={(e) => setFees((v) => ({ ...v, [f.name]: e.target.value }))} />
                    <span className="i_help">{f.help}</span>
                  </div>
                ))}
                <button className="btn m_primary i_submit" type="submit" disabled={busy}
                  data-state={busy ? "loading" : undefined}>저장</button>
              </form>
            </section>

            {/* 우측 열은 짧은 카드 둘을 세로로 — 좌측 배송비 카드와 같은 행 높이를 채운다 */}
            <div className="p_stack">
              <section className="card p_card">
                <h2 className="i_title">내 브랜드</h2>
                <dl className="i_info">
                  <div><dt>브랜드명</dt><dd>{profile.brand_name}</dd></div>
                  <div><dt>사업자명</dt><dd>{profile.company_name}</dd></div>
                  <div><dt>브랜드 소개</dt><dd>{profile.brand_intro || <span className="m_muted">(없음)</span>}</dd></div>
                </dl>
                <p className="i_hint">입점 심사 때 등록된 정보입니다. 변경이 필요하면 운영자에게 문의해 주세요.</p>
              </section>

              {/* 판매자가 여기 있을 것으로 기대하지만 이 화면이 다루지 않는 항목 — 어디로 가야 하는지 알려준다 */}
              <section className="card p_card">
                <h2 className="i_title">여기서 관리하지 않는 것</h2>
                <dl className="i_elsewhere">
                  <div>
                    <dt>상품 등록 · 가격 · 재고</dt>
                    <dd><Link href="/seller/products">상품 관리</Link>에서 합니다.</dd>
                  </div>
                  <div>
                    <dt>송장 입력 · 배송 처리</dt>
                    <dd><Link href="/seller/orders">주문 관리</Link>에서 합니다.</dd>
                  </div>
                  <div>
                    <dt>정산</dt>
                    <dd>결제 연동 전이라 아직 제공하지 않습니다.</dd>
                  </div>
                </dl>
              </section>
            </div>
          </div>
        )}
      </div>
    </ConsoleShell>
  );
}
