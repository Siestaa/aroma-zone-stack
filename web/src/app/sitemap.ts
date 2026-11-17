import type { MetadataRoute } from "next";
import { API_INTERNAL_URL } from "@/lib/api/server";
import { productPath, SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const response = await fetch(`${API_INTERNAL_URL}/sitemap/products`, {
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Sitemap catalog request failed: ${response.status}`);
  const { slugs } = (await response.json()) as { slugs: string[] };
  const paths = ["/", "/catalog", "/about", "/contacts", "/delivery", "/payment", ...slugs.map(productPath)];
  return paths.map((path) => ({ url: `${SITE_URL}${path}` }));
}
