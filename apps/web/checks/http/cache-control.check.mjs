/* 명제 3 — 인증 BFF 응답에는 Cache-Control: no-store가 붙는다 (공개 BFF를 대조군으로 함께 본다).

   실제로 있었던 일: 공개 프록시(lib/public-api.ts)는 no-store를 붙이고 있었는데
   인증 프록시(proxyWithRefresh)만 비어 있었다. 이름·이메일·주소·주문이 실려 나가는 경로다.
   헤더 부재는 코드를 읽어서는 눈에 띄지 않는다 — 나가는 응답을 봐야 한다.

   서버가 필요한 이유: 이 헤더는 함수가 아니라 **라우트 핸들러를 통과한 응답**의 성질이다.
   Next가 스스로 무엇을 얹는지까지 포함해서 봐야 진짜 나가는 값을 본 것이 된다. */
import { test } from "node:test";
import assert from "node:assert/strict";

const BASE = process.env.SLUR_CHECK_BASE_URL;

test("인증 BFF(/api/auth/me)는 no-store + Vary: Cookie로 응답한다", async () => {
  const res = await fetch(`${BASE}/api/auth/me`, { headers: { cookie: "slur_access=stub-access" } });
  await res.text();

  const cacheControl = res.headers.get("cache-control");
  assert.ok(cacheControl, "Cache-Control이 아예 없다 — PII 응답이 캐시 가능하다");
  assert.match(cacheControl, /no-store/, `Cache-Control이 "${cacheControl}"다`);
  // Vary: Cookie가 없으면 공유 캐시가 A의 응답을 B에게 줄 수 있다
  assert.match(res.headers.get("vary") ?? "", /\bCookie\b/i, "Vary에 Cookie가 없다");
});

test("공개 BFF(/api/products)도 no-store다 — 대조군", async () => {
  const res = await fetch(`${BASE}/api/products`);
  await res.text();

  assert.match(res.headers.get("cache-control") ?? "", /no-store/, "공개 경로가 캐시 가능해졌다 (재고·품절은 보는 사이에 움직인다)");
});
