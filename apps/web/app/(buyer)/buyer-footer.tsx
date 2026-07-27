import { BROKER_NOTICE, COMPANY } from "@/app/config/company";
import PolicyLink from "./legal/policy-link";

/* 구매자 푸터 `b_footer` — 전 구매자 화면 공통 (Q3, DESIGN §푸터).
   법정 고지가 스크롤 끝에서 항상 서도록 셸(buyer-shell)이 모든 구매자 화면 하단에 건다 —
   홈만이 아니다. /me의 사업자 정보와 내용이 겹치나 중복은 법적으로 무해하다(DESIGN §544).

   🚨 회사정보·중개자 고지 문구를 여기서 창작하지 않는다 — 정본은 config/company.ts다.
   🚨 정책 링크는 6.1이 만든 /terms·/privacy 그대로다(사본을 만들지 않는다, FR-33).
      목업의 세 번째 링크 `사업자 정보`는 전용 라우트가 없어(내용은 아래 회사정보 블록이 곧 그것이다)
      죽은 링크를 만들지 않고 생략한다 — site-footer.tsx 선례와 같다.

   훅이 없으므로 "use client"를 붙이지 않는다 — 서버 컴포넌트로 선다.

   tabbar prop: <768 하단 고정 탭바가 서는 화면에서만 그 높이만큼 아래 여백을 확보해
   푸터 끝이 탭바에 가리지 않게 한다(≥768에서는 탭바가 사라져 0).
   cta prop: <768 하단 고정 CTA 바(.b_cta_bar)가 서는 화면에서 그 바 높이만큼 아래 여백을 확보해
   법정 고지가 바에 가리지 않게 한다(≥768에서는 바가 사라져 0). */
export default function BuyerFooter({ tabbar = false, cta = false }: { tabbar?: boolean; cta?: boolean }) {
  return (
    <footer className="b_footer" data-tabbar={tabbar ? "on" : undefined} data-cta={cta ? "on" : undefined}>
      <div className="b_container i_in">
        <p className="i_mark">SLUR</p>
        <nav className="i_links" aria-label="정책 문서">
          {/* 클릭 시 모달로 가로챈다(맥락 유지). JS 미탑재·새 탭이면 /terms·/privacy로 이동(폴백). */}
          <PolicyLink kind="terms">이용약관</PolicyLink>
          <PolicyLink kind="privacy">개인정보처리방침</PolicyLink>
        </nav>
        <div className="i_company">
          <p>
            {COMPANY.name} · 대표 {COMPANY.representative} · 사업자등록번호{" "}
            {COMPANY.businessRegistrationNumber} · 통신판매업 신고 {COMPANY.mailOrderNumber}
          </p>
          <p>
            {COMPANY.address} · {COMPANY.contact} · {COMPANY.email}
          </p>
          <p className="b_notice i_broker">{BROKER_NOTICE}</p>
          {/* 임시 정보 규칙(EXPERIENCE §법적 고지) — 실사업자 정보 교체 전까지 선다. /me와 같은 문장. */}
          <p className="b_notice i_temp">실사업자 정보는 서비스 오픈 전에 교체됩니다.</p>
          <p className="i_copy">© SLUR</p>
        </div>
      </div>
    </footer>
  );
}
