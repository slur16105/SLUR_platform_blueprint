/* 금액 포맷 — 구매자 표면 전체가 이 함수 하나로 낸다 (D13).
   8.4~8.6도 같은 함수를 쓴다. 화면마다 다시 쓰면 어딘가에서 ₩나 축약이 생긴다.

   🚨 로케일을 생략하지 않는다. toLocaleString()은 서버와 브라우저의 기본 로케일이 다르면
      하이드레이션 불일치를 만든다 — "ko-KR"을 명시해 못 박는다.
   자릿수 정렬(tabular-nums)은 type.css의 금액 역할 클래스가 이미 갖고 있다. */

/** `32,000원` — ₩·소수점·축약 없음 (UX-DR15). */
export function formatWon(n: number): string {
  return `${n.toLocaleString("ko-KR")}원`;
}

/** `2026년 7월 24일까지` — 입금 기한 (8.5 D10).
 *
 *  🚨 timeZone을 고정하지 않으면 날짜가 하루 어긋난다. deposit_due_at은 UTC로 내려오고
 *     (`datetime.now(timezone.utc) + timedelta(days=…)`), 서버 렌더와 브라우저 렌더가
 *     다른 타임존을 쓰면 하이드레이션까지 불일치한다. 기한이 어긋나면 주문이 자동취소되는
 *     값이라 반올림 사고가 허용되지 않는다 — 로케일과 함께 "Asia/Seoul"을 못 박는다.
 *  파싱할 수 없는 값이면 빈 문자열을 돌려준다 — 화면에 `Invalid Date`를 내지 않는다. */
export function formatDepositDue(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(at);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}년 ${get("month")}월 ${get("day")}일까지`;
}
