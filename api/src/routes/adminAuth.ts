import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  AdminAuthError,
  confirmTotpSetup,
  consumePendingLogin,
  createAdminSession,
  createPendingLogin,
  destroyAdminSession,
  resolvePendingLogin,
  startTotpSetup,
  verifyAdminCredentials,
  verifyTotpCode,
} from "../services/adminAuthService.js";
import { ADMIN_COOKIE_NAME, getOptionalAdmin } from "../services/adminAuthMiddleware.js";
import { db } from "../db/client.js";
import { adminUsers } from "../db/schema.js";
import { eq } from "drizzle-orm";

const loginSchema = z.object({ email: z.email(), password: z.string().min(1) });
const totpSchema = z.object({ pendingToken: z.string().min(1), code: z.string().min(6).max(6) });

const isProd = process.env.NODE_ENV === "production";

function publicAdmin(admin: { id: string; email: string; totpEnabled: boolean }) {
  return { id: admin.id, email: admin.email, totpEnabled: admin.totpEnabled };
}

function setAdminCookie(reply: import("fastify").FastifyReply, token: string, expiresAt: Date) {
  reply.setCookie(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

// Dev-only escape hatch — skips the TOTP step entirely after a correct
// password, so a broken/desynced authenticator can't block local admin
// panel work. The admin's totpSecret/totpEnabled in the DB are untouched,
// so flipping this back off (or just not setting it) resumes normal 2FA
// with the same device, no re-scan needed. NEVER set this in production —
// there's no corresponding prod safeguard, it's a raw bypass.
const disable2fa = process.env.ADMIN_DISABLE_2FA === "true";

export async function adminAuthRoutes(app: FastifyInstance) {
  // Step 1: password. If TOTP is already enabled, respond with a
  // pendingToken and wait for /verify-totp. If this admin has never
  // finished 2FA setup, generate a fresh secret + QR right here — there is
  // no separate "register" flow, admin accounts are seeded by hand
  // (see src/db/seedAdmin.ts) and always go through setup on first login.
  app.post("/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Некорректные данные" });

    try {
      const admin = await verifyAdminCredentials(parsed.data.email, parsed.data.password);

      if (disable2fa) {
        const session = await createAdminSession(admin.id);
        setAdminCookie(reply, session.token, session.expiresAt);
        return { step: "done", ...publicAdmin(admin) };
      }

      const pendingToken = createPendingLogin(admin.id);

      if (!admin.totpEnabled) {
        const { qrDataUrl } = await startTotpSetup(admin.id, admin.email);
        return { step: "totp-setup", pendingToken, qrDataUrl };
      }

      return { step: "totp-verify", pendingToken };
    } catch (err) {
      if (err instanceof AdminAuthError) return reply.code(401).send({ error: err.message });
      throw err;
    }
  });

  // Step 2a: first-time setup — confirm the code the admin just scanned,
  // which both proves they saved it and flips totpEnabled on.
  app.post("/setup-totp", async (request, reply) => {
    const parsed = totpSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Некорректные данные" });

    const adminUserId = resolvePendingLogin(parsed.data.pendingToken);
    if (!adminUserId) return reply.code(401).send({ error: "Сессия входа истекла, войдите заново" });

    try {
      await confirmTotpSetup(adminUserId, parsed.data.code);
    } catch (err) {
      if (err instanceof AdminAuthError) return reply.code(401).send({ error: err.message });
      throw err;
    }

    consumePendingLogin(parsed.data.pendingToken);
    const session = await createAdminSession(adminUserId);
    setAdminCookie(reply, session.token, session.expiresAt);
    const admin = await db.query.adminUsers.findFirst({ where: eq(adminUsers.id, adminUserId) });
    if (!admin) throw new Error("Admin disappeared mid-login");
    return publicAdmin(admin);
  });

  // Step 2b: normal login — verify the 6-digit code from an already-set-up
  // authenticator app.
  app.post("/verify-totp", async (request, reply) => {
    const parsed = totpSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Некорректные данные" });

    const adminUserId = resolvePendingLogin(parsed.data.pendingToken);
    if (!adminUserId) return reply.code(401).send({ error: "Сессия входа истекла, войдите заново" });

    const admin = await db.query.adminUsers.findFirst({ where: eq(adminUsers.id, adminUserId) });
    if (!admin?.totpSecret || !(await verifyTotpCode(admin.totpSecret, parsed.data.code))) {
      return reply.code(401).send({ error: "Неверный код" });
    }

    consumePendingLogin(parsed.data.pendingToken);
    const session = await createAdminSession(admin.id);
    setAdminCookie(reply, session.token, session.expiresAt);
    return publicAdmin(admin);
  });

  app.post("/logout", async (request, reply) => {
    const token = request.cookies[ADMIN_COOKIE_NAME];
    if (token) await destroyAdminSession(token);
    reply.clearCookie(ADMIN_COOKIE_NAME, { path: "/" });
    return { ok: true };
  });

  app.get("/me", async (request, reply) => {
    const admin = await getOptionalAdmin(request);
    if (!admin) return reply.code(401).send({ error: "Не авторизован" });
    return publicAdmin(admin);
  });
}
