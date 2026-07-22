/* 명제 1 — clearSessionCookies는 refresh 쿠키를 두 path(/api·/api/auth) **모두** 소거한다.

   실제로 있었던 일: ResponseCookies는 이름만으로 키를 잡아서, 같은 이름을 두 path로
   set/delete 하면 두 번째가 첫 번째를 덮어쓰고 Set-Cookie가 한 줄만 나갔다.
   Path=/api의 진짜 refresh 쿠키가 14일 살아남아, 로그아웃 뒤에도 세션이 되살아날 수 있었다.
   tsc·lint·build는 전부 통과한다 — 나가는 헤더를 세어 봐야만 보인다.

   그래서 단언 대상은 "함수를 호출했는가"가 아니라 **나가는 Set-Cookie 줄의 집합**이다. */
import { test } from "node:test";
import assert from "node:assert/strict";

import { NextResponse } from "next/server";

import { clearSessionCookies, COOKIE_ACCESS, COOKIE_REFRESH, COOKIE_ROLE, REFRESH_PATH } from "@/lib/auth.ts";

/** "slur_refresh=; Path=/api; Max-Age=0; ..." → { name, path, maxAge } */
function parseSetCookie(line) {
  const [pair, ...attrs] = line.split(";").map((s) => s.trim());
  const name = pair.split("=")[0];
  const find = (key) => attrs.find((a) => a.toLowerCase().startsWith(`${key}=`))?.split("=")[1];
  return { name, path: find("path"), maxAge: find("max-age") };
}

function clearedCookies() {
  const res = NextResponse.next();
  clearSessionCookies(res);
  return res.headers.getSetCookie().map(parseSetCookie);
}

test("refresh 쿠키는 두 path 모두에서 소거된다 (한 줄만 나가면 세션이 되살아난다)", () => {
  const refresh = clearedCookies().filter((c) => c.name === COOKIE_REFRESH);
  const paths = refresh.map((c) => c.path).sort();

  assert.deepEqual(paths, ["/api", "/api/auth"], `refresh 소거 Set-Cookie가 ${refresh.length}줄이다 — 두 path 모두 필요하다`);
  assert.equal(REFRESH_PATH, "/api", "REFRESH_PATH가 바뀌면 이 단언의 전제가 깨진다");
  for (const c of refresh) assert.equal(c.maxAge, "0", `Path=${c.path} 줄이 즉시 만료가 아니다`);
});

test("access·role 쿠키도 심은 path(/)에서 소거된다", () => {
  const cookies = clearedCookies();
  for (const name of [COOKIE_ACCESS, COOKIE_ROLE]) {
    const hit = cookies.filter((c) => c.name === name);
    assert.equal(hit.length, 1, `${name} 소거 줄이 ${hit.length}개다`);
    assert.equal(hit[0].path, "/");
    assert.equal(hit[0].maxAge, "0");
  }
});
