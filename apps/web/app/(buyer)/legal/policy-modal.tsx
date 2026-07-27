"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import { PrivacyDoc, TermsDoc } from "@/app/legal/policy-docs";

/* 정책 읽기 모달 — 약관·개인정보처리방침을 맥락을 유지한 채 얹는다.
   독립 페이지 `/terms`·`/privacy`는 딥링크·비JS 폴백으로 남는다(PolicyLink의 <a href>가 폴백).
   본문은 단일 콘텐츠 소스 app/legal/policy-docs.tsx를 그대로 렌더한다 — 중복 창작 없음.

   접근성: role="dialog" · aria-modal · 포커스 트랩 · ESC 닫기 · 초기 포커스(닫기 버튼) ·
   배경 스크롤 잠금 · 열기 전 포커스 복원. 배치·톤은 buyer.css의 .b_modal/.b_policy(먹색·종이).

   프로바이더 하나가 구매자 셸 전체를 감싸 모달 인스턴스를 한 벌만 둔다(레이아웃에서 마운트).
   여러 곳(푸터·회원가입)의 링크가 openPolicy로 같은 모달을 연다. */

type PolicyKind = "terms" | "privacy";

type PolicyCtx = { openPolicy: (kind: PolicyKind) => void };

const PolicyContext = createContext<PolicyCtx | null>(null);

/** 프로바이더가 없으면 null — PolicyLink는 이때 모달을 열지 않고 실제 페이지로 이동한다(폴백). */
export function usePolicy() {
  return useContext(PolicyContext);
}

const LABEL: Record<PolicyKind, string> = {
  terms: "이용약관",
  privacy: "개인정보처리방침",
};

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])';

export function PolicyProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState<PolicyKind | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  const openPolicy = useCallback((kind: PolicyKind) => setOpen(kind), []);
  const close = useCallback(() => setOpen(null), []);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // 초기 포커스 — 닫기 버튼. 다이얼로그 안에서 시작하지 않으면 트랩이 헐거워진다.
    closeRef.current?.focus();

    const visibleFocusables = () =>
      dialog
        ? Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
            (el) => el.offsetParent !== null,
          )
        : [];

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab") return;
      const items = visibleFocusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const inside = dialog?.contains(active);
      if (e.shiftKey) {
        if (active === first || !inside) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !inside) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open, close]);

  return (
    <PolicyContext.Provider value={{ openPolicy }}>
      {children}
      {open ? (
        <div
          className="b_modal"
          /* 배경(패널 바깥) 클릭으로 닫는다 — ≥768 가운데 패널에서만 실효가 있다.
             target === currentTarget이라 본문·헤더 클릭으로는 닫히지 않는다. */
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="i_dialog" role="dialog" aria-modal="true" aria-label={LABEL[open]} ref={dialogRef}>
            <div className="i_head">
              <span className="b_section_label i_title">{LABEL[open]}</span>
              <button type="button" className="i_close" aria-label="닫기" onClick={close} ref={closeRef}>
                ×
              </button>
            </div>
            <div className="i_body b_policy">{open === "terms" ? <TermsDoc /> : <PrivacyDoc />}</div>
          </div>
        </div>
      ) : null}
    </PolicyContext.Provider>
  );
}
