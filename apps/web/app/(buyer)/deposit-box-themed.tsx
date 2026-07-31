/* 입금 안내 상자 — **새 테마 판** (FR-23, UX-DR14).

   v1 결제가 무통장입금뿐이라 주문 이후 가장 중요한 부품이다.
   🚨 deposit-box.tsx의 내용을 그대로 옮기되 **포맷 함수(formatWon·formatDepositDue)는 재사용**한다 —
      계좌 문자열 처리·기한 포맷이 두 벌이 되면 언젠가 어긋난다.
   🚨 금액·계좌·기한은 전부 서버 값이다 — 하드코딩하지 않는다 (AD-13).
   🚨 계좌는 2026-07-31부터 은행·계좌번호·예금주 3필드다. 서버가 조립한 `account`(한 줄)와
      분리 필드를 함께 내려주므로, 분리 값이 오면 `예금주` 줄을 따로 보여준다(구매자가 가장 많이
      확인하는 정보). 옛 데이터·미설정 환경에서는 분리 값이 비어 있어 한 줄 표기로 폴백한다.
   🚨 메모에 괄호 이름을 넣지 않는다 — 주문에는 수령인만 있고 주문자 이름 필드가 없다. */

import { formatDepositDue, formatWon } from "./format";

const MEMO = "입금자명을 주문자 이름과 같게 해주세요.";
const EXPIRED_NOTE = "기한이 지나 곧 자동 취소됩니다.";

export default function DepositBoxThemed({
  amount,
  account,
  bank = "",
  accountNo = "",
  holder = "",
  dueAt,
  expired = false,
}: {
  amount: number;
  /** 서버가 조립한 한 줄 표기 (분리 필드가 비었을 때의 폴백) */
  account: string;
  bank?: string;
  accountNo?: string;
  holder?: string;
  /** ISO(UTC). 표시는 Asia/Seoul 고정 */
  dueAt: string;
  expired?: boolean;
}) {
  const due = formatDepositDue(dueAt);
  return (
    <section className="border border-foreground p-7" aria-labelledby="dp_cap">
      <span id="dp_cap" className="text-[12px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        입금 안내
      </span>

      <p className="mt-5 text-[13px] text-muted-foreground">입금 금액</p>
      <p className="mt-1 text-[32px] font-semibold tabular-nums">{formatWon(amount)}</p>

      <dl className="mt-6 space-y-3 text-[14px]">
        <div className="flex gap-5">
          <dt className="w-20 flex-none text-muted-foreground">입금 계좌</dt>
          <dd className="font-medium">{bank && accountNo ? `${bank} ${accountNo}` : account}</dd>
        </div>
        {holder ? (
          <div className="flex gap-5">
            <dt className="w-20 flex-none text-muted-foreground">예금주</dt>
            <dd className="font-medium">{holder}</dd>
          </div>
        ) : null}
        <div className="flex gap-5">
          <dt className="w-20 flex-none text-muted-foreground">입금 기한</dt>
          <dd className="font-medium">{due}</dd>
        </div>
      </dl>

      {expired ? <p className="mt-5 text-[13px] font-medium text-accent">{EXPIRED_NOTE}</p> : null}

      <p className="mt-5 border-t border-border pt-4 text-[13px] text-muted-foreground">{MEMO}</p>
    </section>
  );
}
