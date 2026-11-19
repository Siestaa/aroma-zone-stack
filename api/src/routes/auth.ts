import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  AuthError,
  createSession,
  destroySession,
  registerUser,
  updateUserProfile,
  verifyCredentials,
} from "../services/authService.js";
import { COOKIE_NAME, getOptionalUser, requireUser } from "../services/authMiddleware.js";
import { requestPasswordReset, resetPassword } from "../services/passwordResetService.js";
import { allowRequest } from "../services/requestLimitService.js";

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.email(),
  phone: z.string().min(10).optional(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

// All optional — /account/profile submits name+phone, /account/addresses
// submits city+address, and each PATCH only touches the fields it sends.
const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().min(10).nullable().optional(),
  city: z.string().min(1).nullable().optional(),
  address: z.string().min(1).nullable().optional(),
});

const isProd = process.env.NODE_ENV === "production";

function publicUser(user: {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  city: string | null;
  address: string | null;
}) {
  return { id: user.id, email: user.email, name: user.name, phone: user.phone, city: user.city, address: user.address };
}

export async function authRoutes(app: FastifyInstance) {
  app.post("/forgot-password", async (request, reply) => {
    const parsed = z.object({ email: z.email().max(254) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Введите корректный email" });
    try {
      await requestPasswordReset(parsed.data.email.trim(), request.ip);
    } catch {
      request.log.error("Password reset email could not be queued");
      return reply.code(503).send({ error: "Отправка письма временно недоступна. Попробуйте позже." });
    }
    return { ok: true, message: "Если этот email зарегистрирован, мы отправим ссылку для восстановления пароля." };
  });

  app.post("/reset-password", async (request, reply) => {
    const parsed = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/), password: z.string().min(8).max(128) }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Проверьте ссылку и пароль (от 8 до 128 символов)" });
    if (!await allowRequest("reset-attempt", request.ip, 30)) {
      return reply.code(429).send({ error: "Слишком много попыток. Попробуйте позже." });
    }
    try {
      await resetPassword(parsed.data.token, parsed.data.password);
      reply.clearCookie(COOKIE_NAME, { path: "/" });
      return { ok: true };
    } catch (err) {
      if (err instanceof AuthError) return reply.code(400).send({ error: err.message });
      throw err;
    }
  });

  app.post("/register", async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Некорректные данные", details: parsed.error.issues });

    try {
      const user = await registerUser(parsed.data);
      const session = await createSession(user.id, user.passwordHash);
      reply.setCookie(COOKIE_NAME, session.token, {
        httpOnly: true,
        secure: isProd,
        sameSite: "lax",
        path: "/",
        expires: session.expiresAt,
      });
      return publicUser(user);
    } catch (err) {
      if (err instanceof AuthError) return reply.code(409).send({ error: err.message });
      throw err;
    }
  });

  app.post("/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Некорректные данные", details: parsed.error.issues });

    try {
      const user = await verifyCredentials(parsed.data.email, parsed.data.password);
      const session = await createSession(user.id, user.passwordHash);
      reply.setCookie(COOKIE_NAME, session.token, {
        httpOnly: true,
        secure: isProd,
        sameSite: "lax",
        path: "/",
        expires: session.expiresAt,
      });
      return publicUser(user);
    } catch (err) {
      if (err instanceof AuthError) return reply.code(401).send({ error: err.message });
      throw err;
    }
  });

  app.post("/logout", async (request, reply) => {
    const token = request.cookies[COOKIE_NAME];
    if (token) await destroySession(token);
    reply.clearCookie(COOKIE_NAME, { path: "/" });
    return { ok: true };
  });

  app.get("/me", async (request, reply) => {
    const user = await getOptionalUser(request);
    if (!user) return reply.code(401).send({ error: "Не авторизован" });
    return publicUser(user);
  });

  app.patch("/me", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;

    const parsed = updateProfileSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Некорректные данные", details: parsed.error.issues });

    const updated = await updateUserProfile(user.id, parsed.data);
    return publicUser(updated);
  });
}
