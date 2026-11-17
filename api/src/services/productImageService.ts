import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

// Product images are sourced from Aroma-Zone's own CDN
// (images.cdn.europe-west1.gcp.commercetools.com). Verified empirically:
// this CDN is unreachable for some Russian ISPs without a VPN/proxy — even
// this server's own outbound connection to it times out directly. Callers
// (syncCatalog.ts) route through CATALOG_SYNC_PROXY via
// proxyDispatcher.ts's withSyncProxy — this module just does a plain
// fetch, oblivious to whether a proxy is active. The frontend never talks
// to this CDN itself: syncCatalog.ts downloads each product's main image
// here once and stores it locally; visitors always load it from our own
// domain via routes/images.ts.
const ALLOWED_HOSTS = new Set(["images.cdn.europe-west1.gcp.commercetools.com"]);

export const IMAGE_DIR = path.join(process.cwd(), ".product-images");

function sanitizeImageKey(objectId: string): string {
  return objectId.replace(/[^a-zA-Z0-9_-]/g, "_");
}

// Downloads sourceUrl and stores it keyed by the product's Algolia
// objectID (stable across re-syncs, known before the row's own uuid
// exists) — returns the local path to store as products.imageUrl.
export async function downloadProductImage(sourceUrl: string, objectId: string): Promise<string> {
  const url = new URL(sourceUrl);
  if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname)) {
    throw new Error(`Refusing to download image from untrusted host: ${url.hostname}`);
  }

  // Fail fast rather than hanging — a sync run touches up to ~1500
  // products, and a plain request has no timeout at all (observed one hang
  // ~70s before giving up when this CDN was unreachable).
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Image download failed: ${res.status} ${sourceUrl}`);
  const body = Buffer.from(await res.arrayBuffer());

  const ext = path.extname(url.pathname).toLowerCase() || ".jpg";
  const filename = `${sanitizeImageKey(objectId)}${ext}`;

  await mkdir(IMAGE_DIR, { recursive: true });
  await writeFile(path.join(IMAGE_DIR, filename), body);

  return `/api/images/${filename}`;
}
