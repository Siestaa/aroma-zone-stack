import { and, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { categories, products, productVariants } from "../db/schema.js";
import { getCurrentFxRate } from "./settingsService.js";
import { displayName, displayDescription } from "./translationService.js";

const PAGE_SIZE = 20;
export const SORT_VALUES = ["popular", "price-asc", "price-desc"] as const;
export type SortValue = (typeof SORT_VALUES)[number];

export interface ListProductsParams {
  categorySlugs?: string[];
  bioOnly?: boolean;
  query?: string;
  sort?: SortValue;
  page?: number;
}

// Aggregates each product's variants down to the fields a catalog card
// needs: the "from X€" price (cheapest variant, standard e-commerce
// convention when a product has multiple sizes) and whether anything is in
// stock. The image itself lives on `products` directly (one main image per
// product — see schema.ts), not aggregated from variants.
const minPriceEurCents = sql<number>`min(${productVariants.priceEurCents})`;
const anyInStock = sql<boolean>`bool_or(${productVariants.inStock})`;
// Same "cheapest variant wins" convention the main image download uses —
// lets the catalog card show the real flacon/eco-recharge/color distinction
// for the ~30 products where it matters (see schema.ts's format_type
// comment), without the card needing to know about individual variants.
const representativeFormatType = sql<string | null>`(array_agg(${productVariants.formatType} order by ${productVariants.priceEurCents}))[1]`;
// The cheapest variant's own identity — lets a catalog/favorites card add
// straight to the cart without a second fetch for variant details. Same
// "cheapest wins" convention as the format type above, so it can point at
// an out-of-stock variant if a cheaper size happens to be sold out while a
// pricier one isn't — the quick-add button only renders when the product's
// overall `inStock` (bool_or across all variants) is true, not per-variant,
// matching how the "нет в наличии" tag already reads this same flag.
const representativeVariantId = sql<string>`(array_agg(${productVariants.id} order by ${productVariants.priceEurCents}))[1]`;
const representativeSku = sql<string>`(array_agg(${productVariants.sku} order by ${productVariants.priceEurCents}))[1]`;
const representativeCapacity = sql<number | null>`(array_agg(${productVariants.capacity} order by ${productVariants.priceEurCents}))[1]`;
const representativeCapacityUnit = sql<string | null>`(array_agg(${productVariants.capacityUnit} order by ${productVariants.priceEurCents}))[1]`;

// A product belongs to a category iff that category's original French tag
// (categories.name_fr) appears in the product's categories_raw array — a
// product naturally carries many tags at once, so category membership is
// computed via JSONB containment rather than a single FK column (see
// schema.ts's comment on `categories`). Selecting multiple categories is OR
// semantics (product matches if it's in *any* of them), same as the old
// single-column `inArray` behavior it replaces.
async function categoryFilterCondition(slugs: string[]) {
  if (slugs.length === 0) return undefined;
  const rows = await db.query.categories.findMany({ where: inArray(categories.slug, slugs) });
  if (rows.length === 0) return sql`false`; // unknown slug(s) — match nothing rather than everything
  return or(...rows.map((c) => sql`${products.categoriesRaw} @> ${JSON.stringify([c.nameFr])}::jsonb`));
}

async function buildWhere(params: ListProductsParams) {
  // Admin-hidden products never appear on the storefront (see admin panel's
  // products.hidden toggle) — filtered here rather than at the admin layer
  // so every future storefront read path inherits it automatically.
  const conditions = [];
  conditions.push(eq(products.hidden, false));
  if (params.categorySlugs && params.categorySlugs.length > 0) {
    const condition = await categoryFilterCondition(params.categorySlugs);
    if (condition) conditions.push(condition);
  }
  if (params.bioOnly) conditions.push(eq(products.bio, true));
  // Match either language — a shopper might search "huile de ricin" (the
  // French ingredient name, as printed on AZ's own labels) or "касторовое
  // масло" (its translation), and both should find the same product.
  if (params.query) {
    conditions.push(or(ilike(products.name, `%${params.query}%`), ilike(products.nameRu, `%${params.query}%`)));
  }
  return conditions.length > 0 ? and(...conditions) : undefined;
}

export async function listProducts(params: ListProductsParams) {
  const page = params.page && params.page > 1 ? params.page : 1;
  const sort = params.sort ?? "popular";
  const where = await buildWhere(params);

  const orderBy =
    sort === "price-asc"
      ? sql`min(${productVariants.priceEurCents}) asc`
      : sort === "price-desc"
        ? sql`min(${productVariants.priceEurCents}) desc`
        : // "popular" — no fabricated rank field like the old mock data had;
          // best-seller flag first, then review count as a real popularity proxy.
          sql`${products.bestSeller} desc, coalesce(${products.ratingCount}, 0) desc`;

  const rowsQuery = db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      nameRu: products.nameRu,
      bio: products.bio,
      bestSeller: products.bestSeller,
      ratingAvg: products.ratingAvg,
      ratingCount: products.ratingCount,
      minPriceEurCents,
      inStock: anyInStock,
      imageUrl: products.imageUrl,
      formatType: representativeFormatType,
      defaultVariantId: representativeVariantId,
      defaultVariantSku: representativeSku,
      defaultVariantCapacity: representativeCapacity,
      defaultVariantCapacityUnit: representativeCapacityUnit,
    })
    .from(products)
    .innerJoin(productVariants, eq(productVariants.productId, products.id))
    .groupBy(products.id)
    .orderBy(orderBy)
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  const countQuery = db
    .select({ count: sql<number>`count(distinct ${products.id})` })
    .from(products)
    .innerJoin(productVariants, eq(productVariants.productId, products.id));

  const [rows, [countRow]] = await Promise.all([
    where ? rowsQuery.where(where) : rowsQuery,
    where ? countQuery.where(where) : countQuery,
  ]);

  const totalCount = Number(countRow?.count ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  // approxRub is always computed at read time from the live rate, never
  // stored per product — see web/CLAUDE.md's business-model note and the
  // catalog footnote ("пересчитывается на день выкупа").
  const fxRate = await getCurrentFxRate();
  const rowsWithRub = rows.map(({ nameRu, ...r }) => ({
    ...r,
    name: displayName({ name: r.name, nameRu }),
    nameOriginal: r.name,
    approxRub: Math.round((r.minPriceEurCents / 100) * fxRate),
  }));

  return { rows: rowsWithRub, totalCount, totalPages, currentPage, pageSize: PAGE_SIZE, fxRate };
}

