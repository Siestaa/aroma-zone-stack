import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/client.js";
import { mailConfigured, queueEmail } from "../services/emailService.js";
import { allowRequest } from "../services/requestLimitService.js";
import {
  getContactsPageContent,
  getInfoPageContent,
  getProductPageNote,
  type InfoPageSlug,
} from "../services/infoPagesService.js";

const INFO_PAGE_SLUGS: InfoPageSlug[] = ["about", "delivery", "payment"];

export async function pagesRoutes(app: FastifyInstance) {
  app.post("/contact", async (request, reply) => {
    const parsed = z.object({
      name: z.string().trim().min(2).max(100),
      email: z.email().max(254),
      message: z.string().trim().min(10).max(5000),
    }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Проверьте имя, email и текст сообщения (до 5000 символов)" });
    if (!await allowRequest("contact-ip", request.ip, 5)) {
      return reply.code(429).send({ error: "Слишком много сообщений. Попробуйте позже." });
    }
    if (!mailConfigured() || !process.env.CONTACT_EMAIL) {
      return reply.code(503).send({ error: "Форма временно недоступна. Напишите нам по email на странице контактов." });
    }
    await queueEmail(db, {
      recipient: process.env.CONTACT_EMAIL,
      replyTo: parsed.data.email,
      subject: "Новое обращение с сайта — Аромазон-тут",
      body: `Имя: ${parsed.data.name}\nEmail: ${parsed.data.email}\n\n${parsed.data.message}`,
    });
    return { ok: true };
  });

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
