import type { FastifyReply, FastifyRequest } from "fastify";
import { getUserBySessionToken } from "./authService.js";

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? "az_session";

export { COOKIE_NAME };

export async function getOptionalUser(request: FastifyRequest) {
  const token = request.cookies[COOKIE_NAME];
  if (!token) return null;
  return getUserBySessionToken(token);
}

/** Reads the session user, or sends a 401 and returns null. Callers must
 * `if (!user) return;` immediately after — the reply is already sent. */
export async function requireUser(request: FastifyRequest, reply: FastifyReply) {
  const user = await getOptionalUser(request);
  if (!user) {
    reply.code(401).send({ error: "Требуется вход в аккаунт" });
    return null;
  }
  return user;
}
