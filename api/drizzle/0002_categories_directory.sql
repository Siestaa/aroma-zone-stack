-- Categories redesign: many-to-many via categories_raw JSONB containment
-- instead of a single products.category_slug FK. The old 6-category seed
-- data is being fully replaced by the new directory (see
-- src/db/categoryDirectory.ts + seedCategories.ts), so it's safe to clear
-- the table here rather than migrate the old rows in place.

ALTER TABLE "products" DROP COLUMN IF EXISTS "category_slug";

TRUNCATE TABLE "categories";

ALTER TABLE "categories" DROP COLUMN IF EXISTS "name";
ALTER TABLE "categories" ADD COLUMN "name_fr" text NOT NULL;
ALTER TABLE "categories" ADD COLUMN "name_ru" text NOT NULL;
ALTER TABLE "categories" ADD COLUMN "is_product_type" boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "categories_name_fr_idx" ON "categories" USING btree ("name_fr");
CREATE INDEX "products_categories_raw_gin_idx" ON "products" USING gin ("categories_raw");
