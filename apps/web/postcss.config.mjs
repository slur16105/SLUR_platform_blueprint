/* Tailwind v4 파이프라인.
   Tailwind는 `@import "tailwindcss/..."`를 쓴 CSS만 변환한다 —
   기존 슬러/구매자 CSS는 그대로 통과하므로 영향이 없다. */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
