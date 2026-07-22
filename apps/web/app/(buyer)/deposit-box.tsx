/* 입금 안내 상자 (FR-23, UX-DR14, 8.5 D11).

   v1 결제가 무통장입금뿐이라 이것이 주문 이후 가장 중요한 컴포넌트다.
   DESIGN.md가 두 변형을 확정했다 —
     · placed(주문완료) : 종이 면 + 1.5px 액센트 테두리 + 노치 캡션 + 27px 금액. 화면에서 가장 무겁다.
     · detail(주문상세) : accent-wash 면 + 1px accent-line + 20px 금액. 조용히 얹힌다.
   **8.5는 placed만 구현한다.** 렌더되지 않는 CSS를 미리 커밋하면 8.6이 "이미 있다"고 믿고
   눈으로 검증하는 단계를 건너뛴다. 8.6이 variant에 "detail"을 더하고 CSS도 그때 붙인다.
   두 변형이 하나의 컴포넌트라는 사실을 **파일 위치**((buyer) 루트)로 표현해 둔다.

   🚨 `예금주` 줄을 만들지 않는다. 백엔드에는 settings의 deposit_account **문자열 하나**뿐이고
      (시드값 `은행/계좌번호/예금주 미설정`, 관리자 화면에서 1~200자 자유 문자열로 수정),
      없는 필드를 화면이 쪼갤 수 없다. 예금주는 운영자가 그 문자열 안에 넣는다 (위험 1).
   🚨 금액·계좌·기한은 전부 서버 값이다 — 하드코딩하지 않는다 (AD-13).
   🚨 메모의 괄호 이름(`(김소연)`)을 넣지 않는다. 주문에는 recipient_name(수령인)만 있고
      **주문자 이름 필드가 없다** — 선물처럼 둘이 다르면 화면이 거짓말을 한다. */

import { formatDepositDue, formatWon } from "./format";

const MEMO = "입금자명을 주문자 이름과 같게 해주세요."; // [ASSUMPTION] Slur 확인 항목
const EXPIRED_NOTE = "기한이 지나 곧 자동 취소됩니다."; // [ASSUMPTION]

export type DepositBoxProps = {
  /** 8.6이 "detail"을 더한다 */
  variant: "placed";
  amount: number;
  /** settings의 한 문자열 그대로 — 은행/번호/예금주로 쪼개지 않는다 */
  account: string;
  /** ISO(UTC). 표시는 Asia/Seoul 고정 (D10) */
  dueAt: string;
  /** 서버 파생값. 주문 직후에는 항상 false지만 나중에 다시 열면 true일 수 있다 */
  expired?: boolean;
};

export default function DepositBox({ variant, amount, account, dueAt, expired = false }: DepositBoxProps) {
  const due = formatDepositDue(dueAt);
  return (
    <section className={`b_deposit_box m_${variant}`} aria-labelledby="dp_cap">
      <span className="i_cap" id="dp_cap">
        입금 안내
      </span>

      <p className="i_amount_label">입금 금액</p>
      <p className="b_deposit_amount i_amount">{formatWon(amount)}</p>

      <dl className="i_rows">
        <div className="i_row">
          <dt className="b_meta i_key">입금 계좌</dt>
          <dd className="i_value">{account}</dd>
        </div>
        <div className="i_row">
          <dt className="b_meta i_key">입금 기한</dt>
          <dd className="i_value m_due">{due}</dd>
        </div>
      </dl>
      {expired ? <p className="i_expired">{EXPIRED_NOTE}</p> : null}

      <p className="i_memo">{MEMO}</p>
    </section>
  );
}
