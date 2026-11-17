import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { favorites, products, productVariants } from "../db/schema.js";
import { getCurrentFxRate } from "./settingsService.js";
import { displayName } from "./translationService.js";

// Same aggregation shape as productService.listProducts — response is
// ProductListItem-compatible on purpose, so the frontend can reuse
// ProductGrid/ProductCard directly for the favorites page instead of a
// separate rendering path.
const minPriceEurCents = sql<number>`min(${productVariants.priceEurCents})`;
const anyInStock = sql<boolean>`bool_or(${productVariants.inStock})`;
const representativeFormatType = sql<string | null>`(array_agg(${productVariants.formatType} order by ${productVariants.priceEurCents}))[1]`;
const representativeVariantId = sql<string>`(array_agg(${productVariants.id} order by ${productVariants.priceEurCents}))[1]`;
const representativeSku = sql<string>`(array_agg(${productVariants.sku} order by ${productVariants.priceEurCents}))[1]`;
const representativeCapacity = sql<number | null>`(array_agg(${productVariants.capacity} order by ${productVariants.priceEurCents}))[1]`;
const representativeCapacityUnit = sql<string | null>`(array_agg(${productVariants.capacityUnit} order by ${productVariants.priceEurCents}))[1]`;

export async function listFavorites(userId: string) {
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
      addedAt: sql<Date>`max(${favorites.createdAt})`,
    })
    .from(favorites)
    .innerJoin(products, eq(products.id, favorites.productId))
    .innerJoin(productVariants, eq(productVariants.productId, products.id))
    .where(eq(favorites.userId, userId))
    .groupBy(products.id)
    .orderBy(sql`max(${favorites.createdAt}) desc`);

  const fxRate = await getCurrentFxRate();
  return rows.map(({ nameRu, ...r }) => ({
    ...r,
    name: displayName({ name: r.name, nameRu }),
    nameOriginal: r.name,
    approxRub: Math.round((r.minPriceEurCents / 100) * fxRate),
  }));
}

export async function addFavorite(userId: string, productId: string) {
  await db.insert(favorites).values({ userId, productId }).onConflictDoNothing();
}

export async function removeFavorite(userId: string, productId: string) {
  await db.delete(favorites).where(and(eq(favorites.userId, userId), eq(favorites.productId, productId)));
}
