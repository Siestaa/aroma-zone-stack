// CLI wrapper around algolia-client.js — dumps the catalog to CSV.
import { writeFileSync } from "node:fs";
import { fetchAllProducts } from "./algolia-client.js";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  })
);
const LIMIT = args.limit ? parseInt(args.limit, 10) : Infinity;
const OUT_PATH = args.out ?? "output.csv";

const CSV_COLUMNS = [
  "objectID",
  "sku",
  "slug",
  "name",
  "familleTechnique",
  "categories",
  "priceEur",
  "capacity",
  "capacityUnit",
  "imageUrl",
  "bestSeller",
  "inStock",
  "ratingAvg",
  "ratingCount",
  "description",
];

function csvEscape(value) {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsvRow(fields) {
  return CSV_COLUMNS.map((c) => csvEscape(fields[c])).join(",");
}

function extractRow(hit) {
  const variant = hit.variants?.[0];
  const priceValues = variant?.prices?.EUR?.priceValues ?? [];
  const frRetail = priceValues.find((pv) => pv.country === "FR" && !pv.customerGroupID);
  const priceMinor = frRetail?.value ?? hit.masterVariantPriceEURMax ?? null;

  return {
    objectID: hit.objectID,
    sku: hit.key,
    slug: hit.slug,
    name: hit.name,
    // "famille-technique" is coarse (Beauté / Nutrition) but at least a real
    // taxonomy value. categoryKeys mixes real categories with ~50 marketing
    // collections per product ("Idées cadeaux", "Promotions", "Nouveautés"...)
    // with no marker for which is which — kept raw here for manual review,
    // don't treat categoryKeys[0] as *the* category.
    familleTechnique: (hit.attributes?.["famille-technique"] ?? []).join("; "),
    categories: (hit.categoryKeys ?? []).join("; "),
    priceEur: priceMinor !== null ? (priceMinor / 100).toFixed(2) : "",
    capacity: variant?.capacity ?? "",
    capacityUnit: variant?.capacityUnit ?? "",
    imageUrl: variant?.images?.[0] ?? "",
    bestSeller: hit.attributes?.["best-seller"] ?? false,
    inStock: hit.isAnyVariantInStock ?? "",
    ratingAvg: hit.reviewStatistics?.avg ?? "",
    ratingCount: hit.reviewStatistics?.count ?? "",
    description: (hit.description ?? "").replace(/\s+/g, " ").trim(),
  };
}

async function main() {
  const rows = [CSV_COLUMNS.join(",")];

  const hits = await fetchAllProducts({
    limit: LIMIT,
    onPage: ({ page, nbPages, nbHits, collected }) =>
      console.log(`Page ${page}/${nbPages} — collected ${collected} so far (nbHits total: ${nbHits})`),
  });

  for (const hit of hits) {
    const row = extractRow(hit);
    rows.push(toCsvRow(row));
    console.log(`  [${rows.length - 1}] ${row.sku}  ${row.priceEur}EUR  "${row.name}"`);
  }

  writeFileSync(OUT_PATH, rows.join("\n") + "\n", "utf-8");
  console.log(`\nDone. Wrote ${hits.length} rows to ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
