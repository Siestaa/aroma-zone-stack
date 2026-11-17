import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AdminAuthError, confirmTotpReset, startTotpReset } from "../services/adminAuthService.js";
import { requireAdmin } from "../services/adminAuthMiddleware.js";
import {
  getCheckoutTermsContent,
  getFxMarkupRub,
  getHelperFeeRub,
  getPaymentRequisitesText,
  getRawCbrRate,
  setCheckoutTermsContent,
  setFxMarkupRub,
  setHelperFeeRub,
  setPaymentRequisitesText,
} from "../services/settingsService.js";

const confirmSchema = z.object({ code: z.string().min(6).max(6) });
const helperFeeSchema = z.object({ rub: z.number().int().nonnegative() });
const fxMarkupSchema = z.object({ markupRub: z.number().int().nonnegative() });
const paymentRequisitesSchema = z.object({ text: z.string() });
const checkoutTermsSchema = z.object({
  text: z.string().min(1),
  linkText: z.string().min(1),
  linkUrl: z.url(),
});

export async function adminSettingsRoutes(app: FastifyInstance) {
  // Re-bind 2FA to a new device: start returns a fresh QR for the *new*
  // device, the old device's codes keep working until /confirm succeeds
  // (see adminAuthService.ts's startTotpReset/confirmTotpReset).
  app.post("/settings/totp/reset", async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) return;

    return startTotpReset(admin.id, admin.email);
  });

  app.post("/settings/totp/reset/confirm", async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) return;

    const parsed = confirmSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Некорректные данные" });

    try {
      await confirmTotpReset(admin.id, parsed.data.code);
    } catch (err) {
      if (err instanceof AdminAuthError) return reply.code(400).send({ error: err.message });
      throw err;
    }

    return { ok: true };
  });

  // Flat per-order service fee — payment to our fulfillment helpers
  // ("феям-помощницам") — charged to and prepaid by the customer along with
  // the items (distinct from CDEK courier delivery, paid separately by the
  // customer on receipt). See orderService.ts's createOrder for where this
  // feeds into totalRub, and settingsService.ts's getHelperFeeRub for the
  // default.
  app.get("/settings/helper-fee", async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) return;

    return { rub: await getHelperFeeRub() };
  });

  app.patch("/settings/helper-fee", async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) return;

    const parsed = helperFeeSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Некорректные данные" });

    await setHelperFeeRub(parsed.data.rub);
    return { rub: parsed.data.rub };
  });

  // Effective customer-facing EUR/RUB rate = CBR's raw daily rate (synced
  // nightly, read-only here) + an admin-editable markup — see
  // settingsService.ts's getCurrentFxRate for where the two get combined.
  app.get("/settings/fx-rate", async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) return;

    const [cbrRate, markupRub] = await Promise.all([getRawCbrRate(), getFxMarkupRub()]);
    return { cbrRate, markupRub, effectiveRate: cbrRate + markupRub };
  });

  app.patch("/settings/fx-rate", async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) return;

    const parsed = fxMarkupSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Некорректные данные" });

    await setFxMarkupRub(parsed.data.markupRub);
    return { markupRub: parsed.data.markupRub };
  });

  // Free-text card/requisites shown in the customer-facing "Оплатить" modal
  // (web/'s /account/orders/[id]) — see settingsService.ts's
  // getPaymentRequisitesText for why this is a blob of text, not fields.
  app.get("/settings/payment-requisites", async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) return;

    return { text: await getPaymentRequisitesText() };
  });

  app.patch("/settings/payment-requisites", async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) return;

    const parsed = paymentRequisitesSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Некорректные данные" });

    await setPaymentRequisitesText(parsed.data.text);
    return { text: parsed.data.text };
  });

  // Checkout's required consent checkbox ("Я ознакомлен с условиями
  // покупки") — text + inline link, shown on web/'s /checkout. See
  // settingsService.ts's getCheckoutTermsContent for the default copy.
  app.get("/settings/checkout-terms", async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) return;

    return getCheckoutTermsContent();
  });

  app.patch("/settings/checkout-terms", async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) return;

    const parsed = checkoutTermsSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Некорректные данные" });

    await setCheckoutTermsContent(parsed.data);
    return parsed.data;
  });
}
