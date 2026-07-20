import Link from "next/link";

import { BROKER_NOTICE, COMPANY } from "./config/company";
import "./site-footer.css";

export default function SiteFooter() {
  return (
    <footer className="layout_footer">
      <div className="l_inner">
        <p className="l_company">
          {COMPANY.name} · 대표 {COMPANY.representative} · 사업자등록번호 {COMPANY.businessRegistrationNumber} · 통신판매업 신고 {COMPANY.mailOrderNumber}
        </p>
        <p className="l_company">
          {COMPANY.address} · {COMPANY.contact} · {COMPANY.email}
        </p>
        <p className="l_notice">{BROKER_NOTICE}</p>
        <nav className="l_links" aria-label="정책 문서">
          <Link href="/terms">이용약관</Link>
          <Link href="/privacy">개인정보처리방침</Link>
        </nav>
      </div>
    </footer>
  );
}
