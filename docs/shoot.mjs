/* README용 화면 캡처 — 로컬 스택(localhost:3000)에서 역할별로 로그인해 찍는다.
   실행: node shoot.mjs   (playwright 필요) */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3000";
const OUT = process.argv[2] || "docs/screenshots";
const ACCOUNTS = {
  admin: { email: "local-admin@example.com", password: "local-admin-password-2026" },
  seller: { email: "local-seller@example.com", password: "local-seller-password-2026" },
  buyer: { email: "local-buyer@example.com", password: "local-buyer-password-2026" },
};

// [파일명, 경로, 역할, 옵션]
const SHOTS = [
  // 구매자
  ["buyer-home", "/", "buyer", { full: true }],
  ["buyer-product", "PRODUCT", "buyer", { full: true }],
  ["buyer-cart", "/cart", "buyer", {}],
  ["buyer-checkout", "/checkout", "buyer", { full: true }],
  ["buyer-orders", "/orders", "buyer", {}],
  ["buyer-order-detail", "ORDER", "buyer", { full: true }],
  ["buyer-order-delivered", "ORDER_DELIVERED", "buyer", { full: true }],
  ["buyer-returns", "/returns", "buyer", {}],
  ["buyer-support", "/support", "buyer", {}],
  ["buyer-notices", "/notices", "buyer", {}],
  ["buyer-me", "/me", "buyer", { full: true }],
  ["buyer-login", "/login", null, {}],
  // 판매자
  ["seller-dashboard", "/seller", "seller", {}],
  ["seller-products", "/seller/products", "seller", {}],
  ["seller-product-new", "/seller/products/new", "seller", { full: true }],
  ["seller-orders", "/seller/orders", "seller", {}],
  ["seller-settings", "/seller/settings", "seller", { full: true }],
  // 관리자
  ["admin-dashboard", "/admin", "admin", { full: true }],
  ["admin-orders", "/admin/orders", "admin", {}],
  ["admin-order-detail", "ADMIN_ORDER", "admin", { full: true }],
  ["admin-deposits", "/admin/deposits", "admin", {}],
  ["admin-returns", "/admin/returns", "admin", {}],
  ["admin-inquiries", "/admin/inquiries", "admin", {}],
  ["admin-notices", "/admin/notices", "admin", {}],
  ["admin-applications", "/admin/sellers/applications", "admin", {}],
  ["admin-lookup", "/admin/lookup", "admin", {}],
  ["admin-home", "/admin/home", "admin", {}],
  ["admin-products", "/admin/products", "admin", {}],
  ["admin-settings", "/admin/settings", "admin", { full: true }],
];

async function login(ctx, role) {
  const res = await ctx.request.post(`${BASE}/api/auth/login`, {
    data: ACCOUNTS[role],
    headers: { Origin: BASE },
  });
  if (!res.ok()) throw new Error(`${role} 로그인 실패: ${res.status()}`);
}

async function resolvePath(ctx, token) {
  if (token === "PRODUCT") {
    const r = await ctx.request.get(`${BASE}/api/products`);
    const items = (await r.json()).items ?? [];
    // 품절이 아니고 **상세 설명이 충실한** 상품을 고른다.
    // 대표 화면이 "품절"이거나 설명 한 줄짜리면 기능을 오해한다.
    for (const it of items.filter((i) => !i.sold_out)) {
      const d = await (await ctx.request.get(`${BASE}/api/products/${it.id}`)).json();
      if ((d.description ?? "").length > 200) return `/products/${it.id}`;
    }
    const live = items.find((i) => !i.sold_out) ?? items[0];
    return live ? `/products/${live.id}` : "/";
  }
  if (token === "ORDER_DELIVERED") {
    const r = await ctx.request.get(`${BASE}/api/orders`);
    const items = (await r.json()).items ?? [];
    const done = items.find((o) => o.display_status === "delivered");
    return done ? `/orders/${done.order_id}` : "/orders";
  }
  if (token === "ORDER" || token === "ADMIN_ORDER") {
    const r = await ctx.request.get(`${BASE}/api/${token === "ORDER" ? "orders" : "admin/orders?page=1"}`);
    const body = await r.json();
    const first = (body.items ?? [])[0];
    if (!first) return token === "ORDER" ? "/orders" : "/admin/orders";
    return token === "ORDER" ? `/orders/${first.order_id}` : `/admin/orders/${first.order_id}`;
  }
  return token;
}

// 모바일 캡처 — README의 모바일 표가 참조하는 파일명을 그대로 쓴다
const MOBILE = [
  ["buyer-home-mobile", "/", "buyer"],
  ["buyer-product-detail-mobile", "PRODUCT", "buyer"],
  ["buyer-cart-mobile", "/cart", "buyer"],
  ["buyer-checkout-mobile", "/checkout", "buyer"],
  ["buyer-orders-mobile", "/orders", "buyer"],
  ["buyer-me-mobile", "/me", "buyer"],
  ["buyer-returns-mobile", "/returns", "buyer"],
  ["buyer-login-mobile", "/login", null],
];

const browser = await chromium.launch();
fs.mkdirSync(OUT, { recursive: true });
let done = 0;

for (const [name, target, role, opt] of SHOTS) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 2, // 문서에 넣어도 흐리지 않게
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
  });
  try {
    if (role) await login(ctx, role);
    const page = await ctx.newPage();
    const url = BASE + (await resolvePath(ctx, target));
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(700); // 클라이언트 렌더(대시보드 집계 등) 안정화
    await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: Boolean(opt.full) });
    console.log(`  ✓ ${name}  ${url.replace(BASE, "")}`);
    done += 1;
  } catch (e) {
    console.log(`  ✗ ${name}  ${e.message.split("\n")[0]}`);
  } finally {
    await ctx.close();
  }
}

for (const [name, target, role] of MOBILE) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone 14 기준
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
  });
  try {
    if (role) await login(ctx, role);
    const page = await ctx.newPage();
    const url = BASE + (await resolvePath(ctx, target));
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
    console.log(`  ✓ ${name}  (모바일)`);
    done += 1;
  } catch (e) {
    console.log(`  ✗ ${name}  ${e.message.split("\n")[0]}`);
  } finally {
    await ctx.close();
  }
}

await browser.close();
console.log(`\n캡처 ${done}/${SHOTS.length + MOBILE.length}`);
