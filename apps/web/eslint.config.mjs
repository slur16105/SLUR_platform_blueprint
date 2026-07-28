import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // giftpop 정적 사본(반입 자산) — 앱 소스가 아니므로 린트 제외
    "public/giftpop-buyer/**",
    "public/giftpop-admin/**",
  ]),
]);

export default eslintConfig;
