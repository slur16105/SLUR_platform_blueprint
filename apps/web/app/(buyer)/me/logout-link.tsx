"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import { useCartCount } from "../cart-count";

/* 구매자 로그아웃 (D4).

   🚨 app/logout-button.tsx를 재사용하지 않는다 — 그 컴포넌트는 판매자·관리자 9화면의
      공용 부품이고 목적지가 `/login`이며 클래스도 슬러 파랑 계열(.btn m_ghost)이다.
      목적지 prop을 더하면 9개 화면이 전부 회귀 검증 대상이 된다. 8.2 D7이 열어 둔
      두 선택지 중 "구매자 전용 버튼 신설"을 택했다.
   🚨 app/api/auth/logout/route.ts와 lib/auth.ts의 clearSessionCookies는 한 줄도 고치지 않는다 —
      refresh 서버 폐기(멱등) + 쿠키 3종(slur_access · slur_refresh 현·구 path · slur_role)
      삭제까지 8.2가 이미 검증했다.

   동작 순서: (1) POST /api/auth/logout → (2) setCount(undefined) → (3) replace("/") → (4) refresh()
   🚨 (2)가 없으면 로그아웃 후에도 장바구니 배지 숫자가 남는다 — `/me` → `/`는 같은 (buyer)
      레이아웃 안의 클라이언트 내비게이션이라 CartCountProvider가 remount되지 않고,
      router.refresh()는 서버 컴포넌트만 다시 그릴 뿐 클라이언트 Context state를 비우지 않는다.
      (cart-count.tsx는 수정하지 않는다 — setCount가 이미 공개 API다.)
   🚨 push가 아니라 replace다 — 뒤로 가기로 로그아웃된 /me에 돌아가면 401 화면을 본다.
   🚨 확인 줄을 두지 않는다 — 되돌릴 수 없는 파괴적 동작이 아니다(다시 로그인하면 된다).
      UX-DR16의 "확인 후 실행"은 `삭제`·`주문 취소`를 가리킨다.
   🚨 실패 문구를 만들지 않는다 — BFF가 멱등이라 상류가 죽어도 쿠키는 지워진다. 문구가 뜨면
      사용자는 "로그아웃이 안 됐다"고 믿고 같은 버튼을 반복해서 누른다. 네트워크가 끊겨
      BFF에 닿지 못했더라도 `/`로 보낸다(쿠키가 남아도 다음 API 호출이 401로 정리한다). */
export default function LogoutLink() {
  const router = useRouter();
  const { setCount } = useCartCount();
  const [pending, setPending] = useState(false);

  const logout = useCallback(() => {
    if (pending) return; // 중복 제출 차단
    setPending(true);
    void (async () => {
      await fetch("/api/auth/logout", { method: "POST", cache: "no-store" }).catch(() => {});
      setCount(undefined); // 배지 리셋 — 이동 전에 (D4)
      router.replace("/");
      router.refresh(); // Router Cache 잔상 제거 (콘솔 버튼과 같은 관례)
    })();
  }, [pending, router, setCount]);

  return (
    <button type="button" className="b_btn m_text m_full b_control i_logout" onClick={logout} disabled={pending}>
      {/* 밑줄은 글자에만 걸린다 — 버튼 폭 전체에 선이 그어지지 않게 span으로 감싼다.
          스피너를 쓰지 않는다 (UX-DR9). 요청 중에는 disabled가 유일한 표시다. */}
      <span className="i_text">로그아웃</span>
    </button>
  );
}
