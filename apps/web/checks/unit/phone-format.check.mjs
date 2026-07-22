/* 명제 2 — formatPhone은 서울(02) 지역번호를 두 자리로 끊는다.

   실제로 있었던 일: 앞 3자리를 무조건 지역번호로 보고 0212345678을 021-234-5678로 끊었다.
   타입도 lint도 빌드도 통과한다 — 출력 문자열을 눈으로 비교해야만 보인다.
   순수 함수라 서버가 필요 없고, 이 검사는 밀리초 단위로 끝난다. */
import { test } from "node:test";
import assert from "node:assert/strict";

import { formatPhone } from "@/app/(buyer)/format.ts";

const CASES = [
  { label: "휴대폰 11자리", input: "01028473391", expected: "010-2847-3391" },
  { label: "서울 8자리", input: "0212345678", expected: "02-1234-5678" },
  { label: "서울 7자리", input: "021234567", expected: "02-123-4567" },
  { label: "경기 8자리", input: "0311234567", expected: "031-123-4567" },
];

for (const { label, input, expected } of CASES) {
  test(`formatPhone ${label} — ${input} → ${expected}`, () => {
    assert.equal(formatPhone(input), expected);
  });
}
