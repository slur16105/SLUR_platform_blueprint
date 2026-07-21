import BuyerShell from "../buyer-shell";

/* 내 정보 — `/me` (보호 라우트).
   🚧 자리표시. 내용은 8.7이 대체한다 — 사업자 정보·중개자 고지(FR-31)·약관 링크(FR-33)가
      구매자 표면에서 놓일 자리가 여기다(구매자 라우트에는 상시 푸터가 없다).
   읽는 화면이므로 ≥768에서 본문을 640px로 묶는다 (m_read). */
export default function MePage() {
  return (
    <BuyerShell tab="me" showTabbar topbar={{ variant: "title", title: "내 정보" }}>
      <div className="b_container m_read b_stub">
        <p className="b_body">내 정보는 8.7에서 채웁니다.</p>
        <p className="b_notice i_note">탭 목적지 확인을 위한 자리표시 화면입니다.</p>
      </div>
    </BuyerShell>
  );
}
