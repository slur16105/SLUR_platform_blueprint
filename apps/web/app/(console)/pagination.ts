/** 콘솔 테이블 페이지네이션 공용 계산 — 관리자·판매자 목록 화면이 같은 규칙을 쓴다. */

/** 페이지 번호 창 — 현재 페이지 주변 최대 `span`개. 총 페이지가 적으면 있는 만큼만. */
export function pageWindow(page: number, lastPage: number, span = 5): number[] {
  const width = Math.min(span, Math.max(1, lastPage));
  let start = Math.max(1, page - Math.floor(width / 2));
  if (start + width - 1 > lastPage) start = Math.max(1, lastPage - width + 1);
  return Array.from({ length: width }, (_, i) => start + i);
}

/** "1–20" 표시 범위 — 현재 페이지가 실제로 보여준 건수(items.length) 기준. */
export function pageRange(page: number, size: number, shown: number): string {
  const from = (page - 1) * size + 1;
  return `${from}–${(page - 1) * size + shown}`;
}
