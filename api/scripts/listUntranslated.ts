import "dotenv/config";
import { isNull, or, desc, sql } from "drizzle-orm";
import { db } from "../src/db/client.js";
import { products } from "../src/db/schema.js";

const limit = Number(process.argv[2] ?? 50);

const rows = await db
  .select({ objectId: products.objectId, name: products.name, description: products.description })
  .from(products)
  .where(or(isNull(products.nameRu), isNull(products.descriptionRu)))
  .orderBy(desc(products.bestSeller), desc(sql`coalesce(${products.ratingCount}, 0)`))
  .limit(limit);

console.log(JSON.stringify(rows, null, 2));
process.exit(0);
