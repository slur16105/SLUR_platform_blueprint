import { NextRequest } from "next/server";

import { proxyPublic } from "@/lib/public-api";

/* 공개 상품 목록 — GET /api/v1/products?category=&page=
   화이트리스트: category·page 두 쿼리만 상류로 넘긴다. 그 외는 버린다 (D2).
   정렬·페이지 크기 파라미터는 백엔드에 없으므로 만들지도 흘리지도 않는다. */
export async function GET(req: NextRequest) {
  const src = req.nextUrl.searchParams;
  const out = new URLSearchParams();
  const category = src.get("category");
  const page = src.get("page");
  if (category) out.set("category", category);
  if (page) out.set("page", page);
  const qs = out.toString();
  return proxyPublic(`/api/v1/products${qs ? `?${qs}` : ""}`);
}
