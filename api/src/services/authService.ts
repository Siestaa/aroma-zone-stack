import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import * as argon2 from "argon2";
import { db } from "../db/client.js";
import { sessions, users } from "../db/schema.js";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export class AuthError extends Error {}

export async function registerUser(input: { email: string; phone?: string; name: string; password: string }) {
  const existing = await db.query.users.findFirst({ where: eq(users.email, input.email) });
  if (existing) throw new AuthError("Этот email уже зарегистрирован");

  const passwordHash = await argon2.hash(input.password);
  const [user] = await db
    .insert(users)
    .values({ email: input.email, phone: input.phone ?? null, name: input.name, passwordHash })
    .returning();
  if (!user) throw new Error("Insert returned no user row");
  return user;
}

export async function verifyCredentials(email: string, password: string) {
  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user) throw new AuthError("Неверный email или пароль");

  const valid = await argon2.verify(user.passwordHash, password);
  if (!valid) throw new AuthError("Неверный email или пароль");

  return user;
}

export async function createSession(userId: string, expectedPasswordHash?: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.transaction(async (tx) => {
    const [user] = await tx.select({ passwordHash: users.passwordHash }).from(users)
      .where(eq(users.id, userId)).for("update");
    if (!user || (expectedPasswordHash !== undefined && user.passwordHash !== expectedPasswordHash)) {
      throw new AuthError("Пароль изменён. Войдите с новым паролем.");
    }
    await tx.insert(sessions).values({ token, userId, expiresAt });
  });
  return { token, expiresAt };
}

export async function destroySession(token: string) {
  await db.delete(sessions).where(eq(sessions.token, token));
}

export async function updateUserProfile(
  userId: string,
  input: { name?: string; phone?: string | null; city?: string | null; address?: string | null },
) {
  const [user] = await db.update(users).set(input).where(eq(users.id, userId)).returning();
  if (!user) throw new AuthError("Пользователь не найден");
  return user;
}

export async function getUserBySessionToken(token: string) {
  const session = await db.query.sessions.findFirst({ where: eq(sessions.token, token) });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await destroySession(token);
    return null;
  }
  const user = await db.query.users.findFirst({ where: eq(users.id, session.userId) });
  return user ?? null;
}
