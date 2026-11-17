import Link from "next/link";
import { apiGet } from "@/lib/api/server";
import type { Category, ProductsResponse } from "@/lib/api/types";
import { ProductGrid } from "@/components/product/ProductGrid";
import { PageTransition } from "@/components/transitions/PageTransition";
import { Filters } from "./Filters";
import { CatalogSearch } from "./CatalogSearch";
import { SortSelect } from "./SortSelect";
import { Pagination } from "./Pagination";
import styles from "./page.module.css";

export default async function CatalogPage({ searchParams }: PageProps<"/catalog">) {
  const params = await searchParams;

  const categoryParam = typeof params.category === "string" ? params.category : undefined;
  const selectedCategories = categoryParam?.split(",").filter(Boolean) ?? [];
  const bioOnly = params.bio === "1";
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const sort = typeof params.sort === "string" ? params.sort : "popular";
  const page = typeof params.page === "string" ? params.page : "1";

  const qs = new URLSearchParams();
  if (categoryParam) qs.set("category", categoryParam);
  if (bioOnly) qs.set("bio", "1");
  if (query) qs.set("q", query);
  if (sort !== "popular") qs.set("sort", sort);
  qs.set("page", page);

  const [data, categories] = await Promise.all([
    apiGet<ProductsResponse>(`/products?${qs.toString()}`),
    apiGet<{ categories: Category[] }>("/categories").then((r) => r?.categories ?? []),
  ]);

  const products = data?.products ?? [];
  const pagination = data?.pagination ?? { page: 1, totalPages: 1, totalCount: 0, pageSize: 20 };

  const activeCategoryNames = categories
    .filter((c) => selectedCategories.includes(c.slug))
    .map((c) => c.name);

  function buildPageHref(targetPage: number) {
    const usp = new URLSearchParams();
    if (selectedCategories.length > 0) usp.set("category", selectedCategories.join(","));
    if (bioOnly) usp.set("bio", "1");
    if (query) usp.set("q", query);
    if (sort !== "popular") usp.set("sort", sort);
    if (targetPage > 1) usp.set("page", String(targetPage));
    const s = usp.toString();
    return s ? `/catalog?${s}` : "/catalog";
  }

  return (
    // PageTransition wraps only the product grid below, not this whole
    // <main> — matching /account/favorites' scope. Breadcrumbs/Filters/
    // toolbar/Pagination stay outside any <ViewTransition> on purpose: a
    // shared product-thumb-* morph (ProductCard.tsx) nested many layers
    // deep inside ONE huge named boundary (the old set-up wrapped all of
    // this plus the grid as a single group) forced the browser to carve
    // each of up to 20 simultaneously-morphing thumbs out of that big
    // parent's snapshot — measurably slow, and during that window the
    // shared element failed to pair cleanly, reading as the photo
    // vanishing and popping back in instead of smoothly moving. Keeping
    // the transitioned boundary down to just the grid (few, simple nodes)
    // fixes that without touching the morph itself.
    <main>
      <div className={styles.crumbs}>
        <Link href="/" transitionTypes={["nav-back"]}>
          Главная
        </Link>{" "}
        /{" "}
        <Link href="/catalog" transitionTypes={["nav-back"]}>
          Каталог
        </Link>
        {activeCategoryNames.length > 0 ? ` / ${activeCategoryNames.join(", ")}` : ""}
        {query ? ` / Поиск: «${query}»` : ""}
      </div>
      <div className={styles.layout}>
        <Filters categories={categories} />
        <div>
          <div className={styles.toolbar}>
            <CatalogSearch />
            <div className={styles.toolbarRight}>
              <span>{pagination.totalCount} товаров</span>
              <SortSelect />
            </div>
          </div>
          <PageTransition>
            {products.length > 0 ? (
              <ProductGrid products={products} />
            ) : (
              <p className={styles.empty}>
                {query
                  ? `По запросу «${query}» ничего не нашлось.`
                  : "По этим фильтрам ничего не нашлось."}
              </p>
            )}
          </PageTransition>
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            buildHref={buildPageHref}
          />
          <p className={styles.footnote}>
            * ориентировочно, курс ЦБ с наценкой за растаможку — пересчитывается на день выкупа
          </p>
        </div>
      </div>
    </main>
  );
}
