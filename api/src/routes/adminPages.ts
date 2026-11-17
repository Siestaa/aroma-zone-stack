import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAdmin } from "../services/adminAuthMiddleware.js";
import {
  getContactsPageContent,
  getInfoPageContent,
  getProductPageNote,
  setContactsPageContent,
  setInfoPageContent,
  setProductPageNote,
  type InfoPageSlug,
} from "../services/infoPagesService.js";

const INFO_PAGE_SLUGS: InfoPageSlug[] = ["about", "delivery", "payment"];

const blockSchema = z.object({ title: z.string(), body: z.string() });
const infoPageSchema = z.object({
  eyebrow: z.string(),
  title: z.string(),
  lede: z.string(),
  blocks: z.array(blockSchema),
  note: z.string().optional(),
});
const contactsPageSchema = z.object({
  email: z.string(),
  communityText: z.string(),
  communityLinkText: z.string(),
  communityLinkUrl: z.string(),
});
const productPageNoteSchema = z.object({ title: z.string(), body: z.string() });

export async function adminPagesRoutes(app: FastifyInstance) {
  app.get<{ Params: { slug: string } }>("/pages/:slug", async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) return;

    const { slug } = request.params;
    if (!INFO_PAGE_SLUGS.includes(slug as InfoPageSlug)) {
      return reply.code(404).send({ error: "Страница не найдена" });
    }
    return getInfoPageContent(slug as InfoPageSlug);
  });

  app.put<{ Params: { slug: string } }>("/pages/:slug", async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) return;

    const { slug } = request.params;
    if (!INFO_PAGE_SLUGS.includes(slug as InfoPageSlug)) {
      return reply.code(404).send({ error: "Страница не найдена" });
    }
    const parsed = infoPageSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Некорректные данные" });

    await setInfoPageContent(slug as InfoPageSlug, parsed.data);
    return getInfoPageContent(slug as InfoPageSlug);
  });

  app.get("/pages/contacts", async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) return;

    return getContactsPageContent();
  });

  app.put("/pages/contacts", async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) return;

    const parsed = contactsPageSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Некорректные данные" });

    await setContactsPageContent(parsed.data);
    return getContactsPageContent();
  });

  app.get("/pages/product-note", async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) return;

    return getProductPageNote();
  });

  app.put("/pages/product-note", async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) return;

    const parsed = productPageNoteSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Некорректные данные" });

    await setProductPageNote(parsed.data);
    return getProductPageNote();
  });
}
