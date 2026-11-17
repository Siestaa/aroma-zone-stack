import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { products, productVariants, settings } from "../db/schema.js";
import { fetchAllProducts } from "../../../scraper/algolia-client.js";
import { fetchEurRubRate } from "./fxRate.js";
import { downloadProductImage } from "../services/productImageService.js";
import { withSyncProxy } from "../services/proxyDispatcher.js";
import { translationInvalidationPatch } from "../services/translationService.js";

interface AlgoliaPriceValue {
  country: string;
  customerGroupID?: string;
  value: number;
}

interface AlgoliaVariant {
  sku: string;
  // Algolia sends `false` (not null/undefined) for non-liquid products.
  capacity?: number | false;
  capacityUnit?: string;
  images?: string[];
  isInStock?: boolean;
  prices?: { EUR?: { priceValues?: AlgoliaPriceValue[] } };
}

interface AlgoliaHit {
  objectID: string;
  slug: string;
  name: string;
  description?: string;
  key: string;
  attributes?: { "famille-technique"?: string[]; "best-seller"?: boolean; culture?: string[] };
  categoryKeys?: string[];
  reviewStatistics?: { avg?: number; count?: number };
  isAnyVariantInStock?: boolean;
  masterVariantPriceEURMax?: number;
  variants?: AlgoliaVariant[];
}

function variantPriceEurCents(hit: AlgoliaHit, variant: AlgoliaVariant): number {
  const priceValues = variant.prices?.EUR?.priceValues ?? [];
  const frRetail = priceValues.find((pv) => pv.country === "FR" && !pv.customerGroupID);
  return frRetail?.value ?? hit.masterVariantPriceEURMax ?? 0;
}

// Algolia sends `capacity: false` (not null/undefined) for non-liquid
// products like capsules — anything that isn't an actual number isn't a real
// capacity value.
function normalizeCapacity(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

// "BIO cosmétique", "BIO alimentaire", "Cosmos organic", "BIO Cosmos
// certified..." all count; "Conventionnelle"/"Sauvage"/"Ecologique" don't.
function isBio(hit: AlgoliaHit): boolean {
  const culture = hit.attributes?.culture ?? [];
  return culture.some((c) => c.toLowerCase().includes("bio") || c.toLowerCase().includes("cosmos organic"));
}

// "Main" image = cheapest variant's first photo — same "cheapest variant
// wins" convention productService/favoriteService already use for the
// catalog-card image.
function pickMainImageUrl(hit: AlgoliaHit): string | null {
  const variants = hit.variants ?? [];
  if (variants.length === 0) return null;
  const cheapest = variants.reduce((min, v) =>
    variantPriceEurCents(hit, v) < variantPriceEurCents(hit, min) ? v : min
  );
  return cheapest.images?.[0] ?? null;
}

// Only re-downloads when the source URL actually changed since the last
// sync — `sourceImageUrl` is compared against, not overwritten, on
// download failure, so a persistently-changed-but-unreachable image keeps
// retrying on every future sync instead of getting stuck.
async function resolveProductImage(
  hit: AlgoliaHit,
  existing: { sourceImageUrl: string | null } | undefined
): Promise<{ imageUrl?: string; sourceImageUrl?: string }> {
  const newSourceImageUrl = pickMainImageUrl(hit);
  if (!newSourceImageUrl || existing?.sourceImageUrl === newSourceImageUrl) return {};

  try {
    const imageUrl = await downloadProductImage(newSourceImageUrl, hit.objectID);
    return { imageUrl, sourceImageUrl: newSourceImageUrl };
  } catch (err) {
    console.warn(`[syncCatalog] image download failed for ${hit.objectID}: ${(err as Error).message}`);
    return {};
  }
}

async function upsertProduct(hit: AlgoliaHit) {
  const existing = await db.query.products.findFirst({
    where: eq(products.objectId, hit.objectID),
    columns: { sourceImageUrl: true, name: true, description: true },
  });

  const imagePatch = await resolveProductImage(hit, existing);
  const description = hit.description ?? existing?.description ?? "";
  const translationPatch = translationInvalidationPatch(existing, {
    name: hit.name,
    description,
  });

  const [row] = await db
    .insert(products)
    .values({
      objectId: hit.objectID,
      slug: hit.slug,
      name: hit.name,
      description,
      familleTechnique: (hit.attributes?.["famille-technique"] ?? []).join(", "),
      categoriesRaw: hit.categoryKeys ?? [],
      bestSeller: hit.attributes?.["best-seller"] ?? false,
      bio: isBio(hit),
      ratingAvg: hit.reviewStatistics?.avg ?? null,
      ratingCount: hit.reviewStatistics?.count ?? null,
      isAnyVariantInStock: hit.isAnyVariantInStock ?? true,
      lastSyncedAt: new Date(),
      ...imagePatch,
    })
    .onConflictDoUpdate({
      target: products.objectId,
      set: {
        slug: hit.slug,
        name: hit.name,
        description,
        familleTechnique: hit.attributes?.["famille-technique"]?.join(", "),
        categoriesRaw: hit.categoryKeys ?? [],
        bestSeller: hit.attributes?.["best-seller"] ?? false,
        bio: hit.attributes?.culture === undefined ? undefined : isBio(hit),
        ratingAvg: hit.reviewStatistics?.avg ?? null,
        ratingCount: hit.reviewStatistics?.count ?? null,
        isAnyVariantInStock: hit.isAnyVariantInStock ?? true,
        lastSyncedAt: new Date(),
        ...imagePatch,
        ...translationPatch,
      },
    })
    .returning({ id: products.id });

  if (!row) throw new Error(`Upsert of product ${hit.objectID} returned no row`);
  return row.id;
}

async function upsertVariants(hit: AlgoliaHit, productId: string) {
  for (const variant of hit.variants ?? []) {
    await db
      .insert(productVariants)
      .values({
        productId,
        sku: variant.sku,
        capacity: normalizeCapacity(variant.capacity),
        capacityUnit: variant.capacityUnit ?? null,
        priceEurCents: variantPriceEurCents(hit, variant),
        inStock: variant.isInStock ?? true,
      })
      .onConflictDoUpdate({
        target: productVariants.sku,
        set: {
          productId,
          capacity: normalizeCapacity(variant.capacity),
          capacityUnit: variant.capacityUnit ?? null,
          priceEurCents: variantPriceEurCents(hit, variant),
          inStock: variant.isInStock ?? true,
        },
      });
  }
}

async function upsertFxRate() {
  const rate = await fetchEurRubRate();
  await db
    .insert(settings)
    .values({ key: "fx_rate_eur_rub", value: { rate, updatedAt: new Date().toISOString() } })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: { rate, updatedAt: new Date().toISOString() } },
    });
  return rate;
}

