import { BROKER_NOTICE, COMPANY } from "@/app/config/company";

/* 약관·개인정보처리방침 본문 — 단일 콘텐츠 소스 (중복 창작 금지).
   두 곳이 이 컴포넌트를 함께 렌더한다:
   · 독립 페이지 `/terms`·`/privacy` (console 그룹, policy.css로 스타일) — 딥링크·비JS 폴백.
   · 구매자 정책 모달 (buyer 그룹, buyer.css의 .b_policy로 buyer 톤 재스타일).
   훅이 없는 순수 컴포넌트라 서버(페이지)·클라이언트(모달) 양쪽에서 쓸 수 있다.
   마크업(alert·p_title·p_section)은 바꾸지 않는다 — console 렌더 결과가 그대로 유지된다. */

export function TermsDoc() {
  return (
    <>
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
    </>
  );
}

export function PrivacyDoc() {
  return (
    <>
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
          <li><strong>회원가입 시 (필수)</strong>: 이메일 주소, 이름, 비밀번호 (비밀번호는 복호화할 수 없는 해시 형태로만 저장합니다)</li>
          <li><strong>회원가입 시 (선택)</strong>: 휴대폰 번호</li>
          <li><strong>주문 시 (필수)</strong>: 수령인 이름, 수령인 연락처, 배송지 주소</li>
          <li><strong>판매자 입점 신청 시 (필수)</strong>: 상호, 대표자명, 사업자등록번호, 통신판매업 신고번호, 사업장 주소, 연락처, 브랜드명·브랜드 소개</li>
        </ul>
        <p>서비스 이용 과정에서 접속 기록 등 서비스 이용 기록이 자동으로 생성되어 수집될 수 있습니다.</p>
        <p>
          판매자 입점 신청이 반려된 경우에도 재신청 심사와 부정 신청 방지를 위해 신청 내역과 반려 사유가
          보존될 수 있습니다.
        </p>
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
    </>
  );
}
