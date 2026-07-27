"use client";

import { usePolicy } from "./policy-modal";

/* 정책 링크 — 클릭하면 모달로 가로채고, JS가 없거나 새 탭이면 실제 페이지로 이동한다.
   <a href>를 그대로 유지하는 것이 딥링크·비JS 폴백이다(모달은 그 위에 얹는 개선). */

type PolicyKind = "terms" | "privacy";

const HREF: Record<PolicyKind, string> = {
  terms: "/terms",
  privacy: "/privacy",
};

export default function PolicyLink({
  kind,
  className,
  children,
}: {
  kind: PolicyKind;
  className?: string;
  children: React.ReactNode;
}) {
  const ctx = usePolicy();
  return (
    <a
      href={HREF[kind]}
      className={className}
      onClick={(e) => {
        if (!ctx) return; // 프로바이더 없음 → 실제 페이지로 이동 (폴백)
        // 새 탭·수정자 클릭·가운데 클릭은 브라우저 기본에 맡긴다
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        ctx.openPolicy(kind);
      }}
    >
      {children}
    </a>
  );
}
