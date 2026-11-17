import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAdmin } from "../services/adminAuthMiddleware.js";
import { getProductsByIds, listCategoriesWithCounts } from "../services/productService.js";
import {
  getFooterCategorySlugs,
  getHomeCategorySlugs,
  getHomeHeroText,
  getHomeProductIds,
  setFooterCategorySlugs,
  setHomeCategorySlugs,
  setHomeHeroText,
  setHomeProductIds,
} from "../services/settingsService.js";

const homeConfigSchema = z.object({
  categorySlugs: z.array(z.string()),
  productIds: z.array(z.string()),
  hero: z.object({
    eyebrow: z.string(),
    title: z.string(),
    lede: z.string(),
  }),
  footerCategorySlugs: z.array(z.string()),
});

async function resolveHomeConfig() {
  const [categorySlugs, productIds, hero, footerCategorySlugs] = await Promise.all([
    getHomeCategorySlugs(),
    getHomeProductIds(),
    getHomeHeroText(),
    getFooterCategorySlugs(),
  ]);
  const products = await getProductsByIds(productIds);
  return {
    categorySlugs,
    products: products.map((p) => ({ id: p.id, slug: p.slug, name: p.name, imageUrl: p.imageUrl })),
    hero,
    footerCategorySlugs,
  };
}

export async function adminHomeRoutes(app: FastifyInstance) {
  // Full product-type category directory for the "Главная" picker's
  // checkbox list — same rows GET /api/categories returns publicly, just
  // admin-auth-gated instead of CORS-open (admin/ only has CORS for
  // /api/admin/*, see index.ts).
  app.get("/categories", async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) return;

    const categories = await listCategoriesWithCounts();
    return { categories };
  });

  app.get("/home-config", async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) return;

    return resolveHomeConfig();
  });

  app.put("/home-config", async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) return;

    const parsed = homeConfigSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Некорректные данные" });

    await Promise.all([
      setHomeCategorySlugs(parsed.data.categorySlugs),
      setHomeProductIds(parsed.data.productIds),
      setHomeHeroText(parsed.data.hero),
      setFooterCategorySlugs(parsed.data.footerCategorySlugs),
    ]);

    return resolveHomeConfig();
  });
}
