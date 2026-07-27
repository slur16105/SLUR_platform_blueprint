import { proxyPublic } from "@/lib/public-api";

/* 공개 편성 지면 — GET /api/v1/home
   쿼리를 받지 않는다(활성 편성 한 판을 서버가 고른다). 그래서 화이트리스트도 없다 —
   api/products와 달리 상류로 넘길 파라미터가 없으므로 경로만 그대로 프록시한다.
   봉투·no-store 규약은 proxyPublic이 지킨다(공개 GET, 세션 무접촉). */
export async function GET() {
  return proxyPublic("/api/v1/home");
}
