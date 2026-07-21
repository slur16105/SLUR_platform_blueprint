import type { Metadata } from "next";

import { BROKER_NOTICE, COMPANY } from "@/app/config/company";
import "@/app/styles/policy.css";

export const metadata: Metadata = {
  title: "이용약관 | SLUR",
  description: "SLUR 서비스 이용약관",
};

export default function TermsPage() {
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
          <h1 className="p_title">이용약관</h1>
          <p className="p_meta">시행일: 실서비스 오픈 시 확정 (초안)</p>
        </header>

        <section className="p_section">
          <h2>제1조 (목적)</h2>
          <p>
            이 약관은 {COMPANY.name}(이하 &ldquo;회사&rdquo;)가 운영하는 SLUR 서비스(이하 &ldquo;서비스&rdquo;)에서
            회사와 이용자 간의 권리·의무 및 책임 사항, 서비스 이용 조건과 절차를 정함을 목적으로 합니다.
          </p>
        </section>

        <section className="p_section">
          <h2>제2조 (정의)</h2>
          <ol>
            <li><strong>서비스</strong>: 회사가 운영하는 큐레이션형 커머스 플랫폼으로, 판매자와 구매자 간 통신판매를 중개하는 온라인 마켓플레이스를 말합니다.</li>
            <li><strong>구매자</strong>: 서비스를 통해 판매자의 상품을 구매하는 이용자를 말합니다.</li>
            <li><strong>판매자</strong>: 회사의 심사·승인을 거쳐 서비스에 입점하여 상품을 판매하는 사업자를 말합니다.</li>
            <li><strong>주문 묶음</strong>: 하나의 주문 안에서 동일한 판매자의 상품을 묶은 단위를 말하며, 배송과 취소는 이 단위로 처리됩니다.</li>
          </ol>
        </section>

        <section className="p_section">
          <h2>제3조 (통신판매중개자의 지위와 면책)</h2>
          <p>{BROKER_NOTICE}</p>
          <ol>
            <li>회사는 통신판매중개자로서 거래 시스템을 제공할 뿐, 판매자와 구매자 간에 이루어지는 거래의 당사자가 아닙니다.</li>
            <li>상품의 정보, 품질, 배송, 하자 및 거래 이행에 관한 의무와 책임은 해당 상품을 등록한 판매자에게 있습니다.</li>
            <li>다만 회사는 관계 법령이 통신판매중개자에게 부과하는 책임을 부담하며, 분쟁이 발생한 경우 그 해결을 위해 성실히 노력합니다.</li>
          </ol>
        </section>

        <section className="p_section">
          <h2>제4조 (계정)</h2>
          <ol>
            <li>서비스 이용을 위해서는 이메일 주소로 계정을 생성해야 하며, 하나의 계정으로 구매자·판매자 등 복수의 역할을 보유할 수 있습니다.</li>
            <li>계정 정보(이메일·비밀번호)의 관리 책임은 이용자 본인에게 있으며, 이를 제3자에게 양도하거나 대여할 수 없습니다.</li>
            <li>타인의 정보 도용, 부정한 방법으로 서비스를 이용하는 행위가 확인되는 경우 회사는 해당 계정의 이용을 제한할 수 있습니다.</li>
          </ol>
        </section>

        <section className="p_section">
          <h2>제5조 (구매·결제·취소)</h2>
          <ol>
            <li>구매자는 서비스가 정한 절차에 따라 주문하며, 주문 완료 시 배송지 정보와 결제 안내가 제공됩니다.</li>
            <li>결제는 무통장입금 방식으로 하며, 회사(관리자)가 입금을 확인한 때에 결제가 완료됩니다.</li>
            <li>주문 시 안내되는 입금 기한 내에 입금이 확인되지 않은 주문은 자동으로 취소되며, 이 경우 별도의 통지 없이 주문이 취소될 수 있습니다.</li>
            <li>구매자는 판매자별 주문 묶음 단위로 주문을 취소할 수 있습니다. 묶음의 일부 상품만 개별 취소할 수는 없습니다.</li>
            <li>취소는 해당 묶음의 배송 준비가 시작되기 전까지 가능하며, 배송 준비가 시작된 이후에는 직접 취소할 수 없고 회사에 문의해야 합니다.</li>
            <li>입금 완료 전 주문의 모든 묶음이 취소된 경우 해당 주문 전체가 취소 처리됩니다.</li>
          </ol>
        </section>

        <section className="p_section">
          <h2>제6조 (청약철회·환불)</h2>
          <p>
            배송 완료 후의 청약철회·환불 규정은 실서비스 오픈 전 확정·게시합니다. 현 단계의 서비스는
            내부 테스트 전용으로 운영되며, 실제 외부 구매자를 대상으로 하지 않습니다.
          </p>
        </section>

        <section className="p_section">
          <h2>제7조 (판매자의 의무)</h2>
          <ol>
            <li>판매자는 상품명·가격·옵션·배송 조건 등 상품 정보를 정확하게 등록하고 최신 상태로 유지해야 합니다.</li>
            <li>판매자는 결제가 확인된 주문에 대해 성실히 배송을 이행하고, 상품의 하자·오배송 등에 대한 책임을 부담합니다.</li>
            <li>판매자는 전자상거래 등에서의 소비자보호에 관한 법률 등 관계 법령을 준수해야 합니다.</li>
          </ol>
        </section>

        <section className="p_section">
          <h2>제8조 (분쟁 해결)</h2>
          <ol>
            <li>거래에 관한 분쟁은 원칙적으로 거래 당사자인 판매자와 구매자 간에 해결합니다.</li>
            <li>회사는 분쟁의 공정하고 신속한 해결을 위해 필요한 조치를 취하도록 노력하며, 이용자는 {COMPANY.email}로 분쟁 조정을 요청할 수 있습니다.</li>
            <li>이 약관과 서비스 이용에 관한 분쟁에는 대한민국 법을 적용합니다.</li>
          </ol>
        </section>

        <section className="p_section">
          <h2>부칙</h2>
          <p>이 약관은 실서비스 오픈일에 맞추어 시행일을 확정하며, 시행 전 법률 전문가의 검토를 거쳐 개정될 수 있습니다.</p>
        </section>
      </div>
    </main>
  );
}
