"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import CategoryChips, { type Category } from "./category-chips";
import ProductCard, { type ProductItem } from "./product-card";
import {
  EmptyState,
  ErrorState,
  GridSkeleton,
  getPublicJson,
  type ApiFailure,
} from "./buyer-feedback";

/* 상품목록 본체 — `/`의 내용.
   URL이 화면 상태의 저장소다 (D4): 선택 카테고리는 ?category=<uuid>에 replace로 남는다.
   push가 아니라 replace인 이유는 칩을 다섯 번 누르면 히스토리가 다섯 칸 쌓여
   뒤로가기가 상품목록을 벗어나지 못하기 때문이다 (UX-DR16).

   페이지네이션은 `더 보기` 버튼이다 — 스크롤 관찰자·자동 로드를 만들지 않는다 (UX-DR16).
   응답에 size가 없으므로 페이지 크기를 상수로 박지 않고 `누적 길이 >= total`로 끝을 판정한다 (D5).

   숨김 상품은 서버가 제외한다 — 클라이언트가 상태로 거르지 않는다 (FR-12).
   로그인 여부를 판정하지 않는다 — 공개 화면이므로 slur_role 쿠키를 읽지 않는다 (R7, AD-1).

   로딩 여부를 상태로 두지 않고 `적재된 카테고리 !== 지금 카테고리`로 파생한다 —
   effect 안에서 동기 setState를 하지 않기 위한 형태다(react-hooks/set-state-in-effect). */

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const EMPTY_ALL = "아직 등록된 상품이 없습니다."; // [ASSUMPTION] 스파인의 빈 상태 표에 없는 문구
const EMPTY_CATEGORY = "이 카테고리에는 아직 상품이 없습니다.";

type ProductListResponse = { items: ProductItem[]; total: number; page: number };

/** 적재 결과 한 벌 — 어느 카테고리의 것인지를 함께 들고 다닌다. */
type Snapshot = {
  key: string;
  items: ProductItem[];
  total: number;
  page: number;
  error: ApiFailure | null;
};

export default function ProductList() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 형식이 아닌 값이 URL에 있으면 상류를 부르지 않고 조용히 정리한다 (422 화면을 만들지 않는다)
  const rawCategory = searchParams.get("category");
  const category = rawCategory && UUID_RE.test(rawCategory) ? rawCategory : null;
  const malformedQuery = rawCategory !== null && category === null;
  const key = category ?? "";

  // null = 아직 못 받음(또는 실패) — 칩 행을 감추고 목록은 계속 보여준다
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [retry, setRetry] = useState(0);
  const reqRef = useRef(0); // 카테고리 전환 중 도착한 옛 응답을 버린다

  const loading = snap === null || snap.key !== key;
  const items = useMemo(() => (loading ? [] : snap.items), [loading, snap]);
  const total = loading ? 0 : snap.total;
  const page = loading ? 1 : snap.page;
  const error = loading ? null : snap.error;

  /* 카테고리 조회 — 실패해도 목록 전체를 오류 화면으로 덮지 않는다 (AC 2). */
  useEffect(() => {
    let alive = true;
    void (async () => {
      const r = await getPublicJson<Category[]>("/api/products/categories");
      if (!alive) return;
      setCategories(r.ok && Array.isArray(r.data) ? r.data : null);
    })();
    return () => {
      alive = false;
    };
  }, []);

  /* 형식이 틀렸거나 응답에 없는 카테고리(삭제된 링크)는 조용히 `전체`로 되돌리고 쿼리를 정리한다. */
  useEffect(() => {
    if (malformedQuery) {
      router.replace(pathname);
      return;
    }
    if (category && categories && !categories.some((c) => c.id === category)) {
      router.replace(pathname);
    }
  }, [malformedQuery, category, categories, router, pathname]);

  const buildUrl = useCallback(
    (p: number) => {
      const q = new URLSearchParams();
      if (category) q.set("category", category);
      q.set("page", String(p));
      return `/api/products?${q.toString()}`;
    },
    [category],
  );

  /* 첫 페이지 — 카테고리가 바뀌면 key가 달라져 누적이 통째로 갈린다. */
  useEffect(() => {
    if (malformedQuery) return; // 쿼리 정리 후 다시 들어온다
    let alive = true;
    const token = ++reqRef.current;
    void (async () => {
      const r = await getPublicJson<ProductListResponse>(buildUrl(1));
      if (!alive || token !== reqRef.current) return;
      setLoadingMore(false);
      setSnap(
        r.ok
          ? { key, items: r.data.items ?? [], total: r.data.total ?? 0, page: r.data.page ?? 1, error: null }
          : { key, items: [], total: 0, page: 1, error: r.error },
      );
    })();
    return () => {
      alive = false;
    };
  }, [buildUrl, key, malformedQuery, retry]);

  async function loadMore() {
    if (loadingMore) return;
    const token = reqRef.current;
    setLoadingMore(true);
    const r = await getPublicJson<ProductListResponse>(buildUrl(page + 1));
    if (token !== reqRef.current) return; // 사이에 카테고리가 바뀌었다 — 누적하지 않는다
    setSnap((prev) =>
      prev === null || prev.key !== key
        ? prev
        : r.ok
          ? {
              key,
              items: [...prev.items, ...(r.data.items ?? [])],
              total: r.data.total ?? prev.total,
              page: r.data.page ?? prev.page + 1,
              error: null,
            }
          : { ...prev, error: r.error },
    );
    setLoadingMore(false);
  }

  function select(id: string | null) {
    router.replace(id ? `${pathname}?category=${encodeURIComponent(id)}` : pathname);
  }

  return (
    <>
      {categories && categories.length > 0 ? (
        <CategoryChips categories={categories} selected={category} onSelect={select} />
      ) : null}

      <div className="b_container b_section">
        <p className="b_eyebrow i_eyebrow">큐레이션</p>
        <h1 className="b_display i_display">
          골라온 것들을
          <br />
          천천히 봅니다
        </h1>

        {loading ? <GridSkeleton /> : null}

        {!loading && error && items.length === 0 ? (
          <ErrorState message={error.message} onRetry={() => setRetry((n) => n + 1)} />
        ) : null}

        {!loading && !error && items.length === 0 ? (
          <EmptyState message={category ? EMPTY_CATEGORY : EMPTY_ALL} />
        ) : null}

        {items.length > 0 ? (
          <>
            <div className="b_grid b_products">
              {items.map((item) => (
                <ProductCard key={item.id} item={item} />
              ))}
            </div>
            {error ? (
              <ErrorState message={error.message} onRetry={() => void loadMore()} />
            ) : items.length < total ? (
              <div className="b_more">
                <button
                  type="button"
                  className="b_btn m_ghost b_button_text"
                  onClick={() => void loadMore()}
                  disabled={loadingMore}
                >
                  더 보기
                </button>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </>
  );
}
