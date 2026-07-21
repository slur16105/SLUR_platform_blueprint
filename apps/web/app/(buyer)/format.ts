/* 금액 포맷 — 구매자 표면 전체가 이 함수 하나로 낸다 (D13).
   8.4~8.6도 같은 함수를 쓴다. 화면마다 다시 쓰면 어딘가에서 ₩나 축약이 생긴다.

   🚨 로케일을 생략하지 않는다. toLocaleString()은 서버와 브라우저의 기본 로케일이 다르면
      하이드레이션 불일치를 만든다 — "ko-KR"을 명시해 못 박는다.
   자릿수 정렬(tabular-nums)은 type.css의 금액 역할 클래스가 이미 갖고 있다. */

/** `32,000원` — ₩·소수점·축약 없음 (UX-DR15). */
export function formatWon(n: number): string {
  return `${n.toLocaleString("ko-KR")}원`;
}
