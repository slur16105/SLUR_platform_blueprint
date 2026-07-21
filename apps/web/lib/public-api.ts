/* 공개 GET 전용 프록시 — 서버 전용 모듈 (D2).
   🚨 이 경로에 lib/auth.ts의 proxyWithRefresh를 쓰지 않는다.
      그 함수는 상류가 401이면 clearSessionCookies(res)를 호출한다 —
      공개 상품 조회가 상류 장애로 401을 한 번 받는 순간 로그인 사용자의 세션이 지워진다.
      공개 화면이 세션을 파괴할 수 있는 구조를 만들지 않는다.

   이 헬퍼가 지키는 것 넷:
   · Authorization 헤더를 붙이지 않는다 (공개 엔드포인트는 토큰을 무시한다)
   · refresh 회전을 하지 않는다
   · 어떤 경우에도 세션 쿠키를 건드리지 않는다
   · cache: "no-store" + 응답 Cache-Control: no-store (재고·품절은 보는 사이에 움직인다)

   API_BASE만 lib/auth에서 가져온다 — 그 파일은 수정하지 않는다. */
import { NextResponse } from "next/server";

import { API_BASE } from "./auth";

/** 표준 UUID — 하이픈 위치·hex 검증. 대소문자를 허용하고 상류 전달 전 소문자로 정규화한다. */
export const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/** 상류가 JSON을 주지 않거나 닿지 않을 때의 봉투 — proxyWithRefresh의 폴백과 같은 모양이다. */
const SERVICE_UNAVAILABLE = { code: "service_unavailable", message: "일시적인 오류입니다.", details: [] };

/** 없는 상품 · 형식이 틀린 id 공용 봉투. 사용자가 만든 잘못된 URL과 없는 상품을 화면에서 구별할 이유가 없다. */
export const NOT_FOUND = { code: "not_found", message: "상품을 찾을 수 없습니다.", details: [] };

/** 공개 응답은 언제나 no-store. ISR·revalidate를 쓰지 않는다. */
export function publicJson(body: unknown, status: number): NextResponse {
  const res = NextResponse.json(body, { status });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

/** 공개 GET 대리 호출. 봉투는 상류 것을 그대로 흘리고, 봉투가 아니면 폴백으로 감싼다. */
export async function proxyPublic(path: string): Promise<NextResponse> {
  let upstream: Response;
  try {
    upstream = await fetch(`${API_BASE}${path}`, { method: "GET", cache: "no-store" });
  } catch {
    return publicJson(SERVICE_UNAVAILABLE, 503); // 상류에 닿지 못함 — 500으로 새어 나가지 않게 봉투로 만든다
  }
  const text = await upstream.text();
  try {
    return publicJson(JSON.parse(text), upstream.status);
  } catch {
    // 게이트웨이 HTML 오류 페이지 등 — 상태 코드가 200이어도 봉투가 아니면 실패로 다룬다
    return publicJson(SERVICE_UNAVAILABLE, 503);
  }
}
