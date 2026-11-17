import type { FastifyInstance } from "fastify";
import {
  getContactsPageContent,
  getInfoPageContent,
  getProductPageNote,
  type InfoPageSlug,
} from "../services/infoPagesService.js";

const INFO_PAGE_SLUGS: InfoPageSlug[] = ["about", "delivery", "payment"];

export async function pagesRoutes(app: FastifyInstance) {
  app.get<{ Params: { slug: string } }>("/pages/:slug", async (request, reply) => {
    const { slug } = request.params;
    if (!INFO_PAGE_SLUGS.includes(slug as InfoPageSlug)) {
      return reply.code(404).send({ error: "Страница не найдена" });
    }
    return getInfoPageContent(slug as InfoPageSlug);
  });

  app.get("/pages/contacts", async () => getContactsPageContent());

  // Second accordion item on every /product/[slug] page (see
  // infoPagesService.ts's ProductPageNote comment) — not part of the
  // :slug route above since it's not a whole page, just the one note.
  app.get("/pages/product-note", async () => getProductPageNote());
}
