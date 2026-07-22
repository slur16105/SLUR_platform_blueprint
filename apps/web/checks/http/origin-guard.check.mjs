/* 명제 4 — 상태를 바꾸는 BFF는 위조 Origin에 403 봉투를 준다. 정상 Origin은 통과한다.

   실제로 있었던 일: 상태 변경 라우트에 Origin 검사가 없어 크로스사이트 폼 POST가 통했다
   (강제 로그아웃 등). 검사를 붙였다는 사실은 코드를 읽으면 보이지만,
   **붙였는데 동작하지 않는 경우**(헤더 비교식 오류·프록시 호스트 불일치)는 보이지 않는다.

   두 방향을 함께 단언한다. 막는 것만 단언하면 "전부 403"이라는 최악의 회귀를 통과시킨다. */
import { test } from "node:test";
import assert from "node:assert/strict";

const BASE = process.env.SLUR_CHECK_BASE_URL;
const PATH = "/api/carts/items"; // 상태 변경 BFF의 대표 — assertSameOrigin 한 벌을 공유한다

const post = (origin) =>
  fetch(`${BASE}${PATH}`, {
    method: "POST",
    headers: { origin, "content-type": "application/json", cookie: "slur_access=stub-access" },
    body: JSON.stringify({ variant_id: "stub-variant", quantity: 1 }),
  });

test("위조 Origin은 403 + 봉투로 막힌다", async () => {
  const res = await post("https://evil.example");
  const body = await res.json();

  assert.equal(res.status, 403);
  // 봉투 규약: {code, message, details}. 500 HTML이나 빈 본문이 나가면 클라이언트가 화면을 못 만든다
  assert.equal(body.code, "forbidden");
  assert.ok(typeof body.message === "string" && body.message.length > 0);
  assert.ok(Array.isArray(body.details));
});

test("파싱되지 않는 Origin(null)도 막힌다 — fail-closed", async () => {
  const res = await post("null");
  await res.json();
  assert.equal(res.status, 403);
});

test("정상 Origin은 통과한다 — 전부 막는 회귀를 잡는다", async () => {
  const res = await post(BASE);
  await res.text();
  assert.notEqual(res.status, 403, "같은 출처 요청이 막혔다 — 장바구니 담기가 통째로 죽는다");
  assert.equal(res.status, 200);
});
