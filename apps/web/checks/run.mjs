/* 자동 단언 러너 — `npm run check` (또는 `npm run check -- unit` / `-- http`).

   의존성 0. Node 22 내장만 쓴다: node:test · node:assert · 내장 타입 스트리핑.
   설치되는 것도, package.json의 dependencies에 얹히는 것도 없다.

   두 묶음의 성질이 다르므로 실행도 분리한다:
     · unit — 순수 함수. 서버 없음. 밀리초.
     · http — 실제로 나가는 응답. 상류 스텁 + next start가 필요하다. 초.
   섞어 두면 "빠른 검사"라는 성질이 사라진다. */
import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { startStubUpstream } from "./http/stub-upstream.mjs";
import { startNextServer } from "./http/server.mjs";

const CHECKS_DIR = fileURLToPath(new URL(".", import.meta.url));
const APP_DIR = fileURLToPath(new URL("..", import.meta.url));

async function checkFiles(bucket) {
  const dir = new URL(`${bucket}/`, import.meta.url);
  const names = (await readdir(dir)).filter((n) => n.endsWith(".check.mjs")).sort();
  return names.map((n) => fileURLToPath(new URL(n, dir)));
}

/** node --test 자식 프로세스. 종료 코드를 그대로 돌려준다. */
function runNodeTest(files, extraArgs, env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [...extraArgs, "--test", ...files], {
      cwd: APP_DIR,
      env: { ...process.env, ...env },
      stdio: "inherit",
    });
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

async function runUnit() {
  const files = await checkFiles("unit");
  const started = Date.now();
  const code = await runNodeTest(files, [
    // 앱 코드를 사본 없이 그대로 부르기 위한 해석 규칙 두 줄 (checks/resolve-hooks.mjs)
    "--import",
    `${new URL("resolve-hooks.mjs", import.meta.url)}`,
    // .ts를 CommonJS로 오해했다가 다시 읽었다는 안내 — 시끄럽기만 하다
    "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
  ]);
  return { code, ms: Date.now() - started };
}

async function runHttp() {
  const files = await checkFiles("http");
  const started = Date.now();
  const stub = await startStubUpstream();
  let server;
  try {
    server = await startNextServer({ upstreamUrl: stub.url, cwd: APP_DIR });
    const bootMs = Date.now() - started;
    const testStarted = Date.now();
    const code = await runNodeTest(files, [], { SLUR_CHECK_BASE_URL: server.url });
    return { code, ms: Date.now() - started, bootMs, testMs: Date.now() - testStarted };
  } finally {
    await server?.close();
    await stub.close();
  }
}

const requested = process.argv.slice(2).filter((a) => a === "unit" || a === "http");
const buckets = requested.length > 0 ? requested : ["unit", "http"];

let failed = false;
const timings = [];
for (const bucket of buckets) {
  console.log(`\n──── checks/${bucket} ────`);
  const { code, ms, bootMs, testMs } = bucket === "unit" ? await runUnit() : await runHttp();
  timings.push(bootMs === undefined ? `${bucket} ${ms}ms` : `${bucket} ${ms}ms (서버 기동 ${bootMs}ms + 단언 ${testMs}ms)`);
  if (code !== 0) failed = true;
}

console.log(`\n실행 시간: ${timings.join(" · ")}  [cwd ${CHECKS_DIR}]`);
process.exit(failed ? 1 : 0);
