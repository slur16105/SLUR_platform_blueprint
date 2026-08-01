"use client";

/* 런타임 오류 경계 — 화면 렌더 중 예외가 나면 여기가 대신 그려진다.

   🚨 오류 내용을 사용자에게 보여주지 않는다. 스택·메시지에는 내부 경로나 데이터가 섞일 수 있고,
      사용자가 그걸로 할 수 있는 일도 없다. 대신 **다시 시도**와 **연락 경로**를 준다.
      digest(서버가 붙이는 오류 식별자)만 작게 노출해, 문의 시 운영자가 로그와 대조할 수 있게 한다.

   reset()은 Next가 주는 재렌더 함수다 — 새로고침 없이 실패한 구간만 다시 시도한다.
   그래서 이 화면만 StatusScreen을 쓰지 않고 버튼을 직접 그린다(링크가 아니라 함수 호출이다). */

import { useEffect } from "react";
import Link from "next/link";

import "./(buyer)/theme.css";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 운영 로그 수집기는 아직 없다 — 최소한 콘솔에는 남겨 개발 중 원인을 잡을 수 있게 한다
    console.error("[render error]", error);
  }, [error]);

  return (
    <div className="slur flex min-h-screen flex-col items-center justify-center px-5 py-20 text-center">
      <Link href="/" className="text-[22px] font-bold tracking-tight">SLUR.</Link>

      <h1 className="mt-12 text-[26px] font-semibold tracking-tight">화면을 불러오지 못했습니다</h1>
      <p className="mt-3 max-w-[440px] text-[14px] leading-relaxed text-muted-foreground">
        일시적인 문제일 수 있습니다. <b className="font-medium text-foreground">다시 시도</b>를 눌러 보시고,
        같은 화면이 계속 나오면 아래 <b className="font-medium text-foreground">1:1 문의</b>로 알려주세요.
        주문·결제가 진행 중이었다면 <Link href="/orders" className="underline underline-offset-4">주문 내역</Link>에서
        처리 여부를 먼저 확인해 주세요.
      </p>

      <div className="mt-8 flex w-full max-w-[320px] flex-col gap-2">
        <button
          type="button"
          onClick={reset}
          className="h-11 border border-foreground bg-foreground text-[14px] font-medium text-background transition-opacity hover:opacity-80"
        >
          다시 시도
        </button>
        <Link href="/" className="h-11 border border-border text-[14px] leading-[44px] transition-colors hover:border-foreground">
          홈으로 가기
        </Link>
      </div>

      <nav aria-label="도움말" className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2">
        <Link href="/support" className="text-[13px] text-muted-foreground underline underline-offset-4 hover:text-foreground">
          1:1 문의
        </Link>
        <Link href="/faq" className="text-[13px] text-muted-foreground underline underline-offset-4 hover:text-foreground">
          자주 묻는 질문
        </Link>
      </nav>

      {error.digest && (
        <p className="mt-8 text-[11px] text-muted-foreground">
          문의 시 알려주세요 — 오류 번호 <span className="font-mono">{error.digest}</span>
        </p>
      )}
    </div>
  );
}
