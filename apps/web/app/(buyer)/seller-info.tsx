/* 판매자 신원정보 6항목 + 중개자 고지 (FR-32, UX-DR10).

   이 배치는 디자인 취향이 아니라 규제 요건이다 — 청약(`장바구니 담기`·`바로 구매`) 버튼보다
   반드시 위에 있어야 하고, 모달·별도 페이지·`더보기` 뒤로 숨길 수 없다.
   ≥768에서도 우측 sticky 칼럼이 아니라 2단 아래 전체 폭에 놓인다 (browse.css의 grid 영역).
   접이식이되 기본 펼침 — <details open>.

   🚨 고지 문구는 app/config/company.ts의 BROKER_NOTICE 상수 하나에서 온다 (D10).
      화면 코드에 문장을 다시 쓰지 않는다 — 상수는 COMPANY.name에서 파생되므로
      실사업자 정보 교체(오픈 게이트)가 한 줄 수정으로 전 표면(웹 푸터·상품상세·주문서·내 정보)에
      반영된다. 화면마다 문장을 박으면 그날 하나를 빼먹는 것이 법적 고지 회귀가 된다.

   상품상세에는 `임시 정보` 태그를 두지 않는다 — 여기 6항목은 판매자 실데이터이고,
   placeholder인 것은 플랫폼 사업자 정보(/me, 8.7)다. */

import { BROKER_NOTICE } from "@/app/config/company";

/** GET /api/v1/products/{id}의 seller_info (SellerInfo). 판매자 부재는 비정상 데이터라 빈 문자열 방어가 걸려 있다. */
export type SellerInfoData = {
  brand_name: string;
  company_name: string;
  representative_name: string;
  business_registration_number: string;
  mail_order_number: string;
  business_address: string;
  contact_phone: string;
};

const ROWS: ReadonlyArray<{ label: string; key: keyof SellerInfoData }> = [
  { label: "상호", key: "company_name" },
  { label: "대표자", key: "representative_name" },
  { label: "사업자등록번호", key: "business_registration_number" },
  { label: "통신판매업 신고번호", key: "mail_order_number" },
  { label: "사업장 주소", key: "business_address" },
  { label: "연락처", key: "contact_phone" },
];

/** 중개자 고지 한 줄. 8.5(주문서)가 6항목 없이 이것만 재사용할 수 있게 분리해 둔다. */
export function BrokerNotice({ className }: { className?: string }) {
  return <p className={["b_notice b_broker", className].filter(Boolean).join(" ")}>{BROKER_NOTICE}</p>;
}

export default function SellerInfoSection({ info }: { info: SellerInfoData }) {
  // 상호가 비면 빈 6행 상자를 노출하지 않는다 (6.2 리뷰 패치와 같은 규칙). 고지는 남는다.
  const showBox = info.company_name.trim() !== "";

  return (
    <section className="b_legal">
      {showBox ? (
        <details className="b_seller_info" open>
          <summary className="i_summary">
            <span className="b_section_label i_head">판매자 정보</span>
            <span className="i_caret" aria-hidden="true" />
          </summary>
          <dl className="i_box">
            {ROWS.map(({ label, key }) => (
              <div className="b_row i_row" key={key}>
                <dt className="b_meta i_key">{label}</dt>
                <dd className="i_value">{info[key]}</dd>
              </div>
            ))}
          </dl>
        </details>
      ) : null}
      <BrokerNotice />
    </section>
  );
}
