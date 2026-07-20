import type { Metadata } from "next";

import { COMPANY } from "../config/company";
import "../styles/policy.css";

export const metadata: Metadata = {
  title: "개인정보처리방침 | SLUR",
  description: "SLUR 개인정보처리방침",
};

export default function PrivacyPage() {
  return (
    <main className="page_policy">
      <div className="p_doc">
        <div className="alert m_warning" role="alert">
          <div className="i_body">
            <span className="i_title">법률 검토 전 초안</span>
            <span className="i_text">본 문서는 법률 검토 전 초안입니다. 실서비스 오픈 전 전문 검토를 거칩니다.</span>
          </div>
        </div>

        <header>
          <h1 className="p_title">개인정보처리방침</h1>
          <p className="p_meta">시행일: 실서비스 오픈 시 확정 (초안)</p>
        </header>

        <section className="p_section">
          <h2>1. 수집하는 개인정보 항목</h2>
          <p>
            {COMPANY.name}(이하 &ldquo;회사&rdquo;)는 서비스 제공에 필요한 최소한의 개인정보만을 수집합니다.
          </p>
          <ul>
            <li><strong>회원가입 시 (필수)</strong>: 이메일 주소, 이름</li>
            <li><strong>회원가입 시 (선택)</strong>: 휴대폰 번호</li>
            <li><strong>주문 시 (필수)</strong>: 수령인 이름, 수령인 연락처, 배송지 주소</li>
          </ul>
          <p>서비스 이용 과정에서 접속 기록 등 서비스 이용 기록이 자동으로 생성되어 수집될 수 있습니다.</p>
        </section>

        <section className="p_section">
          <h2>2. 개인정보의 수집·이용 목적</h2>
          <ul>
            <li>회원 식별, 본인 확인 및 로그인 등 계정 관리</li>
            <li>주문 접수, 결제(입금) 확인, 배송 처리 등 거래 이행</li>
            <li>주문·배송 상태 등 거래 관련 사항의 안내</li>
            <li>서비스 부정 이용 방지 및 문의·분쟁 대응</li>
          </ul>
        </section>

        <section className="p_section">
          <h2>3. 개인정보의 보유·이용 기간</h2>
          <p>
            회사는 회원 탈퇴 시 지체 없이 개인정보를 파기합니다. 다만 관계 법령에 따라 보존이 필요한 경우
            아래 기간 동안 해당 정보를 분리하여 보관합니다.
          </p>
          <ul>
            <li>계약 또는 청약철회 등에 관한 기록: 5년 (전자상거래 등에서의 소비자보호에 관한 법률)</li>
            <li>대금 결제 및 재화 등의 공급에 관한 기록: 5년 (전자상거래 등에서의 소비자보호에 관한 법률)</li>
            <li>소비자의 불만 또는 분쟁 처리에 관한 기록: 3년 (전자상거래 등에서의 소비자보호에 관한 법률)</li>
            <li>서비스 접속 기록: 3개월 (통신비밀보호법)</li>
          </ul>
        </section>

        <section className="p_section">
          <h2>4. 개인정보의 제3자 제공</h2>
          <p>
            회사는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 다만 주문한 상품의 배송을 위해
            아래와 같이 제공합니다.
          </p>
          <ul>
            <li><strong>제공받는 자</strong>: 이용자가 주문한 상품의 판매자</li>
            <li><strong>제공 항목</strong>: 수령인 이름, 수령인 연락처, 배송지 주소, 배송 요청사항</li>
            <li><strong>제공 목적</strong>: 주문 상품의 배송 및 배송 관련 연락</li>
            <li><strong>보유·이용 기간</strong>: 배송 완료 후 관계 법령에 따른 보존 기간까지</li>
          </ul>
        </section>

        <section className="p_section">
          <h2>5. 개인정보의 파기</h2>
          <p>
            회사는 보유 기간이 경과하거나 처리 목적이 달성된 개인정보를 지체 없이 파기합니다.
            전자적 파일 형태의 정보는 복구할 수 없는 기술적 방법으로 삭제하며, 종이 문서는 분쇄하거나 소각합니다.
          </p>
        </section>

        <section className="p_section">
          <h2>6. 개인정보 관련 문의</h2>
          <p>
            개인정보 처리에 관한 문의, 열람·정정·삭제·처리정지 요구는 아래 연락처로 하실 수 있습니다.
          </p>
          <ul>
            <li><strong>이메일</strong>: {COMPANY.email}</li>
            <li><strong>전화</strong>: {COMPANY.contact}</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
