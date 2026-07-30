/* 프로토타입 — 상품상세. 홈과 **같은 재료**(토큰·헤더·푸터·카드)를 쓰고 배치만 상세용으로 바꾼다.
   좌 이미지 갤러리 / 우 구매 정보 2단 → 아래 설명·배송·판매자 정보 → 함께 보면 좋은 상품.
   데이터는 실 API(/api/v1/products/{id}), 이미지만 데모. 기존 화면 영향 0. */

import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductCard, ProtoFooter, ProtoHeader } from "../../chrome";
import { getJson, img, imgSeed, won, type Category, type ProductDetail, type Product } from "../../data";
import BuyBox from "./buy-box";

import "../../proto.css";

export default async function ProtoProductDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [product, categories, list] = await Promise.all([
    getJson<ProductDetail | null>(`/api/v1/products/${id}`, null),
    getJson<Category[]>("/api/v1/products/categories", []),
    getJson<{ items?: Product[] }>("/api/v1/products?page=1", {}),
  ]);

  if (!product) notFound();

  const seed = imgSeed(product.id);
  const category = categories.find((c) => c.id === product.category_id);
  /* 함께 보면 좋은 상품 — 같은 카테고리 우선, 자기 자신 제외 */
  const related = (list.items ?? [])
    .filter((p) => p.id !== product.id)
    .sort((a, b) => Number(b.category_id === product.category_id) - Number(a.category_id === product.category_id))
    .slice(0, 5);

  const s = product.seller_info;

  return (
    <div className="proto min-h-screen">
      <ProtoHeader categories={categories} />

      <main className="mx-auto max-w-[1600px] px-5">
        {/* 빵부스러기 */}
        <nav className="flex items-center gap-2 py-6 text-[13px] text-muted-foreground" aria-label="위치">
          <Link href="/proto/home" className="hover:text-foreground">HOME</Link>
          <span>/</span>
          {category ? (
            <>
              <Link href="#" className="hover:text-foreground">{category.name}</Link>
              <span>/</span>
            </>
          ) : null}
          <span className="text-foreground">{product.name}</span>
        </nav>

        {/* 좌 갤러리 / 우 구매 정보 */}
        <div className="grid gap-10 pb-16 md:grid-cols-2 md:gap-14">
          <div>
            <div className="aspect-4/5 w-full overflow-hidden bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img(seed, 1000, 1250)}
                alt=""
                className={`h-full w-full object-cover ${product.sold_out ? "opacity-40 grayscale" : ""}`}
              />
            </div>
            {/* 썸네일 — 실 이미지가 1장뿐이라 데모로 몇 컷을 함께 보인다 */}
            <div className="mt-2 grid grid-cols-4 gap-2">
              {[0, 1, 2, 3].map((k) => (
                <div key={k} className={`aspect-square overflow-hidden bg-muted ${k === 0 ? "" : "opacity-60"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img(seed + k, 300, 300)} alt="" className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          </div>

          <div className="md:pt-2">
            <p className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
              {product.brand_name}
            </p>
            <h1 className="mt-2.5 text-[34px] font-semibold leading-tight tracking-tight">{product.name}</h1>
            <p className="mt-4 text-[26px] font-semibold tabular-nums">
              {won(product.price_from)}
              {product.sold_out ? (
                <span className="ml-3 align-middle bg-foreground px-2.5 py-1 text-[12px] font-medium text-background">
                  SOLD OUT
                </span>
              ) : null}
            </p>

            <div className="mt-8">
              <BuyBox variants={product.variants} soldOut={product.sold_out} />
            </div>
          </div>
        </div>
      </main>

      {/* 상품 설명 — 검은 면으로 구획 (EQL식 리듬) */}
      <section className="bg-foreground py-16 text-background">
        <div className="mx-auto max-w-[900px] px-5 text-center">
          <p className="text-[13px] tracking-[0.3em] text-accent">PRODUCT</p>
          <p className="mt-6 text-[20px] leading-relaxed opacity-80">{product.description}</p>
        </div>
      </section>

      {/* 배송·교환 / 판매자 정보 */}
      <section className="mx-auto max-w-[1600px] px-5 py-16">
        <div className="grid gap-12 md:grid-cols-2">
          <div>
            <h2 className="mb-5 text-[22px] font-semibold uppercase tracking-wide">SHIPPING & RETURNS</h2>
            <dl className="text-[14px] leading-relaxed">
              {[
                ["배송비", "판매자마다 다르며 주문서에서 확인할 수 있습니다."],
                ["배송 기간", "결제 확인 후 영업일 기준 2~5일"],
                ["교환·반품", "수령 후 7일 이내 신청 가능(단순 변심 시 왕복 배송비 부담)"],
                ["유의사항", "주문 제작·해외 배송 상품은 교환·반품이 제한될 수 있습니다."],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-6 border-b border-border py-3.5 last:border-b-0">
                  <dt className="w-24 flex-none text-muted-foreground">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div>
            <h2 className="mb-5 text-[22px] font-semibold uppercase tracking-wide">SELLER</h2>
            <dl className="text-[14px] leading-relaxed">
              {[
                ["브랜드", s.brand_name],
                ["상호", s.company_name],
                ["대표자", s.representative_name],
                ["사업자등록번호", s.business_registration_number],
                ["통신판매업신고", s.mail_order_number],
                ["주소", s.business_address],
                ["연락처", s.contact_phone],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-6 border-b border-border py-3.5 last:border-b-0">
                  <dt className="w-28 flex-none text-muted-foreground">{k}</dt>
                  <dd>{v || "-"}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-5 text-[13px] leading-relaxed text-muted-foreground">
              SLUR는 통신판매중개자이며 통신판매의 당사자가 아닙니다.
              상품·상품정보·거래에 관한 의무와 책임은 판매자에게 있습니다.
            </p>
          </div>
        </div>
      </section>

      {/* 함께 보면 좋은 상품 */}
      {related.length ? (
        <section className="mx-auto max-w-[1600px] px-5 pb-20">
          <div className="mb-6 flex items-baseline justify-between border-b border-border pb-3">
            <h2 className="text-[22px] font-semibold uppercase tracking-wide">YOU MAY ALSO LIKE</h2>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-9 md:grid-cols-4 lg:grid-cols-5">
            {related.map((p) => (
              <ProductCard key={p.id} p={p} seed={imgSeed(p.id)} />
            ))}
          </div>
        </section>
      ) : null}

      <ProtoFooter />
    </div>
  );
}
