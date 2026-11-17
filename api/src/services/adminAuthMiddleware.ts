import type { FastifyReply, FastifyRequest } from "fastify";
import { getAdminBySessionToken } from "./adminAuthService.js";

// Deliberately a different cookie name from the storefront's session cookie
// (COOKIE_NAME in authMiddleware.ts) — admin and customer sessions must
// never be readable by each other's code path.
const ADMIN_COOKIE_NAME = process.env.ADMIN_SESSION_COOKIE_NAME ?? "az_admin_session";

export { ADMIN_COOKIE_NAME };

export async function getOptionalAdmin(request: FastifyRequest) {
  const token = request.cookies[ADMIN_COOKIE_NAME];
  if (!token) return null;
  return getAdminBySessionToken(token);
}

/** Reads the admin session, or sends a 401 and returns null. Callers must
 * `if (!admin) return;` immediately after — the reply is already sent. */
export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  const admin = await getOptionalAdmin(request);
  if (!admin) {
    reply.code(401).send({ error: "Требуется вход в админку" });
    return null;
  }
  return admin;
}
