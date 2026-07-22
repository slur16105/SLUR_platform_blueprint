/* Next 서버 기동/정지 — HTTP 단언 다섯 중 셋이 "실제로 나가는 응답"을 봐야 해서 필요하다.

   프로덕션 모드(next build 산출물 + next start)로 띄운다. next dev는 개발 편의를 위해
   응답 헤더를 스스로 손대는 구간이 있어, 개발 서버에서 통과한 캐시 헤더 단언이
   프로덕션에서 참이라는 보장이 없다. 배포되는 것과 같은 산출물을 본다.

   전제: .next에 빌드 산출물이 있어야 한다(`npm run build`). 없으면 여기서 알려주고 멈춘다. */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";

const READY_TIMEOUT_MS = 60_000;

/** OS에게 빈 포트를 하나 얻는다 — 고정 포트는 로컬에서 이미 쓰고 있을 수 있다. */
function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

async function waitForReady(url, child) {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`next start가 먼저 종료됐다 (code ${child.exitCode})`);
    try {
      const res = await fetch(`${url}/api/products`, { redirect: "manual" });
      if (res.status > 0) return;
    } catch {
      // 아직 안 떴다
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`Next 서버가 ${READY_TIMEOUT_MS}ms 안에 뜨지 않았다`);
}

/** { url, close }. upstreamUrl은 BFF가 부를 상류(스텁) 주소. */
export async function startNextServer({ upstreamUrl, cwd }) {
  if (!existsSync(new URL("../../.next/BUILD_ID", import.meta.url))) {
    throw new Error("빌드 산출물이 없다 — 먼저 `npm run build`를 돌려라.");
  }
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  const child = spawn("npx", ["next", "start", "-p", String(port), "-H", "127.0.0.1"], {
    cwd,
    env: { ...process.env, API_BASE_URL: upstreamUrl, NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const log = [];
  child.stdout.on("data", (d) => log.push(String(d)));
  child.stderr.on("data", (d) => log.push(String(d)));

  try {
    await waitForReady(url, child);
  } catch (err) {
    child.kill("SIGKILL");
    throw new Error(`${err.message}\n--- next start 출력 ---\n${log.join("")}`);
  }

  return {
    url,
    close: () =>
      new Promise((done) => {
        if (child.exitCode !== null) return done();
        child.once("exit", () => done());
        child.kill("SIGTERM");
        setTimeout(() => child.kill("SIGKILL"), 3000).unref();
      }),
  };
}
