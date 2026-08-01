/* 안내 화면 공통 부품 — 404·오류·권한 없음처럼 "진행이 막힌 순간"을 그린다.

   막힌 화면은 세 가지를 반드시 말해야 한다:
     ① 무슨 일이 일어났는가 (탓하지 않는 문장으로)
     ② 왜 그럴 수 있는가   (사용자가 납득할 만한 이유)
     ③ 지금 무엇을 하면 되는가 (버튼 — 추측하게 두지 않는다)

   같은 자리에서 같은 모양으로 보여야 "또 뭐가 고장났나" 하는 인상을 주지 않으므로 부품을 하나로 둔다.
   상단바를 쓰지 않는다 — 이 화면까지 온 요청은 이미 뭔가 실패한 상태라, 카테고리 조회 같은
   추가 의존을 만들면 안내 화면 자체가 다시 실패할 수 있다. */

import Link from "next/link";
import type { ReactNode } from "react";

export type StatusAction = {
  href?: string;
  label: string;
  /** 주 동작 하나만 채운 버튼으로 — 사용자가 무엇부터 눌러야 할지 헷갈리지 않게 */
  primary?: boolean;
};

export default function StatusScreen({
  code,
  title,
  message,
  actions,
  links,
  footer,
}: {
  /** 404 같은 코드. 없으면 표시하지 않는다(사용자에게 의미 없는 코드는 굳이 보이지 않는다) */
  code?: string;
  title: string;
  message: ReactNode;
  actions: StatusAction[];
  /** 부차적 이동 경로 — 문의·도움말처럼 "그래도 안 되면" 자리 */
  links?: { href: string; label: string }[];
  footer?: ReactNode;
}) {
  return (
    <div className="slur flex min-h-screen flex-col items-center justify-center px-5 py-20 text-center">
      <Link href="/" className="text-[22px] font-bold tracking-tight">SLUR.</Link>

      {code && (
        <p className="mt-12 text-[13px] font-medium tracking-[0.2em] text-muted-foreground">{code}</p>
      )}
      <h1 className={`${code ? "mt-3" : "mt-12"} text-[26px] font-semibold tracking-tight`}>{title}</h1>
      <div className="mt-3 max-w-[440px] text-[14px] leading-relaxed text-muted-foreground">{message}</div>

      <div className="mt-8 flex w-full max-w-[320px] flex-col gap-2">
        {actions.map((a) =>
          a.href ? (
            <Link
              key={a.label}
              href={a.href}
              className={
                a.primary
                  ? "h-11 border border-foreground bg-foreground text-[14px] font-medium leading-[44px] text-background transition-opacity hover:opacity-80"
                  : "h-11 border border-border text-[14px] leading-[44px] transition-colors hover:border-foreground"
              }
            >
              {a.label}
            </Link>
          ) : null,
        )}
      </div>

      {links && links.length > 0 && (
        <nav aria-label="도움말" className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-[13px] text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      )}

      {footer && <div className="mt-8 text-[11px] text-muted-foreground">{footer}</div>}
    </div>
  );
}
