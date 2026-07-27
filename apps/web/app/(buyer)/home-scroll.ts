/* 홈 스크롤 복원 (9.4 Q4).
   홈이 편성 지면으로 2~4배 길어지므로, 상품상세를 보고 뒤로 왔을 때 보던 자리로 돌아와야 한다.

   설계:
   · history.scrollRestoration을 manual로 덮지 않는다(스펙 §6) — 브라우저/Next 기본 복원은 그대로 둔다.
     이 모듈은 편성·그리드가 클라이언트에서 비동기로 채워져 복귀 순간 문서 높이가 모자란 탓에
     기본 복원이 위로 튀는 경우만 보정한다.
   · 복원은 "상품 카드를 눌러 상세로 갔다가 돌아온" 경로에서만 무장(arm)된다.
     하단 탭/로고로 홈에 새로 진입하면 무장되지 않아 최상단으로 온다(재탭 최상단, 기존 규칙 유지).
   · 저장 위치는 카드를 누른 그 순간의 scrollY다(그 뒤 화면이 언마운트돼도 값이 남는다).

   세션 스토리지가 막힌 환경(사생활 모드 등)에서는 조용히 무보정 — 기본 복원에 맡긴다. */

const POS_KEY = "slur:home:scrollY";
const ARM_KEY = "slur:home:restore";

/** 상품 카드 클릭 시 호출 — 지금 스크롤 위치를 저장하고 복원을 무장한다. */
export function armHomeScroll(): void {
  try {
    sessionStorage.setItem(POS_KEY, String(window.scrollY));
    sessionStorage.setItem(ARM_KEY, "1");
  } catch {
    /* 저장 불가 — 기본 복원에 맡긴다 */
  }
}

/** 홈 탭·로고로 홈에 새로 진입하는 경로에서 호출 — 복원 무장을 해제한다.
 *  카드→상세→뒤로(무장 유지)만 복원되고, 카드 클릭 뒤 하단 홈 탭으로 오면 최상단이 되게 한다(재탭 최상단 규칙). */
export function disarmHomeScroll(): void {
  try {
    sessionStorage.removeItem(ARM_KEY);
  } catch {
    /* 저장 불가 — 무장 자체가 없었으므로 무보정 */
  }
}

/** 무장돼 있으면 저장 위치를 반환하고 무장을 해제한다. 아니면 null. */
export function consumeHomeScroll(): number | null {
  try {
    if (sessionStorage.getItem(ARM_KEY) !== "1") return null;
    sessionStorage.removeItem(ARM_KEY);
    const y = Number(sessionStorage.getItem(POS_KEY) ?? "0");
    return Number.isFinite(y) && y > 0 ? y : null;
  } catch {
    return null;
  }
}

/** 문서가 그 위치까지 자랄 때까지(비동기 그리드 적재) 기다렸다가 스크롤한다.
 *  최대 ~40프레임(약 0.6s)만 기다린다 — 그 뒤엔 닿는 데까지만 복원한다. */
export function restoreHomeScroll(y: number): void {
  let tries = 0;
  const tick = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (max >= y || tries++ > 40) {
      window.scrollTo(0, y);
    } else {
      requestAnimationFrame(tick);
    }
  };
  requestAnimationFrame(tick);
}