export async function runSyncCatalog() {
  const startedAt = Date.now();
  let productCount = 0;
  let variantCount = 0;

  // Catalog fetch (Algolia) and per-product image downloads both go
  // through CATALOG_SYNC_PROXY when set — the FX rate fetch below
  // (a Russian domain) deliberately stays outside this, on a direct
  // connection.
  await withSyncProxy(async () => {
    const hits = (await fetchAllProducts({
      onPage: ({ page, nbPages, collected }) => console.log(`[syncCatalog] page ${page}/${nbPages}, ${collected} hits fetched`),
    })) as unknown as AlgoliaHit[];

    for (const hit of hits) {
      if (!hit.variants?.length) {
        console.warn(`[syncCatalog] no French retail price found for ${hit.objectID} (slug: ${hit.slug})`);
        continue;
      }
      try {
        const productId = await upsertProduct(hit);
        await upsertVariants(hit, productId);
        productCount++;
        variantCount += hit.variants?.length ?? 0;
      } catch (err) {
        // Aroma-Zone's own catalog occasionally has two distinct objectIDs
        // sharing the same slug (products.slug is unique, but upsertProduct's
        // ON CONFLICT only targets object_id) — on a fresh DB the second one
        // hits a unique-violation instead of just updating in place. One bad
        // hit shouldn't sink the other ~1500 good ones, so skip and log
        // rather than letting the exception abort the whole sync.
        console.warn(`[syncCatalog] upsert failed for ${hit.objectID} (slug: ${hit.slug}): ${(err as Error).message}`);
      }
    }
  });

  const rate = await upsertFxRate();

  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(
    `[syncCatalog] done in ${seconds}s — ${productCount} products, ${variantCount} variants, fx_rate_eur_rub=${rate}`
  );
  return { productCount, variantCount, rate };
}

// Only run automatically when this file is the process entry point (`npm run
// sync:catalog`), not when imported by the cron scheduler in index.ts.
if (import.meta.url === `file://${process.argv[1]}`) {
  runSyncCatalog()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
