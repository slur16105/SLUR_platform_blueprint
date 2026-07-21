import { proxyPublic } from "@/lib/public-api";

/* 공개 카테고리 목록 — GET /api/v1/products/categories.
   응답은 봉투가 아니라 배열이며 서버가 sort_order·created_at으로 이미 정렬해 내려준다.
   정적 세그먼트라 같은 깊이의 [id]보다 먼저 매칭된다 — /api/products/categories가 상세로 새지 않는다. */
export async function GET() {
  return proxyPublic("/api/v1/products/categories");
}
