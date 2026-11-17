// Seeds the full category directory (see categoryDirectory.ts) — every real
// Aroma-Zone categoryKeys tag worth keeping, translated to Russian. Slugs
// are generated (not hand-picked) since there are hundreds of these; run
// this whenever categoryDirectory.ts changes, it's idempotent.
import "dotenv/config";
import { db, pool } from "./client.js";
import { categories } from "./schema.js";
import { CATEGORY_DIRECTORY } from "./categoryDirectory.js";
import { uniqueSlug } from "./slugify.js";

async function main() {
  const taken = new Set<string>();
  const rows = CATEGORY_DIRECTORY.map(([nameFr, nameRu, isProductType]) => ({
    slug: uniqueSlug(nameRu, taken),
    nameFr,
    nameRu,
    isProductType,
  }));

  for (const row of rows) {
    await db
      .insert(categories)
      .values(row)
      .onConflictDoUpdate({
        target: categories.nameFr,
        set: { nameRu: row.nameRu, isProductType: row.isProductType },
      });
  }
  console.log(`Seeded ${rows.length} categories (${rows.filter((r) => r.isProductType).length} product-type).`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then(() => pool.end())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
