/* 금액 포맷 — 구매자 표면 전체가 이 함수 하나로 낸다 (D13).
   8.4~8.6도 같은 함수를 쓴다. 화면마다 다시 쓰면 어딘가에서 ₩나 축약이 생긴다.

   🚨 로케일을 생략하지 않는다. toLocaleString()은 서버와 브라우저의 기본 로케일이 다르면
      하이드레이션 불일치를 만든다 — "ko-KR"을 명시해 못 박는다.
   자릿수 정렬(tabular-nums)은 type.css의 금액 역할 클래스가 이미 갖고 있다. */

/** `32,000원` — ₩·소수점·축약 없음 (UX-DR15). */
export function formatWon(n: number): string {
  return `${n.toLocaleString("ko-KR")}원`;
}

/** Asia/Seoul 고정 파트 추출 — 날짜 함수 셋이 같은 규칙을 공유한다 (D11).
 *  파싱할 수 없는 값이면 null. 화면에 `Invalid Date`를 내지 않는다. */
function seoulParts(iso: string, opts: Intl.DateTimeFormatOptions): ((t: Intl.DateTimeFormatPartTypes) => string) | null {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  const parts = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", ...opts }).formatToParts(at);
  return (type) => parts.find((p) => p.type === type)?.value ?? "";
}

/** `2026년 7월 24일까지` — 입금 기한 (8.5 D10).
 *
 *  🚨 timeZone을 고정하지 않으면 날짜가 하루 어긋난다. deposit_due_at은 UTC로 내려오고
 *     (`datetime.now(timezone.utc) + timedelta(days=…)`), 서버 렌더와 브라우저 렌더가
 *     다른 타임존을 쓰면 하이드레이션까지 불일치한다. 기한이 어긋나면 주문이 자동취소되는
 *     값이라 반올림 사고가 허용되지 않는다 — 로케일과 함께 "Asia/Seoul"을 못 박는다.
 *  파싱할 수 없는 값이면 빈 문자열을 돌려준다 — 화면에 `Invalid Date`를 내지 않는다. */
export function formatDepositDue(iso: string): string {
  const get = seoulParts(iso, { year: "numeric", month: "numeric", day: "numeric" });
  if (!get) return "";
  return `${get("year")}년 ${get("month")}월 ${get("day")}일까지`;
}

/** `2026.07.21` — 주문내역 행의 날짜 (8.6 D11).
 *  created_at은 UTC로 내려온다. 타임존을 고정하지 않으면 다른 타임존에서 주문 날짜가 하루 어긋나고
 *  서버 렌더와 브라우저 렌더가 갈려 하이드레이션까지 불일치한다. */
export function formatOrderDate(iso: string): string {
  const get = seoulParts(iso, { year: "numeric", month: "2-digit", day: "2-digit" });
  if (!get) return "";
  return `${get("year")}.${get("month")}.${get("day")}`;
}

/** `2026년 7월 21일 14:22` — 주문상세의 주문일시 (8.6 D11). 24시간제로 못 박는다. */
export function formatOrderDateTime(iso: string): string {
  const get = seoulParts(iso, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  if (!get) return "";
  return `${get("year")}년 ${get("month")}월 ${get("day")}일 ${get("hour")}:${get("minute")}`;
}

/** `010-2847-3391` — 저장은 숫자만(^\d{9,11}$)이고 하이픈은 표시 계층이 넣는다 (8.6 D11).
 *
 *  🚨 order_no와 다르다. order_no는 "클라 가공 금지"가 명시된 식별자지만 전화번호는 표시 문제다.
 *  [ASSUMPTION] 11자리 → 3-4-4, 10자리 → 3-3-4, 그 밖(9자리 등) → 원문 그대로.
 *  서울 지역번호(02) 같은 예외는 구매자 연락처가 휴대폰이라는 전제에서 벗어난다 —
 *  **틀리게 끊느니 원문을 보여준다.** */
export function formatPhone(digits: string): string {
  if (!/^\d+$/.test(digits)) return digits;
  // 서울(02)만 지역번호가 두 자리다. 이걸 빼면 0212345678이 021-234-5678로 끊겨
  // 가장 흔한 번호가 가장 이상하게 보인다. 나머지 지역번호·휴대폰은 세 자리.
  const head = digits.startsWith("02") ? 2 : 3;
  const rest = digits.length - head;
  if (rest === 8) return `${digits.slice(0, head)}-${digits.slice(head, head + 4)}-${digits.slice(head + 4)}`;
  if (rest === 7) return `${digits.slice(0, head)}-${digits.slice(head, head + 3)}-${digits.slice(head + 3)}`;
  return digits;
}
