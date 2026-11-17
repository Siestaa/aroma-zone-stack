ALTER TABLE "products" ADD COLUMN "image_url" text;
ALTER TABLE "products" ADD COLUMN "source_image_url" text;
ALTER TABLE "product_variants" DROP COLUMN "image_url";
