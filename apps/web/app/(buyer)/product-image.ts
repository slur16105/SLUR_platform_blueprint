/* 상품 이미지 해석기 — **목록과 상세가 같은 사진을 쓰게 하는 단일 규칙**.

   문제였던 것: 목록은 데모 사진(상품 id로 배정)을, 상세는 응답의 image_url을 그대로 썼다.
   그런데 지금 실 상품 사진은 전부 같은 회색 플레이스홀더(`/local-product-images/local-demo.jpg`)라
   목록에서 본 사진과 상세 사진이 달라 보였다 (오너 지적 2026-07-30).

   규칙: **플레이스홀더면 데모 사진, 진짜 사진이면 그대로.**
   실 상품 사진이 업로드되면 두 화면 모두 자동으로 그 사진을 쓴다 — 나중에 코드를 고칠 필요가 없다.
   🚨 데모 사진은 오픈 게이트 항목이다. 실사진이 준비되면 이 파일의 OBJ 목록만 지우면 된다. */

/** 로컬 검증용 플레이스홀더 경로. 이 접두어면 "진짜 상품 사진이 아직 없다"는 뜻이다. */
const PLACEHOLDER_PREFIX = "/local-product-images/";

/* 편집숍 톤 정물·오브제 (인물 없음) */
const OBJ = [
  "1493957988430-a5f2e15f39a3", "1534349762230-e0cadf78f5da", "1556909212-d5b604d0c90d",
  "1513694203232-719a280e022f", "1567016432779-094069958ea5", "1540932239986-30128078f3c5",
  "1522708323590-d24dbb6b0267", "1556910103-1c02745aae4d", "1600607687939-ce8a6c25118c",
];

/** 상품 id에서 안정적인 번호를 뽑는다 — 같은 상품은 어느 화면에서나 같은 사진이다. */
export const seedOf = (id: string) => id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);

export const demoImg = (seed: number, w = 600, h = 750) =>
  `https://images.unsplash.com/photo-${OBJ[Math.abs(seed) % OBJ.length]}?w=${w}&h=${h}&fit=crop&q=80&auto=format`;

export const isPlaceholder = (url: string | null | undefined) =>
  !url || url.startsWith(PLACEHOLDER_PREFIX);

/**
 * 화면에 그릴 상품 사진 한 장.
 * @param id      상품 id (데모 사진 배정 기준 — 화면 간 일치의 열쇠)
 * @param url     서버가 준 이미지 URL (없거나 플레이스홀더면 데모로 대체)
 * @param variant 갤러리에서 여러 컷을 보일 때의 오프셋 (0=대표)
 */
export function productImage(
  id: string,
  url: string | null | undefined,
  { w = 600, h = 750, variant = 0 }: { w?: number; h?: number; variant?: number } = {},
): string {
  if (!isPlaceholder(url)) return url as string;
  return demoImg(seedOf(id) + variant, w, h);
}