export async function listSitemapProductSlugs(): Promise<string[]> {
  const rows = await db.select({ slug: products.slug })
    .from(products)
    .where(eq(products.hidden, false))
    .orderBy(products.slug);
  return rows.map(({ slug }) => slug);
}

export async function getProductBySlug(slug: string) {
  const product = await db.query.products.findFirst({ where: eq(products.slug, slug) });
  if (!product || product.hidden) return null;
  const variants = await db.query.productVariants.findMany({ where: eq(productVariants.productId, product.id) });

  const fxRate = await getCurrentFxRate();
  // Variants no longer carry their own image (schema.ts) — every variant
  // shows the product's one main image, keeping the frontend's per-variant
  // ProductVariant.imageUrl shape unchanged.
  const variantsWithRub = variants.map((v) => ({
    ...v,
    imageUrl: product.imageUrl,
    approxRub: Math.round((v.priceEurCents / 100) * fxRate),
  }));

  // Which (product-type) categories this product belongs to — for the
  // breadcrumb. A product can match several; the frontend just shows the
  // first, there's no single "primary" one in this data model.
  const matchedCategories =
    product.categoriesRaw.length > 0
      ? await db
          .select({ slug: categories.slug, name: categories.nameRu })
          .from(categories)
          .where(and(eq(categories.isProductType, true), inArray(categories.nameFr, product.categoriesRaw)))
      : [];

  return {
    ...product,
    name: displayName(product),
    nameOriginal: product.name,
    description: displayDescription(product),
    variants: variantsWithRub,
    fxRate,
    categories: matchedCategories,
  };
}

// Product-type categories only (see schema.ts) — these are the ones that
// drive real navigation (catalog filter sidebar, homepage top-5); the
// marketing/audience/facet tags in the full directory are backend-only data.
const productCountForCategory = sql<number>`(
  select count(*) from ${products}
  where ${products.categoriesRaw} @> jsonb_build_array(${categories.nameFr})
)`;

export async function listCategoriesWithCounts() {
  const rows = await db
    .select({
      slug: categories.slug,
      name: categories.nameRu,
      count: productCountForCategory,
    })
    .from(categories)
    .where(eq(categories.isProductType, true))
    .orderBy(sql`${productCountForCategory} desc`);

  return rows.map((r) => ({ ...r, count: Number(r.count) }));
}

// Resolves an admin-picked, ordered list of category slugs (homepage config,
// see settingsService.ts's getHomeCategorySlugs) to full rows — preserving
// the given order (that's the whole point of letting an admin order them)
// and silently dropping any slug that no longer exists rather than erroring,
// so a stale pinned slug just quietly falls out of the homepage instead of
// breaking it.
export async function getCategoriesBySlugs(slugs: string[]) {
  if (slugs.length === 0) return [];
  const rows = await db
    .select({ slug: categories.slug, name: categories.nameRu, count: productCountForCategory })
    .from(categories)
    .where(inArray(categories.slug, slugs));
  const bySlug = new Map(rows.map((r) => [r.slug, { ...r, count: Number(r.count) }]));
  return slugs.map((slug) => bySlug.get(slug)).filter((r) => r !== undefined);
}

// Same order-preserving resolution as getCategoriesBySlugs, for the
// homepage's admin-picked "Лидеры продаж" product ids — same ProductListItem
// shape listProducts() rows produce, and hidden products are excluded even
// if still pinned (an admin hiding a product shouldn't require also
// remembering to unpin it from the homepage).
export async function getProductsByIds(ids: string[]) {
  if (ids.length === 0) return [];
  const rows = await db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      nameRu: products.nameRu,
      bio: products.bio,
      bestSeller: products.bestSeller,
      ratingAvg: products.ratingAvg,
      ratingCount: products.ratingCount,
      minPriceEurCents,
      inStock: anyInStock,
      imageUrl: products.imageUrl,
      formatType: representativeFormatType,
      defaultVariantId: representativeVariantId,
      defaultVariantSku: representativeSku,
      defaultVariantCapacity: representativeCapacity,
      defaultVariantCapacityUnit: representativeCapacityUnit,
    })
    .from(products)
    .innerJoin(productVariants, eq(productVariants.productId, products.id))
    .where(and(inArray(products.id, ids), eq(products.hidden, false)))
    .groupBy(products.id);

  const fxRate = await getCurrentFxRate();
  const byId = new Map(
    rows.map(({ nameRu, ...r }) => [
      r.id,
      {
        ...r,
        name: displayName({ name: r.name, nameRu }),
        nameOriginal: r.name,
        approxRub: Math.round((r.minPriceEurCents / 100) * fxRate),
      },
    ])
  );
  return ids.map((id) => byId.get(id)).filter((r) => r !== undefined);
}
