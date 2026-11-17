import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAdmin } from "../services/adminAuthMiddleware.js";
import { getCatalogFilterCategorySlugs, setCatalogFilterCategorySlugs } from "../services/settingsService.js";

const catalogFiltersSchema = z.object({ categorySlugs: z.array(z.string()) });

// The admin's checkbox+reorder list itself is served by the full category
// directory endpoint already registered in adminHome.ts (GET /admin/categories,
// same rows the public GET /categories falls back to) — no need to duplicate
// that here, this route just owns the picked/ordered subset.
export async function adminCatalogFiltersRoutes(app: FastifyInstance) {
  app.get("/catalog-filters", async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) return;

    return { categorySlugs: await getCatalogFilterCategorySlugs() };
  });

  app.put("/catalog-filters", async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) return;

    const parsed = catalogFiltersSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Некорректные данные" });

    await setCatalogFilterCategorySlugs(parsed.data.categorySlugs);
    return { categorySlugs: parsed.data.categorySlugs };
  });
}
