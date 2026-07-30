/* 프로토타입 공용 값 — 타입·API 조회·표기 헬퍼.
   화면이 늘어나도 "재료"는 여기 한 곳에서 가져다 쓴다(디자인 시스템의 데이터 쪽 대응물). */

import { API_BASE } from "@/lib/auth";

export type Product = {
  id: string;
  name: string;
  brand_name: string;
  price_from: number;
  main_image_url: string | null;
  sold_out: boolean;
  category_id: string | null;
};

export type Variant = {
  id: string;
  option1_name: string;
  option1_value: string;
  option2_name: string;
  option2_value: string;
  final_price: number;
  purchasable: boolean;
};

export type SellerInfo = {
  brand_name: string;
  company_name: string;
  representative_name: string;
  business_registration_number: string;
  mail_order_number: string;
  business_address: string;
  contact_phone: string;
};

export type ProductDetail = Product & {
  description: string;
  image_urls: string[];
  variants: Variant[];
  seller_info: SellerInfo;
};

export type Category = { id: string; name: string };

export type Feature = {
  id: string;
  kind: "hero" | "slot";
  issue_no: string | null;
  issue_label: string | null;
  title: string;
  lead_text: string | null;
  layout: "feature" | "strip";
  items: Product[];
};

export type Home = { hero: Feature | null; slots: Feature[] };

export async function getJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${path}`, { next: { revalidate: 60 } });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

/* 편집숍 톤 정물·오브제 (인물 없음). 실 상품 사진 확보 전 데모. */
const OBJ = [
  "1493957988430-a5f2e15f39a3", "1534349762230-e0cadf78f5da", "1556909212-d5b604d0c90d",
  "1513694203232-719a280e022f", "1567016432779-094069958ea5", "1540932239986-30128078f3c5",
  "1522708323590-d24dbb6b0267", "1556910103-1c02745aae4d", "1600607687939-ce8a6c25118c",
];
export const img = (i: number, w = 600, h = 750) =>
  `https://images.unsplash.com/photo-${OBJ[Math.abs(i) % OBJ.length]}?w=${w}&h=${h}&fit=crop&q=80&auto=format`;
export const wide = (id: string, w = 1800, h = 620) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&fit=crop&q=80&auto=format`;

/** 상품 id로 안정적인 이미지 번호를 뽑는다 — 목록과 상세가 같은 사진을 쓰게 하기 위함 */
export const imgSeed = (id: string) => id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);

export const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

/* 내비 표기용 영문 라벨 — 데이터(카테고리명)는 한글 그대로 두고 **표시만** 영문으로 옮긴다.
   매핑에 없는 이름은 원본을 그대로 보여준다(운영자가 새 카테고리를 추가해도 깨지지 않는다). */
const EN: Record<string, string> = {
  문구: "STATIONERY",
  생활: "LIVING",
  패션: "FASHION",
  리빙: "INTERIOR",
  뷰티: "BEAUTY",
  테크: "TECH",
  푸드: "FOOD",
};
export const en = (name: string) => EN[name] ?? name;
