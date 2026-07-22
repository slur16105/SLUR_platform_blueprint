/* 순수 단언이 앱 코드를 "있는 그대로" 불러오기 위한 최소 배관 (의존성 0의 대가).

   Node는 앱 코드가 쓰는 두 가지 지정자를 스스로 풀지 못한다:
     · "next/server"  — Next 패키지가 확장자 없는 이 이름을 exports에 노출하지 않는다
     · "@/lib/auth"   — tsconfig paths 별칭은 번들러 규약이지 Node 규약이 아니다
   그래서 해석 단계에서만 두 규칙을 얹는다. **코드 변환은 하지 않는다** —
   .ts는 Node 22의 내장 타입 스트리핑이 그대로 읽는다(트랜스파일러 없음).

   이 파일이 사라지면 검사가 앱 코드의 사본을 들고 있어야 하고, 사본은 반드시 원본과 갈라진다. */
import { registerHooks } from "node:module";

const APP_ROOT = new URL("../", import.meta.url).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "next/server") return nextResolve("next/server.js", context);
    if (specifier.startsWith("@/")) return nextResolve(new URL(specifier.slice(2), APP_ROOT).href, context);
    return nextResolve(specifier, context);
  },
});
