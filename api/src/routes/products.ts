import type { FastifyInstance } from "fastify";
import {
  getCategoriesBySlugs,
  getProductBySlug,
  getProductsByIds,
  listProducts,
  listCategoriesWithCounts,
  listSitemapProductSlugs,
  SORT_VALUES,
  type SortValue,
} from "../services/productService.js";
import {
  getCatalogFilterCategorySlugs,
  getFooterCategorySlugs,
  getHomeCategorySlugs,
  getHomeHeroText,
  getHomeProductIds,
} from "../services/settingsService.js";

function parseQuery(raw: Record<string, unknown>) {
  const categoryParam = typeof raw.category === "string" ? raw.category : undefined;
  const categorySlugs = categoryParam?.split(",").filter(Boolean) ?? [];
  const bioOnly = raw.bio === "1";
  const query = typeof raw.q === "string" ? raw.q.trim() : "";
  const sortParam = typeof raw.sort === "string" ? raw.sort : "popular";
  const sort: SortValue = (SORT_VALUES as readonly string[]).includes(sortParam) ? (sortParam as SortValue) : "popular";
  const pageParam = typeof raw.page === "string" ? parseInt(raw.page, 10) : 1;
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  return { categorySlugs, bioOnly, query, sort, page };
}

export async function productRoutes(app: FastifyInstance) {
  app.get("/sitemap/products", async () => ({ slugs: await listSitemapProductSlugs() }));

  app.get("/products", async (request) => {
    const params = parseQuery(request.query as Record<string, unknown>);
    const result = await listProducts(params);
    return {
      products: result.rows,
      pagination: {
        page: result.currentPage,
        totalPages: result.totalPages,
        totalCount: result.totalCount,
        pageSize: result.pageSize,
      },
    };
  });

  app.get<{ Params: { slug: string } }>("/products/:slug", async (request, reply) => {
    const product = await getProductBySlug(request.params.slug);
    if (!product) return reply.code(404).send({ error: "Товар не найден" });
    return product;
  });

  // Catalog filter sidebar's category list — admin-curated, ordered subset
  // (see admin panel's "Фильтры каталога" page / routes/adminCatalogFilters.ts)
  // when configured, else every product-type category ordered by count desc
  // (the original, pre-CMS behavior).
  app.get("/categories", async () => {
    const pinnedSlugs = await getCatalogFilterCategorySlugs();
    const categories =
      pinnedSlugs.length > 0 ? await getCategoriesBySlugs(pinnedSlugs) : await listCategoriesWithCounts();
    return { categories };
  });

  // Homepage's "Категории"/"Лидеры продаж" sections — admin-picked and
  // ordered (see admin panel's "Главная" page / routes/adminHome.ts) when
  // configured, else the same automatic top-5-by-count / top-4-popular
  // logic the homepage used before this existed.
  app.get("/home", async () => {
    const pinnedSlugs = await getHomeCategorySlugs();
    const categories =
      pinnedSlugs.length > 0 ? await getCategoriesBySlugs(pinnedSlugs) : (await listCategoriesWithCounts()).slice(0, 5);

    const pinnedIds = await getHomeProductIds();
    const products =
      pinnedIds.length > 0 ? await getProductsByIds(pinnedIds) : (await listProducts({ sort: "popular", page: 1 })).rows.slice(0, 4);

    const hero = await getHomeHeroText();

    return { categories, products, hero };
  });

  // Site footer's "Каталог" column — admin-curated, ordered (see admin
  // panel's "Главная" page / routes/adminHome.ts), falls back to the
  // footer's original hand-picked slugs (getFooterCategorySlugs) rather
  // than an empty list.
  app.get("/footer-categories", async () => {
    const slugs = await getFooterCategorySlugs();
    return { categories: await getCategoriesBySlugs(slugs) };
  });
}
