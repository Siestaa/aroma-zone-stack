import "dotenv/config";
import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { db } from "../src/db/client.js";
import { products } from "../src/db/schema.js";

const path = process.argv[2];
if (!path) {
  console.error("Usage: tsx scripts/applyTranslations.ts <file.json>");
  process.exit(1);
}

const entries: Array<{ objectId: string; nameRu: string; descriptionRu: string }> = JSON.parse(readFileSync(path, "utf8"));

for (const e of entries) {
  await db.update(products).set({ nameRu: e.nameRu, descriptionRu: e.descriptionRu }).where(eq(products.objectId, e.objectId));
}

console.log(`Applied ${entries.length} translations.`);
process.exit(0);
