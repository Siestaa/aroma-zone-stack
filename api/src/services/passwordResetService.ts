import { createHash, randomBytes } from "node:crypto";
import * as argon2 from "argon2";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { passwordResets, sessions, users } from "../db/schema.js";
import { AuthError } from "./authService.js";
import { mailConfigured, publicWebUrl, queueTemplatedEmail } from "./emailService.js";
import { allowRequest } from "./requestLimitService.js";

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function requestPasswordReset(email: string, ip: string): Promise<void> {
  const allowedIp = await allowRequest("reset-ip", ip, 20);
  const allowedEmail = await allowRequest("reset-email", email.toLowerCase(), 5);
  if (!allowedIp || !allowedEmail) return;
  if (!mailConfigured()) throw new Error("Email delivery is not configured");

  await db.transaction(async (tx) => {
    // Old accounts may have mixed-case email addresses. Refuse ambiguous matches.
    const matches = await tx.select().from(users)
      .where(sql`lower(${users.email}) = ${email.toLowerCase()}`).for("update");
    if (matches.length !== 1) return;
    const user = matches[0]!;
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const tokenHash = hashToken(token);
    await tx.insert(passwordResets).values({ userId: user.id, tokenHash, passwordHash: user.passwordHash, expiresAt })
      .onConflictDoUpdate({ target: passwordResets.userId, set: { tokenHash, passwordHash: user.passwordHash, expiresAt } });
    const link = new URL("/account/reset-password", publicWebUrl());
    // The fragment stays out of HTTP access logs and referrer headers.
    link.hash = `token=${token}`;
    await queueTemplatedEmail(tx, "password_reset", {
      recipient: user.email,
      variables: { name: user.name },
      actionUrl: link.href,
      expiresAt,
    });
  });
}

export async function resetPassword(token: string, password: string): Promise<void> {
  const tokenHash = hashToken(token);
  const [candidate] = await db.select().from(passwordResets)
    .where(and(eq(passwordResets.tokenHash, tokenHash), gt(passwordResets.expiresAt, new Date())));
  if (!candidate) throw new AuthError("Ссылка недействительна или истекла. Запросите новую.");
  const passwordHash = await argon2.hash(password);
  await db.transaction(async (tx) => {
    // Lock in the same order as reset requests, serializing competing attempts.
    const [user] = await tx.select().from(users).where(eq(users.id, candidate.userId)).for("update");
    const [reset] = await tx.delete(passwordResets)
      .where(and(eq(passwordResets.userId, candidate.userId), eq(passwordResets.tokenHash, tokenHash), gt(passwordResets.expiresAt, new Date())))
      .returning();
    if (!reset || !user || user.passwordHash !== reset.passwordHash) {
      throw new AuthError("Ссылка недействительна или истекла. Запросите новую.");
    }
    await tx.update(users).set({ passwordHash }).where(eq(users.id, user.id));
    await tx.delete(sessions).where(eq(sessions.userId, user.id));
    await queueTemplatedEmail(tx, "password_changed", {
      recipient: user.email,
      variables: { name: user.name },
      actionUrl: new URL("/account", publicWebUrl()).href,
    });
  });
}
