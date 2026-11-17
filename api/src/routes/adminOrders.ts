import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAdmin } from "../services/adminAuthMiddleware.js";
import {
  AdminOrderError,
  getOrderById,
  listOrders,
  markOrderViewedByAdmin,
  updateOrderStatus,
  updateOrderTrackingUrl,
} from "../services/adminOrderService.js";
import { orderStatusEnum } from "../db/schema.js";

const listQuerySchema = z.object({
  status: z.enum(orderStatusEnum.enumValues).optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
});

const updateStatusSchema = z.object({ status: z.enum(orderStatusEnum.enumValues) });
const updateTrackingUrlSchema = z.object({ trackingUrl: z.string().trim().min(1).nullable() });

export async function adminOrderRoutes(app: FastifyInstance) {
  app.get("/orders", async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) return;

    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: "Некорректные параметры" });

    return listOrders({ status: parsed.data.status, query: parsed.data.q, page: parsed.data.page });
  });

  app.get<{ Params: { id: string } }>("/orders/:id", async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) return;

    const order = await getOrderById(request.params.id);
    if (!order) return reply.code(404).send({ error: "Заказ не найден" });
    await markOrderViewedByAdmin(order.id);
    return order;
  });

  app.patch<{ Params: { id: string } }>("/orders/:id/status", async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) return;

    const parsed = updateStatusSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Некорректные данные" });

    try {
      return await updateOrderStatus(request.params.id, parsed.data.status);
    } catch (err) {
      if (err instanceof AdminOrderError) return reply.code(404).send({ error: err.message });
      throw err;
    }
  });

  app.patch<{ Params: { id: string } }>("/orders/:id/tracking-url", async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) return;

    const parsed = updateTrackingUrlSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Некорректные данные" });

    try {
      return await updateOrderTrackingUrl(request.params.id, parsed.data.trackingUrl);
    } catch (err) {
      if (err instanceof AdminOrderError) return reply.code(404).send({ error: err.message });
      throw err;
    }
  });
}
