import Link from "next/link";

import { COMPANY } from "@/app/config/company";
import BuyerShell from "../buyer-shell";
import BuyerPageHeading from "../buyer-page-heading";
import { BrokerNotice } from "../seller-info";
import AccountCard from "./account-card";
import LogoutLink from "./logout-link";
import "./me.css";

/* 내 정보 — `/me` (보호 라우트).

   D1 — 이 화면은 웹 푸터의 모바일 대응이다. 8.1이 구매자 라우트에서 SiteFooter를 뺐으므로
        **구매자에게 FR-31·33이 닿는 경로는 여기 하나뿐**이다. 편의 기능이 아니라 규제 요건의
        유일한 수용처이며, 그 사실이 아래 D3의 층 분리를 강제한다.

   D3 — 두 층으로 가른다. 이 서버 컴포넌트가 셸·메뉴 줄·사업자 정보·중개자 고지를 **API 없이**
        정적으로 그리고, 계정 구획(<AccountCard />)과 로그아웃(<LogoutLink />)만 클라이언트다.
        🚨 계정 조회가 실패해도 법적 고지가 사라지면 안 된다 — 그 결합을 물리적으로 만들지 않는다.

   D2 — `가입 방식` 줄을 만들지 않는다. MeResponse는 {id, email, name, phone}뿐이고
        email 유무로 가입 경로를 추론하면 **이메일이 있는 카카오 계정에 "이메일 가입"**이라고 쓰게 된다.

   🚨 셸 호출 형태(tab="me" · showTabbar · topbar.variant="title")를 바꾸지 않는다 —
      8.1이 탭 활성 판정에 쓴다. 상단바는 **좌측 정렬** `내 정보`다(목업은 중앙 정렬이지만
      EXPERIENCE §IA가 좌측 정렬로 확정했고 DESIGN/EXPERIENCE가 목업을 이긴다, AD-14).
   바깥 틀 .b_frame은 상단바·푸터와 같은 정렬선(content-max)을 공유하고, "끝까지 한 단"의 읽기 폭
   (640, UX-DR4)은 안쪽 열 .b_col_read가 좌측 정렬로 갖는다 (오너 확정 2026-07-27, m_read 대체).
   🚨 회원정보 수정·배송지 관리·찜·전화번호 표시를 붙이지 않는다 (v1 밖, EXPERIENCE §IA 확정). */

/** 사업자 정보 6항목 (UX-DR10). 🚨 값은 전부 COMPANY 상수에서 온다 — 화면 코드에
 *  상호·번호·주소 문자열을 다시 쓰지 않는다 (AD-13). 실정보 교체(오픈 게이트)가
 *  다지점 수정이 되는 순간, 그날 하나를 빼먹는 것이 곧 법적 고지 회귀다.
 *  COMPANY.email은 목업 6항목에 없다 — 넣지 않는다. */
const BIZ_ROWS: ReadonlyArray<{ label: string; value: string }> = [
  { label: "상호", value: COMPANY.name },
  { label: "대표자", value: COMPANY.representative },
  { label: "사업자등록번호", value: COMPANY.businessRegistrationNumber },
  { label: "통신판매업 신고번호", value: COMPANY.mailOrderNumber },
  { label: "주소", value: COMPANY.address },
  { label: "연락처", value: COMPANY.contact },
];

/** 메뉴 줄 — 내비게이션이지 설정이 아니다. 주문내역 외의 앱 기능을 더하지 않는다.
 *  `/terms`·`/privacy`는 6.1이 만든 정책 페이지 그대로다(사본을 만들지 않는다, FR-33). */
const MENU: ReadonlyArray<{ href: string; label: string }> = [
  { href: "/orders", label: "주문내역" },
  { href: "/terms", label: "이용약관" },
  { href: "/privacy", label: "개인정보처리방침" },
];

export default function MePage() {
  return (
    <BuyerShell tab="me" showTabbar topbar={{ variant: "title", title: "내 정보" }}>
      <div className="b_frame">
        <div className="b_me b_col_read">
          <BuyerPageHeading title="내 정보" />
        {/* 계정 — 유일한 API 의존 구획 */}
        <section className="i_sec i_acct_sec" aria-labelledby="me_h_acct">
          <AccountCard headingId="me_h_acct" />
        </section>

        {/* 메뉴 줄 — 8px 종이 접기 띠로 구획을 가른다 (UX-DR12).
            행 전체가 링크이고 높이가 44px 이상이다 (UX-DR7).
            우측 셰브런은 CSS 도형이다 — 인라인 SVG는 [data-surface="buyer"] svg의
            stroke-width 전역 규칙을 물려받는다 (8.4 학습 12). */}
        <nav className="i_menu" aria-label="내 정보 메뉴">
          {MENU.map(({ href, label }) => (
            <Link key={href} href={href} className="i_menu_item">
              <span className="b_control i_label">{label}</span>
              <span className="i_chev" aria-hidden="true" />
            </Link>
          ))}
        </nav>

        {/* 사업자 정보 + 중개자 고지 (FR-31, UX-DR10) — API 없이 선다 */}
        <section className="i_sec i_biz_sec" aria-labelledby="me_h_biz">
          <div className="i_biz_head">
            <h2 className="b_section_label i_biz_label" id="me_h_biz">
              사업자 정보
            </h2>
            {/* placeholder를 실제 정보로 오인하지 않게 하는 장치. 점선 상자와 한 벌이다. */}
            <span className="b_tag i_ph_tag">임시 정보</span>
          </div>
          <dl className="i_biz_box b_row">
            {BIZ_ROWS.map(({ label, value }) => (
              <div className="b_kv_row" key={label}>
                <dt className="i_key">{label}</dt>
                <dd className="i_value">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="b_notice i_biz_note">실사업자 정보는 서비스 오픈 전에 교체됩니다.</p>
          {/* 🚨 문장을 복사하지 않는다 — 정본은 config/company.ts의 BROKER_NOTICE다 (8.3 D10).
              접히지 않는다. 모달·별도 페이지·`더보기` 뒤로 숨기지 않는다 (UX-DR10). */}
          <BrokerNotice className="i_broker" />
        </section>

          {/* 로그아웃 — 약한 텍스트 버튼. 위 1px hairline. 빨강·경고색을 쓰지 않는다. */}
          <div className="i_logout_sec">
            <LogoutLink />
          </div>
        </div>
      </div>
    </BuyerShell>
  );
}
