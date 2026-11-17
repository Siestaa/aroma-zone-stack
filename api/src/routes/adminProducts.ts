import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAdmin } from "../services/adminAuthMiddleware.js";
import { AdminProductError, listAdminProducts, updateAdminProduct } from "../services/adminProductService.js";
import { getLastSyncedAt, getNextScheduledSyncAt, isSyncRunning, triggerCatalogSync } from "../services/syncStatusService.js";

const listQuerySchema = z.object({
  untranslated: z.coerce.boolean().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
});

const updateSchema = z.object({
  nameRu: z.string().min(1).nullable().optional(),
  descriptionRu: z.string().nullable().optional(),
  hidden: z.boolean().optional(),
});

export async function adminProductRoutes(app: FastifyInstance) {
  app.get("/products/sync-status", async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) return;

    return {
      running: isSyncRunning(),
      lastSyncedAt: await getLastSyncedAt(),
      nextScheduledAt: getNextScheduledSyncAt(),
    };
  });

  app.post("/products/sync", async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) return;

    return triggerCatalogSync();
  });

  app.get("/products", async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) return;

    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: "Некорректные параметры" });

    return listAdminProducts({
      untranslatedOnly: parsed.data.untranslated,
      query: parsed.data.q,
      page: parsed.data.page,
    });
  });

  app.patch<{ Params: { id: string } }>("/products/:id", async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) return;

    const parsed = updateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Некорректные данные" });

    try {
      return await updateAdminProduct(request.params.id, parsed.data);
    } catch (err) {
      if (err instanceof AdminProductError) return reply.code(404).send({ error: err.message });
      throw err;
    }
  });
}
