/* 상류 스텁 — FastAPI 자리에 앉는 최소 서버.
   BFF(app/api/**)가 무엇을 붙이고 무엇을 막는지만 보면 되므로, 상류는 "닿으면 200"이면 충분하다.
   진짜 FastAPI를 띄우면 DB·마이그레이션·시드가 딸려 오고, 그 순간 이 검사는 의존성 0이 아니게 된다.

   응답은 일부러 Cache-Control을 붙이지 않는다 — BFF가 붙이는 것만 보이게 하기 위해서다. */
import { createServer } from "node:http";

const ROUTES = {
  "GET /api/v1/auth/me": {
    status: 200,
    body: { id: "stub-user", email: "stub@example.com", name: "스텁", phone: "01028473391" },
  },
  "POST /api/v1/carts/items": { status: 200, body: { id: "stub-cart-item", quantity: 1 } },
  "GET /api/v1/products": { status: 200, body: { items: [], page: 1, total: 0 } },
};

/** 상류 스텁을 띄우고 { url, close }를 돌려준다. 포트는 OS가 고른다(0). */
export function startStubUpstream() {
  const server = createServer((req, res) => {
    const path = (req.url ?? "/").split("?")[0];
    const hit = ROUTES[`${req.method} ${path}`];
    const payload = hit
      ? { status: hit.status, body: hit.body }
      : { status: 404, body: { code: "not_found", message: "스텁에 없는 경로입니다.", details: [] } };
    const json = JSON.stringify(payload.body);
    res.writeHead(payload.status, { "Content-Type": "application/json" });
    res.end(json);
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}
