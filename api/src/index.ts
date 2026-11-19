import "dotenv/config";
import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyCors from "@fastify/cors";
import cron from "node-cron";
import { lte, sql } from "drizzle-orm";
import { db } from "./db/client.js";
import { runSyncCatalog } from "./jobs/syncCatalog.js";
import { processEmailQueue } from "./services/emailService.js";
import { passwordResets, requestLimits } from "./db/schema.js";
import { authRoutes } from "./routes/auth.js";
import { productRoutes } from "./routes/products.js";
import { cartRoutes } from "./routes/cart.js";
import { favoriteRoutes } from "./routes/favorites.js";
import { orderRoutes } from "./routes/orders.js";
import { imageRoutes } from "./routes/images.js";
import { pagesRoutes } from "./routes/pages.js";
import { adminAuthRoutes } from "./routes/adminAuth.js";
import { adminOrderRoutes } from "./routes/adminOrders.js";
import { adminProductRoutes } from "./routes/adminProducts.js";
import { adminSettingsRoutes } from "./routes/adminSettings.js";
import { adminHomeRoutes } from "./routes/adminHome.js";
import { adminPagesRoutes } from "./routes/adminPages.js";
import { adminCatalogFiltersRoutes } from "./routes/adminCatalogFilters.js";
import {
  getCheckoutTermsContent,
  getCurrentFxRate,
  getHelperFeeRub,
  getPaymentRequisitesText,
} from "./services/settingsService.js";

const app = Fastify({ logger: true, trustProxy: ["127.0.0.1", "::1"] });

// Only /api/admin/* needs CORS — the storefront (web/) is same-origin via
// Nginx and never sends cross-origin requests. The admin panel is a
// separate app/deploy (its own repo), so its origin(s) must be allowlisted
// explicitly; ADMIN_ORIGIN is a comma-separated list, defaulting to the
// admin/ Vite dev server's port for local dev.
const adminOrigins = (process.env.ADMIN_ORIGIN ?? "http://localhost:5173").split(",").map((o) => o.trim());
await app.register(fastifyCors, {
  origin: adminOrigins,
  credentials: true,
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
});

await app.register(fastifyCookie);
await app.register(authRoutes, { prefix: "/api/auth" });
await app.register(productRoutes, { prefix: "/api" });
await app.register(cartRoutes, { prefix: "/api" });
await app.register(favoriteRoutes, { prefix: "/api" });
await app.register(orderRoutes, { prefix: "/api" });
await app.register(imageRoutes, { prefix: "/api" });
await app.register(pagesRoutes, { prefix: "/api" });
await app.register(adminAuthRoutes, { prefix: "/api/admin/auth" });
await app.register(adminOrderRoutes, { prefix: "/api/admin" });
await app.register(adminProductRoutes, { prefix: "/api/admin" });
await app.register(adminSettingsRoutes, { prefix: "/api/admin" });
await app.register(adminHomeRoutes, { prefix: "/api/admin" });
await app.register(adminPagesRoutes, { prefix: "/api/admin" });
await app.register(adminCatalogFiltersRoutes, { prefix: "/api/admin" });

app.get("/health", async () => {
  await db.execute(sql`select 1`);
  return { ok: true };
});

app.get("/api/fx-rate", async () => ({ rate: await getCurrentFxRate() }));
// The "феям-помощницам" flat service fee — shown to and prepaid by the
// customer along with the items (see orderService.ts's createOrder), so the
// storefront needs to read it too, same as the fx rate above.
app.get("/api/helper-fee", async () => ({ rub: await getHelperFeeRub() }));
// Payment card/requisites text for the "Оплатить" modal on /account/orders —
// see settingsService.ts's getPaymentRequisitesText.
app.get("/api/payment-requisites", async () => ({ text: await getPaymentRequisitesText() }));
// Checkout's required consent-checkbox text + link — see
// settingsService.ts's getCheckoutTermsContent.
app.get("/api/checkout-terms", async () => getCheckoutTermsContent());

// Daily catalog + FX rate refresh, off-peak (04:00 Europe/Moscow). Runs
// in-process — no separate systemd timer/OS cron needed.
cron.schedule(
  "0 4 * * *",
  () => {
    runSyncCatalog().catch((err) => app.log.error({ err }, "syncCatalog failed"));
  },
  { timezone: "Europe/Moscow" }
);

const port = Number(process.env.PORT ?? 4000);
let sendingEmails = false;
async function deliverEmails() {
  if (sendingEmails) return;
  sendingEmails = true;
  try {
    await processEmailQueue();
    await db.delete(passwordResets).where(lte(passwordResets.expiresAt, new Date()));
    await db.delete(requestLimits).where(lte(requestLimits.expiresAt, new Date()));
  } catch {
    app.log.error("Email queue processing failed");
  } finally {
    sendingEmails = false;
  }
}
const mailTimer = setInterval(() => { void deliverEmails(); }, 30_000);
mailTimer.unref();
app.addHook("onClose", async () => { clearInterval(mailTimer); });
void deliverEmails();
app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
