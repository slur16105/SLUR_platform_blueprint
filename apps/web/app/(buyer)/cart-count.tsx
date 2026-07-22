"use client";

/* 장바구니 배지 값의 소유자 (D5).
   (buyer) 레이아웃이 children을 이 프로바이더로 감싸고, CartBadge가 여기서 값을 읽는다 —
   탭바·상단 내비·상단바의 <CartBadge /> 호출부는 한 글자도 바뀌지 않는다.

   · 값 = items.length (담긴 항목 수 전체, 구매 불가 포함). 수량의 합이 아니다 (AC 8·9).
   · 읽기: 마운트 1회 + refresh() 호출 시. 단 slur_role 쿠키가 있을 때만 — 비로그인 방문자에게
     401을 만들지 않기 위한 UX 힌트일 뿐 권한 판정이 아니다 (R7, AD-1).
     401이면 조용히 배지를 지우고 리다이렉트하지 않는다.
   · 쓰기: 장바구니 응답을 받은 곳이 밀어 넣는다 (한 응답에 한 writer).
   · refresh()는 로그인·회원가입 성공 직후가 부른다. /login·/signup도 (buyer) 그룹이라
     router.replace로 `/`에 가도 이 프로바이더는 remount되지 않는다 — 갱신하지 않으면
     방금 로그인한 사람의 배지가 비어 있다(로그아웃 리셋의 거울상). 읽기는 여기 한 곳이 갖는다.
   🚨 새 npm 의존성을 만들지 않는다 — React Context는 이미 있는 도구다 (AC 9). */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { getCart } from "./cart-api";

type CartCountValue = {
  /** undefined = 아직 모름 또는 비로그인 — 배지를 그리지 않는다 */
  count: number | undefined;
  setCount: (n: number | undefined) => void;
  /** 세션이 바뀌었다 — 다시 읽어 온다 (로그인·회원가입 직후) */
  refresh: () => void;
};

// 프로바이더 밖에서도 던지지 않는다 — 배지는 UX 장식이지 보호 동작이 아니다.
const CartCountContext = createContext<CartCountValue>({
  count: undefined,
  setCount: () => {},
  refresh: () => {},
});

export function useCartCount(): CartCountValue {
  return useContext(CartCountContext);
}

function hasRoleHint(): boolean {
  return document.cookie.split("; ").some((c) => c.startsWith("slur_role="));
}

export function CartCountProvider({ children }: { children: React.ReactNode }) {
  /* 초기값이 서버·클라이언트 모두 undefined이고 CartBadge가 그때 아무것도 그리지 않으므로
     하이드레이션 마크업 불일치가 없다. */
  const [count, setCount] = useState<number | undefined>(undefined);
  const [readKey, setReadKey] = useState(0);

  useEffect(() => {
    if (!hasRoleHint()) return;
    let alive = true;
    void (async () => {
      const r = await getCart();
      if (!alive) return;
      setCount(r.ok ? r.data.items.length : undefined);
    })();
    return () => {
      alive = false;
    };
  }, [readKey]);

  const push = useCallback((n: number | undefined) => setCount(n), []);
  const refresh = useCallback(() => setReadKey((k) => k + 1), []);
  const value = useMemo(() => ({ count, setCount: push, refresh }), [count, push, refresh]);

  return <CartCountContext.Provider value={value}>{children}</CartCountContext.Provider>;
}
