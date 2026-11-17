import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireUser } from "../services/authMiddleware.js";
import { addToCart, clearCart, getCart, removeCartItem, setCartItemQty } from "../services/cartService.js";

const addSchema = z.object({ productVariantId: z.string(), qty: z.number().int().positive() });
const qtySchema = z.object({ qty: z.number().int() });

export async function cartRoutes(app: FastifyInstance) {
  app.get("/cart", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    return { items: await getCart(user.id) };
  });

  app.post("/cart/items", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const parsed = addSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Некорректные данные" });
    await addToCart(user.id, parsed.data.productVariantId, parsed.data.qty);
    return { items: await getCart(user.id) };
  });

  app.patch<{ Params: { id: string } }>("/cart/items/:id", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const parsed = qtySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Некорректные данные" });
    await setCartItemQty(user.id, request.params.id, parsed.data.qty);
    return { items: await getCart(user.id) };
  });

  app.delete<{ Params: { id: string } }>("/cart/items/:id", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    await removeCartItem(user.id, request.params.id);
    return { items: await getCart(user.id) };
  });

  app.delete("/cart", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    await clearCart(user.id);
    return { items: [] };
  });
}
