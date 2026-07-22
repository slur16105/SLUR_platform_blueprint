"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { BlockSkeleton, ErrorState, getPublicJson, type ApiFailure } from "../buyer-feedback";

/* 계정 구획 — `/me`의 **유일한 API 의존 층** (D3).
   사업자 정보·중개자 고지·약관 링크는 page.tsx가 API 없이 그리므로, 여기가 실패해도
   법적 고지는 화면에 남는다. 그 결합을 만들지 않는 것이 이 파일이 조각으로 분리된 이유다.

   🚨 D2 — `가입 방식` 줄을 만들지 않는다. MeResponse에 provider·has_password가 없고,
      `email === null ⇒ 소셜 전용`은 참이지만 역이 거짓이다(카카오는 검증된 이메일을 저장한다).
      한쪽 방향만 맞는 추론을 화면에 내는 것은 조용한 거짓말이다.
   🚨 phone은 응답에 있지만 그리지 않는다 — 전화번호 표시는 v1 밖이다.
   🚨 effect 안에서 동기 setState를 하지 않는다 (react-hooks/set-state-in-effect가 lint error).
      결과는 {data, error} 한 벌로 두고 **로딩을 파생**시킨다 (8.4·8.6의 관례).
   🚨 표시 규약(R6): 분기는 code, 표시는 message. HTTP 상태 코드·code 문자열을 렌더하지 않는다. */

/** GET /api/v1/auth/me — 서버 계약 그대로. 🚨 email은 null 가능(소셜 전용 계정). */
type MeResponse = {
  id: string;
  email: string | null;
  name: string;
  /** 이 화면은 쓰지 않는다 (v1 밖) */
  phone: string;
};

/** 빈 값은 `—`로 자리를 지킨다 — 줄을 지우면 레이아웃이 계정마다 달라진다 (8.6의 규약). */
const EMPTY = "—";

export default function AccountCard({ headingId }: { headingId: string }) {
  const router = useRouter();

  /* 로딩 상태를 따로 두지 않고 null 여부로 파생한다 — effect 안 동기 setState 회피 형태다. */
  const [result, setResult] = useState<{ data: MeResponse | null; error: ApiFailure | null } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  /* 401 → /login?next=%2Fme. 미들웨어 통과는 인증이 아니다 —
     slur_role(14일)이 slur_access(30분)보다 오래 살아 있다 (AD-1, R7). */
  const toLogin = useCallback(() => router.replace("/login?next=%2Fme"), [router]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      // 공개 GET용으로 만든 한 벌이지만 형태가 같다 — 두 번째 규약을 만들지 않는다.
      // 세션은 httpOnly 쿠키라 same-origin fetch에 자동으로 실린다.
      const r = await getPublicJson<MeResponse>("/api/auth/me");
      if (!alive) return;
      if (!r.ok && r.error.code === "unauthorized") {
        toLogin();
        return;
      }
      setResult(r.ok ? { data: r.data, error: null } : { data: null, error: r.error });
    })();
    return () => {
      alive = false;
    };
  }, [reloadKey, toLogin]);

  const retry = useCallback(() => {
    setResult(null);
    setReloadKey((k) => k + 1);
  }, []);

  return (
    <>
      <h2 className="b_eyebrow i_eyebrow" id={headingId}>
        계정
      </h2>

      {result === null ? (
        /* 최초 로딩 — 블록 골격. 화면 중앙 스피너를 쓰지 않는다 (UX-DR9). */
        <>
          <BlockSkeleton className="i_sk_name" />
          <BlockSkeleton className="i_sk_email" />
        </>
      ) : result.error ? (
        <ErrorState message={result.error.message} onRetry={retry} />
      ) : (
        <>
          <p className="b_title_sm i_name">{result.data?.name || EMPTY}</p>
          <p className="b_meta i_email">{result.data?.email || EMPTY}</p>
        </>
      )}
    </>
  );
}
