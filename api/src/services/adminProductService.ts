import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { products } from "../db/schema.js";

const PAGE_SIZE = 30;

export interface ListAdminProductsParams {
  // Products where nameRu is still null — a fresh add from last night's
  // sync, or one whose French text changed (translationInvalidationPatch in
  // translationService.ts nulls it back out on any real source edit).
  untranslatedOnly?: boolean;
  query?: string;
  page?: number;
}

export async function listAdminProducts(params: ListAdminProductsParams) {
  const page = params.page && params.page > 1 ? params.page : 1;

  const conditions = [];
  if (params.untranslatedOnly) conditions.push(isNull(products.nameRu));
  if (params.query?.trim()) {
    const q = `%${params.query.trim()}%`;
    conditions.push(or(ilike(products.name, q), ilike(products.nameRu, q)));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rowsQuery = db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      nameRu: products.nameRu,
      description: products.description,
      descriptionRu: products.descriptionRu,
      imageUrl: products.imageUrl,
      hidden: products.hidden,
      lastSyncedAt: products.lastSyncedAt,
    })
    .from(products)
    .orderBy(desc(products.lastSyncedAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  const countQuery = db.select({ count: sql<number>`count(*)` }).from(products);

  const [rows, [countRow]] = await Promise.all([
    where ? rowsQuery.where(where) : rowsQuery,
    where ? countQuery.where(where) : countQuery,
  ]);

  const totalCount = Number(countRow?.count ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return { rows, totalCount, totalPages, currentPage: Math.min(page, totalPages), pageSize: PAGE_SIZE };
}

export class AdminProductError extends Error {}

export async function updateAdminProduct(
  id: string,
  input: { nameRu?: string | null; descriptionRu?: string | null; hidden?: boolean }
) {
  const [product] = await db.update(products).set(input).where(eq(products.id, id)).returning();
  if (!product) throw new AdminProductError("Товар не найден");
  return product;
}
