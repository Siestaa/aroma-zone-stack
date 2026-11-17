import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getOptionalUser, requireUser } from "../services/authMiddleware.js";
import { createOrder, getMyOrderById, listMyOrders, markOrderPaidByCustomer, OrderError } from "../services/orderService.js";

const createOrderSchema = z
  .object({
    items: z.array(z.object({ productVariantId: z.string(), qty: z.number().int().positive() })).min(1),
    fulfillment: z.enum(["pickup", "post", "cdek"]),
    city: z.string().optional(),
    address: z.string().optional(),
    comment: z.string().optional(),
    contactName: z.string().min(2),
    contactEmail: z.email(),
    contactPhone: z.string().min(10),
  })
  .refine((data) => data.fulfillment === "pickup" || Boolean(data.city?.trim()), {
    message: "Укажите город",
    path: ["city"],
  })
  .refine((data) => data.fulfillment === "pickup" || Boolean(data.address?.trim()), {
    message: "Укажите адрес доставки",
    path: ["address"],
  });

export async function orderRoutes(app: FastifyInstance) {
  app.post("/orders", async (request, reply) => {
    const parsed = createOrderSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Некорректные данные", details: parsed.error.issues });

    const user = await getOptionalUser(request);

    try {
      const order = await createOrder({ ...parsed.data, userId: user?.id ?? null });
      return order;
    } catch (err) {
      if (err instanceof OrderError) return reply.code(400).send({ error: err.message });
      throw err;
    }
  });

  app.get("/orders", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    return { orders: await listMyOrders(user.id) };
  });

  app.get<{ Params: { id: string } }>("/orders/:id", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;

    const order = await getMyOrderById(user.id, request.params.id);
    if (!order) return reply.code(404).send({ error: "Заказ не найден" });
    return order;
  });

  app.post<{ Params: { id: string } }>("/orders/:id/mark-paid", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;

    const order = await markOrderPaidByCustomer(user.id, request.params.id);
    if (!order) return reply.code(404).send({ error: "Заказ не найден" });
    return order;
  });
}
