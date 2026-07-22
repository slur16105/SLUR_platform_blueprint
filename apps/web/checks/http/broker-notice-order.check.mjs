/* 명제 5 — 주문서에서 중개자 고지는 `주문하기`보다 **먼저** 만들어진다 (두 폭 모두).

   실제로 있었던 일: ≥768 레이아웃에서 고지가 우측 sticky 칼럼의 `주문하기` **아래**에 있었다.
   고지를 읽지 않고도 주문이 끝난다 — 디자인 취향이 아니라 규제 요건(FR-32) 위반이다.

   🚨 이 검사가 무엇을 보는지 정확히 적어 둔다.
      구매자 표면은 클라이언트 렌더다. /checkout의 SSR HTML은 스켈레톤뿐이고
      (실측: `주문하기`·`중개` 문자열 0건, x-nextjs-cache HIT) 고지도 CTA도 거기에 없다.
      그래서 **브라우저가 실제로 내려받는 산출물**을 본다 — /checkout이 참조하는 청크를
      서버에서 그대로 받아, 두 노드가 만들어지는 순서를 비교한다.
      JSX 자식 배열의 순서는 컴파일·압축을 지나도 보존되므로 이 순서는 곧 DOM 순서다.

   ❌ 이 검사가 증명하지 못하는 것: **화면에 보이는 순서**. CSS(order·flex-direction·absolute·
      grid-area)는 DOM 순서를 뒤집을 수 있다. 그건 브라우저 레이아웃이 필요하다 (README 참조). */
import { test } from "node:test";
import assert from "node:assert/strict";

const BASE = process.env.SLUR_CHECK_BASE_URL;

/* 표식은 화면 코드의 클래스 문자열이다 — 이름을 바꾸면 이 검사가 깨진다.
   깨질 때 조용히 통과하지 않고 "표식을 못 찾았다"로 실패하게 만들어 둔다. */
const NOTICE_WIDE = "i_legal m_side"; // ≥768 — 우측 금액 칼럼의 고지
const CTA_WIDE = "i_cta_side"; //        ≥768 — 같은 칼럼의 주문하기
const NOTICE_NARROW = "i_legal m_flow"; // <768 — 문서 흐름 끝의 고지
const CTA_NARROW = "b_cta_bar"; //        <768 — 하단 고정 CTA 바

async function checkoutChunk() {
  const page = await fetch(`${BASE}/checkout`, { headers: { cookie: "slur_role=buyer" } });
  assert.equal(page.status, 200, "/checkout이 200이 아니다");
  const html = await page.text();

  const paths = [...new Set([...html.matchAll(/\/_next\/static\/chunks\/[A-Za-z0-9_.-]+\.js/g)].map((m) => m[0]))];
  assert.ok(paths.length > 0, "/checkout HTML에서 청크 참조를 찾지 못했다");

  const hits = [];
  for (const path of paths) {
    const js = await (await fetch(`${BASE}${path}`)).text();
    if (js.includes(NOTICE_WIDE)) hits.push({ path, js });
  }
  assert.equal(
    hits.length,
    1,
    `고지 표식("${NOTICE_WIDE}")을 가진 청크가 ${hits.length}개다 — 표식이 바뀌었거나 코드가 다른 청크로 옮겨졌다`,
  );
  assert.ok(hits[0].js.includes("주문하기"), "찾은 청크에 `주문하기`가 없다 — 주문서 코드가 아니다");
  return hits[0].js;
}

const chunk = await checkoutChunk();

test("≥768 — 고지가 우측 칼럼의 `주문하기`보다 먼저 만들어진다", () => {
  const notice = chunk.indexOf(NOTICE_WIDE);
  const cta = chunk.indexOf(CTA_WIDE);
  assert.notEqual(cta, -1, `CTA 표식("${CTA_WIDE}")을 찾지 못했다`);
  assert.ok(notice < cta, "고지가 주문하기 뒤에 있다 — 고지를 읽지 않고 주문이 끝난다 (FR-32)");
});

test("<768 — 고지가 하단 고정 CTA 바보다 먼저 만들어진다", () => {
  const notice = chunk.indexOf(NOTICE_NARROW);
  const cta = chunk.indexOf(CTA_NARROW);
  assert.notEqual(notice, -1, `고지 표식("${NOTICE_NARROW}")을 찾지 못했다`);
  assert.notEqual(cta, -1, `CTA 표식("${CTA_NARROW}")을 찾지 못했다`);
  assert.ok(notice < cta, "고지가 고정 CTA 바 뒤에 있다 (FR-32)");
});
