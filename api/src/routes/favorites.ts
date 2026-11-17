import type { FastifyInstance } from "fastify";
import { requireUser } from "../services/authMiddleware.js";
import { addFavorite, listFavorites, removeFavorite } from "../services/favoriteService.js";

export async function favoriteRoutes(app: FastifyInstance) {
  app.get("/favorites", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    return { favorites: await listFavorites(user.id) };
  });

  app.post<{ Params: { productId: string } }>("/favorites/:productId", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    await addFavorite(user.id, request.params.productId);
    return { favorites: await listFavorites(user.id) };
  });

  app.delete<{ Params: { productId: string } }>("/favorites/:productId", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    await removeFavorite(user.id, request.params.productId);
    return { favorites: await listFavorites(user.id) };
  });
}
