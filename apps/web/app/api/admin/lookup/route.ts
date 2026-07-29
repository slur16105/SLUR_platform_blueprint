import { NextRequest } from "next/server";

import { proxyWithRefresh } from "@/lib/auth";

// 관리자 조회 (Story 5.6) — tab=users|sellers|products 를 각 FastAPI 목록 API로 프록시
const TABS = new Set(["users", "sellers", "products"]);
const PRODUCT_STATUSES = new Set(["active", "soldout", "hidden"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function invalid(message: string) {
  return Response.json({ code: "validation_error", message, details: [] }, { status: 422 });
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const tab = sp.get("tab") ?? "";
  if (!TABS.has(tab)) return invalid("지원하지 않는 조회 탭입니다.");

  const q = (sp.get("q") ?? "").trim();
  const page = sp.get("page") ?? "1";
  if (q && (q.length < 2 || q.length > 100)) return invalid("검색어는 2~100자로 입력해 주세요.");
  if (!/^\d+$/.test(page) || Number(page) < 1 || Number(page) > 10000) return invalid("올바르지 않은 페이지입니다.");

  const query = new URLSearchParams({ page });
  if (q) query.set("q", q);

  if (tab === "users") {
    const role = sp.get("role") ?? "";
    if (role && !["admin", "seller", "buyer"].includes(role)) return invalid("올바르지 않은 역할입니다.");
    if (role) query.set("role", role);
  }

  if (tab === "products") {
    const categoryId = sp.get("category_id") ?? "";
    const status = sp.get("status") ?? "";
    if (categoryId && !UUID_RE.test(categoryId)) return invalid("올바르지 않은 카테고리입니다.");
    if (status && !PRODUCT_STATUSES.has(status)) return invalid("지원하지 않는 상태입니다.");
    if (categoryId) query.set("category_id", categoryId);
    if (status) query.set("status", status);
  }

  return proxyWithRefresh(req, `/api/v1/admin/${tab}?${query.toString()}`, { method: "GET" });
}
