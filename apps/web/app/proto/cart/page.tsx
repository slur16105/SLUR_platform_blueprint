/* 프로토타입 — 장바구니. 판매자별 묶음 + 선택·수량 + 우측 합계(스티키).
   ⚠️ 담긴 내용은 **실제 내 장바구니가 아니라** 실 상품 몇 개로 만든 예시다
      (실 장바구니는 로그인이 필요하고, 이 프로토타입은 모양 판단용이다).
   기존 화면 영향 0. */

import { ProtoFooter, ProtoHeader } from "../chrome";
import { getJson, type Category, type Product } from "../data";
import CartView from "./cart-view";

import "../proto.css";

export default async function ProtoCart() {
  const [list, categories] = await Promise.all([
    getJson<{ items?: Product[] }>("/api/v1/products?page=1", {}),
    getJson<Category[]>("/api/v1/products/categories", []),
  ]);

  /* 예시 담김 — 품절 1건을 섞어 "구매 불가" 표현까지 확인할 수 있게 한다 */
  const all = list.items ?? [];
  const sample = [
    ...all.filter((p) => !p.sold_out).slice(0, 3),
    ...all.filter((p) => p.sold_out).slice(0, 1),
  ];

  return (
    <div className="proto min-h-screen">
      <ProtoHeader categories={categories} />

      <main className="mx-auto max-w-[1600px] px-5">
        <div className="border-b border-border py-12 text-center">
          <h1 className="text-[40px] font-bold uppercase leading-none tracking-tight">CART</h1>
          <p className="mt-3 text-[14px] text-muted-foreground">
            <span className="font-semibold text-accent">{sample.length}</span>개의 상품
          </p>
        </div>

        <div className="pt-10">
          <CartView initial={sample} />
        </div>
      </main>

      <ProtoFooter />
    </div>
  );
}
